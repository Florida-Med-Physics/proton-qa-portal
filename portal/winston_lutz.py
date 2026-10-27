"""Read DoseLab Winston-Lutz report labels, retaining their acquisition date."""
import re
from datetime import datetime
from io import BytesIO


def parse_file(data, filename):
    from pypdf import PdfReader
    text='\n'.join(p.extract_text() or '' for p in PdfReader(BytesIO(data)).pages)
    return parse_text(text, filename)


def parse_text(text, filename):
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
        measurements.append(dict(category='Winston-Lutz',name=name,unit='mm',result=value,expected=0,warn=None,fail=1 if i==0 else None,tol_mode='absolute',criterion='wl-max-delta' if i==0 else None,sphinx_status=('Passed' if value<1 else 'Failed') if i==0 else 'Recorded',sphinx_label=name))
    def record(category, name, unit, value):
        measurements.append(dict(category=category, name=name, unit=unit, result=float(value), expected=0 if unit=='mm' else None, warn=None, fail=None, tol_mode='absolute', criterion=None, sphinx_status='Recorded', sphinx_label=category+' · '+name))
    for label, unit in [('SID','cm'), ('Radiation field threshold','%'), ('Center object threshold','%')]:
        m=re.search(re.escape(label)+r':\s*(\d+(?:\.\d+)?)\s*'+re.escape(unit),text,re.I)
        if m: record('WL settings',label,unit,m[1])
    regions=text.split('Region Images',1)
    if len(regions)>1:
        pattern=r'G\s*([\d.]+)\s*°\s*,\s*C\s*([\d.]+)\s*°\s*,\s*T\s*([\d.]+)\s*°'
        fields=list(re.finditer(pattern,regions[1]))
        seen=set()
        for i,field in enumerate(fields):
            angles=tuple(float(v) for v in field.groups())
            if angles in seen: raise ValueError('Duplicate Winston-Lutz field angles.')
            seen.add(angles)
            block=regions[1][field.end():fields[i+1].start() if i+1<len(fields) else len(regions[1])]
            offsets=re.search(r'[∆Δ]\s*=\s*([+−-]?[\d.]+)\s*;\s*Total\s*[∆Δ]\s*=\s*([\d.]+)\s*mm\s*[∆Δ]\s*=\s*([+−-]?[\d.]+)\s*mm',block)
            if not offsets: raise ValueError('Missing offsets for Winston-Lutz field '+str(angles))
            category='WL field G '+format(angles[0],'g')+'°, C '+format(angles[1],'g')+'°, T '+format(angles[2],'g')+'°'
            for name,value in zip(('Gantry angle','Collimator angle','Couch angle'),angles): record(category,name,'°',value)
            for name,value in zip(('Horizontal delta','Vertical delta','Total delta'),(offsets[1],offsets[3],offsets[2])): record(category,name,'mm',value.replace('−','-'))
        if not fields: raise ValueError('No readable Winston-Lutz region fields.')
        record('WL settings','Image count','',len(fields))
    machine=re.search(r'(?:^|\n)\s*Machine:\s*([^\n]+)',text,re.I)
    return dict(filename=filename,qa_date=qa_date,finished=qa_date+'T00:00:00',sphinx_user='',report_machine=machine[1].strip() if machine else '',measurements=measurements)
