import json
import unittest
from portal import service,sphinx
from portal.db import Database
from tests.test_portal import make_users

class UniformPbsTests(unittest.TestCase):
    def test_energy_alias_is_unique_and_never_nearest_guess(self):
        items=[{'name':'Spot 6 [120.6 MeV] – Sigma X','test_id':6},{'name':'Spot 1 [226.4 MeV] – Sigma X','test_id':1}]
        self.assertEqual(sphinx.template_match(items,'Spot 2 [121.83 MeV] – Sigma X')['test_id'],6)
        self.assertIsNone(sphinx.template_match(items,'Spot 2 [100 MeV] – Sigma X'))
        self.assertIsNone(sphinx.template_match(items+[{'name':'Spot 3 [120 MeV] – Sigma X'}],'Spot 2 [120 MeV] – Sigma X'))
        self.assertEqual(sphinx.canonical_key('Energy [101.6 MeV] – Distal Depth'),sphinx.canonical_key('Energy [100 MeV] – Distal Depth'))
    def test_migration_and_import_keep_shared_tests_and_history(self):
        db=Database(':memory:');u=make_users(db)['admin']
        q=service.save_queue(db,u,{'name':'PBS DailyQA Template - Sphinx','items':[]})['id']
        def test(name):return service.save_test(db,u,{'name':name,'category':'Spot','type':'numeric','unit':'mm','expected':0,'fail':1,'owner_queue_id':q})['id']
        base=test('Spot 6 [120.6 MeV] – Sigma X');old=test('Spot 2 [120 MeV] – Sigma X')
        service.save_queue(db,u,{'name':'PBS DailyQA Template - Sphinx','items':[{'test_id':base}]},q)
        machine=service.save_machine(db,u,{'name':'GTR1'})['id'];a=service.save_assignment(db,u,{'machine_id':machine,'queue_id':q,'frequency':'daily'})['id']
        db.run('UPDATE assignments SET test_selection=? WHERE id=?',(json.dumps({'added':[old],'excluded':[base]}),a))
        run=service.submit_run(db,u,a,{'results':[{'test_id':old,'value':.2}]})
        db.run('INSERT INTO assignment_overrides(assignment_id,test_id,expected) VALUES(?,?,?)',(a,old,.1))
        db._unify_pbs_selections();db._unify_pbs_selections()
        t=service.run_template(db,u,a);self.assertEqual([i['test_id'] for i in t['items']],[base]);self.assertEqual(t['items'][0]['limits']['expected'],.1)
        ids,added=service._sphinx_test_ids(db,u,t,[{'category':'Spot','name':'Spot 2 [121.8 MeV] – Sigma X'},{'category':'Spot','name':'Spot 9 [80 MeV] – Sigma X'}],True)
        self.assertEqual(list(ids.values()),[base]);self.assertEqual(added,[])
        points=service.machine_trends(db,u,machine)[str(base)];self.assertEqual(points[0]['source_test_id'],old);self.assertEqual(points[0]['run_id'],run['id'])
        db.close()
