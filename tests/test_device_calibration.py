import unittest
from portal import derived,service
from portal.db import Database
from tests.test_portal import make_users

class DeviceCalibrationTests(unittest.TestCase):
    def test_lookup_missing_zero_unknown_and_validation(self):
        source={'name':'Chamber','category':'Devices','type':'choice'}
        rule={'kind':'lookup','inputs':[{'name':'Chamber','category':'Devices'}],'values':[{'choice':'Sample A','value':0},{'choice':'Sample B','value':2.5}]}
        self.assertEqual(derived.calculate(rule,[source],lambda _: 'Sample A'),0)
        self.assertEqual(derived.calculate(rule,[source],lambda _: 'Sample B'),2.5)
        for choice in ['',None,'Unknown']:self.assertIsNone(derived.calculate(rule,[source],lambda _:choice))
        with self.assertRaises(ValueError):derived.validate({**rule,'values':[{'choice':'A','value':float('inf')}]})
        with self.assertRaises(ValueError):derived.resolve(rule,[{**source,'type':'numeric'}])
    def test_submission_recomputes_both_factors_and_downstream_product(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic device machine'})['id']
        q=service.save_queue(db,admin,{'name':'Synthetic calibration QA','items':[]})['id']
        tests=[]
        def add(name,type,**data):
            tid=service.save_test(db,admin,{'name':name,'category':'Devices','type':type,'owner_queue_id':q,**data})['id'];tests.append(tid);return tid
        chamber=add('Chamber','choice',choices=['Sample chamber A','Sample chamber B'])
        factor=add('Chamber factor','derived',derived={'kind':'lookup','inputs':[{'name':'Chamber','category':'Devices'}],'values':[{'choice':'Sample chamber A','value':100},{'choice':'Sample chamber B','value':200}]})
        meter=add('Electrometer','choice',choices=['Sample meter A','Sample meter B'])
        efactor=add('Meter factor','derived',derived={'kind':'lookup','inputs':[{'name':'Electrometer','category':'Devices'}],'values':[{'choice':'Sample meter A','value':1},{'choice':'Sample meter B','value':1.1}]})
        product=add('Overall factor','derived',derived={'inputs':[{'name':'Chamber factor','category':'Devices'},{'name':'Meter factor','category':'Devices'}],'formula':'A*B'})
        service.save_queue(db,admin,{'name':'Synthetic calibration QA','items':[{'test_id':t} for t in tests]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        def submit(c,e):
            rid=service.submit_run(db,admin,a,{'results':[{'test_id':chamber,'value':c},{'test_id':meter,'value':e},{'test_id':factor,'value':999},{'test_id':efactor,'value':999}]})['id']
            return {r['test_id']:r['value_num'] for r in service.get_run(db,admin,rid)['results']}
        first=submit('Sample chamber A','Sample meter A');self.assertEqual((first[factor],first[efactor],first[product]),(100,1,100))
        second=submit('Sample chamber B','Sample meter B');self.assertEqual(second[factor],200);self.assertAlmostEqual(second[product],220)
        missing=submit('', 'Sample meter A');self.assertIsNone(missing[factor]);self.assertIsNone(missing[product])
        db.close()

    def test_existing_templates_upgrade_without_changing_historical_results(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        m=service.save_machine(db,admin,{'name':'Legacy device machine'})['id']
        q=service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx','items':[]})['id']
        c=service.save_test(db,admin,{'name':'Chamber','category':'Device Selection','type':'text','description':'Template 3.03.','owner_queue_id':q})['id']
        f=service.save_test(db,admin,{'name':'Chamber Cal. Factor(Proton), Gy/C','category':'Device Selection','type':'numeric','description':'Template 3.04.','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'PBS DailyQA Template - Sphinx','items':[{'test_id':c},{'test_id':f}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        rid=service.submit_run(db,admin,a,{'results':[{'test_id':c,'value':'Historical chamber'},{'test_id':f,'value':50}]})['id']
        db._install_derived_calculations()
        self.assertEqual(db.one('SELECT type FROM tests WHERE id=?',(c,))['type'],'choice')
        lookup=derived.read(db.one('SELECT description FROM tests WHERE id=?',(f,))['description'])
        self.assertEqual(lookup['kind'],'lookup');self.assertTrue(lookup['sample'])
        result=next(r for r in service.get_run(db,admin,rid)['results'] if r['test_id']==f)
        self.assertEqual(result['value_num'],50)
        changed={**lookup,'sample':False,'values':[{'choice':'Custom chamber','value':123}]}
        service.save_test(db,admin,{**db.one('SELECT * FROM tests WHERE id=?',(f,)),'type':'derived','derived':changed},f)
        db._install_derived_calculations()
        self.assertEqual(derived.read(db.one('SELECT description FROM tests WHERE id=?',(f,))['description'])['values'],changed['values'])
        db.close()
