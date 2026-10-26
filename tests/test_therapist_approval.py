import unittest
from portal import auth, service
from portal.db import Database
from tests.test_portal import make_users

class ApprovalTests(unittest.TestCase):
    def test_required_two_stage_signoff(self):
        db=Database(':memory:');users=make_users(db);admin=users['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic approval machine'})['id']
        q=service.save_queue(db,admin,{'name':'Synthetic approval list'})['id']
        t=service.save_test(db,admin,{'name':'QA reviewed by therapist?','type':'boolean','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'Synthetic approval list','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded','start_date':'2026-10-26'})['id']
        run=service.submit_run(db,users['mpa'],a,{'qa_date':'2026-10-26','results':[{'test_id':t,'value':True}]})['id']
        self.assertTrue(service.get_run(db,admin,run)['therapist_approval_required'])
        with self.assertRaisesRegex(service.PortalError,'Therapist approval'):
            service.review_run(db,users['physicist'],run,{'decision':'approved'})
        with self.assertRaises(service.PortalError):service.therapist_approve_run(db,users['mpa'],run)
        service.therapist_approve_run(db,users['therapist'],run)
        with self.assertRaises(service.PortalError):service.therapist_approve_run(db,users['therapist'],run)
        with self.assertRaisesRegex(service.PortalError,'medical physicist'):service.review_run(db,admin,run,{'decision':'approved'})
        service.review_run(db,users['physicist'],run,{'decision':'approved'})
        saved=service.get_run(db,admin,run)
        self.assertEqual(saved['therapist_approved_by'],users['therapist']['id'])
        self.assertEqual(saved['reviewed_by'],users['physicist']['id'])
        self.assertEqual(saved['review_status'],'approved')
        self.assertFalse(auth.can(users['mpa'],'configure'))
