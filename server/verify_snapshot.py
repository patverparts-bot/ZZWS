"""Reconstruct application rows in isolated, in-memory SQLite; never restore live data.

Reads a decrypted snapshot from stdin. Outputs only a non-sensitive summary.
Live Supabase Auth is outside this rehearsal. Credential material already held
inside owner recovery archives is verified as part of those private archives.
Canonical payload_text must be parsed directly by PostgreSQL on recovery, rather
than round-tripped through a JSON number serializer.
"""
import hashlib
import json
import re
import sqlite3
import sys
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from datetime import datetime
from uuid import UUID


def verify_buyer_offers(tables, users, versions):
    rows = tables.get('buyer_offers', [])
    identities, offer_numbers = set(), set()
    for row in rows:
        identity = row.get('id')
        if not isinstance(identity, str) or not identity or identity in identities:
            raise ValueError('buyer_offer_identity_invalid')
        identities.add(identity)
        if row.get('actor_id') not in users:
            raise ValueError('missing_owner')
        if row.get('catalog_version') and row['catalog_version'] not in versions:
            raise ValueError('missing_price_version')
        name, phone = row.get('buyer_name'), row.get('buyer_phone')
        if (not isinstance(name, str) or not name.strip() or len(name) > 200
                or re.search(r'[\x00-\x1f\x7f]', name)
                or not isinstance(phone, str) or not re.fullmatch(r'\+[1-9]\d{7,14}', phone)):
            raise ValueError('buyer_offer_contact_invalid')
        markup = Decimal(str(row.get('markup_percent')))
        if not markup.is_finite() or not 0 <= markup <= 1000:
            raise ValueError('buyer_offer_amount_invalid')
        source = row.get('source', 'catalog')
        base_cart = row.get('base_cart', {})
        if (source not in {'catalog', 'cart', 'selection', 'product', 'bundle'}
                or not isinstance(base_cart, dict) or len(base_cart) > 5000
                or (source != 'cart' and base_cart)):
            raise ValueError('buyer_offer_state_invalid')
        for sku, item in base_cart.items():
            if (not isinstance(sku, str) or not 1 <= len(sku) <= 100 or sku in {'__proto__', 'prototype', 'constructor'}
                    or not isinstance(item, dict) or set(item) != {'qty'} or isinstance(item['qty'], bool)):
                raise ValueError('buyer_offer_lines_invalid')
            quantity = Decimal(str(item['qty']))
            if not quantity.is_finite() or quantity != int(quantity) or not 1 <= quantity <= 1000000:
                raise ValueError('buyer_offer_amount_invalid')
        state = row.get('state')
        number = row.get('offer_number')
        if state == 'draft':
            if number is not None:
                raise ValueError('buyer_offer_number_invalid')
        elif (isinstance(number, bool) or not isinstance(number, int)
                or not 1 <= number <= 9007199254740991 or number in offer_numbers):
            raise ValueError('buyer_offer_number_invalid')
        else:
            offer_numbers.add(number)
        public, internal, request = (row.get(key) for key in ('public_lines', 'internal_lines', 'request_lines'))
        if state not in {'draft', 'finalized', 'handed_off'} or any(not isinstance(value, list) for value in (public, internal, request)):
            raise ValueError('buyer_offer_state_invalid')
        if state == 'draft':
            if (public or internal or request or row.get('finalized_at') or row.get('handed_off_at')
                    or Decimal(str(row.get('total', 0))) != 0 or Decimal(str(row.get('expected_profit', 0))) != 0):
                raise ValueError('buyer_offer_state_invalid')
            continue
        if (not row.get('catalog_version') or not row.get('rules_revision') or row.get('profile_revision') is None
                or not row.get('finalized_at') or not row.get('finalize_request')
                or (state == 'handed_off') != bool(row.get('handed_off_at'))
                or not 1 <= len(public) <= 500 or len(internal) != len(public) or len(request) != len(public)):
            raise ValueError('buyer_offer_state_invalid')
        if any(not isinstance(item, dict) for items in (public, internal, request) for item in items):
            raise ValueError('buyer_offer_lines_invalid')
        costs = {item.get('articul'): item for item in internal}
        inputs = {item.get('articul'): item for item in request}
        skus = {item.get('articul') for item in public}
        if len(skus) != len(public) or len(costs) != len(public) or len(inputs) != len(public) or skus != set(costs) or skus != set(inputs):
            raise ValueError('buyer_offer_lines_invalid')
        total, purchase = Decimal(0), Decimal(0)
        for item in public:
            sku = item.get('articul')
            if not isinstance(sku, str) or not 1 <= len(sku) <= 100 or sku in {'__proto__', 'prototype', 'constructor'}:
                raise ValueError('buyer_offer_lines_invalid')
            cost, source = costs[sku], inputs[sku]
            quantity, sale, unit_cost, amount = (Decimal(str(value)) for value in (item.get('qty'), item.get('salePrice'), cost.get('unitCost'), item.get('amount')))
            if (not all(value.is_finite() for value in (quantity, sale, unit_cost, amount))
                    or quantity != int(quantity) or not 1 <= quantity <= 9999
                    or sale != int(sale) or not 1 <= sale <= Decimal('1e10')
                    or not 0 < unit_cost <= Decimal('1e10')
                    or Decimal(str(cost.get('qty'))) != quantity or Decimal(str(source.get('qty'))) != quantity
                    or Decimal(str(source.get('salePrice'))) != sale
                    or sale < (unit_cost * (1 + markup / 100)).to_integral_value(rounding=ROUND_CEILING)
                    or amount != quantity * sale):
                raise ValueError('buyer_offer_amount_invalid')
            total += amount
            purchase += quantity * unit_cost
        saved_total, profit = Decimal(str(row.get('total'))), Decimal(str(row.get('expected_profit')))
        if (not saved_total.is_finite() or not profit.is_finite() or total > Decimal('1e14') or saved_total != total
                or profit != (total - purchase).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)):
            raise ValueError('buyer_offer_amount_invalid')
    return len(rows)


def verify_maintenance(tables):
    names = {'maintenance_state', 'maintenance_jobs', 'maintenance_archives',
             'maintenance_unlocks', 'maintenance_auth_mutations', 'maintenance_order_tombstones'}
    if not names.intersection(tables):
        return 0
    if not names.issubset(tables):
        raise ValueError('maintenance_tables_missing')
    users = {r['id'] for r in tables['users']}
    owners = {r['user_id'] for r in tables.get('admin_scopes', []) if r.get('scope') == 'owner'}
    state = tables['maintenance_state']
    protected = state[0].get('protected_owner') if len(state) == 1 else None
    # Clean installs may create the control singleton before their first owner.
    # The normal owner gate initializes this pointer on first use; a unique
    # existing owner is sufficient to preserve that safe initialization state.
    owner_valid = protected in users.intersection(owners) or (protected is None and len(users.intersection(owners)) == 1)
    if len(state) != 1 or state[0].get('freeze_job') is not None or not owner_valid:
        raise ValueError('maintenance_owner_or_freeze_invalid')
    if tables['maintenance_unlocks']:
        raise ValueError('maintenance_grants_revived')
    jobs = {r['id']: r for r in tables['maintenance_jobs']}
    archives = {r['id']: r for r in tables['maintenance_archives']}
    if len(jobs) != len(tables['maintenance_jobs']) or len(archives) != len(tables['maintenance_archives']):
        raise ValueError('maintenance_duplicate_identity')
    for job in jobs.values():
        if job.get('state') not in {'completed', 'failed', 'cancelled'} or job.get('actor_id') not in users:
            raise ValueError('maintenance_job_revived')
        if job.get('archive_id') and job['archive_id'] not in archives:
            raise ValueError('maintenance_archive_missing')
        if job.get('source_archive_id') and job['source_archive_id'] not in archives:
            raise ValueError('maintenance_archive_missing')
    for lease in tables['maintenance_auth_mutations']:
        if lease.get('state') != 'uncertain':
            raise ValueError('maintenance_lease_revived')
    for row in archives.values():
        raw = row.get('payload_text')
        if not isinstance(raw, str):
            raise ValueError('maintenance_archive_text_missing')
        data = raw.encode('utf-8')
        if hashlib.sha256(data).hexdigest() != row.get('sha256') or len(data) != row.get('download_bytes'):
            raise ValueError('maintenance_archive_checksum')
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get('format') != 'zzws-maintenance-archive-v1' or payload.get('schemaVersion') != 1:
            raise ValueError('maintenance_archive_format')
        if row.get('job_id') not in jobs or row.get('actor_id') not in users:
            raise ValueError('maintenance_archive_job_missing')
        if jobs[row['job_id']].get('archive_id') != row['id']:
            raise ValueError('maintenance_archive_job_missing')
    return len(archives)


def verify_proposals(tables, users):
    names = {'proposals', 'proposal_cart', 'proposal_reads'}
    if not names.intersection(tables):
        return 0  # Older application snapshots did not include these tables.
    if not names.issubset(tables):
        raise ValueError('proposal_tables_missing')
    offers = {row.get('token_hash'): row for row in tables['proposals']}
    if len(offers) != len(tables['proposals']) or any(not isinstance(key, str) or not key for key in offers):
        raise ValueError('proposal_duplicate_identity')
    accounts = {row['id']: row for row in tables['users']}
    for offer in offers.values():
        if offer.get('owner_id') not in users:
            raise ValueError('missing_proposal_owner')
        if offer.get('customer_id') and offer['customer_id'] not in users:
            raise ValueError('missing_proposal_customer')
    for name in ['proposal_cart', 'proposal_reads']:
        identities = set()
        for row in tables[name]:
            user = row.get('user_id')
            if user not in users:
                raise ValueError('missing_owner')
            offer = offers.get(row.get('token_hash'))
            if offer is None:
                raise ValueError('missing_proposal')
            receiver = accounts[user].get('customer_id') or user
            if offer.get('customer_id') and offer['customer_id'] != receiver:
                raise ValueError('proposal_receiver_mismatch')
            key = (user, row.get('articul') if name == 'proposal_cart' else row.get('token_hash'))
            if key in identities:
                raise ValueError('proposal_duplicate_identity')
            identities.add(key)
    return len(offers)


def verify_product_specifications(tables):
    names = {'product_specifications', 'specification_refresh_jobs'}
    if not names.intersection(tables):
        return 0, 0
    if not names.issubset(tables):
        raise ValueError('specification_tables_missing')
    identities = set()
    for row in tables['product_specifications']:
        sku = row.get('articul')
        if (not isinstance(sku, str) or not 1 <= len(sku) <= 100
                or sku in {'__proto__', 'constructor', 'prototype'} or sku in identities):
            raise ValueError('specification_identity_invalid')
        identities.add(sku)
        if (not isinstance(row.get('name'), str) or not 1 <= len(row['name']) <= 500
                or not isinstance(row.get('source_url'), str) or not 1 <= len(row['source_url']) <= 2048
                or not isinstance(row.get('provider'), str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,31}', row['provider'])
                or not isinstance(row.get('specifications'), list) or not 1 <= len(row['specifications']) <= 200):
            raise ValueError('specification_content_invalid')
        try:
            datetime.fromisoformat(row['checked_at'])
        except (KeyError, ValueError, TypeError):
            raise ValueError('specification_content_invalid')
    identities = set()
    for row in tables['specification_refresh_jobs']:
        try:
            UUID(row['id'])
            UUID(row['owner'])
        except (KeyError, ValueError, TypeError, AttributeError):
            raise ValueError('specification_refresh_identity_invalid')
        if row['id'] in identities:
            raise ValueError('specification_refresh_identity_invalid')
        identities.add(row['id'])
        # owner is an audit UUID without an FK; historical deleted users are valid.
        if (row.get('state') not in {'completed', 'cancelled'}
                or row.get('lease') is not None or row.get('lease_until') is not None):
            raise ValueError('specification_refresh_revived')
        counts = [row.get(key) for key in ('total', 'processed', 'cursor', 'refreshed', 'retained')]
        if any(not isinstance(value, int) or isinstance(value, bool) for value in counts):
            raise ValueError('specification_refresh_progress_invalid')
        total, processed, cursor, refreshed, retained = counts
        if (not 1 <= total <= 100000 or min(processed, cursor, refreshed, retained) < 0
                or processed != cursor or processed != refreshed + retained or processed > total
                or not isinstance(row.get('queue'), list) or len(row['queue']) != total
                or not isinstance(row.get('errors'), list) or len(row['errors']) > 30
                or not isinstance(row.get('provider'), str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,31}', row['provider'])):
            raise ValueError('specification_refresh_progress_invalid')
    return len(tables['product_specifications']), len(tables['specification_refresh_jobs'])


def verify(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get('format') != 'zzws-application-backup-v1':
        raise ValueError('invalid_manifest')
    tables = snapshot.get('tables')
    if not isinstance(tables, dict) or not {'users', 'orders', 'versions', 'state'}.issubset(tables):
        raise ValueError('missing_tables')
    if any(not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows) for rows in tables.values()):
        raise ValueError('invalid_rows')
    maintenance_verified = verify_maintenance(tables)
    users = {r['id'] for r in tables['users']}
    versions = {r['id'] for r in tables['versions']}
    orders = {r['id'] for r in tables['orders']}
    try:
        buyer_offers_verified = verify_buyer_offers(tables, users, versions)
    except (ArithmeticError, TypeError, KeyError) as error:
        raise ValueError('buyer_offer_amount_invalid') from error
    for key, ids in [('users', users), ('versions', versions), ('orders', orders)]:
        if len(ids) != len(tables[key]):
            raise ValueError('duplicate_identity')
    for row in tables['users']:
        if row.get('customer_id') and row['customer_id'] not in users:
            raise ValueError('missing_company')
    proposals_verified = verify_proposals(tables, users)
    specifications_verified, specification_jobs_verified = verify_product_specifications(tables)
    for row in tables['state']:
        if row.get('version') and row['version'] not in versions:
            raise ValueError('missing_price_version')
    checked = 0
    for order in tables['orders']:
        if order.get('user_id') and order['user_id'] not in users:
            raise ValueError('missing_order_user')
        lines = order.get('lines')
        if not isinstance(lines, list):
            raise ValueError('invalid_order_lines')
        total = Decimal(0)
        for line in lines:
            qty, price = Decimal(str(line['qty'])), Decimal(str(line['unitPrice']))
            if not qty.is_finite() or not price.is_finite() or qty <= 0 or qty != int(qty) or price < 0:
                raise ValueError('invalid_order_amount')
            total += qty * price
        saved_total = Decimal(str(order['total']))
        if not saved_total.is_finite() or abs(total-saved_total) > Decimal('0.02'):
            raise ValueError('order_total_mismatch')
        checked += 1
    for name in ['saved_carts', 'user_memory', 'admin_scopes', 'client_receipt_controls', 'order_gate', 'apk_downloads', 'apk_usage']:
        for row in tables.get(name, []):
            if row.get('user_id') and row['user_id'] not in users:
                raise ValueError('missing_owner')
    for row in tables.get('approval_reminder_snoozes', []):
        if row.get('order_id') not in orders:
            raise ValueError('missing_event_order')
        if row.get('recipient_id') not in users or row.get('actor') not in users:
            raise ValueError('missing_owner')
    for row in tables.get('order_events', []):
        if row.get('order_id') not in orders:
            raise ValueError('missing_event_order')
    with sqlite3.connect(':memory:') as db:
        db.execute('create table restored (table_name text, position integer, payload text check(json_valid(payload)), primary key(table_name,position))')
        for name, rows in tables.items():
            db.executemany('insert into restored values(?,?,?)', [(name, i, json.dumps(row, ensure_ascii=False, sort_keys=True, allow_nan=False)) for i, row in enumerate(rows)])
        for name, rows in tables.items():
            restored = [json.loads(r[0]) for r in db.execute('select payload from restored where table_name=? order by position', (name,))]
            if restored != rows:
                raise ValueError('restore_roundtrip_mismatch')
        if db.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise ValueError('restore_integrity_failed')
    return {'ok': True, 'scope': 'application-data-only', 'created': snapshot.get('created'), 'tables': len(tables), 'rows': sum(map(len, tables.values())), 'orderTotalsVerified': checked, 'maintenanceArchivesVerified': maintenance_verified, 'buyerOffersVerified': buyer_offers_verified, 'proposalRowsVerified': proposals_verified, 'productSpecificationsVerified': specifications_verified, 'specificationRefreshJobsVerified': specification_jobs_verified}


if __name__ == '__main__':
    try:
        result = verify(json.load(sys.stdin))
    except Exception as error:
        safe_codes = {'invalid_manifest', 'missing_tables', 'invalid_rows', 'duplicate_identity', 'missing_price_version', 'missing_order_user', 'invalid_order_lines', 'invalid_order_amount', 'order_total_mismatch', 'missing_owner', 'missing_event_order', 'restore_roundtrip_mismatch', 'restore_integrity_failed', 'maintenance_tables_missing', 'maintenance_owner_or_freeze_invalid', 'maintenance_grants_revived', 'maintenance_duplicate_identity', 'maintenance_job_revived', 'maintenance_archive_missing', 'maintenance_lease_revived', 'maintenance_archive_text_missing', 'maintenance_archive_checksum', 'maintenance_archive_format', 'maintenance_archive_job_missing', 'buyer_offer_identity_invalid', 'buyer_offer_contact_invalid', 'buyer_offer_state_invalid', 'buyer_offer_lines_invalid', 'buyer_offer_amount_invalid', 'missing_company', 'proposal_tables_missing', 'proposal_duplicate_identity', 'missing_proposal_owner', 'missing_proposal_customer', 'missing_proposal', 'proposal_receiver_mismatch', 'specification_tables_missing', 'specification_identity_invalid', 'specification_content_invalid', 'specification_refresh_identity_invalid', 'specification_refresh_revived', 'specification_refresh_progress_invalid', 'buyer_offer_number_invalid'}
        code = str(error) if isinstance(error, ValueError) and str(error) in safe_codes else 'snapshot_rehearsal_failed'
        print(json.dumps({'ok': False, 'error': code, 'errorType': type(error).__name__}))
        sys.exit(1)
    print(json.dumps(result))
