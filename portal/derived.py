"""Safe arithmetic for derived numeric tests; dependencies must precede their output."""
import ast
import json
import math
import re
from urllib.parse import quote,unquote

MARKER=re.compile(r'\[derived: ([^\]]+)\]')

def read(description):
    m=MARKER.search(description or '')
    return json.loads(unquote(m[1])) if m else None

def evaluate(formula,values):
    if not isinstance(formula,str) or len(formula)>500:raise ValueError('Invalid derived formula.')
    if '**' in formula:raise ValueError('Use A*A for squares.')
    tree=ast.parse(formula,mode='eval')
    if len(list(ast.walk(tree)))>200:raise ValueError('Formula is too long.')
    def calc(n):
        if isinstance(n,ast.Constant) and type(n.value) in (float,int):return float(n.value)
        if isinstance(n,ast.Name) and re.fullmatch('[A-Z]',n.id) and n.id in values:return values[n.id]
        if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub)):return calc(n.operand)*(1 if isinstance(n.op,ast.UAdd) else -1)
        if isinstance(n,ast.BinOp) and isinstance(n.op,(ast.Add,ast.Sub,ast.Mult,ast.Div,ast.Pow)):
            a,b=calc(n.left),calc(n.right)
            if isinstance(n.op,ast.Add):return a+b
            if isinstance(n.op,ast.Sub):return a-b
            if isinstance(n.op,ast.Mult):return a*b
            if isinstance(n.op,ast.Div):return a/b
            if abs(b)>1000:raise ValueError('Exponent is too large.')
            return a**b
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and not n.keywords:
            args=[calc(x) for x in n.args]
            fn={'sqrt':lambda x:math.sqrt(x) if x>=0 else float('nan'),'abs':abs,'min':lambda *a:min(a),'max':lambda *a:max(a),'mean':lambda *a:sum(a)/len(a)}.get(n.func.id)
            if fn and args:return fn(*args)
        raise ValueError('Use input letters, numbers, arithmetic, sqrt, abs, min, max or mean.')
    try:
        value=calc(tree.body)
        return value if isinstance(value,(int,float)) and math.isfinite(value) else None
    except (ZeroDivisionError,OverflowError):return None

def validate(rule):
    if isinstance(rule,dict) and rule.get('kind')=='lookup':
        inputs=rule.get('inputs');rows=rule.get('values')
        if not isinstance(inputs,list) or len(inputs)!=1 or not isinstance(inputs[0],dict) or not isinstance(inputs[0].get('name'),str) or not isinstance(inputs[0].get('category'),str):raise ValueError('Choose one earlier multiple-choice test.')
        if not isinstance(rows,list) or len(rows)>100:raise ValueError('Enter device calibration factors.')
        choices=[]
        for row in rows:
            if not isinstance(row,dict) or 'value' not in row or not isinstance(row.get('choice'),str) or not row['choice'].strip() or row['choice'] in choices:raise ValueError('Each device must have a unique name.')
            choices.append(row['choice']);value=row.get('value')
            if value is not None and (type(value) not in (float,int) or not math.isfinite(value)):raise ValueError('Calibration factors must be finite numbers or blank.')
        return rule
    if not isinstance(rule,dict) or not isinstance(rule.get('inputs'),list) or not 1<=len(rule['inputs'])<=26 or any(not isinstance(x,dict) or not isinstance(x.get('name'),str) or not isinstance(x.get('category'),str) for x in rule['inputs']):raise ValueError('Select 1–26 earlier numeric tests.')
    evaluate(rule.get('formula'),{chr(65+i):1 for i in range(len(rule['inputs']))})
    return rule

def encode(description,rule):
    clean=re.sub(r'\s*\[derived: [^\]]+\]','',description or '')
    return clean+(' [derived: '+quote(json.dumps(validate(rule)),safe='')+']' if rule else '')

def resolve(rule,prior):
    validate(rule);sources=[]
    for source in rule['inputs']:
        matches=[x for x in prior if x['name']==source['name'] and (x.get('category') or '')==source['category'] and x['type']==('choice' if rule.get('kind')=='lookup' else 'numeric')]
        if len(matches)!=1:raise ValueError(f"Derived input '{source['name']}' must be an earlier matching test in this list.")
        sources.append(matches[0])
    return sources

def calculate(rule,prior,get):
    sources=resolve(rule,prior)
    if rule.get('kind')=='lookup':
        selected=get(sources[0])
        return next((row.get('value') for row in rule['values'] if row['choice']==selected),None)
    values=[get(x) for x in sources]
    if any(v is None or str(v).strip()=='' for v in values):return None
    return evaluate(rule['formula'],{chr(65+i):float(v) for i,v in enumerate(values)})
