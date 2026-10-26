/* DoseLab Winston-Lutz: labels are deliberately distinct, never infer delta from total delta. */
window.QAWinstonLutz = (() => {
  function parseText(text, filename) {
    if (!/DoseLab\s+Winston[–-]Lutz\s+Results/i.test(text)) throw Error('Not a DoseLab Winston-Lutz report.');
    const dateMatch = /\bDate:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i.exec(text);
    const d = dateMatch && new Date(dateMatch[1]+' 12:00:00');
    if (!d || !Number.isFinite(+d)) throw Error('The report needs a readable acquisition date.');
    const qa_date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const names=['Maximum delta','Maximum total delta','Mean total delta'];
    const measurements=names.map((name,i)=>{
      const re=new RegExp('(?:^|\\n)\\s*'+name+'\\s*:\\s*([+\\-]?\\d+(?:\\.\\d+)?)\\s*mm\\b','i');
      const m=re.exec(text); if(!m) throw Error(`Missing ${name} in the report.`);
      const result=Number(m[1]);if(!Number.isFinite(result)||result<0)throw Error(`Invalid ${name}.`);
      return {category:'Winston-Lutz',name,unit:'mm',result,expected:i===0?0:null,warn:null,fail:i===0?1:null,tol_mode:'absolute',criterion:i===0?'wl-max-delta':null,sphinx_status:i===0?(result<1?'Passed':'Failed'):'Recorded',sphinx_label:name};
    });
    const report_machine = /(?:^|\n)\s*Machine:\s*([^\n]+)/i.exec(text)?.[1]?.trim() || '';
    return {filename,qa_date,finished:qa_date+'T00:00:00',sphinx_user:'',report_machine,measurements};
  }
  let library;
  async function parse(bytes,filename) {
    library ||= import('./pdf.min.mjs');const pdfjs=await library;
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',document.baseURI).href;
    const pdf=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
    try {let text='';for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();for(const item of content.items)text+=(item.str||'')+(item.hasEOL?'\n':' ');text+='\n';}return parseText(text,filename);}finally{await pdf.destroy();}
  }
  return {parse,parseText};
})();
