"""Deleting unused machines preserves shared templates; machines with history must be retired."""
import unittest
from tests import test_machine_selection as fixtures
from portal import service

class MachineDeletionTests(unittest.TestCase):
    setUp=fixtures.MachineSelectionTests.setUp
    tearDown=fixtures.MachineSelectionTests.tearDown
    template=fixtures.MachineSelectionTests.template
    def test_unused_machine_deletion_removes_only_its_schedules(self):
        machine=self.template(1)['machine']['id']
        service.delete_machine(self.db,self.user,machine)
        self.assertIsNone(self.db.one('SELECT id FROM machines WHERE id=?',(machine,)))
        self.assertIsNotNone(self.db.one('SELECT id FROM assignments WHERE id=?',(self.assignments[0],)))
        self.assertEqual(len(service.get_queue(self.db,self.user,self.queue)['items']),1)
    def test_history_blocks_deletion_and_retirement_keeps_results(self):
        machine=self.template(1)['machine']
        run=service.submit_run(self.db,self.user,self.assignments[1],{'qa_date':'2026-10-22','results':[{'test_id':self.base,'value':'1'}]})
        with self.assertRaisesRegex(service.PortalError,'Retire'):
            service.delete_machine(self.db,self.user,machine['id'])
        service.save_machine(self.db,self.user,{**machine,'active':False},machine['id'])
        self.assertIsNotNone(service.get_run(self.db,self.user,run['id']))
        self.assertNotIn(machine['id'],[m['id'] for m in service.dashboard(self.db,self.user)['machines']])
    def test_permissions(self):
        with self.assertRaises(service.PortalError):
            service.delete_machine(self.db,self.users['therapist'],self.template(1)['machine']['id'])
