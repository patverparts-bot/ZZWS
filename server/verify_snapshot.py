"""Reconstruct application rows in isolated, in-memory SQLite; never restore live data.

Reads a decrypted snapshot from stdin. Outputs only a non-sensitive summary.
Live Supabase Auth is outside this rehearsal. Credential material already held
inside owner recovery archives is verified as part of those private archives.
Canonical payload_text must be parsed directly by PostgreSQL on recovery, rather
than round-tripped through a JSON number serializer.
"""
import hashlib
import json
import sqlite3
import sys
from decimal import Decimal


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
    for key, ids in [('users', users), ('versions', versions), ('orders', orders)]:
        if len(ids) != len(tables[key]):
            raise ValueError('duplicate_identity')
    for row in tables['users']:
        if row.get('customer_id') and row['customer_id'] not in users:
            raise ValueError('missing_company')
    proposals_verified = verify_proposals(tables, users)
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
    return {'ok': True, 'scope': 'application-data-only', 'created': snapshot.get('created'), 'tables': len(tables), 'rows': sum(map(len, tables.values())), 'orderTotalsVerified': checked, 'maintenanceArchivesVerified': maintenance_verified, 'proposalRowsVerified': proposals_verified}


if __name__ == '__main__':
    try:
        result = verify(json.load(sys.stdin))
    except Exception as error:
        safe_codes = {'invalid_manifest', 'missing_tables', 'invalid_rows', 'duplicate_identity', 'missing_price_version', 'missing_order_user', 'invalid_order_lines', 'invalid_order_amount', 'order_total_mismatch', 'missing_owner', 'missing_company', 'missing_event_order', 'proposal_tables_missing', 'proposal_duplicate_identity', 'missing_proposal_owner', 'missing_proposal_customer', 'missing_proposal', 'proposal_receiver_mismatch', 'restore_roundtrip_mismatch', 'restore_integrity_failed', 'maintenance_tables_missing', 'maintenance_owner_or_freeze_invalid', 'maintenance_grants_revived', 'maintenance_duplicate_identity', 'maintenance_job_revived', 'maintenance_archive_missing', 'maintenance_lease_revived', 'maintenance_archive_text_missing', 'maintenance_archive_checksum', 'maintenance_archive_format', 'maintenance_archive_job_missing'}
        code = str(error) if isinstance(error, ValueError) and str(error) in safe_codes else 'snapshot_rehearsal_failed'
        print(json.dumps({'ok': False, 'error': code, 'errorType': type(error).__name__}))
        sys.exit(1)
    print(json.dumps(result))
