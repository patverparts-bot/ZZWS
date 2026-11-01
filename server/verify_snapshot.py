"""Reconstruct application rows in isolated, in-memory SQLite; never restore live data.

Reads a decrypted snapshot from stdin. Outputs only a non-sensitive summary.
Supabase Auth passwords/MFA and PostgreSQL deployment are outside this rehearsal.
"""
import json
import sqlite3
import sys
from decimal import Decimal


def verify(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get('format') != 'zzws-application-backup-v1':
        raise ValueError('invalid_manifest')
    tables = snapshot.get('tables')
    if not isinstance(tables, dict) or not {'users', 'orders', 'versions', 'state'}.issubset(tables):
        raise ValueError('missing_tables')
    if any(not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows) for rows in tables.values()):
        raise ValueError('invalid_rows')
    users = {r['id'] for r in tables['users']}
    versions = {r['id'] for r in tables['versions']}
    orders = {r['id'] for r in tables['orders']}
    for key, ids in [('users', users), ('versions', versions), ('orders', orders)]:
        if len(ids) != len(tables[key]):
            raise ValueError('duplicate_identity')
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
    return {'ok': True, 'scope': 'application-data-only', 'created': snapshot.get('created'), 'tables': len(tables), 'rows': sum(map(len, tables.values())), 'orderTotalsVerified': checked}


if __name__ == '__main__':
    try:
        result = verify(json.load(sys.stdin))
    except Exception as error:
        safe_codes = {'invalid_manifest', 'missing_tables', 'invalid_rows', 'duplicate_identity', 'missing_price_version', 'missing_order_user', 'invalid_order_lines', 'invalid_order_amount', 'order_total_mismatch', 'missing_owner', 'missing_event_order', 'restore_roundtrip_mismatch', 'restore_integrity_failed'}
        code = str(error) if isinstance(error, ValueError) and str(error) in safe_codes else 'snapshot_rehearsal_failed'
        print(json.dumps({'ok': False, 'error': code, 'errorType': type(error).__name__}))
        sys.exit(1)
    print(json.dumps(result))
