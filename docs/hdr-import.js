/* HDR Daily QA: read locally, recognize the departmental form, review before filling. */
window.QAHdrDaily=(()=>{
  const booleanNames=['Emergency and operating procedures, emergency equipment, and TCS self-test','Video system operational','Intercom operational','Survey meter operational','Battery check OK','Source air kerma strength and proper decay verification','Position verification','Emergency stop test','Console stop test','Catheter misconnect test','Door open test','Radiation monitor test','Dwell time test','Radiation warning light test','Position indicator light test'];
  function parseText(text){
    if(/DoseLab\s+Winston[–-]Lutz/i.test(text))throw Error('This is a Winston–Lutz report. Select the SRS QA list.');
    if(!/Flexitron\s+HDR\s+Treatment\s+Day/i.test(text))throw Error('This is not the supported Flexitron HDR treatment-day QA form.');
    const date=/\bDate\s*:\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i.exec(text);
    if(!date)throw Error('The HDR form needs a readable QA date.');
    const qa_date=`${date[3]}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`;
    if(new Date(qa_date+'T12:00:00').toISOString().slice(0,10)!==qa_date)throw Error('The HDR form date is invalid.');
    const values={};const capture=(name,re)=>{const m=re.exec(text);if(m){const v=Number(m[1]);if(Number.isFinite(v)&&v>=0)values[name]=v;}};
    capture('Survey meter Cs-137 check source reading',/check\s+source\s+reading\s+([\d.]+)/i);
    capture('Source air kerma strength — TCS Sk',/TCS\s+Sk[\s\S]{0,45}?\b(\d+\.\d+)/i);
    capture('Source air kerma strength — decay table Sk',/Decay\s+Table\s+Sk\s+([\d.]+)/i);
    capture('Position verification — console distance',/Distance\s+set\s+at\s+console\s+([\d.]+)/i);
    capture('Position verification — ruler reading',/Source\s+position\s+ruler\s*:\s*Reading\s+([\d.]+)/i);
    capture('Dwell time — set time',/Set\s+dwell\s+time\s+([\d.]+)/i);
    capture('Dwell time — measured time',/Measured\s+time\s*(?:\d{1,2}\.\s+[|]?\s*)?(\d+\.\d+)/i);
    const channel=/Catheter\s+misconnect[^\n]*Channel\s+(\d+)/i.exec(text);if(channel)values['Catheter misconnect — channel']=channel[1];
    return {qa_date,values};
  }
  function groups(indices){const out=[];for(const n of indices){if(!out.length||n-out.at(-1).at(-1)>2)out.push([n]);else out.at(-1).push(n);}return out.map(a=>a.reduce((s,n)=>s+n,0)/a.length);}
  function checkboxes(canvas,skipHeader,expectedRows){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),{width:w,height:h}=canvas,image=ctx.getImageData(0,0,w,h).data;
    const dark=(x,y)=>{const i=(Math.floor(y)*w+Math.floor(x))*4;return image[i]<110&&image[i+1]<110&&image[i+2]<110;};
    const horizontal=[];for(let y=0;y<h;y++){let ink=0,n=0;for(let x=Math.floor(w*.06);x<w*.95;x+=3){n++;if(dark(x,y))ink++;}if(ink/n>.72)horizontal.push(y);}
    const required=expectedRows+1+(skipHeader?1:0),lines=groups(horizontal);if(lines.length<required)return null;
    const ys=lines.slice(0,required);
    const xs=[];for(let x=0;x<w;x++){let ink=0,n=0;for(let y=Math.ceil(ys[0]);y<ys.at(-1);y+=3){n++;if(dark(x,y))ink++;}if(n&&ink/n>.75)xs.push(x);}
    const vertical=groups(xs);if(vertical.length<4)return null;const borders=vertical.slice(-3),centers=[(borders[0]+borders[1])/2,(borders[1]+borders[2])/2];
    const ink=(cx,cy)=>{const radius=Math.max(3,Math.floor(w*.0035));let marked=0,total=0;for(let y=Math.round(cy)-radius;y<=cy+radius;y++)for(let x=Math.round(cx)-radius;x<=cx+radius;x++){const i=(y*w+x)*4;total++;if(dark(x,y)||image[i+2]>120&&image[i+2]>image[i]*1.4&&image[i+1]>image[i]+20)marked++;}return marked/total;};
    const result=[];for(let row=0;row<expectedRows;row++){const i=row+(skipHeader?1:0),cy=(ys[i]+ys[i+1])/2,a=ink(centers[0],cy),b=ink(centers[1],cy);result.push(a>.15&&b<.07?true:b>.15&&a<.07?false:null);}return result;
  }
  let ocrScript;
  async function loadOcr(){if(window.Tesseract)return;ocrScript||=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('ocr/tesseract.min.js',document.baseURI).href;s.onload=resolve;s.onerror=()=>reject(Error('Could not load the local HDR PDF reader.'));document.head.append(s);});await ocrScript;}
  async function parse(bytes,filename,onProgress=()=>{}){
    const pdfjs=await import('./pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
    const pdf=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;let worker;
    try{
      if(pdf.numPages>4)throw Error('Choose the HDR Daily QA form (up to four pages).');
      const texts=[],canvases=[];
      for(let n=1;n<=pdf.numPages;n++){
        onProgress(`Reading HDR page ${n} of ${pdf.numPages}…`);const page=await pdf.getPage(n),viewport=page.getViewport({scale:2.5}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;canvases.push(canvas);
        const content=await page.getTextContent();let text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
        if(text.trim().length<80){
          await loadOcr();if(!worker)worker=await Tesseract.createWorker('eng',1,{workerPath:new URL('ocr/worker.min.js',document.baseURI).href,corePath:new URL('ocr/',document.baseURI).href,langPath:new URL('ocr/',document.baseURI).href.replace(/\/$/,''),cacheMethod:'write'});
          onProgress(`Recognizing HDR page ${n} of ${pdf.numPages}…`);text=(await worker.recognize(canvas)).data.text;
        }
        texts.push(text);
      }
      const parsed=parseText(texts.join('\n'));let readChecks=0;
      if(canvases.length===2){for(let page=0;page<2;page++){const checks=checkboxes(canvases[page],page===0,page===0?11:4);if(checks)checks.forEach((v,i)=>{if(v!==null){parsed.values[booleanNames[i+(page===0?0:11)]]=v;readChecks++;}});}}
      return {...parsed,filename,recognized_checkboxes:readChecks,unread_checkboxes:15-readChecks};
    }finally{if(worker)await worker.terminate();await pdf.destroy();}
  }
  const supported=template=>template.items.some(i=>i.category==='HDR treatment-day QA');
  return {parse,parseText,checkboxes,supported};
})();
