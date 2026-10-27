'use strict';
// Native OOXML round-trip: retain all original entries, images, styles and formulas.
// Only worksheet values/caches are patched. No eval or executable workbook content.
window.QAExcel = (() => {
  const data = () => window.QA_WORKBOOK_DATA;
  const keyOf = t => /\[excel: ([^\]]+)\]/.exec(t.description || '')?.[1];
  const supported = t => (t.items || t.results || []).some(x => keyOf(x));
  const flatten = xs => xs.flat(Infinity);
  function parse(formula) {
    const tokens = [], pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|("(?:[^"]|"")*")|(\$?[A-Z]{1,3}\$?\d+)|([A-Z_][A-Z0-9_.]*)|(<=|>=|<>|[+\-*/^=<>():,]))/gy;
    let at = 0;
    while (at < formula.length) {
      pattern.lastIndex = at;
      const m = pattern.exec(formula);
      if (!m) throw Error('Unsupported workbook formula syntax.');
      tokens.push(m[1] ? {n:Number(m[1])} : m[2] ? {s:m[2].slice(1,-1).replaceAll('""','"')} : m[3] ? {r:m[3].replaceAll('$','')} : m[4] ? {id:m[4]} : m[5]);
      at = pattern.lastIndex;
    }
    let i=0;
    const prec={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'+':2,'-':2,'*':3,'/':3,'^':4};
    const expr = (min=0) => {
      let t=tokens[i++], node;
      if (t==='+' || t==='-') node={op:'unary'+t,a:expr(4)};
      else if (t==='(') {node=expr();if(tokens[i++]!==')')throw Error('Unbalanced workbook formula.');}
      else if (t && typeof t==='object') {
        if (t.id) {if(tokens[i++]!=='(')throw Error('Unsupported workbook name.');const args=[];if(tokens[i]!==')')do{args.push(expr());}while(tokens[i++]===',');else i++;node={fn:t.id,args};}
        else node=t;
      } else throw Error('Invalid workbook formula.');
      if (node.r && tokens[i]===':') {i++;const end=tokens[i++];if(!end?.r)throw Error('Invalid range.');node={range:[node.r,end.r]};}
      while (typeof tokens[i]==='string' && prec[tokens[i]] >= min) {const op=tokens[i++];node={op,a:node,b:expr(prec[op]+1)};}
      return node;
    };
    const ast=expr();if(i!==tokens.length)throw Error('Unsupported workbook formula remainder.');return ast;
  }
  const astCache = new Map();
  function evaluate(overrides={}) {
    const book=data(), cache=new Map(), stack=new Set(), editable=new Set(book.mapping.filter(m=>!m.formula).map(m=>m.key)), dependencyCache=new Map();
    const dependencies=(sheet,ref,seen=new Set())=>{
      const key=`${sheet}!${ref}`;if(editable.has(key))return [key];if(dependencyCache.has(key))return dependencyCache.get(key);if(seen.has(key))return [];seen.add(key);
      const formula=book.model[sheet]?.[ref]?.f;if(!formula)return [];
      if(!astCache.has(formula))astCache.set(formula,parse(formula));
      const refs=[];const walk=n=>{if(n.r)refs.push(n.r);if(n.range){const a=XLSX.utils.decode_cell(n.range[0]),b=XLSX.utils.decode_cell(n.range[1]);for(let r=a.r;r<=b.r;r++)for(let c=a.c;c<=b.c;c++)refs.push(XLSX.utils.encode_cell({r,c}));}if(n.a)walk(n.a);if(n.b)walk(n.b);if(n.args)n.args.forEach(walk);};walk(astCache.get(formula));
      const result=[...new Set(refs.flatMap(r=>dependencies(sheet,r,new Set(seen))))];dependencyCache.set(key,result);return result;
    };
    const cell = (sheet,ref) => {
      const key=`${sheet}!${ref}`;
      if(Object.hasOwn(overrides,key))return overrides[key];
      if(cache.has(key))return cache.get(key);
      if(stack.has(key))throw Error('Circular workbook formula.');
      const c=book.model[sheet]?.[ref];if(!c)return null;
      if(!c.f)return c.v ?? null;
      if(dependencies(sheet,ref).some(k=>!Object.hasOwn(overrides,k)||overrides[k]===null||overrides[k]===''))return null;
      stack.add(key);
      if(!astCache.has(c.f))astCache.set(c.f,parse(c.f));
      const v=calc(astCache.get(c.f),sheet);stack.delete(key);cache.set(key,v);return v;
    };
    const calc = (n,sheet) => {
      if(Object.hasOwn(n,'n'))return n.n;if(Object.hasOwn(n,'s'))return n.s;if(n.r)return cell(sheet,n.r);
      if(n.range){const a=XLSX.utils.decode_cell(n.range[0]),b=XLSX.utils.decode_cell(n.range[1]),v=[];for(let r=a.r;r<=b.r;r++)for(let c=a.c;c<=b.c;c++)v.push(cell(sheet,XLSX.utils.encode_cell({r,c})));return v;}
      if(n.fn){const args=n.args;if(n.fn==='IF')return calc(args[0],sheet)?calc(args[1],sheet):args[2]?calc(args[2],sheet):false;
        const v=flatten(args.map(x=>calc(x,sheet)));
        if(n.fn==='ISBLANK')return v[0]===null;if(n.fn==='AND')return v.every(Boolean);if(n.fn==='OR')return v.some(Boolean);if(n.fn==='ABS')return Math.abs(Number(v[0]));
        if(n.fn==='AVERAGE'){const nums=v.filter(x=>typeof x==='number');return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null;}
        throw Error(`Unsupported workbook function ${n.fn}.`);
      }
      const a=calc(n.a,sheet);if(n.op==='unary-')return -Number(a);if(n.op==='unary+')return Number(a);const b=calc(n.b,sheet);
      switch(n.op){case '+':return Number(a)+Number(b);case '-':return Number(a)-Number(b);case '*':return Number(a)*Number(b);case '/':return Number(b)===0?null:Number(a)/Number(b);case '^':return Number(a)**Number(b);case '=':return a===b;case '<>':return a!==b;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;}throw Error('Unsupported workbook operator.');
    };
    return {cell, all:()=>Object.fromEntries(Object.entries(book.model).flatMap(([s,cells])=>Object.entries(cells).filter(([,c])=>c.f).map(([ref])=>[`${s}!${ref}`,cell(s,ref)])))};
  }
  function valuesFromEntries(entries) {
    const out={};for(const e of entries){const key=keyOf(e.item);if(!key)continue;const m=data().mapping.find(x=>x.key===key);if(m?.formula)continue;const raw=e.input.value;out[key]=raw===''?null:e.item.type==='numeric'?Number(raw):e.item.type==='boolean'?(raw==='pass'||raw==='true'||raw==='1'?'PASS':'FAIL'):raw;}return out;
  }
  function wire(entries) {
    if(!entries.some(e=>keyOf(e.item)))return;
    const derived=entries.filter(e=>!window.QADerived?.read(e.item.description)&&data().mapping.find(m=>m.key===keyOf(e.item))?.formula);
    derived.forEach(e=>{e.input.readOnly=true;e.input.placeholder='calculated';e.input.classList.add('from-file');});
    const refresh=()=>{try{const engine=evaluate(valuesFromEntries(entries));for(const e of derived){const v=engine.cell(...keyOf(e.item).split('!'));e.input.value=v==null||v===''?'':typeof v==='number'?String(Number(v.toPrecision(12))):String(v);e.input.dispatchEvent(new Event('input'));}}catch(err){console.error('Workbook calculation:',err.message);}};
    entries.filter(e=>!derived.includes(e)&&!window.QADerived?.read(e.item.description)).forEach(e=>e.input.addEventListener('input',refresh));refresh();
  }
  const textEncoder=new TextEncoder(), textDecoder=new TextDecoder();
  const u16=(v,p)=>new DataView(v.buffer,v.byteOffset,v.byteLength).getUint16(p,true),u32=(v,p)=>new DataView(v.buffer,v.byteOffset,v.byteLength).getUint32(p,true);
  function unzip(bytes) {
    let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&u32(bytes,end)!==0x06054b50)end--;if(end<0)throw Error('Invalid XLSX archive.');
    let p=u32(bytes,end+16);const entries=[];for(let i=0;i<u16(bytes,end+10);i++){if(u32(bytes,p)!==0x02014b50)throw Error('Invalid XLSX directory.');const nl=u16(bytes,p+28),xl=u16(bytes,p+30),cl=u16(bytes,p+32),offset=u32(bytes,p+42),start=offset+30+u16(bytes,offset+26)+u16(bytes,offset+28),size=u32(bytes,p+20);entries.push({name:textDecoder.decode(bytes.slice(p+46,p+46+nl)),method:u16(bytes,p+10),crc:u32(bytes,p+16),size:u32(bytes,p+24),compressed:bytes.slice(start,start+size)});p+=46+nl+xl+cl;}return entries;
  }
  async function inflate(entry){if(entry.method===0)return entry.compressed;if(entry.method!==8)throw Error('Unsupported XLSX compression.');return new Uint8Array(await new Response(new Blob([entry.compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function zip(entries){const chunks=[],central=[];let offset=0;for(const e of entries){const name=textEncoder.encode(e.name),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,e.method,true);v.setUint32(14,e.crc,true);v.setUint32(18,e.compressed.length,true);v.setUint32(22,e.size,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,e.compressed);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(10,e.method,true);d.setUint32(16,e.crc,true);d.setUint32(20,e.compressed.length,true);d.setUint32(24,e.size,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+e.compressed.length;}const end=new Uint8Array(22),d=new DataView(end.buffer),size=central.reduce((n,c)=>n+c.length,0);d.setUint32(0,0x06054b50,true);d.setUint16(8,entries.length,true);d.setUint16(10,entries.length,true);d.setUint32(12,size,true);d.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
  const xmlEscape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function patchXml(xml,updates){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid workbook worksheet.');const ns=doc.documentElement.namespaceURI,make=n=>doc.createElementNS(ns,n),sheetData=doc.getElementsByTagName('sheetData')[0];for(const [ref,value]of Object.entries(updates)){let cell=[...doc.getElementsByTagName('c')].find(c=>c.getAttribute('r')===ref);if(!cell){const r=Number(ref.match(/\d+/)[0]);let row=[...sheetData.children].find(x=>x.getAttribute('r')===String(r));if(!row){row=make('row');row.setAttribute('r',r);const next=[...sheetData.children].find(x=>Number(x.getAttribute('r'))>r);sheetData.insertBefore(row,next||null);}cell=make('c');cell.setAttribute('r',ref);const next=[...row.children].find(x=>XLSX.utils.decode_cell(x.getAttribute('r')).c>XLSX.utils.decode_cell(ref).c);row.insertBefore(cell,next||null);}const formula=cell.getElementsByTagName('f')[0];for(const n of [...cell.children])if(n.localName==='v'||n.localName==='is')n.remove();cell.removeAttribute('t');if(value===null||value===undefined||value==='')continue;const v=make('v');if(typeof value==='number'&&Number.isFinite(value)){v.textContent=String(value);cell.append(v);}else if(formula){cell.setAttribute('t','str');v.textContent=String(value);cell.append(v);}else{cell.setAttribute('t','inlineStr');const inline=make('is'),t=make('t');t.textContent=String(value);inline.append(t);cell.append(inline);}}
    return new XMLSerializer().serializeToString(doc);}
  async function exportFile(values,date,performer){const book=data(),response=await fetch(book.asset);if(!response.ok)throw Error('Original monthly workbook is unavailable.');const original=new Uint8Array(await response.arrayBuffer()),entries=unzip(original),expanded=XLSX.CFB.read(original,{type:'array'}),calculated=evaluate(values).all();const all={...calculated,...values};const serial=(Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;for(const [sn,path]of Object.entries(book.sheets)){const e=entries.find(e=>e.name===path),updates=Object.fromEntries(Object.entries(all).filter(([k])=>k.startsWith(sn+'!')).map(([k,v])=>[k.slice(sn.length+1),v]));if(book.metadata[sn]){updates[book.metadata[sn].date]=serial;updates[book.metadata[sn].performer]=performer;}
      const bytes=textEncoder.encode(patchXml(textDecoder.decode(expanded.FileIndex[expanded.FullPaths.indexOf('Root Entry/'+path)].content),updates));Object.assign(e,{method:0,crc:crc32(bytes),size:bytes.length,compressed:bytes});}
    return zip(entries);}
  async function readFile(file){const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false}),book=data();for(const sn of Object.keys(book.sheets))if(!wb.Sheets[sn])throw Error(`This workbook needs the original worksheet “${sn}”.`);const values={};for(const m of book.mapping){const v=wb.Sheets[m.sheet][m.cell]?.v;if(v===undefined||v===null||v==='')continue;if(m.type==='numeric'&&(!Number.isFinite(Number(v))))throw Error(`${m.key}: expected a number.`);if(m.type==='boolean'&&!/^(pass|fail|yes|no|true|false|1|0)$/i.test(String(v)))throw Error(`${m.key}: expected Pass or Fail.`);values[m.key]=m.type==='numeric'?Number(v):m.type==='boolean'?(/^(pass|yes|true|1)$/i.test(String(v))?'PASS':'FAIL'):String(v);}return {values,workbook:wb};}
  return {data,keyOf,supported,valuesFromEntries,evaluate,wire,readFile,exportFile,parse};
})();
