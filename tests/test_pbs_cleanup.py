import tempfile
import unittest
from pathlib import Path
from portal.db import Database
from portal import service
from tests.test_portal import make_users

class PbsCleanupTests(unittest.TestCase):
    def test_existing_names_limits_and_ids(self):
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / 'test.db')
            db = Database(path)
            user = make_users(db)['admin']
            q = service.save_queue(db, user, {'name': 'PBS DailyQA Template - Sphinx'})['id']
            t = service.save_test(db, user, {'name': 'GTR5_Energy [100 MeV]: Distal Depth [mm]', 'type': 'numeric', 'unit': 'mm', 'expected': 123, 'warn': .75, 'fail': 1.5, 'owner_queue_id': q})['id']
            db.close()
            db = Database(path)
            test = db.one('SELECT * FROM tests WHERE id=?', (t,))
            self.assertNotIn('GTR', test['name'])
            self.assertEqual(test['expected'], 123)
            self.assertEqual(test['warn'], .5)
            self.assertEqual(test['fail'], 1)
            db.run('UPDATE tests SET warn=.6 WHERE id=?', (t,))
            db.close()
            db = Database(path)
            self.assertEqual(db.one('SELECT warn FROM tests WHERE id=?', (t,))['warn'], .6)
            db.close()
