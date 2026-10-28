"""Validate saved import mappings; extracted answers still use normal run validation."""
import re

def validate(blocks, items):
    if not isinstance(blocks,list) or len(blocks)>20: raise ValueError('Use up to 20 import blocks.')
    ids=set()
    for b in blocks:
        if not isinstance(b,dict) or not isinstance(b.get('id'),str) or b['id'] in ids or not isinstance(b.get('name'),str) or not b['name'].strip() or len(b['name'])>120 or b.get('reader') not in ('excel','columns','labels','pdf','sphinx','hdr','proton-monthly','dqa3'): raise ValueError('Each import block needs a unique ID, name, and reader.')
        ids.add(b['id'])
        if b['reader'] in ('sphinx','hdr'): continue
        if b['reader']=='columns' and (type(b.get('header_row',1)) is not int or not 1<=b.get('header_row',1)<=1000000): raise ValueError('Enter a valid CSV header row.')
        mappings=b.get('mappings')
        if not isinstance(mappings,list) or not 1<=len(mappings)<=500: raise ValueError('Add at least one test mapping.')
        seen=set()
        for m in mappings:
            ref=m.get('test',{}) if isinstance(m,dict) else {}
            key=(ref.get('name'),ref.get('category',''))
            matches=[t for t in items if (t['name'],t.get('category',''))==key]
            if len(matches)!=1 or re.search(r'\[(?:derived:|calc: workbook)',matches[0].get('description') or ''): raise ValueError('Map an existing, non-derived test.')
            if key in seen: raise ValueError('Map each test once per block.')
            seen.add(key)
            if not isinstance(m.get('source'),str) or not m['source'].strip() or len(m['source'])>200: raise ValueError('Enter a cell, column, or report label for each mapping.')
            if b['reader'] in ('excel','proton-monthly') and not re.fullmatch(r'\$?[A-Za-z]{1,3}\$?[1-9]\d{0,6}',m['source']): raise ValueError('Excel mappings need cell addresses such as F17.')
            if type(m.get('row')) is not int or not 1<=m['row']<=1000000: raise ValueError('Enter a positive row or value number.')
        if b.get('sheet') is not None and (not isinstance(b['sheet'],str) or len(b['sheet'])>120): raise ValueError('Invalid worksheet name.')
    return blocks
