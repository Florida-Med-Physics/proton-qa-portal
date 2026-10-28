/* Configurable, local-only imports. Values are previewed; templates retain their limits. */
window.QAMappedImports=(()=>{
  const protonDefaults={"sheet": "GTR5 Monthly QA", "cells": {"Door interlock": "F17", "MU chamber interlocks": "F18", "Beam pause / hold and resume": "F19", "Audio intercom and video monitoring": "F20", "“Beam ON” indicator": "F21", "“X-ray ON” indicator": "F22", "Room search / clearance chime": "F23", "Couch translational accuracy — X (lateral) [mm]": "F29", "Couch translational accuracy — Y (longitudinal) [mm]": "F30", "Couch translational accuracy — Z (vertical) [mm]": "F31", "Couch rotational accuracy — T090 [deg]": "F32", "Couch pitch accuracy [deg]": "F33", "Couch roll accuracy [deg]": "F34", "Couch yaw accuracy [deg]": "F35", "Couch trueness (vertical sag) [mm]": "F36", "CBCT match residual — X [mm]": "F39", "CBCT match residual — Y [mm]": "F40", "CBCT match residual — Z [mm]": "F41", "kV-kV match residual — X [mm]": "F42", "kV-kV match residual — Y [mm]": "F43", "kV-kV match residual — Z [mm]": "F44", "Snout extension accuracy [mm]": "F58", "XRV ISO difference — G000 [mm]": "F62", "XRV ISO difference — G060 [mm]": "F63", "XRV ISO difference — G120 [mm]": "F64", "XRV ISO difference — G180 [mm]": "F65", "Spatial resolution (high contrast)": "F133", "Uniformity and noise": "F135", "Artefacts / dead pixels": "F136", "Geometric accuracy / scaling [mm]": "F137", "HU constancy — water insert [HU]": "F139", "Uniformity [HU]": "F140", "Geometric distortion / scaling [mm]": "F141", "Spatial resolution": "F142", "Noise / SNR": "F144", "Chamber temperature [°C]": "F4", "Air pressure [hPa]": "F5", "Spot QA performed this month (quarterly items)": "C7", "Couch angle 0° – BB walkout X [mm]": "E48", "Couch angle 0° – BB walkout Y [mm]": "F48", "Couch angle 0° – BB walkout Z [mm]": "G48", "Couch angle 315° – BB walkout X [mm]": "E49", "Couch angle 315° – BB walkout Y [mm]": "F49", "Couch angle 315° – BB walkout Z [mm]": "G49", "Couch angle 270° – BB walkout X [mm]": "E50", "Couch angle 270° – BB walkout Y [mm]": "F50", "Couch angle 270° – BB walkout Z [mm]": "G50", "Couch angle 225° – BB walkout X [mm]": "E51", "Couch angle 225° – BB walkout Y [mm]": "F51", "Couch angle 225° – BB walkout Z [mm]": "G51", "Couch angle 180° – BB walkout X [mm]": "E52", "Couch angle 180° – BB walkout Y [mm]": "F52", "Couch angle 180° – BB walkout Z [mm]": "G52", "Output G0 – 70 MeV – charge [nC]": "F75", "Output G0 – 120 MeV – charge [nC]": "F76", "Output G0 – 180 MeV – charge [nC]": "F77", "Output G0 – 225 MeV – charge [nC]": "F78", "Output G90 – 70 MeV – charge [nC]": "F79", "Output G90 – 120 MeV – charge [nC]": "F80", "Output G90 – 180 MeV – charge [nC]": "F81", "Output G90 – 225 MeV – charge [nC]": "F82", "Range R90 (Zebra) – 70 MeV [mm]": "F85", "Range R90 (Zebra) – 80 MeV [mm]": "F86", "Range R90 (Zebra) – 90 MeV [mm]": "F87", "Range R90 (Zebra) – 100 MeV [mm]": "F88", "Range R90 (Zebra) – 110 MeV [mm]": "F89", "Range R90 (Zebra) – 120 MeV [mm]": "F90", "Range R90 (Zebra) – 130 MeV [mm]": "F91", "Range R90 (Zebra) – 140 MeV [mm]": "F92", "Range R90 (Zebra) – 150 MeV [mm]": "F93", "Range R90 (Zebra) – 160 MeV [mm]": "F94", "Range R90 (Zebra) – 170 MeV [mm]": "F95", "Range R90 (Zebra) – 180 MeV [mm]": "F96", "Range R90 (Zebra) – 190 MeV [mm]": "F97", "Range R90 (Zebra) – 200 MeV [mm]": "F98", "Range R90 (Zebra) – 210 MeV [mm]": "F99", "Range R90 (Zebra) – 220 MeV [mm]": "F100", "Range R90 (Zebra) – 225 MeV [mm]": "F101", "Spot QA G0 – 100 MeV – position deviation [mm]": "F104", "Spot QA G0 – 100 MeV – σx [%]": "F105", "Spot QA G0 – 100 MeV – σy [%]": "F106", "Spot QA G0 – 100 MeV – skewness": "F107", "Spot QA G0 – 160 MeV – position deviation [mm]": "F108", "Spot QA G0 – 160 MeV – σx [%]": "F109", "Spot QA G0 – 160 MeV – σy [%]": "F110", "Spot QA G0 – 160 MeV – skewness": "F111", "Spot QA G0 – 220 MeV – position deviation [mm]": "F112", "Spot QA G0 – 220 MeV – σx [%]": "F113", "Spot QA G0 – 220 MeV – σy [%]": "F114", "Spot QA G0 – 220 MeV – skewness": "F115", "Spot QA G90 – 100 MeV – position deviation [mm]": "F116", "Spot QA G90 – 100 MeV – σx [%]": "F117", "Spot QA G90 – 100 MeV – σy [%]": "F118", "Spot QA G90 – 100 MeV – skewness": "F119", "Spot QA G90 – 160 MeV – position deviation [mm]": "F120", "Spot QA G90 – 160 MeV – σx [%]": "F121", "Spot QA G90 – 160 MeV – σy [%]": "F122", "Spot QA G90 – 160 MeV – skewness": "F123", "Spot QA G90 – 220 MeV – position deviation [mm]": "F124", "Spot QA G90 – 220 MeV – σx [%]": "F125", "Spot QA G90 – 220 MeV – σy [%]": "F126", "Spot QA G90 – 220 MeV – skewness": "F127"}};
  const readers=['excel','columns','labels','pdf','sphinx','hdr','proton-monthly','dqa3'];
  const key=t=>JSON.stringify([t.name,t.category||'']);
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function validate(blocks,items){
    if(!Array.isArray(blocks)||blocks.length>20)throw Error('Use up to 20 import blocks.');
    const ids=new Set();
    for(const b of blocks){
      if(!b||typeof b.id!=='string'||ids.has(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!readers.includes(b.reader))throw Error('Each import block needs a unique ID, name, and reader.');ids.add(b.id);
      if(['sphinx','hdr'].includes(b.reader))continue;
      if(!Array.isArray(b.mappings)||!b.mappings.length||b.mappings.length>500)throw Error('Add at least one test mapping.');
      if(b.reader==='columns'&&(!Number.isInteger(b.header_row??1)||(b.header_row??1)<1||(b.header_row??1)>1000000))throw Error('Enter a valid CSV header row.');
      const seen=new Set();
      for(const m of b.mappings){
        const matches=items.filter(t=>key(t)===key(m.test||{}));
        if(matches.length!==1||/\[(?:derived:|calc: workbook)/.test(matches[0]?.description||''))throw Error('Map an existing, non-derived test.');
        if(seen.has(key(m.test)))throw Error('Map each test once per block.');seen.add(key(m.test));
        if(typeof m.source!=='string'||!m.source.trim()||m.source.length>200)throw Error('Enter a cell, column, or report label for each mapping.');
        if(['excel','proton-monthly'].includes(b.reader)&&!/^\$?[A-Za-z]{1,3}\$?[1-9]\d{0,6}$/.test(m.source))throw Error('Excel mappings need cell addresses such as F17.');
        if(!Number.isInteger(m.row)||m.row<1||m.row>1000000)throw Error('Enter a positive row or value number.');
      }
      if(b.sheet!=null&&(typeof b.sheet!=='string'||b.sheet.length>120))throw Error('Invalid worksheet name.');
    }return blocks;
  }
  function convert(raw,item){
    if(raw==null||String(raw).trim()==='')return null;
    if(item.type==='numeric'){
      if(typeof raw==='number'){if(Number.isFinite(raw))return raw;throw Error('Not a finite measurement.');}
      const text=String(raw).trim(),m=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(.*?)$/i.exec(text);
      if(!m||m[2]&&norm(m[2])!==norm(item.unit))throw Error('Expected one number'+(item.unit?' in '+item.unit:'')+'.');const value=Number(m[1]);if(!Number.isFinite(value))throw Error('Not a finite measurement.');return value;
    }
    if(item.type==='boolean'){const v=String(raw).trim().toLowerCase();if(['pass','passed','yes','true','1'].includes(v))return 'pass';if(['fail','failed','no','false','0'].includes(v))return 'fail';throw Error('Expected Pass/Fail or Yes/No.');}
    if(item.type==='status'){const v=String(raw).trim().toLowerCase();if(['pass','passed'].includes(v))return 'pass';if(['warning','warn'].includes(v))return 'warn';if(['fail','failed','action'].includes(v))return 'fail';throw Error('Expected Pass, Warning, or Fail.');}
    if(item.type==='choice'){const match=/\[choices: ([^\]]+)\]/.exec(item.description||'');const choices=match?JSON.parse(decodeURIComponent(match[1])):[];if(!choices.includes(String(raw).trim()))throw Error('Value is not one of this test’s choices.');}
    return String(raw).trim();
  }
  async function pdfText(bytes,progress=()=>{}){
    const lib=await import('./pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
    const pdf=await lib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;let worker;
    try{if(pdf.numPages>20)throw Error('Use a PDF with 20 pages or fewer.');const pages=[];
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),content=await page.getTextContent();let text=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');
        if(text.trim().length<80){
          progress(`Recognizing PDF page ${n} of ${pdf.numPages}…`);
          if(!window.Tesseract)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('ocr/tesseract.min.js',document.baseURI).href;s.onload=resolve;s.onerror=()=>reject(Error('OCR could not load.'));document.head.append(s);});
          worker ||= await Tesseract.createWorker('eng',1,{workerPath:new URL('ocr/worker.min.js',document.baseURI).href,corePath:new URL('ocr/',document.baseURI).href,langPath:new URL('ocr/',document.baseURI).href.replace(/\/$/,''),cacheMethod:'write'});
          const view=page.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;text=(await worker.recognize(canvas)).data.text;
        }pages.push(text);
      }return pages.join('\n');
    }finally{if(worker)await worker.terminate();await pdf.destroy();}
  }
  async function read(file,block,items,progress=()=>{}){
    validate([block],items);const bytes=new Uint8Array(await file.arrayBuffer());let sheet,rows,text='';
    if(block.reader==='pdf'||/\.pdf$/i.test(file.name))text=await pdfText(bytes,progress);
    else if(['labels','dqa3'].includes(block.reader))text=new TextDecoder().decode(bytes);
    else{
      const book=XLSX.read(bytes,{type:'array',raw:true,codepage:65001});
      const sn=block.sheet||book.SheetNames[0];sheet=book.Sheets[sn];if(!sheet)throw Error(`Worksheet “${sn}” was not found.`);
      rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
    }
    return block.mappings.map(m=>{
      const item=items.find(t=>key(t)===key(m.test));let raw;
      try{
        if(text){
          const lines=text.split(/\r?\n/).filter(line=>norm(line).startsWith(norm(m.source)));
          if(!lines.length)return {item,source:m.source,value:null,raw:'',message:'Not found — stays unanswered'};
          if(lines.length>1)throw Error('This label matches more than one line. Use a more specific label.');
          const line=lines[0];let end=0,acc='';for(;end<line.length&&acc!==norm(m.source);end++)acc=norm(line.slice(0,end+1));
          const rest=line.slice(end).replace(/^[\s:=|,;\t]+/,'');
          if(item.type==='numeric'){
            const values=rest.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi)||[];
            if(values.length>1&&m.row===1)throw Error('More than one number follows this label. Set the value number explicitly (2 or higher), or use a more specific label.');
            raw=values.length===1?rest.replace(/\s+(?:Passed|Failed|Pass|Fail|Warning)\b.*$/i,'').trim():values[m.row-1]??'';
          }else raw=rest;
        }else if(['excel','proton-monthly'].includes(block.reader)){
          const cell=sheet[m.source.replace(/\$/g,'').toUpperCase()];if(cell?.f&&cell.v==null)throw Error('Recalculate and save this workbook in Excel first.');raw=cell?.v;
        }else{
          const headers=rows[(block.header_row||1)-1]||[],matches=headers.map((h,i)=>String(h).trim()===m.source.trim()?i:-1).filter(i=>i>=0);
          if(matches.length>1)throw Error('CSV column header is duplicated.');
          const column=matches.length?matches[0]:/^[A-Za-z]{1,3}$/.test(m.source)?XLSX.utils.decode_col(m.source.toUpperCase()):-1;
          if(column<0)throw Error('CSV column was not found.');if(m.row<=(block.header_row||1))throw Error('Choose a data row below the header.');raw=rows[m.row-1]?.[column];
        }
        const value=convert(raw,item);return {item,source:((block.sheet||'')?block.sheet+'!':'')+m.source+(block.reader==='columns'?' · row '+m.row:''),raw,value,message:value===null?'Blank — stays unanswered':''};
      }catch(error){return {item,source:m.source,raw,value:null,error:error.message};}
    });
  }
  return {validate,read,key,convert,pdfText,protonDefaults};
})();
