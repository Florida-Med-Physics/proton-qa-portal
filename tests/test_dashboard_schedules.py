import unittest
from portal.db import Database
from portal import service
from tests.test_portal import make_users

class DashboardScheduleTests(unittest.TestCase):
    def test_requested_defaults_apply_once_and_keep_other_schedules(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        targets=[('TrueBeam','Monthly QA – TrueBeam','monthly'),('HDR Flexitron','Daily QA – HDR Flexitron','asneeded'),('HDR Flexitron','Source Exchange QA – HDR Flexitron','asneeded')]
        ids=[]
        for machine,name,frequency in targets:
            existing=db.one('SELECT id FROM machines WHERE name=?',(machine,))
            mid=existing['id'] if existing else service.save_machine(db,admin,{'name':machine})['id']
            qid=service.save_queue(db,admin,{'name':name,'items':[]})['id']
            aid=service.save_assignment(db,admin,{'machine_id':mid,'queue_id':qid,'frequency':'daily','active':False})['id'];ids.append((aid,frequency))
        db._install_requested_dashboard_schedules()
        for aid,freq in ids:
            a=db.one('SELECT * FROM assignments WHERE id=?',(aid,));self.assertEqual(a['frequency'],freq);self.assertEqual(a['active'],1)
        db.run("UPDATE assignments SET frequency='weekly' WHERE id=?",(ids[0][0],))
        db._install_requested_dashboard_schedules()
        self.assertEqual(db.one('SELECT frequency FROM assignments WHERE id=?',(ids[0][0],))['frequency'],'weekly')
        db.close()
