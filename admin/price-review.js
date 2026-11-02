(() => {
 let warnings=0,reportDraft=null,reportPromise=null,serial=0;
 const dataTools=window.ZZWS_PRICE_REVIEW_DATA,t=value=>window.ZZWS_I18N?.t(value)||value;
 async function completeReport(){
  if(reportPromise)return reportPromise;const draft=reportDraft;
  reportPromise=(async()=>{const response=await ZZWS.request('admin/price/report',{method:'POST',body:JSON.stringify({draft})});if(!response.ok){if(response.status===401&&typeof showLogin==='function')showLogin();const error=await response.json();throw new Error(error.error||'Չհաջողվեց ստանալ հաշվետվությունը');}const workbook=XLSX.read(await response.text(),{type:'string',raw:true,FS:';'});return dataTools.fromRows(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:true,defval:''}));})();
  try{return await reportPromise;}catch(e){if(reportDraft===draft)reportPromise=null;throw e;}
 }
 function exportReport(changes){
  const book=XLSX.utils.book_new(),count=new Set(changes.map(r=>r.articul)).size;
  const rows=[[t('Մեծածախ գների փոփոխություններ')],[t('Ապրանքների քանակ'),count,'',t('Գնային փոփոխությունների քանակ'),changes.length],[t('0՝ գին չկա։ Տոկոսը հաշվարկվում է միայն նախկին դրական գնից։')],[t('Արտիկուլ'),t('Մոդել'),t('Գնի տեսակ'),t('Նախկին գին'),t('Նոր գին'),t('Փոփոխություն, դրամ'),t('Փոփոխություն, %')],...changes.map(r=>[r.articul,r.name,dataTools.sources[r.source],r.before,r.after,r.after-r.before,r.before>0?(r.after-r.before)/r.before:''])];
  const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!cols']=[{wch:16},{wch:55},{wch:18},{wch:18},{wch:18},{wch:22},{wch:20}];sheet['!merges']=[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:2,c:0},e:{r:2,c:6}}];sheet['!autofilter']={ref:'A4:G'+Math.max(4,rows.length)};
  for(let i=5;i<=rows.length;i++){for(const col of ['D','E'])sheet[col+i].z='#,##0.##';sheet['F'+i].z='+#,##0.##;-#,##0.##;0';if(sheet['G'+i]?.t==='n')sheet['G'+i].z='+0.0%;-0.0%;0.0%';}
  XLSX.utils.book_append_sheet(book,sheet,'Wholesale changes');XLSX.writeFile(book,'Wholesale-price-changes.xlsx');
 }
 window.ZZWS_PRICE_REVIEW={
  reset(){++serial;warnings=0;reportDraft=null;reportPromise=null;},
  show(data){
   this.reset();const ticket=serial;warnings=data.difference?.warningsCount??data.difference?.warnings?.length??0;reportDraft=data.draft;
   let local=dataTools.changes(data.difference?.details||[]),box=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('div');box.append(summary,content);el('sample').append(box);
   const render=rows=>{if(ticket!==serial)return;local=rows;const groups=dataTools.grouped(rows);summary.textContent='Մեծածախ գների փոփոխություններ'+(groups.length>300?' · առաջին 300 դիրքերը':'');content.replaceChildren();if(!groups.length){const note=document.createElement('p');note.textContent='WS, KP և KP Promo գները չեն փոխվել։';content.append(note);return;}content.append(table(['Արտիկուլ','Մոդել','Գների փոփոխություններ'],groups.slice(0,300).map(row=>[row.articul,row.name,row.changes.map(v=>dataTools.sources[v.source]+': '+v.before+' → '+v.after+' ('+(v.after-v.before)+' ֏)').join(' · ')])));};
   if(data.difference?.detailsTruncated){summary.textContent='Մեծածախ գների փոփոխությունները բեռնվում են…';completeReport().then(render).catch(e=>{if(ticket===serial)summary.textContent=e.message;});}else render(local);
   const download=button('Ներբեռնել գների փոփոխությունները (Excel)',async()=>{download.disabled=true;try{const rows=reportDraft?await completeReport():local;if(ticket!==serial)return;render(rows);exportReport(rows);}finally{if(ticket===serial)download.disabled=false;}});download.id='downloadPriceReport';box.before(download);
   if(warnings>(data.difference?.warnings?.length||0)){const note=document.createElement('p');note.textContent='Խոշոր գնային փոփոխություններ՝ '+warnings+'։';box.before(note);}
  },
  errors(error){this.reset();el('preview').hidden=false;el('publish').disabled=true;el('priceDifference').textContent='';el('priceWarnings').replaceChildren();el('summary').textContent='Ֆայլը չի ընդունվել։ Շտկեք սխալները և կրկին բեռնեք։';el('sample').replaceChildren(table(['Տող','Արտիկուլ','Սխալ'],(error.data?.issues||[{row:'—',message:error.message}]).map(row=>[row.row??'—',row.articul||'',row.message])));},
  confirm(){return !warnings||confirm('Գնացուցակում կան առնվազն 30% գնային փոփոխություններ։ Ստուգե՞լ եք նախադիտման տարբերությունները և ցանկանո՞ւմ եք հրապարակել։');}
 };
})();
