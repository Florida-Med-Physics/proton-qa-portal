import unittest
from portal import service,derived
from portal.db import Database
from tests.test_portal import make_users

class DerivedTests(unittest.TestCase):
    def setUp(self):
        self.db=Database(':memory:');self.u=make_users(self.db);self.admin=self.u['admin']
        self.m=service.save_machine(self.db,self.admin,{'name':'Calculation machine'})['id']
        self.q=service.save_queue(self.db,self.admin,{'name':'Calculation list','items':[]})['id']
        self.a=service.save_test(self.db,self.admin,{'name':'Set','category':'Timing','type':'numeric','owner_queue_id':self.q})['id']
        self.b=service.save_test(self.db,self.admin,{'name':'Measured','category':'Timing','type':'numeric','owner_queue_id':self.q})['id']
        self.rule={'inputs':[{'name':'Set','category':'Timing'},{'name':'Measured','category':'Timing'}],'formula':'100*(A-B)/A'}
        self.c=service.save_test(self.db,self.admin,{'name':'Difference','category':'Timing','type':'derived','derived':self.rule,'expected':0,'fail':2,'owner_queue_id':self.q})['id']
        service.save_queue(self.db,self.admin,{'name':'Calculation list','items':[{'test_id':t} for t in [self.a,self.b,self.c]]},self.q)
        self.assignment=service.save_assignment(self.db,self.admin,{'machine_id':self.m,'queue_id':self.q,'frequency':'asneeded'})['id']
    def tearDown(self):self.db.close()
    def submit(self,a,b):
        r=service.submit_run(self.db,self.u['mpa'],self.assignment,{'results':[{'test_id':self.a,'value':a},{'test_id':self.b,'value':b},{'test_id':self.c,'value':999}]})['id']
        return next(x for x in service.get_run(self.db,self.admin,r)['results'] if x['test_id']==self.c)
    def test_recomputed_not_trusted_and_evaluated(self):
        r=self.submit(30,30.1);self.assertAlmostEqual(r['value_num'],-1/3);self.assertEqual(r['status'],'pass')
        self.assertEqual(self.submit(30,32)['status'],'fail')
    def test_blank_and_zero_never_pass(self):
        for a,b in [(None,30),(0,30),(30,None)]:
            r=self.submit(a,b);self.assertIsNone(r['value_num']);self.assertEqual(r['status'],'recorded')
    def test_no_forward_inputs_or_cycles(self):
        with self.assertRaises(service.PortalError):service.save_queue(self.db,self.admin,{'name':'Calculation list','items':[{'test_id':t} for t in [self.c,self.a,self.b]]},self.q)
    def test_safe_arithmetic(self):
        self.assertEqual(derived.evaluate('sqrt(A*A+B*B)',{'A':3,'B':4}),5)
        self.assertEqual(derived.evaluate('mean(A,B)+abs(-2)',{'A':2,'B':4}),5)
        for formula in ["__import__('os')",'A.__class__','[A]','A**9999','C+1']:
            with self.assertRaises((ValueError,SyntaxError,TypeError)):derived.evaluate(formula,{'A':1,'B':1})
    def test_chain(self):
        d=service.save_test(self.db,self.admin,{'name':'Magnitude','category':'Timing','type':'derived','derived':{'inputs':[{'name':'Difference','category':'Timing'}],'formula':'abs(A)'},'owner_queue_id':self.q})['id']
        service.save_queue(self.db,self.admin,{'name':'Calculation list','items':[{'test_id':t} for t in [self.a,self.b,self.c,d]]},self.q)
        rid=service.submit_run(self.db,self.u['mpa'],self.assignment,{'results':[{'test_id':self.a,'value':30},{'test_id':self.b,'value':30.1}]})['id']
        row=next(x for x in service.get_run(self.db,self.admin,rid)['results'] if x['test_id']==d)
        self.assertAlmostEqual(row['value_num'],1/3)

    def test_seed_audit_dependencies(self):
        import json
        from pathlib import Path
        seed=json.loads((Path(__file__).parents[1]/'portal'/'seed.json').read_text())
        count=0
        for template in seed['templates']:
            prior=[]
            for item in template['checks']:
                rule=derived.read(item.get('description'))
                if rule:
                    derived.resolve(rule,prior);count+=1
                prior.append(item)
        self.assertEqual(count,31)
