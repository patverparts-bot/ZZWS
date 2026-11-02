(() => {
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const core=window.ZZWS_WAREHOUSE_ALLOCATION,root=node('fieldset');root.id='stockPicker';root.hidden=true;root.style.minWidth='0';
 root.append(node('legend','Ապրանքների ընտրություն ըստ պահեստների'),node('p','Տեղադրեք մոդելների և քանակների երկու սյունակ կամ ընտրեք XLSX, CSV, TSV, TXT ֆայլ։ Պահեստների կանոնները վերցվում են «Պահեստներ» բաժնից։ Խանութներում պահպանվում է վերջին օրինակը։'));
 root.append(node('p','Մյուս պահեստներից ընտրությունը սկսվում է ամենամեծ մնացորդից՝ հնարավորինս հավասարեցնելով մնացորդները։'));
 root.append(node('p','Եթե հիմնական պահեստներից մեկում ամբողջ պահանջված քանակը կա, ընտրությունը կատարվում է միայն այդ պահեստից։ Յուրաքանչյուր պահեստը ցուցադրվում է առանձին տողով։'));
 const priorityText=node('span');priorityText.setAttribute('data-i18n-skip','');const priorityLine=node('p');priorityLine.append(node('span','Հիմնական պահեստների հերթականությունը՝ '),priorityText);root.append(priorityLine);
 let policyStamp=null;
 function policy(data){const p=data.warehousePolicy;if(!p||!Array.isArray(p.mainWarehouses)||!Array.isArray(p.priority)||p.priority.length!==p.mainWarehouses.length||new Set(p.priority).size!==p.priority.length||p.priority.some(code=>typeof code!=='string'||!/^\d{3}$/.test(code)||!p.mainWarehouses.includes(code)))throw Error('Պահեստների կարգավորումները հասանելի չեն։ Թարմացրեք էջը և կրկին փորձեք։');priorityText.textContent=p.priority.join(' → ')||'—';return p;}
 const adminIntro=[...root.querySelectorAll(':scope > p')],clientIntro=node('p','Ստուգեք ցանկը ձեր կատալոգում։ Հասանելի ապրանքները կարող եք տեղափոխել զամբյուղ։ Առկայության ճշտում պահանջող և չգտնված ապրանքները ցուցադրվում են առանձին։');clientIntro.hidden=true;root.append(clientIntro);
 const paste=node('textarea');paste.rows=7;paste.maxLength=500000;paste.id='stockPickerPaste';paste.style.width='100%';paste.style.boxSizing='border-box';
 const pasteLabel=node('label','Մոդել և քանակ');pasteLabel.append(paste);
 const file=node('input');file.type='file';file.accept='.xlsx,.csv,.tsv,.txt';file.id='stockPickerFile';const fileLabel=node('label','Ցանկի ֆայլ');fileLabel.append(file);
 const last=node('input');last.type='checkbox';last.id='stockPickerLast';const lastLabel=node('label','Օգտագործել նաև խանութների վերջին օրինակը');lastLabel.prepend(last);
 const kp=node('input');kp.type='checkbox';kp.id='stockPickerKp';kp.setAttribute('role','switch');const priceLabel=node('label','KP գներ (անջատված՝ Dealer)');priceLabel.prepend(kp);
 const build=node('button','Կազմել ցանկը'),download=node('button','Ներբեռնել Excel');build.type=download.type='button';download.disabled=true;
 const message=node('p'),output=node('div');message.setAttribute('role','status');message.setAttribute('aria-live','polite');output.style.overflowX='auto';
 root.append(pasteLabel,fileLabel,priceLabel,lastLabel,node('p','Սա հաշվարկ է ըստ ընթացիկ մնացորդների։ Ապրանքները չեն ամրագրվում։ Չգտնված մոդելները և պակասող քանակները մնում են ցանկում։'),build,download,message,output);
 let dialog=null,opener=null;
 const priceHeading=document.querySelector('#price h1');
 if(priceHeading)priceHeading.after(root);
 else{
  dialog=node('dialog');dialog.id='stockPickerCatalogDialog';dialog.setAttribute('aria-labelledby','stockPickerCatalogTitle');
  const heading=node('h2','Ապրանքների ընտրություն ըստ ցանկի');heading.id='stockPickerCatalogTitle';const close=node('button','Փակել');close.type='button';close.className='stock-picker-close';close.onclick=()=>dialog.close();
  dialog.append(heading,close,root);document.body.append(dialog);
  opener=node('button','Ընտրել ցանկից');opener.id='stockPickerOpen';opener.type='button';opener.className='stock-picker-open';opener.hidden=true;opener.onclick=()=>{if(allowed)dialog.showModal();};document.querySelector('#stickySearchBar > div').append(opener);
  document.addEventListener('DOMContentLoaded',()=>{const heading=document.querySelector('.sf-catalog-heading');if(heading)heading.insertBefore(opener,heading.querySelector('#dealerWorkspace'));});
 }
 let epoch=0,allowed=false,clientMode=false,result=null,exportRows=null,visualArticles=null;
 let visualButton=null,visualNotice=null,cartButton=null;
 function clearVisual(render=true){const changed=visualArticles!==null;visualArticles=null;if(visualNotice)visualNotice.hidden=true;if(changed&&render&&typeof catalogLoaded!=='undefined'&&catalogLoaded)resetAndRender();}
 if(dialog){
  cartButton=node('button','Տեղափոխել զամբյուղ');cartButton.id='stockPickerToCart';cartButton.type='button';cartButton.disabled=true;root.insertBefore(cartButton,download);
  visualButton=node('button','Ցուցադրել գտնված ապրանքները');visualButton.id='stockPickerShowFound';visualButton.type='button';visualButton.disabled=true;root.insertBefore(visualButton,download);
  visualNotice=node('aside');visualNotice.className='stock-picker-visual-notice';visualNotice.hidden=true;
  const text=node('span','Ցուցադրված են ցանկից գտնված ապրանքները։'),restore=node('button','Վերադառնալ ամբողջ կատալոգին');restore.type='button';restore.onclick=()=>clearVisual();visualNotice.append(text,restore);
  document.addEventListener('DOMContentLoaded',()=>document.querySelector('.sf-catalog-heading')?.after(visualNotice));
  visualButton.onclick=()=>{if(!allowed||!result)return;const articles=result.filter(r=>r.articul&&!['ambiguous','missing','quantity'].includes(r.error)).map(r=>String(r.articul));if(!articles.length)return;visualArticles=new Set(articles);visualNotice.hidden=false;dialog.close();window.ZZWS_DEALER?.setView('cards');resetAndRender();visualNotice.scrollIntoView({block:'start'});};
 }
 const headers=['Արտիկուլ','Մոդել','Պահանջված քանակ','Մեծածախ գին','Ընտրված քանակ','Պակաս','Պահեստ','Ստուգում'];
 const errors={checkStock:'Ճշտել առկայությունը',quantity:'Սխալ քանակ',missing:'Մոդելը չի գտնվել',ambiguous:'Մի քանի համապատասխանություն. նշեք արտիկուլը'};
 function clear(render=true){clearVisual(render);result=null;exportRows=null;download.disabled=true;if(visualButton)visualButton.disabled=true;if(cartButton)cartButton.disabled=true;output.replaceChildren();message.textContent='';}
 function invalidate(){++epoch;clear();build.disabled=!allowed;}
 paste.addEventListener('input',()=>{file.value='';invalidate();});file.addEventListener('change',()=>{paste.value='';invalidate();});last.addEventListener('change',invalidate);kp.addEventListener('change',invalidate);
 build.onclick=async()=>{
  if(!allowed)return;const ticket=++epoch;clear();build.disabled=true;message.textContent='Կազմվում է ցանկը…';
  try{
   const selected=file.files[0];if(selected&&selected.size>5*1024*1024)throw new Error('Ֆայլը պետք է լինի մինչև 5 ՄԲ');
   let workbook;
   if(selected)workbook=XLSX.read(await selected.arrayBuffer(),{type:'array',cellFormula:false});
   else {if(!paste.value.trim())throw new Error('Տեղադրեք ցանկը կամ ընտրեք ֆայլը');workbook=XLSX.read(paste.value,{type:'string',cellFormula:false});}
   if(ticket!==epoch||!allowed)return;
   if(workbook.SheetNames.length!==1)throw new Error('Ընտրեք մեկ թերթով ֆայլ');
   const sheet=workbook.Sheets[workbook.SheetNames[0]],range=XLSX.utils.decode_range(sheet['!ref']||'A1');
   if(range.e.r>2100||range.e.c>30)throw new Error('Ցանկը չափազանց մեծ է. առավելագույնը 2000 տող');
   const inputRows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''});
   const rows=core.parse(inputRows);if(!rows.length)throw new Error('Ցանկը դատարկ է');
   const data=await (typeof secureApi==='function'?secureApi('catalog'):api('catalog'));if(ticket!==epoch||!allowed)return;
   const settings=clientMode?null:policy(data);policyStamp=settings?JSON.stringify(settings):null;result=clientMode?core.checkClient(rows,data.products):core.allocate(rows,data.products,last.checked,kp.checked?'KP':'Dealers',settings.priority);
   exportRows=clientMode?result.map(r=>[r.articul||r.sku||'',r.matchedName||r.name,Number.isFinite(r.quantity)?r.quantity:'',r.price??'',errors[r.error]||'']):result.flatMap(r=>{
    const lines=r.allocations.length?r.allocations:[{warehouse:'',quantity:0}];
    return lines.map((a,i)=>{const row=[r.articul||r.sku||'',r.matchedName||r.name,i===0&&Number.isFinite(r.quantity)?r.quantity:'',r.price??'',a.quantity,i===0?r.shortage??'':'',a.warehouse,i===0?errors[r.error]||'':''];if(i===0)row.candidates=r.candidates;return row;});
   });
   const table=node('table'),head=table.createTHead().insertRow(),body=table.createTBody();for(const title of clientMode?['Արտիկուլ','Մոդել','Պահանջված քանակ','Մեծածախ գին','Ստուգում']:headers)head.append(node('th',title));
   if(clientMode){exportRows=[...result.filter(r=>r.available),...result.filter(r=>r.error==='checkStock'),...result.filter(r=>!r.available&&r.error!=='checkStock')].map(r=>{const row=[r.articul||r.sku||'',r.matchedName||r.name,Number.isFinite(r.quantity)?r.quantity:'',r.price??'',r.available?'Առկա է':errors[r.error]||''];row.candidates=r.candidates;row.group=r.available?'available':r.error==='checkStock'?'pending':'missing';return row;});}
   let previousGroup=null;
   for(const row of exportRows){
    if(clientMode&&previousGroup!==row.group){previousGroup=row.group;const group=body.insertRow(),title=node('th',row.group==='available'?'Հասանելի ապրանքներ':row.group==='pending'?'Ճշտել առկայությունը':'Ձեր կատալոգում բացակա ապրանքներ');title.colSpan=5;group.append(title);}
    const tr=body.insertRow();tr.dataset.pickerResult='true';for(const [i,value] of row.entries()){const td=tr.insertCell();td.textContent=String(value);td.setAttribute('data-i18n-skip','');if(i===0||i===6)td.style.whiteSpace='nowrap';}
    if(row[clientMode?4:7])tr.lastChild.removeAttribute('data-i18n-skip');
    if(row.candidates?.length){const list=node('ul');list.style.minWidth='240px';for(const p of row.candidates){const item=node('li',String(p.articul)+' · '+p.name);item.setAttribute('data-i18n-skip','');list.append(item);}tr.lastChild.append(list);}
   }
   output.append(table);message.textContent='Ցանկը պատրաստ է։ Ստուգեք պակասը և չգտնված մոդելները։';download.disabled=false;if(visualButton)visualButton.disabled=!result.some(r=>r.articul&&!['ambiguous','missing','quantity'].includes(r.error));if(cartButton)cartButton.disabled=!result.some(r=>clientMode?r.canAdd:r.allocated>0);
  }catch(e){if(ticket===epoch&&allowed)message.textContent=e.message==='LIST_TOO_LONG'?'Ցանկը չափազանց մեծ է. առավելագույնը 2000 տող':ZZWS.message(e);}
  finally{if(ticket===epoch)build.disabled=!allowed;}
 };
 if(cartButton)cartButton.onclick=async()=>{
  if(!allowed||!result||cartButton.disabled)return;const ticket=epoch,snapshot=result;cartButton.disabled=true;
  try{
   const data=await secureApi('catalog');if(ticket!==epoch||!allowed)return;
   const settings=clientMode?null:policy(data);if(settings&&JSON.stringify(settings)!==policyStamp){invalidate();throw Error('Պահեստների կարգավորումները փոխվել են։ Կրկին կազմեք ցանկը։');}const fresh=clientMode?core.checkClient(snapshot,data.products):core.allocate(snapshot,data.products,last.checked,kp.checked?'KP':'Dealers',settings.priority);let added=0,capped=false;const totals=new Map();
   for(const [i,row] of fresh.entries()){const original=snapshot[i],qty=clientMode?(row.canAdd&&original.canAdd?row.quantity:0):Math.min(row.allocated||0,original.allocated||0);if(!(qty>0)||row.articul!==original.articul||!getProduct(row.articul))continue;totals.set(row.articul,(totals.get(row.articul)||0)+qty);}
   for(const [articul,qty] of totals){const old=cart[articul]?.qty||0,next=Math.min(MAX_QTY,old+qty);if(next<old+qty)capped=true;if(next>old){setDirectQty(articul,next);added+=next-old;}}
   message.textContent=added?'Ապրանքները տեղափոխվել են զամբյուղ։':'Հասանելի ապրանք չի գտնվել։ Կրկին ստուգեք ցանկը։';if(capped)message.textContent+=' Քանակը սահմանափակվել է զամբյուղի առավելագույնով։';
  }catch(e){if(ticket===epoch&&allowed){message.textContent=ZZWS.message(e);cartButton.disabled=false;}}
 };
 download.onclick=()=>{
  if(!allowed||!result)return;
  const book=XLSX.utils.book_new(),rows=[],unavailable=[],pending=[];
  for(const r of result){
   const base=[String(r.articul||r.sku||''),r.matchedName||r.name,''];
   if(clientMode){if(r.available)rows.push([base[0],base[1],r.quantity,r.price??'']);else (r.error==='checkStock'?pending:unavailable).push([base[0],base[1],Number.isFinite(r.quantity)?r.quantity:'']);continue;}
   for(const a of r.allocations)rows.push([...base,a.quantity,r.price??'',String(a.warehouse)]);
   // Keep unresolved quantities visible without inventing a warehouse.
   if(r.shortage>0)unavailable.push([base[0],base[1],r.shortage]);
   else if(!r.allocations.length)unavailable.push([base[0],base[1],'']);
  }
  const exportHeaders=clientMode?['Код','Модель','Количество','Цена']:['Артикул','Номенклатура','Характеристика','Количество','Цена','Склад'];
  if(pending.length)rows.push([],['','Уточнить наличие'],['Код','Модель','Количество'],...pending);
  if(unavailable.length)rows.push([],['',clientMode?'Отсутствует в вашем каталоге':'Нет в наличии или не хватает'],['Код','Модель',clientMode?'Количество':'Недостающее количество'],...unavailable);
  const sheet=XLSX.utils.aoa_to_sheet([exportHeaders,...rows]);
  sheet['!cols']=[{wch:16},{wch:55},{wch:24},{wch:16},{wch:16},{wch:12}];
  sheet['!rows']=[{hpt:22}];
  for(let row=2;row<=rows.length+1;row++)for(const col of ['C','D','E']){const cell=sheet[col+row];if(cell?.t==='n')cell.z='0';}
  XLSX.utils.book_append_sheet(book,sheet,'Selection');XLSX.writeFile(book,'ZZWS-stock-selection.xlsx');
 };
 window.ZZWS_STOCK_PICKER={visualMatch:product=>allowed&&visualArticles!==null?visualArticles.has(String(product.articul)):null,start(user){this.reset();clientMode=!!dialog&&user.role==='client';allowed=clientMode||user.role==='admin'&&user.permissions?.includes('price:read');for(const p of adminIntro)p.hidden=clientMode;clientIntro.hidden=!clientMode;priceLabel.hidden=lastLabel.hidden=clientMode;root.querySelector('legend').textContent=clientMode?'Ստուգել ցանկը կատալոգում':'Ապրանքների ընտրություն ըստ պահեստների';root.hidden=!allowed;if(opener)opener.hidden=!allowed;build.disabled=!allowed;if(allowed&&!clientMode){const ticket=epoch;(typeof secureApi==='function'?secureApi('catalog'):api('catalog')).then(data=>{if(ticket===epoch&&allowed)policy(data);}).catch(()=>{if(ticket===epoch&&allowed)priorityText.textContent='—';});}},reset(){allowed=false;clientMode=false;++epoch;dialog?.close();if(opener)opener.hidden=true;root.hidden=true;paste.value='';file.value='';last.checked=false;kp.checked=false;build.disabled=true;clear(false);}};
})();
