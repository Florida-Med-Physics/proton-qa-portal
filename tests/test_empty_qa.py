import unittest
from portal.db import Database
from portal import service
from tests.test_portal import make_users

class EmptyQaTests(unittest.TestCase):
    def test_zero_test_list_can_complete_without_claiming_pass(self):
        db = Database(':memory:')
        users = make_users(db)
        admin = users['admin']
        m = service.save_machine(db, admin, {'name': 'Synthetic Empty QA Machine'})['id']
        q = service.save_queue(db, admin, {'name': 'Synthetic Empty QA'})['id']
        a = service.save_assignment(db, admin, {'machine_id': m, 'queue_id': q, 'frequency': 'asneeded', 'start_date': '2026-10-26', 'active': True})['id']
        result = service.submit_run(db, users['therapist'], a, {'qa_date': '2026-10-26', 'results': []})
        self.assertEqual(result['overall'], 'recorded')
        run = service.get_run(db, admin, result['id'])
        self.assertEqual(run['review_status'], 'pending')
        self.assertEqual(len(run['results']), 0)
