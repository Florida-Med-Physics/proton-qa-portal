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

    def test_pbs_review_queue_requires_406_pass(self):
        db=Database(':memory:');users=make_users(db);admin=users['admin']
        m=service.save_machine(db,admin,{'name':'GTR synthetic'})['id']
        q=service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx'})['id']
        t=service.save_test(db,admin,{'name':'QA reviewed by therapist?','type':'boolean','description':'Template 4.06.','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        ids=[]
        for value in ('',False,True):
            rid=service.submit_run(db,users['mpa'],a,{'results':[{'test_id':t,'value':value}]})['id'];ids.append(rid)
        ready=service.list_runs(db,admin,{'review_status':'pending'})
        self.assertEqual([r['id'] for r in ready],[])
        self.assertEqual(len(service.list_runs(db,admin,{})),3)
        self.assertEqual(service.dashboard(db,admin)['machines'][0]['pending_review'],0)
        with self.assertRaisesRegex(service.PortalError,'4.06'):
            service.review_run(db,users['physicist'],ids[0],{'decision':'approved'})
        service.therapist_approve_run(db,users['therapist'],ids[0])
        saved=service.get_run(db,admin,ids[0])
        self.assertTrue(saved['review_ready'])
        self.assertEqual(saved['results'][0]['status'],'pass')
        self.assertEqual(service.dashboard(db,admin)['machines'][0]['pending_review'],1)
        service.review_run(db,users['physicist'],ids[0],{'decision':'approved'})
        db.close()

    def test_therapist_can_change_pending_decision_and_clear_signature(self):
        db=Database(':memory:');users=make_users(db);admin=users['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic editable review'})['id']
        q=service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx'})['id']
        t=service.save_test(db,admin,{'name':'QA reviewed by therapist?','type':'boolean','description':'Template 4.06.','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        rid=service.submit_run(db,users['mpa'],a,{'results':[]})['id']
        for role in ('mpa','admin','physicist'):
            with self.assertRaises(service.PortalError):service.set_therapist_review(db,users[role],rid,{'decision':'pass'})
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'pass'})
        self.assertTrue(service.get_run(db,admin,rid)['therapist_approved_by'])
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'fail'})
        run=service.get_run(db,admin,rid)
        self.assertIsNone(run['therapist_approved_by']);self.assertFalse(run['review_ready']);self.assertEqual(run['results'][0]['status'],'fail')
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'clear'})
        self.assertIsNone(service.get_run(db,admin,rid)['results'][0]['value_num'])
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'pass'})
        service.review_run(db,users['physicist'],rid,{'decision':'approved'})
        with self.assertRaises(service.PortalError):service.set_therapist_review(db,users['therapist'],rid,{'decision':'clear'})
        audit=db.all("SELECT detail FROM audit WHERE action='change_therapist_review'")
        self.assertEqual(len(audit),4);self.assertIn('previous',audit[1]['detail'])
        db.close()

    def test_role_unapprovals_and_downstream_invalidation(self):
        db=Database(':memory:');users=make_users(db);admin=users['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic revoke review'})['id']
        q=service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx'})['id']
        t=service.save_test(db,admin,{'name':'QA reviewed by therapist?','type':'boolean','description':'Template 4.06.','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        rid=service.submit_run(db,users['mpa'],a,{'results':[]})['id']
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'pass'})
        service.review_run(db,users['physicist'],rid,{'decision':'approved'})
        with self.assertRaises(service.PortalError):service.unapprove_physics_review(db,users['therapist'],rid)
        service.unapprove_physics_review(db,users['physicist'],rid)
        run=service.get_run(db,admin,rid);self.assertTrue(run['therapist_approved_by']);self.assertEqual(run['review_status'],'pending');self.assertIsNone(run['reviewed_by'])
        service.review_run(db,users['physicist'],rid,{'decision':'approved'})
        with self.assertRaises(service.PortalError):service.unapprove_therapist_review(db,users['physicist'],rid)
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'fail'})
        run=service.get_run(db,admin,rid);self.assertIsNone(run['therapist_approved_by']);self.assertEqual(run['review_status'],'pending');self.assertIsNone(run['reviewed_by']);self.assertEqual(run['results'][0]['status'],'fail')
        service.set_therapist_review(db,users['therapist'],rid,{'decision':'pass'})
        service.review_run(db,users['physicist'],rid,{'decision':'approved'})
        service.unapprove_therapist_review(db,users['therapist'],rid)
        run=service.get_run(db,admin,rid);self.assertIsNone(run['results'][0]['value_num']);self.assertIsNone(run['reviewed_by']);self.assertFalse(run['review_ready'])
        self.assertTrue(db.one("SELECT id FROM audit WHERE action='unapprove_therapist_review'"))
        db.close()
