/* Derived results stay numeric for units, tolerances, history and workbook compatibility. */
window.QADerived=(()=>{
  const marker=/\[derived: ([^\]]+)\]/;
  function read(description){const m=marker.exec(description||'');if(!m)return null;try{return JSON.parse(decodeURIComponent(m[1]));}catch{throw Error('Invalid derived calculation.');}}
  function evaluate(formula,values){
    if(String(formula).includes('**'))throw Error('Use A*A for squares.');
    const tokens=String(formula).match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|\*\*|[()+\-*/,]/gi)||[];
    if(tokens.join('').toLowerCase()!==String(formula).replace(/\s/g,'').toLowerCase()||tokens.length>200)throw Error('Use numbers, input letters, + − * /, parentheses, sqrt, abs, min, max or mean.');
    let i=0;const functions={sqrt:Math.sqrt,abs:Math.abs,min:Math.min,max:Math.max,mean:(...a)=>a.reduce((s,v)=>s+v,0)/a.length};
    function atom(){const t=tokens[i++];if(t==='+')return atom();if(t==='-')return -atom();if(t==='('){const v=expr();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return v;}if(/^[A-Z]$/.test(t||'')){if(!(t in values))throw Error(`Input ${t} is not selected.`);return values[t];}if(t in functions){if(tokens[i++]!=='(')throw Error('Use parentheses for functions.');const a=[expr()];while(tokens[i]===','){i++;a.push(expr());}if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');if((t==='sqrt'||t==='abs')&&a.length!==1)throw Error(`${t} needs one input.`);return functions[t](...a);}if(t&&/^\d|^\./.test(t))return Number(t);throw Error('Invalid calculation.');}
    function power(){let v=atom();if(tokens[i]==='**'){i++;v=v**power();}return v;}
    function term(){let v=power();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],n=power();v=op==='*'?v*n:v/n;}return v;}
    function expr(){let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],n=term();v=op==='+'?v+n:v-n;}return v;}
    const result=expr();if(i!==tokens.length)throw Error('Invalid calculation.');return Number.isFinite(result)?result:null;
  }
  function validate(rule){if(!rule||!Array.isArray(rule.inputs)||!rule.inputs.length||rule.inputs.length>26||rule.inputs.some(x=>!x||typeof x.name!=='string'||typeof x.category!=='string')||typeof rule.formula!=='string'||rule.formula.length>500)throw Error('Select 1–26 earlier numeric tests and enter a formula.');evaluate(rule.formula,Object.fromEntries(rule.inputs.map((x,i)=>[String.fromCharCode(65+i),1])));return rule;}
  function encode(description,rule){return (description||'').replace(/\s*\[derived: [^\]]+\]/g,'')+(rule?' [derived: '+encodeURIComponent(JSON.stringify(validate(rule)))+']':'');}
  function resolve(rule,prior){validate(rule);return rule.inputs.map(source=>{const matches=prior.filter(x=>x.name===source.name&&(x.category||'')===source.category&&x.type==='numeric');if(matches.length!==1)throw Error(`Derived input “${source.name}” must be an earlier numeric test in this list.`);return matches[0];});}
  function calculate(rule,prior,get){const sources=resolve(rule,prior),values=sources.map(get);if(values.some(v=>v===null||v===undefined||String(v).trim()===''||!Number.isFinite(Number(v))))return null;return evaluate(rule.formula,Object.fromEntries(values.map((v,i)=>[String.fromCharCode(65+i),Number(v)])));}
  function value(input){return input.readOnly&&input.dataset.derivedValue!==undefined?input.dataset.derivedValue:input.value;}
  function setInput(input,result){const valid=result!==null&&Number.isFinite(Number(result));input.dataset.derivedValue=valid?String(result):'';input.value=valid?Number(result).toPrecision(3):'';}
  return {read,evaluate,validate,encode,resolve,calculate,value,setInput};
})();
