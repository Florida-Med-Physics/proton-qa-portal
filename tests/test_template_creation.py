"""Template imports are reviewed, owned, unscheduled and atomic. Synthetic data only."""
import unittest
from portal import service
from portal.db import Database
from tests.test_portal import make_users

class TemplateCreationTests(unittest.TestCase):
    def setUp(self):
        self.db=Database(':memory:');self.users=make_users(self.db);self.user=self.users['admin']
    def tearDown(self):self.db.close()
    def test_starter_creates_owned_tests_without_scheduling(self):
        starter=service.template_starters(self.db,self.user)[0]
        result=service.create_template(self.db,self.user,{'name':'Synthetic starter','starter':starter['name']})
        queue=service.get_queue(self.db,self.user,result['id'])
        self.assertEqual(len(queue['items']),len(starter['checks']))
        self.assertEqual(queue['is_template'],1)
        self.assertEqual(self.db.one('SELECT COUNT(*) AS n FROM assignments')['n'],0)
        self.assertTrue(all(t['owner_queue_id']==result['id'] for t in service.list_tests(self.db,self.user)))
    def test_import_preserves_zero_and_blank_limits(self):
        result=service.create_template(self.db,self.user,{'name':'Synthetic Excel','source':'synthetic.xlsx','tests':[{'name':'Zero reference','type':'numeric','expected':0,'warn':0,'fail':1},{'name':'Text criterion','type':'text','description':'Department checks this.'}]})
        tests=service.get_queue(self.db,self.user,result['id'])['items']
        first=self.db.one('SELECT * FROM tests WHERE id=?',(tests[0]['test_id'],));self.assertEqual(first['expected'],0);self.assertEqual(first['warn'],0)
        second=self.db.one('SELECT * FROM tests WHERE id=?',(tests[1]['test_id'],));self.assertIsNone(second['expected'])
    def test_invalid_import_rolls_back_everything(self):
        with self.assertRaises(service.PortalError):
            service.create_template(self.db,self.user,{'name':'Synthetic rollback','tests':[{'name':'Good','type':'text'},{'name':'Invalid','type':'not-a-type'}]})
        self.assertEqual(self.db.one('SELECT COUNT(*) AS n FROM queues')['n'],0)
        self.assertEqual(self.db.one('SELECT COUNT(*) AS n FROM tests')['n'],0)
    def test_permissions_and_duplicate_names(self):
        with self.assertRaises(service.PortalError):service.create_template(self.db,self.users['therapist'],{'name':'Nope'})
        service.create_template(self.db,self.user,{'name':'Synthetic blank'})
        with self.assertRaises(service.PortalError):service.create_template(self.db,self.user,{'name':'synthetic blank'})
