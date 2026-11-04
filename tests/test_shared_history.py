import unittest
from portal import service
from portal.db import Database
from tests.test_portal import make_users

class SharedHistoryTests(unittest.TestCase):
    def test_equivalent_machine_measurements_share_history_but_units_energies_and_machines_do_not(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        m=service.save_machine(db,admin,{'name':'GTR synthetic'})['id']
        other=service.save_machine(db,admin,{'name':'Other synthetic'})['id']
        def make(name,unit='mm'):
            q=service.save_queue(db,admin,{'name':name+' '+unit,'items':[]})['id']
            t=service.save_test(db,admin,{'name':name,'type':'numeric','unit':unit,'category':'Energy','expected':10,'fail':1,'owner_queue_id':q})['id']
            service.save_queue(db,admin,{'name':name+' '+unit,'items':[{'test_id':t}]},q)
            a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
            return q,t,a
        q1,t1,a1=make('Energy [100 MeV] – Distal Depth')
        q2,t2,a2=make('GTR5_Energy [100.00 MeV]: Distal Depth [mm]')
        _,t3,a3=make('Energy [150 MeV] – Distal Depth')
        _,t4,a4=make('Energy [100 MeV] – Distal Depth','cm')
        service.submit_run(db,admin,a1,{'qa_date':'2026-10-01','results':[{'test_id':t1,'value':10}]})
        service.submit_run(db,admin,a2,{'qa_date':'2026-10-02','results':[{'test_id':t2,'value':10.1}]})
        a5=service.save_assignment(db,admin,{'machine_id':other,'queue_id':q1,'frequency':'asneeded'})['id']
        service.submit_run(db,admin,a5,{'results':[{'test_id':t1,'value':100}]})
        history=service.machine_trends(db,admin,m)
        self.assertEqual([p['value'] for p in history[str(t1)]],[10,10.1])
        self.assertEqual(history[str(t1)],history[str(t2)])
        self.assertNotIn(str(t3),history);self.assertNotIn(str(t4),history)
        self.assertEqual(service.trend(db,admin,m,t2)['points'],history[str(t2)])
        self.assertEqual([p['value'] for p in service.trend(db,admin,other,t1)['points']],[100])
        db.close()

    def test_same_day_retests_keep_source_test_number_and_recorded_verdict(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic retest machine'})['id']
        q=service.save_queue(db,admin,{'name':'Synthetic retest list','items':[]})['id']
        t=service.save_test(db,admin,{'name':'Energy [150 MeV] – Distal Depth','type':'numeric','unit':'mm','expected':158.5,'fail':1,'description':'Template 3.15.','owner_queue_id':q})['id']
        service.save_queue(db,admin,{'name':'Synthetic retest list','items':[{'test_id':t}]},q)
        a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        failed=service.submit_run(db,admin,a,{'qa_date':'2026-10-21','results':[{'test_id':t,'value':163.5}]})['id']
        passed=service.submit_run(db,admin,a,{'qa_date':'2026-10-21','results':[{'test_id':t,'value':158.5}]})['id']
        points=service.machine_trends(db,admin,m)[str(t)]
        self.assertEqual([p['run_id'] for p in points],[failed,passed])
        self.assertEqual([p['status'] for p in points],['fail','pass'])
        self.assertTrue(all(p['source_test_id']==t and p['source_test_number']=='3.15' and p['expected']==158.5 for p in points))
        db.close()

    def test_trend_window_keeps_shared_history_and_cuts_by_date_and_count(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        m=service.save_machine(db,admin,{'name':'Synthetic window machine'})['id']
        def make(name):
            q=service.save_queue(db,admin,{'name':name,'items':[]})['id']
            t=service.save_test(db,admin,{'name':'Energy [100 MeV] – Distal Depth' if 'A' in name or 'B' in name else 'Energy [150 MeV] – Distal Depth','type':'numeric','unit':'mm','expected':10,'fail':1,'owner_queue_id':q})['id']
            service.save_queue(db,admin,{'name':name,'items':[{'test_id':t}]},q)
            return t,service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        t1,a1=make('Synthetic list A');t2,a2=make('Synthetic list B');t3,a3=make('Synthetic list C')
        for day,(t,a) in enumerate([(t1,a1),(t2,a2),(t1,a1),(t3,a3),(t2,a2)],start=1):
            service.submit_run(db,admin,a,{'qa_date':f'2026-10-0{day}','results':[{'test_id':t,'value':10+day/10}]})
        full=service.machine_trends(db,admin,m)
        # tests= keeps the whole shared series (t1 and t2 share one history) but returns only the tests asked for
        only=service.machine_trends(db,admin,m,**service.trend_window({'tests':str(t1)}))
        self.assertEqual(only,{str(t1):full[str(t1)]})
        self.assertEqual(len(only[str(t1)]),4)
        cut=service.machine_trends(db,admin,m,**service.trend_window({'tests':f'{t1},{t3}','until':'2026-10-03','last':'2'}))
        self.assertEqual(cut,{str(t1):[p for p in full[str(t1)] if p['qa_date']<='2026-10-03'][-2:]})
        self.assertEqual(service.trend(db,admin,m,t2)['points'],full[str(t2)])
        # ASCII digits only, the same grammar as local-backend.js trendWindow (tests/test_backend_windows.cjs).
        for bad in ({'tests':'x'},{'last':'0'},{'last':'2.5'},{'until':'03/10/2026'},{'tests':'0x10'},{'last':'0x3C'},{'tests':'1_0'},{'last':'6_0'},
                    {'tests':'٥'},{'last':'٥'},{'until':'٢٠٢٦-01-01'},{'tests':'1e1'},{'last':'+5'},{'last':'5.0'},{'tests':'1,,2'},{'until':'2026-1-01'}):
            with self.assertRaises(service.PortalError):service.trend_window(bad)
        self.assertEqual(service.trend_window({}),{})
        self.assertEqual(service.trend_window({'tests':'007,12','last':'60','until':'2026-10-03'}),{'tests':{7,12},'last':60,'until':'2026-10-03'})
        db.close()
