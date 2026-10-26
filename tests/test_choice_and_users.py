import unittest
from portal.db import Database
from portal import service, auth
from tests.test_portal import make_users

class ChoiceAndUserImportTests(unittest.TestCase):
    def setUp(self):
        self.db=Database(':memory:');self.users=make_users(self.db);self.admin=self.users['admin']
    def tearDown(self):self.db.close()
    def test_multiple_choice_saved_and_rejects_unknown_answers(self):
        q=service.save_queue(self.db,self.admin,{'name':'Synthetic choice','items':[]})['id']
        t=service.save_test(self.db,self.admin,{'name':'Electrometer','type':'choice','choices':'Dose 1\nDose X','owner_queue_id':q})['id']
        service.save_queue(self.db,self.admin,{'name':'Synthetic choice','items':[{'test_id':t}]},q)
        m=service.save_machine(self.db,self.admin,{'name':'Synthetic machine'})['id']
        a=service.save_assignment(self.db,self.admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded','weekdays':[0,1,2,3,4]})['id']
        run=service.submit_run(self.db,self.users['therapist'],a,{'results':[{'test_id':t,'value':'Dose X'}]})
        self.assertEqual(service.get_run(self.db,self.admin,run['id'])['results'][0]['value_text'],'Dose X')
        with self.assertRaisesRegex(service.PortalError,'available answer'):
            service.submit_run(self.db,self.users['therapist'],a,{'results':[{'test_id':t,'value':'Not allowed'}]})
        with self.assertRaisesRegex(service.PortalError,'unique'):
            service.save_test(self.db,self.admin,{'name':'Bad','type':'choice','choices':'Same\nSame'})
    def test_user_spreadsheet_is_atomic_and_passwords_are_hashed(self):
        rows=[{'username':'Imported A','full_name':'A','role':'mpa','password':'Temporary123!'},{'username':'Imported B','role':'therapist','password':'AnotherTemp123!'}]
        with self.assertRaises(service.PortalError):service.import_users(self.db,self.users['therapist'],{'users':rows})
        with self.assertRaises(service.PortalError):service.import_users(self.db,self.admin,{'users':[rows[0],{**rows[1],'password':'short'}]})
        self.assertIsNone(self.db.one('SELECT id FROM users WHERE username=?',('Imported A',)))
        self.assertEqual(service.import_users(self.db,self.admin,{'users':rows})['created'],2)
        row=self.db.one('SELECT * FROM users WHERE username=?',('Imported A',))
        self.assertNotEqual(row['password_hash'],rows[0]['password'])
        self.assertTrue(auth.verify_password(rows[0]['password'],row['password_hash']))
        self.assertNotIn(rows[0]['password'],str(self.db.all('SELECT detail FROM audit')))
        user={k:row[k] for k in ('id','username','full_name','role')}
        service.change_own_password(self.db,user,{'current':rows[0]['password'],'new':'UpdatedPassword123!'})
        self.assertTrue(auth.verify_password('UpdatedPassword123!',self.db.one('SELECT password_hash FROM users WHERE id=?',(user['id'],))['password_hash']))
