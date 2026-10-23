"""Machine schedule actions must leave templates, other machines and history intact."""
import unittest
from tests import test_machine_selection as fixtures
from portal import service

class ScheduleActionTests(unittest.TestCase):
    setUp = fixtures.MachineSelectionTests.setUp
    tearDown = fixtures.MachineSelectionTests.tearDown
    template = fixtures.MachineSelectionTests.template
    def test_archive_restore_preserves_machine_state_and_exceptions(self):
        aid=self.assignments[1]
        service.save_test_selection(self.db,self.user,aid,{'excluded':[self.base],'added':[self.extra]})
        self.db.run('UPDATE assignments SET active = 0 WHERE id = ?',(aid,))
        service.archive_assignment(self.db,self.user,aid,{'archived':True})
        self.assertEqual(self.db.one('SELECT active FROM assignments WHERE id = ?',(self.assignments[0],))['active'],1)
        self.assertEqual(service.get_queue(self.db,self.user,self.queue)['active'],1)
        service.archive_assignment(self.db,self.user,aid,{'archived':False})
        self.assertEqual(self.template(1)['assignment']['active'],0)
        self.assertEqual([i['test_id'] for i in self.template(1)['items']],[self.extra])

    def test_delete_removes_schedule_only_and_refuses_recorded_results(self):
        service.delete_assignment(self.db,self.user,self.assignments[1])
        self.assertIsNotNone(self.db.one('SELECT id FROM assignments WHERE id = ?',(self.assignments[0],)))
        self.assertEqual(len(service.get_queue(self.db,self.user,self.queue)['items']),1)
        run=service.submit_run(self.db,self.user,self.assignments[0],{'qa_date':'2026-10-22','results':[{'test_id':self.base,'value':'1'}]})
        with self.assertRaisesRegex(service.PortalError,'recorded results'):
            service.delete_assignment(self.db,self.user,self.assignments[0])
        self.assertIsNotNone(service.get_run(self.db,self.user,run['id']))

    def test_duplicate_uses_effective_tests_and_limits_and_starts_inactive(self):
        aid=self.assignments[1]
        service.save_test_selection(self.db,self.user,aid,{'excluded':[self.base],'added':[self.extra]})
        copy=service.duplicate_assignment(self.db,self.user,aid,{'name':'Synthetic G5 copy'})
        template=service.run_template(self.db,self.user,copy['assignment_id'])
        self.assertEqual([i['name'] for i in template['items']],['Synthetic G5 only'])
        self.assertEqual(template['assignment']['active'],0)
        self.assertEqual(template['machine']['id'],self.template(1)['machine']['id'])
        self.assertNotEqual(template['items'][0]['test_id'],self.extra)
        self.assertEqual(len(service.get_queue(self.db,self.user,self.queue)['items']),1)

    def test_reevaluate_updates_only_selected_schedule(self):
        runs=[]
        for aid in self.assignments:
            runs.append(service.submit_run(self.db,self.user,aid,{'qa_date':'2026-10-22','results':[{'test_id':self.base,'value':'1.15'}]})['id'])
        service.save_overrides(self.db,self.user,self.assignments[1],{'overrides':[{'test_id':self.base,'warn':0.3,'fail':0.5}]})
        result=service.reevaluate_assignment(self.db,self.user,self.assignments[1])
        self.assertEqual(result['runs'],1)
        self.assertEqual(service.get_run(self.db,self.user,runs[0])['overall'],'warn')
        self.assertEqual(service.get_run(self.db,self.user,runs[1])['overall'],'pass')

    def test_machine_actions_require_configuration_permission(self):
        for function,args in [(service.delete_assignment,()),(service.reevaluate_assignment,()),(service.archive_assignment,({'archived':True},)),(service.duplicate_assignment,({'name':'Nope'},))]:
            with self.assertRaises(service.PortalError):
                function(self.db,self.users['therapist'],self.assignments[1],*args)
