import copy
import hashlib
import json
import unittest

from server.verify_snapshot import verify


def fixture():
    raw = '{"format":"zzws-maintenance-archive-v1","schemaVersion":1,"scope":["orders"],"tables":{"orders":[]},"price":1.2300}'
    return {'format': 'zzws-application-backup-v1', 'tables': {
        'users': [{'id': 'owner', 'profile': {'role': 'admin'}}], 'orders': [], 'versions': [], 'state': [{'id': True, 'version': None}],
        'admin_scopes': [{'user_id': 'owner', 'scope': 'owner'}],
        'maintenance_state': [{'id': True, 'protected_owner': 'owner', 'freeze_job': None}],
        'maintenance_unlocks': [], 'maintenance_auth_mutations': [{'id': 'lease', 'state': 'uncertain'}],
        'maintenance_order_tombstones': [{'user_id': 'deleted-user', 'request_id': 'old-request', 'order_id': 'deleted-order', 'job_id': 'job'}],
        'maintenance_jobs': [{'id': 'job', 'actor_id': 'owner', 'state': 'cancelled', 'archive_id': 'archive'}],
        'maintenance_archives': [{'id': 'archive', 'job_id': 'job', 'actor_id': 'owner', 'payload_text': raw, 'sha256': hashlib.sha256(raw.encode()).hexdigest(), 'download_bytes': len(raw.encode())}]
    }}


class MaintenanceBackupTest(unittest.TestCase):
    def test_exact_payload_text_survives_json_transport_and_rehearsal(self):
        data = json.loads(json.dumps(fixture()))
        before = copy.deepcopy(data)
        result = verify(data)
        self.assertTrue(result['ok'])
        self.assertEqual(result['maintenanceArchivesVerified'], 1)
        self.assertEqual(data, before)
        self.assertIn('1.2300', data['tables']['maintenance_archives'][0]['payload_text'])

    def test_archive_corruption_missing_links_and_revived_authority_are_rejected(self):
        mutations = [
            lambda t: t['maintenance_archives'][0].update(payload_text=t['maintenance_archives'][0]['payload_text'].replace('1.2300', '9.9999')),
            lambda t: t['maintenance_jobs'][0].update(state='running'),
            lambda t: t['maintenance_state'][0].update(freeze_job='job'),
            lambda t: t['maintenance_unlocks'].append({'token_hash': 'expired-proof'}),
            lambda t: t['maintenance_auth_mutations'][0].update(state='active'),
            lambda t: t['maintenance_archives'][0].update(job_id='missing'),
            lambda t: t.pop('maintenance_archives'),
        ]
        for change in mutations:
            data = fixture()
            change(data['tables'])
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify(data)

    def test_historical_application_backup_without_maintenance_is_still_supported(self):
        data = fixture()
        data['tables'] = {k: v for k, v in data['tables'].items() if not k.startswith('maintenance_')}
        self.assertTrue(verify(data)['ok'])

    def test_fresh_install_before_first_maintenance_use_retains_unique_owner(self):
        data = fixture()
        data['tables']['maintenance_state'][0]['protected_owner'] = None
        self.assertTrue(verify(data)['ok'])


if __name__ == '__main__':
    unittest.main()
