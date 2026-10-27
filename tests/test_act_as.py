import json
import unittest
from portal import auth,service
from portal.db import Database
from tests.test_portal import make_users

class ActAsTests(unittest.TestCase):
    def test_only_admin_can_assume_roles(self):
        for role in auth.ROLES:
            actual={'id':1,'role':'admin','username':'real-admin'}
            acting=auth.act_as(actual,role)
            self.assertEqual(acting['id'],1);self.assertEqual(acting['role'],role);self.assertEqual(actual['role'],'admin')
        for actual in [None,{'id':2,'role':'therapist'},{'id':3,'role':'mpa'}]:
            with self.assertRaises(ValueError):auth.act_as(actual,'admin')
        with self.assertRaises(ValueError):auth.act_as({'id':1,'role':'admin'},'invalid')
    def test_actual_role_permissions_and_audit_identity(self):
        db=Database(':memory:');u=make_users(db);admin=u['admin']
        m=service.save_machine(db,admin,{'name':'Role test machine'})['id']
        q=service.save_queue(db,admin,{'name':'Role test list','items':[]})['id']
        t=service.save_test(db,admin,{'name':'QA reviewed by therapist?','type':'boolean','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'Role test list','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        rid=service.submit_run(db,u['mpa'],a,{'results':[]})['id']
        therapist=auth.act_as(admin,'therapist')
        with self.assertRaises(service.PortalError):service.save_machine(db,therapist,{'name':'Blocked'})
        token=auth.ACTING_ROLE.set('therapist')
        try:service.set_therapist_review(db,therapist,rid,{'decision':'pass'})
        finally:auth.ACTING_ROLE.reset(token)
        run=service.get_run(db,admin,rid)
        self.assertEqual(run['therapist_approved_by'],admin['id'])
        audit=db.one("SELECT * FROM audit WHERE action='change_therapist_review' ORDER BY id DESC LIMIT 1")
        self.assertEqual(audit['user_id'],admin['id']);self.assertEqual(json.loads(audit['detail'])['acting_role'],'therapist')
        self.assertEqual(db.one('SELECT role FROM users WHERE id=?',(admin['id'],))['role'],'admin')
        db.close()
