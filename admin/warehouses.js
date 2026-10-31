(() => {
 const el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 let revision=null,generation=0,busy=false,dirty=false,rows=[];
 const message=(text,error=false)=>{el('warehousesStatus').textContent=text;el('warehousesStatus').className=error?'error':'';};
 function controls(value){busy=value;for(const control of el('warehouses').querySelectorAll('button,input,select'))control.disabled=value;el('warehouseSave').disabled=value||!revision||!dirty;}
 function changed(){dirty=true;controls(busy);message('Կան չպահպանված փոփոխություններ։');}
 function render(){
  const tbody=el('warehouseRows');tbody.replaceChildren();
  for(const row of rows){
   const tr=node('tr'),code=node('th',row.code);code.scope='row';const cell=node('td'),select=node('select');select.dataset.warehouseCode=row.code;select.setAttribute('aria-label','Պահեստի տեսակ՝ '+row.code);
   for(const [value,text]of [['main','Հիմնական պահեստ'],['shop','Խանութ']]){const option=node('option',text);option.value=value;select.append(option);}select.value=row.type;select.onchange=()=>{row.type=select.value;changed();};cell.append(select);
   tr.append(code,cell,node('td',row.present?'Կա գործող գնացուցակում':'Չկա գործող գնացուցակում'));tbody.append(tr);
  }
  el('warehouseEmpty').hidden=rows.length>0;controls(busy);
 }
 async function load(){
  if(busy)return;if(dirty&&!confirm('Չպահպանված փոփոխությունները կկորչեն։ Շարունակե՞լ։'))return;
  const ticket=generation;controls(true);message('Տվյալները թարմացվում են…');
  try{const data=await api('admin/warehouses');if(ticket!==generation)return;revision=data.revision;rows=data.warehouses.map(r=>({...r}));dirty=false;render();status('');message('Ընտրեք յուրաքանչյուր պահեստի տեսակը և պահպանեք։');}
  catch(e){if(ticket===generation){message(ZZWS.message(e),true);throw e;}}
  finally{if(ticket===generation)controls(false);}
 }
 el('warehouseReload').onclick=()=>run(load);
 el('warehouseAdd').onclick=()=>{
  const input=el('warehouseCode'),code=input.value.trim();
  if(!/^\d{3}$/.test(code)){message('Նշեք պահեստի երեքանիշ եզակի կոդերը՝ օրինակ 003',true);input.focus();return;}
  if(rows.some(r=>r.code===code)){message('Այս պահեստն արդեն ցանկում է։',true);return;}
  rows.push({code,type:'main',present:false});rows.sort((a,b)=>a.code.localeCompare(b.code));input.value='';changed();render();
 };
 el('warehouseForm').onsubmit=e=>{e.preventDefault();if(busy||!revision||!dirty)return;run(async()=>{
  const ticket=generation,payload={revision,mainWarehouses:rows.filter(r=>r.type==='main').map(r=>r.code)};controls(true);
  try{const data=await api('admin/warehouses',{method:'POST',body:JSON.stringify(payload)});if(ticket!==generation)return;revision=data.revision;rows=data.warehouses.map(r=>({...r}));dirty=false;render();status('');message('Պահեստների կարգավորումները պահպանված են։ Կատալոգները կթարմացվեն հաջորդ ստուգման ժամանակ։');}
  catch(e){if(ticket===generation)message(ZZWS.message(e),true);throw e;}
  finally{if(ticket===generation)controls(false);}
 });};
 window.ZZWS_ADMIN_WAREHOUSES={load,reset(){generation++;revision=null;dirty=false;rows=[];el('warehouseCode').value='';el('warehouseRows').replaceChildren();message('');controls(false);}};
})();
