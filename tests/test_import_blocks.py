import unittest
from portal import service,import_blocks
from portal.db import Database
from tests.test_portal import make_users
class ImportBlockTests(unittest.TestCase):
 def test_mapping_round_trip_and_validation(self):
  db=Database(':memory:');u=make_users(db)['admin'];q=service.save_queue(db,u,{'name':'Import demo','items':[]})['id'];tid=service.save_test(db,u,{'name':'Output','category':'Dose','type':'numeric','owner_queue_id':q})['id']
  b={'id':'one','name':'Excel','reader':'excel','sheet':'Sheet1','mappings':[{'test':{'name':'Output','category':'Dose'},'source':'B2','row':1}]}
  service.save_queue(db,u,{'name':'Import demo','items':[{'test_id':tid}],'import_blocks':[b]},q)
  self.assertEqual(service.get_queue(db,u,q)['import_blocks'],[b]);m=service.save_machine(db,u,{'name':'Demo machine'})['id'];a=service.save_assignment(db,u,{'machine_id':m,'queue_id':q,'frequency':'daily'})['id'];self.assertEqual(service.run_template(db,u,a)['queue']['import_blocks'],[b])
  bad={**b,'mappings':[{'test':{'name':'Missing','category':'Dose'},'source':'B2','row':1}]}
  with self.assertRaisesRegex(service.PortalError,'existing'):service.save_queue(db,u,{'name':'Import demo','items':[{'test_id':tid}],'import_blocks':[bad]},q)
  self.assertEqual(service.get_queue(db,u,q)['import_blocks'],[b]);db.close()
 def test_bad_cell_and_derived_target_rejected(self):
  item={'name':'Dose','category':'','description':''};b={'id':'one','name':'x','reader':'excel','mappings':[{'test':{'name':'Dose','category':''},'source':'A0','row':1}]}
  with self.assertRaises(ValueError):import_blocks.validate([b],[item])
  b['mappings'][0]['source']='A1';item['description']='[derived: x]'
  with self.assertRaises(ValueError):import_blocks.validate([b],[item])
