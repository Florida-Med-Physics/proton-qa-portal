import unittest
from portal import service
from portal.db import Database
from tests.test_portal import make_users

class InlineTemplateTests(unittest.TestCase):
    def setUp(self):
        self.db=Database(':memory:');self.user=make_users(self.db)['admin']
        self.q=service.save_queue(self.db,self.user,{'name':'Synthetic Inline'})['id']
        self.t=service.save_test(self.db,self.user,{'name':'Original','category':'Old','type':'numeric','unit':'mm','expected':0,'warn':1,'fail':2,'owner_queue_id':self.q})['id']
        self.payload={'name':'Synthetic Inline','items':[{'test_id':self.t,'expected':0,'warn':1,'fail':2}]}
    def test_definition_and_defaults_save_together(self):
        service.save_queue(self.db,self.user,{**self.payload,'test_updates':[{'test_id':self.t,'name':'Edited','category':'Safety','type':'boolean'}]},self.q)
        test=self.db.one('SELECT * FROM tests WHERE id=?',(self.t,))
        self.assertEqual((test['name'],test['category'],test['type']),('Edited','Safety','boolean'))
        self.assertIsNone(self.db.one('SELECT expected FROM queue_items WHERE test_id=?',(self.t,))['expected'])
    def test_bad_definition_rolls_back_all_edits(self):
        with self.assertRaises(service.PortalError):
            service.save_queue(self.db,self.user,{**self.payload,'items':[{'test_id':self.t,'warn':-1}],'test_updates':[{'test_id':self.t,'name':'Should roll back'}]},self.q)
        self.assertEqual(self.db.one('SELECT name FROM tests WHERE id=?',(self.t,))['name'],'Original')
