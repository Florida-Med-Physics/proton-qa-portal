import unittest
from portal.winston_lutz import parse_text

HEADER='DoseLab Winston-Lutz Results\nDate: July 07, 2026\nMaximum delta: 0.45 mm\nMaximum total delta: 0.60 mm\nMean total delta: 0.32mm\nSID: 150 cm\nRadiation field threshold: 50%\nCenter object threshold: 80%\nRegion Images\n'
FIELD='G 0 ° , C 0 ° , T 270 °\nRI.example.dcm\n∆ =-0.39; Total ∆ =0.60mm\n∆ =+0.45mm\n'

class ExpandedWLTests(unittest.TestCase):
    def test_signed_offsets_angles_and_settings(self):
        data=parse_text(HEADER+FIELD,'TrueBeam.pdf')['measurements']
        self.assertEqual(len(data),13)
        field={m['name']:m['result'] for m in data if m['category'].startswith('WL field')}
        self.assertEqual(field,{'Gantry angle':0,'Collimator angle':0,'Couch angle':270,'Horizontal delta':-.39,'Vertical delta':.45,'Total delta':.6})
        self.assertTrue(all(m['sphinx_status']=='Recorded' and m['fail'] is None and m['warn'] is None for m in data[3:]))
    def test_incomplete_and_duplicate_fields_rejected(self):
        for text in (HEADER+FIELD.replace('∆ =+0.45mm',''),HEADER+FIELD+FIELD):
            with self.assertRaises(ValueError):parse_text(text,'TrueBeam.pdf')
    def test_reordering_preserves_field_identity(self):
        second=FIELD.replace('270','90').replace('-0.39','+0.42')
        def values(text):return {(m['category'],m['name']):m['result'] for m in parse_text(text,'TrueBeam.pdf')['measurements']}
        self.assertEqual(values(HEADER+FIELD+second),values(HEADER+second+FIELD))
