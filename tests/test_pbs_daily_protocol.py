import json,unittest
from pathlib import Path
from portal import service
from portal.db import Database
from tests.test_portal import make_users
class PbsDailyProtocolTests(unittest.TestCase):
 def test_revision_updates_old_list_without_deleting_history(self):
  db=Database(':memory:');u=make_users(db)['admin'];seed=json.loads(Path('portal/seed.json').read_text());tpl=next(t for t in seed['templates'] if 'PBS DailyQA' in t['name'])
  q=service.save_queue(db,u,{'name':tpl['name'],'items':[]})['id']
  names=['Did you hear beeping sound from the neutron detector?','[OBs] Required Correction Vector - X [cm]','Please move PPS in X (-4.0 cm), Y (+1.0 cm), Z (+1.0 cm) using the correction vector to run CBCT.']
  ids=[service.save_test(db,u,{'name':n,'category':'Safety','type':'boolean','description':'Template 2.01.','owner_queue_id':q})['id'] for n in names]
  service.save_queue(db,u,{'name':tpl['name'],'items':[{'test_id':i} for i in ids]},q)
  assignments={}
  for name in ['GTR1','GTR2','GTR5']:
   mid=service.save_machine(db,u,{'name':name})['id'];assignments[name]=service.save_assignment(db,u,{'machine_id':mid,'queue_id':q,'frequency':'daily'})['id']
  run=service.submit_run(db,u,assignments['GTR1'],{'results':[{'test_id':ids[0],'value':'pass'}]})
  db._install_pbs_daily_protocol();count=db.one('SELECT COUNT(*) n FROM tests')['n'];db._install_pbs_daily_protocol();self.assertEqual(count,db.one('SELECT COUNT(*) n FROM tests')['n'])
  self.assertIsNotNone(db.one('SELECT id FROM results WHERE run_id=? AND test_id=?',(run['id'],ids[0])))
  for machine in ['GTR1','GTR2','GTR5']:
   items=service.run_template(db,u,assignments[machine])['items'];self.assertFalse(any('neutron detector' in x['name'] for x in items));self.assertEqual(any(x['name'].startswith('[OBs]') for x in items),machine=='GTR5');self.assertTrue(any('Template 1.09b.' in x['description'] for x in items));self.assertTrue(any(x['name']=='DO NOT APPLY Correction' and '[direction: next]' in x['description'] for x in items));self.assertFalse(any('Do not move the couch' in x['description'] for x in items));self.assertFalse(any('apply the 3D correction vector (x, y, z) based on the CBCT' in x['name'] for x in items))
  db.close()
