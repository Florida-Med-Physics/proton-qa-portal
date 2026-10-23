"""Synthetic machine exceptions stay separate while shared definitions keep syncing."""
import json
import unittest
from portal import service
from portal.db import Database
from tests.test_portal import make_users

class MachineSelectionTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(':memory:')
        self.users = make_users(self.db)
        self.user = self.users['admin']
        self.queue = service.save_queue(self.db, self.user, {'name': 'Synthetic shared'})['id']
        self.base = service.save_test(self.db, self.user, {'name': 'Synthetic shared test', 'owner_queue_id': self.queue, 'expected': 1, 'warn': 0.1, 'fail': 0.2})['id']
        self.extra = service.save_test(self.db, self.user, {'name': 'Synthetic G5 only', 'owner_queue_id': self.queue, 'type': 'boolean'})['id']
        service.save_queue(self.db, self.user, {'name':'Synthetic shared', 'items':[{'test_id':self.base}]},self.queue)
        self.assignments=[]
        for name in ['Synthetic G1', 'Synthetic G5']:
            machine=service.save_machine(self.db,self.user,{'name':name})['id']
            self.assignments.append(service.save_assignment(self.db,self.user,{'machine_id':machine,'queue_id':self.queue,'frequency':'asneeded'})['id'])
    def tearDown(self):
        self.db.close()
    def template(self,index):
        return service.run_template(self.db,self.user,self.assignments[index])
    def test_exclude_add_sync_and_reset(self):
        aid=self.assignments[1]
        service.save_test_selection(self.db,self.user,aid,{'excluded':[self.base],'added':[self.extra]})
        self.assertEqual([i['test_id'] for i in self.template(0)['items']],[self.base])
        self.assertEqual([i['test_id'] for i in self.template(1)['items']],[self.extra])
        shared=service.get_queue(self.db,self.user,self.queue)
        new=service.save_test(self.db,self.user,{'name':'New shared test','type':'text','owner_queue_id':self.queue})['id']
        service.save_queue(self.db,self.user,{'name':shared['name'],'items':[{'test_id':self.base},{'test_id':new}]},self.queue)
        self.assertEqual([i['test_id'] for i in self.template(1)['items']],[new,self.extra])
        self.assertEqual([i['test_id'] for i in self.template(0)['items']],[self.base,new])
        service.save_test_selection(self.db,self.user,aid,{'excluded':[],'added':[]})
        self.assertEqual([i['test_id'] for i in self.template(1)['items']],[self.base,new])
    def test_shared_limits_sync_and_machine_override_wins(self):
        service.save_overrides(self.db,self.user,self.assignments[1],{'overrides':[{'test_id':self.base,'warn':0.05}]})
        service.save_queue(self.db,self.user,{'name':'Synthetic shared','items':[{'test_id':self.base,'warn':0.15}]},self.queue)
        self.assertEqual(self.template(0)['items'][0]['limits']['warn'],0.15)
        self.assertEqual(self.template(1)['items'][0]['limits']['warn'],0.05)
    def test_permissions_and_cross_list_validation(self):
        with self.assertRaises(service.PortalError):
            service.save_test_selection(self.db,self.users['therapist'],self.assignments[1],{'excluded':[self.base]})
        other=service.save_queue(self.db,self.user,{'name':'Other'})['id']
        foreign=service.save_test(self.db,self.user,{'name':'Foreign','owner_queue_id':other})['id']
        with self.assertRaises(service.PortalError):
            service.save_test_selection(self.db,self.user,self.assignments[1],{'added':[foreign]})
        self.assertEqual(self.template(1)['test_selection'],{})
    def test_completed_run_uses_effective_membership_and_keeps_history(self):
        aid=self.assignments[1]
        service.save_test_selection(self.db,self.user,aid,{'excluded':[self.base],'added':[self.extra]})
        run=service.submit_run(self.db,self.user,aid,{'qa_date':'2026-10-22','results':[{'test_id':self.extra,'value':'yes'}]})
        service.save_test_selection(self.db,self.user,aid,{'excluded':[],'added':[]})
        result=service.get_run(self.db,self.user,run['id'])
        self.assertEqual([r['test_id'] for r in result['results']],[self.extra])
    def test_sphinx_does_not_readd_excluded_measurements(self):
        aid = self.assignments[1]
        service.save_test_selection(self.db, self.user, aid, {'excluded': [self.base]})
        template = self.template(1)
        ids, added = service._sphinx_test_ids(self.db, self.user, template, [{'category': '', 'name': 'Synthetic shared test'}], True)
        self.assertEqual(ids, {})
        self.assertEqual(added, [])
        self.assertEqual(self.template(1)['items'], [])

    def test_hdr_seed_has_two_on_demand_shells(self):
        db=Database(':memory:');user=make_users(db)['admin'];service.seed_defaults(db,user)
        hdr=next(m for m in service.list_machines(db,user) if m['name']=='HDR Flexitron')
        schedules=service.list_assignments(db,user,hdr['id'])
        self.assertEqual(len(schedules),2)
        self.assertTrue(all(a['frequency']=='asneeded' for a in schedules))
        self.assertTrue(all(not service.run_template(db,user,a['id'])['items'] for a in schedules))
        db.close()
