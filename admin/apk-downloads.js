(() => {
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;},root=document.getElementById('apkDownloads');
 const help=node('p','Ցուցակը հաշվի է առնում միայն ZZWS-ով ներբեռնումները՝ հաշվառումը միացնելուց հետո։ Drive-ի հղումով ներբեռնումները այստեղ չեն գրանցվում։');
 const explanation=node('p','«Հարցված է» նշանակում է՝ ֆայլը կամ հղումը տրամադրվել է։ «Ներբեռնված և ստուգված է» ցուցադրվում է միայն բրաուզերի կամ հավելվածի հաստատումից հետո։ Սա տեղադրման հաստատում չէ։ Հին հավելվածը կարող է հայտնել միայն հարցումը։');
 const form=node('form'),version=node('select'),search=node('input'),state=node('select'),find=node('button','Գտնել'),refresh=node('button','Թարմացնել'),summary=node('div'),message=node('p'),scroll=node('div'),pager=node('div'),previous=node('button','Նախորդը'),next=node('button','Հաջորդը'),pageLabel=node('span');
 form.className='apk-download-filters';search.type='search';search.maxLength=100;search.placeholder='Անուն, մուտքանուն կամ հաճախորդ';search.name='search';version.name='versionCode';state.name='status';
 for(const [title,input] of [['Օգտատիրոջ որոնում',search],['APK տարբերակը',version],['Ներբեռնման վիճակը',state]]){const label=node('label',title);label.append(input);form.append(label);}
 for(const [value,label] of [['','Բոլորը'],['downloaded','Ներբեռնված և ստուգված է'],['requested','Հարցված է, հաստատում չկա'],['unknown','Տվյալներ չկան']]){const o=node('option',label);o.value=value;state.append(o);}
 refresh.type=previous.type=next.type='button';find.type='submit';form.append(find,refresh);summary.className='apk-download-summary';message.id='apkDownloadsStatus';message.setAttribute('role','status');scroll.className='apk-download-table';pager.className='apk-download-pager';pager.append(previous,pageLabel,next);const instructions=node('details'),instructionTitle=node('summary','Ինչպես է գրանցվում ներբեռնումը');instructions.className='apk-download-help';instructions.append(instructionTitle,help,explanation);root.append(instructions,form,summary,message,scroll,pager);
 let serial=0,busy=false,offset=0,last=null,current=null,owner=null;
 const date=value=>value?new Date(value).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan'}):'—';
 const statusLabels={downloaded:'Ներբեռնված և ստուգված է',requested:'Հարցված է, հաստատում չկա',unknown:'Տվյալներ չկան'},roles={manager:'Գլխավոր մենեջեր',employee:'Աշխատակից',admin:'Ադմինիստրատոր'};
 function controls(){for(const input of form.querySelectorAll('input,select,button'))input.disabled=busy;previous.disabled=busy||offset===0;next.disabled=busy||!last||offset+last.limit>=last.total;}
 function cellData(td,text){const span=node('span',text||'—');span.dataset.i18nSkip='true';td.append(span);}
 function render(){
  if(!last)return;summary.replaceChildren();for(const key of ['downloaded','requested','unknown'])summary.append(node('p',({downloaded:'Ներբեռնվել է',requested:'Հարցվել է',unknown:'Տվյալներ չկան'}[key])+': '+last.totals[key]));scroll.replaceChildren();
  if(!last.rows.length)scroll.append(node('p','Ընտրված պայմաններով օգտատերեր չկան։'));
  else{const table=node('table'),head=table.createTHead().insertRow();for(const title of ['Օգտատեր','Հաճախորդ','Ներբեռնման վիճակը','Վերջին հարցումը','Ներբեռնման հաստատումը','Վերջին գործարկման տարբերակը'])head.append(node('th',title));const body=table.createTBody();
   for(const row of last.rows){const tr=body.insertRow(),person=tr.insertCell();cellData(person,row.name);person.append(node('small',roles[row.role]||''));if(row.login){const login=node('small');cellData(login,row.login);person.append(login);}if(!row.active)person.append(node('small','Հասանելիությունն անջատված է'));
    const company=tr.insertCell();cellData(company,[row.customer_code,row.client].filter(Boolean).join(' · '));const status=tr.insertCell();status.append(node('span',statusLabels[row.status]));if(row.attempts)status.append(node('small','Հարցումների թիվը՝ '+row.attempts));if(row.sources)status.append(node('small',row.sources.split(', ').map(s=>s==='android'?'Android':s==='web'?'Կայք':'Անհայտ աղբյուր').join(' / ')));
    tr.insertCell().textContent=date(row.requested_at);tr.insertCell().textContent=date(row.completed_at);const usage=tr.insertCell();usage.append(node('span',row.observed_version||'—'));if(row.observed_at)usage.append(node('small',date(row.observed_at)));}
   scroll.append(table);}
  pageLabel.textContent=(last.total?offset+1:0)+'–'+Math.min(offset+last.limit,last.total)+' / '+last.total;controls();window.ZZWS_I18N?.refresh(root);
 }
 function reset(){++serial;owner=null;current=null;last=null;offset=0;busy=false;version.replaceChildren();search.value='';state.value='';scroll.replaceChildren();summary.replaceChildren();message.textContent='';controls();}
 async function load(){
  if(busy)return;const who=sessionStorage.getItem('zzws_session_v3');if(who!==owner){reset();owner=who;}const ticket=++serial;busy=true;message.textContent='Բեռնվում է…';controls();
  try{
   const release=await ZZWS.json(new URL('../zzws-apk/current',ZZWS_CONFIG.api).href);if(owner!==who||ticket!==serial)return;current=release.release;if(!current?.versionCode)throw Error('APK-ի նոր տարբերակը դեռ հրապարակված չէ։');
   const selected=version.value||String(current.versionCode),params=new URLSearchParams({versionCode:selected,search:search.value.trim(),status:state.value,offset:String(offset)}),data=await ZZWS.json('admin/users/apk-downloads?'+params);
   if(owner!==who||ticket!==serial)return;const values=new Map([[current.versionCode,current.version],...data.versions.map(v=>[v.version_code,v.version])]);if(!values.has(Number(selected)))values.set(Number(selected),selected);version.replaceChildren();for(const [code,title]of [...values].sort((a,b)=>b[0]-a[0])){const option=node('option',title);option.value=code;version.append(option);}version.value=selected;last=data;offset=data.offset;message.textContent='';render();
  }catch(error){if(owner===who&&ticket===serial){message.textContent=ZZWS.message(error);scroll.replaceChildren();summary.replaceChildren();last=null;}}
  finally{if(owner===who&&ticket===serial){busy=false;controls();}}
 }
 form.onsubmit=e=>{e.preventDefault();offset=0;load();};version.onchange=state.onchange=()=>{offset=0;load();};refresh.onclick=()=>load();previous.onclick=()=>{offset=Math.max(0,offset-50);load();};next.onclick=()=>{offset+=50;load();};window.addEventListener('zzws:languagechange',render);
 window.ZZWS_APK_DOWNLOADS=Object.freeze({load,reset,navigationState:()=>({offset,version:version.value,search:search.value,status:state.value}),async restoreView(value){offset=Math.max(0,Number(value?.offset)||0);version.value=String(value?.version||'');search.value=String(value?.search||'').slice(0,100);state.value=String(value?.status||'');await load();}});controls();
})();
