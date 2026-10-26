import unittest
from unittest.mock import patch
from portal import qa, service, winston_lutz
from portal.db import Database
from tests.test_portal import make_users

class WinstonLutzTests(unittest.TestCase):
    def test_strict_boundary_and_context_only(self):
        limits=qa.resolve_limits({'description':'[rule: wl-max-delta]','expected':0,'warn':None,'fail':1,'tol_mode':'absolute'})
        for x in (0,0.45,0.999999999):self.assertEqual(qa.evaluate('numeric',x,limits),'pass')
        for x in (-0.1,1,1.01):self.assertEqual(qa.evaluate('numeric',x,limits),'fail')
        self.assertEqual(qa.evaluate('numeric',20,{'expected':None}),'recorded')
    def test_distinct_pdf_labels_and_required_date(self):
        from types import SimpleNamespace
        text='DoseLab Winston-Lutz Results\nDate: July 07, 2026\nMachine: Eyeline\nMaximum delta: 0.45 mm\nMaximum total delta: 0.60 mm\nMean total delta: 0.32mm'
        with patch('pypdf.PdfReader',return_value=SimpleNamespace(pages=[SimpleNamespace(extract_text=lambda:text)])):
            p=winston_lutz.parse_file(b'fake','TrueBeam.pdf')
        self.assertEqual(p['qa_date'],'2026-07-07')
        self.assertEqual([m['result'] for m in p['measurements']],[.45,.60,.32])
        self.assertEqual([m['sphinx_status'] for m in p['measurements']],['Passed','Recorded','Recorded'])
        with patch('pypdf.PdfReader',return_value=SimpleNamespace(pages=[SimpleNamespace(extract_text=lambda:text.replace('Date:','Acquired:'))])):
            with self.assertRaisesRegex(ValueError,'date'):winston_lutz.parse_file(b'fake','2026-07-07.pdf')
    def test_server_submission_uses_only_maximum_delta(self):
        db=Database(':memory:');admin=make_users(db)['admin']
        q=service.save_queue(db,admin,{'name':'SRS','items':[]})['id']
        ts=[]
        for name,description in [('Maximum delta','[rule: wl-max-delta]'),('Maximum total delta','Context only')]:
            ts.append(service.save_test(db,admin,{'name':name,'category':'Winston-Lutz','type':'numeric','description':description,'expected':0 if not ts else None,'fail':1 if not ts else None,'owner_queue_id':q})['id'])
        service.save_queue(db,admin,{'name':'SRS','items':[{'test_id':t} for t in ts]},q)
        m=service.save_machine(db,admin,{'name':'TrueBeam'})['id'];a=service.save_assignment(db,admin,{'machine_id':m,'queue_id':q,'frequency':'asneeded'})['id']
        for x,verdict in [(0.45,'pass'),(1,'fail')]:
            r=service.submit_run(db,admin,a,{'qa_date':'2026-07-07','results':[{'test_id':ts[0],'value':x},{'test_id':ts[1],'value':100}]})
            self.assertEqual(r['overall'],verdict)
        db.close()
