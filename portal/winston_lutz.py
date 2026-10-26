"""Read DoseLab Winston-Lutz report labels, retaining their acquisition date."""
import re
from datetime import datetime
from io import BytesIO


def parse_file(data, filename):
    from pypdf import PdfReader
    text='\n'.join(p.extract_text() or '' for p in PdfReader(BytesIO(data)).pages)
    if not re.search(r'DoseLab\s+Winston[–-]Lutz\s+Results',text,re.I):
        raise ValueError('Not a DoseLab Winston-Lutz report.')
    match=re.search(r'\bDate:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})',text,re.I)
    if not match:
        raise ValueError('The report needs a readable acquisition date.')
    qa_date=datetime.strptime(match[1],'%B %d, %Y').date().isoformat()
    measurements=[]
    for i,name in enumerate(('Maximum delta','Maximum total delta','Mean total delta')):
        m=re.search(r'(?:^|\n)\s*'+name+r'\s*:\s*([+\-]?\d+(?:\.\d+)?)\s*mm\b',text,re.I)
        if not m or float(m[1])<0: raise ValueError('Missing or invalid '+name+'.')
        value=float(m[1])
        measurements.append(dict(category='Winston-Lutz',name=name,unit='mm',result=value,expected=0 if i==0 else None,warn=None,fail=1 if i==0 else None,tol_mode='absolute',criterion='wl-max-delta' if i==0 else None,sphinx_status=('Passed' if value<1 else 'Failed') if i==0 else 'Recorded',sphinx_label=name))
    machine=re.search(r'(?:^|\n)\s*Machine:\s*([^\n]+)',text,re.I)
    return dict(filename=filename,qa_date=qa_date,finished=qa_date+'T00:00:00',sphinx_user='',report_machine=machine[1].strip() if machine else '',measurements=measurements)
