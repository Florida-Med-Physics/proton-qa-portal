import unittest
from portal import service
from portal.db import Database
from tests.test_portal import make_users

class RunTrashTests(unittest.TestCase):
    def test_reversible_trash_excludes_results_from_review_counts_history_and_schedule(self):
        db=Database(':memory:');u=make_users(db);admin=u['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic trash machine'})['id']
        q=service.save_queue(db,admin,{'name':'Synthetic trash list','items':[]})['id']
        t=service.save_test(db,admin,{'name':'Distance','category':'Synthetic','type':'numeric','unit':'mm','expected':0,'fail':1,'owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'Synthetic trash list','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        r=service.submit_run(db,u['therapist'],a,{'results':[{'test_id':t,'value':.2}]})['id']
        with self.assertRaises(service.PortalError):service.trash_run(db,u['mpa'],r,{})
        service.trash_run(db,u['therapist'],r,{'reason':'Synthetic error'})
        self.assertEqual(service.list_runs(db,admin,{}),[])
        self.assertEqual(service.list_runs(db,admin,{'trashed':'1'})[0]['id'],r)
        self.assertEqual(service.machine_trends(db,admin,m),{})
        self.assertEqual(service.dashboard(db,admin)['machines'][0]['pending_review'],0)
        self.assertIsNone(service._last_done(db,a))
        self.assertEqual(service.get_run(db,admin,r)['results'][0]['value_num'],.2)
        with self.assertRaises(service.PortalError):service.review_run(db,u['physicist'],r,{'decision':'approved'})
        service.trash_run(db,admin,r,{'trashed':False})
        self.assertEqual(service.list_runs(db,admin,{})[0]['id'],r)
        self.assertEqual(service.trend(db,admin,m,t)['points'][0]['value'],.2)
        actions=[x['action'] for x in db.all('SELECT action FROM audit')]
        self.assertIn('trash_run',actions);self.assertIn('restore_run',actions)
        db.close()
