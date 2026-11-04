import copy
import unittest
from server.verify_snapshot import verify


class BuyerOfferSnapshotTests(unittest.TestCase):
    def sample(self):
        return {'format': 'zzws-application-backup-v1', 'tables': {
            'users': [{'id': 'owner'}], 'versions': [{'id': 'catalog'}], 'orders': [], 'state': [{'version': 'catalog'}],
            'buyer_offers': [{'id': 'offer', 'offer_number': 1, 'actor_id': 'owner', 'buyer_name': 'Synthetic buyer', 'buyer_phone': '+37499123456',
                              'markup_percent': 15, 'price_category': 'Dealers', 'state': 'handed_off', 'catalog_version': 'catalog',
                              'rules_revision': 'rules', 'profile_revision': 1, 'finalized_at': '2026-11-04T00:00:00Z',
                              'handed_off_at': '2026-11-04T00:01:00Z', 'finalize_request': 'request',
                              'request_lines': [{'articul': '001234', 'qty': 2, 'salePrice': 115000}],
                              'public_lines': [{'articul': '001234', 'qty': 2, 'salePrice': 115000, 'amount': 230000}],
                              'internal_lines': [{'articul': '001234', 'qty': 2, 'unitCost': 100000}],
                              'total': 230000, 'expected_profit': 30000}]}}

    def test_valid_handed_offer_preserves_state_and_contacts_without_mutating_snapshot(self):
        data = self.sample()
        original = copy.deepcopy(data)
        result = verify(data)
        self.assertTrue(result['ok'])
        self.assertEqual(result['buyerOffersVerified'], 1)
        self.assertEqual(data, original)

    def test_draft_has_no_fake_finalized_amounts(self):
        data = self.sample()
        data['tables']['buyer_offers'][0].update(state='draft', offer_number=None, finalized_at=None, handed_off_at=None,
                                               public_lines=[], internal_lines=[], request_lines=[], total=0, expected_profit=0)
        self.assertTrue(verify(data)['ok'])
        data['tables']['buyer_offers'][0]['total'] = 1
        with self.assertRaises(ValueError):
            verify(data)

    def test_fractional_purchase_uses_exact_floor_and_rounded_profit(self):
        data = self.sample()
        row = data['tables']['buyer_offers'][0]
        row.update(total=115001, expected_profit=15001)
        row['request_lines'][0].update(qty=1, salePrice=115001)
        row['public_lines'][0].update(qty=1, salePrice=115001, amount=115001)
        row['internal_lines'][0].update(qty=1, unitCost=100000.001)
        self.assertTrue(verify(data)['ok'])
        row['public_lines'][0]['salePrice'] = 115000
        with self.assertRaises(ValueError):
            verify(data)
        row.update(total=1, expected_profit=1, markup_percent=0)
        row['request_lines'][0].update(salePrice=1)
        row['public_lines'][0].update(salePrice=1, amount=1)
        row['internal_lines'][0].update(unitCost=0.001)
        self.assertTrue(verify(data)['ok'])

    def test_bad_relations_amounts_contacts_and_replay_states_are_rejected(self):
        for mutation in [lambda row: row.update(actor_id='missing'), lambda row: row.update(catalog_version='missing'),
                         lambda row: row.update(buyer_phone=''), lambda row: row.update(buyer_name=''),
                         lambda row: row.update(expected_profit=30001), lambda row: row.update(total=230001),
                         lambda row: row.update(handed_off_at=None), lambda row: row.update(state='finalized'),
                         lambda row: row['public_lines'][0].update(salePrice=114999),
                         lambda row: row['internal_lines'][0].update(qty=1),
                         lambda row: row['request_lines'][0].update(articul='other')]:
            data = self.sample()
            mutation(data['tables']['buyer_offers'][0])
            with self.assertRaises(ValueError):
                verify(data)
        data = self.sample()
        data['tables']['buyer_offers'].append(copy.deepcopy(data['tables']['buyer_offers'][0]))
        with self.assertRaises(ValueError):
            verify(data)

    def test_cart_source_preserves_only_bounded_baseline_quantities(self):
        data = self.sample()
        row = data['tables']['buyer_offers'][0]
        row.update(source='cart', base_cart={'001234': {'qty': 2}, 'other-cart-sku': {'qty': 1}})
        original = copy.deepcopy(data)
        self.assertTrue(verify(data)['ok'])
        self.assertEqual(data, original)
        for source, baseline in [('unknown', {}), ('catalog', {'001234': {'qty': 2}}), ('cart', []),
                                 ('cart', {'__proto__': {'qty': 1}}), ('cart', {'001234': {'qty': 0}}),
                                 ('cart', {'001234': {'qty': 1.5}}), ('cart', {'001234': {'qty': 1000001}}),
                                 ('cart', {'001234': {'qty': True}}), ('cart', {'001234': {'qty': 1, 'price': 100000}})]:
            invalid = self.sample()
            invalid['tables']['buyer_offers'][0].update(source=source, base_cart=baseline)
            with self.assertRaises(ValueError):
                verify(invalid)

    def test_human_offer_numbers_are_unique_positive_safe_integers(self):
        for number in [None, 0, -1, True, '1', 1.5, 9007199254740992]:
            data = self.sample()
            data['tables']['buyer_offers'][0]['offer_number'] = number
            with self.assertRaises(ValueError):
                verify(data)
        for number in [1, 9007199254740991]:
            data = self.sample()
            data['tables']['buyer_offers'][0]['offer_number'] = number
            self.assertTrue(verify(data)['ok'])
        data = self.sample()
        other = copy.deepcopy(data['tables']['buyer_offers'][0])
        other.update(id='other', finalize_request='other-request')
        data['tables']['buyer_offers'].append(other)
        with self.assertRaises(ValueError):
            verify(data)


if __name__ == '__main__':
    unittest.main()
