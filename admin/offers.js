(() => {
 const root=document.getElementById('offers'),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const editor=node('div'),actions=node('div'),history=node('div'),status=node('div'),current=node('p');editor.className='offer-editor';actions.className='offer-actions';history.className='offer-history';status.id='offerStatus';status.className='offer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.tabIndex=-1;status.hidden=true;
 const notice=(kind,text,focus=false)=>{status.dataset.state=kind;status.textContent=text;status.hidden=!text;if(focus){status.focus({preventScroll:true});status.scrollIntoView({block:'nearest',behavior:'smooth'});}};
 const title=node('input'),codes=node('textarea'),expires=node('input'),active=node('input');title.id='offerTitle';title.maxLength=200;codes.id='offerArticles';codes.rows=6;expires.id='offerExpires';expires.type='date';active.type='checkbox';active.id='offerActive';
 const field=(label,input)=>{const l=node('label',label);l.append(input);return l;};
 const fresh=node('button','Նոր առաջարկ'),save=node('button','Հրապարակել առաջարկը'),toggle=node('button','Անջատել առաջարկը'),remove=node('button','Ջնջել առաջարկը'),more=node('button','Բեռնել ավելին');
 fresh.id='offerNew';save.id='offerSave';toggle.id='offerToggle';remove.id='offerDelete';more.id='offerMore';remove.className='danger';for(const b of [fresh,save,toggle,remove,more])b.type='button';
 const hint=node('p','Բաժնում ավտոմատ ցուցադրվում են հաճախորդին հասանելի մեծածախ ակցիայով ապրանքները և այս ցանկի իրեն հասանելի ապրանքները՝ նշված ժամկետով։ Յուրաքանչյուրը տեսնում է միայն իր կատալոգն ու գները։');hint.className='help';
 const retention=node('p','Բոլոր արտիկուլները պահպանվում են ցանկում, նաև գործող գնացուցակում դեռ չգտնվածները։ Ձեռքով ավելացված ապրանքին մեծածախ ակցիայի գին ունենալը պարտադիր չէ․ այն ցուցադրվում է հաճախորդի հասանելի գնով։');retention.className='help';
 const timing=node('p','Ավարտի ամսաթիվը պարտադիր չէ։ Նշված դեպքում առաջարկը կգործի մինչև այդ օրվա 23:59-ը՝ Երևանի ժամանակով։ Առանց ամսաթվի այն գործում է մինչև անջատելը։ Միաժամանակ գործում է մեկ առաջարկ։');timing.className='help';
 const enabled=field('Առաջարկը միացված է',active);enabled.className='offer-enabled';actions.append(fresh,save,toggle,remove);
 editor.append(current,field('Վերնագիր',title),field('Արտիկուլներ՝ ստորակետով կամ նոր տողով',codes),retention,hint,field('Գործում է մինչև՝ ներառյալ',expires),timing,enabled,status,actions);
 const historyTitle=node('h2','Պահպանված առաջարկներ');historyTitle.id='offerHistoryTitle';history.setAttribute('aria-labelledby',historyTitle.id);root.append(editor,historyTitle,history,more);
 let selected=null,requestId=crypto.randomUUID(),busy=false,dirty=false,generation=0,loadSerial=0,next=null,entries=new Map();
 const labels={active:'Գործող',disabled:'Անջատված',expired:'Ժամկետն ավարտված է',deleted:'Ջնջված'};
 function controls(){for(const e of [title,codes,expires,active,fresh,save,...history.querySelectorAll('button')])e.disabled=busy||e.dataset.deleted==='true';toggle.disabled=remove.disabled=busy||!selected;more.disabled=busy;toggle.hidden=remove.hidden=!selected;more.hidden=next===null;editor.setAttribute('aria-busy',String(busy));save.textContent=busy?'Պահպանվում է…':selected?'Պահպանել փոփոխությունները':'Հրապարակել առաջարկը';}
 function restore(o){selected=o||null;title.value=o?.title||'';codes.value=o?.articles.join(', ')||'';expires.value=o?.expires_on||'';active.checked=o?o.active===true:true;requestId=crypto.randomUUID();dirty=false;toggle.textContent=o?.active?'Անջատել առաջարկը':'Միացնել առաջարկը';current.textContent=o?'Ընտրված առաջարկ՝ '+o.title:'Նոր առաջարկ';controls();}
 function discard(){return !dirty||confirm('Չպահպանված փոփոխությունները կկորչեն։ Շարունակե՞լ։');}
 for(const input of [title,codes,expires,active])input.addEventListener('input',()=>{dirty=true;requestId=crypto.randomUUID();notice('info','Կան չպահպանված փոփոխություններ։');});
 function availability(o){const box=node('div');box.className='offer-availability';box.append(node('p','Պահպանված արտիկուլներ՝ '+o.articles.length));
  const group=(label,articles,kind)=>{const details=node('details'),summary=node('summary',label+' '+articles.length),list=node('p',articles.join(', '));details.className='offer-articles '+kind;details.append(summary,list);box.append(details);};
  if(o.availability){group('Գործող գնացուցակում՝',o.availability.found,'found');group('Դեռ չկան գնացուցակում, բայց պահպանված են՝',o.availability.missing,'missing');}else group('Բոլոր պահպանված արտիկուլները՝',o.articles,'all');return box;
 }
 const stateOf=o=>o.deleted_at?'deleted':!o.active?'disabled':o.expires_on&&o.expires_on<new Date(Date.now()+4*3600000).toISOString().slice(0,10)?'expired':'active';
 function render(){history.replaceChildren();if(!entries.size)history.append(node('p','Պահպանված առաջարկներ դեռ չկան։'));for(const o of entries.values()){
  const row=node('div'),open=node('button',o.title),meta=node('p');row.className='offer-history-row';row.dataset.offerId=o.id;open.type='button';open.disabled=busy||!!o.deleted_at;open.dataset.deleted=String(!!o.deleted_at);open.onclick=()=>{if(!busy&&discard()){restore(o);render();notice('info','Պահպանված ցանկը բացված է խմբագրիչում։',true);}};
  const state=o.status||stateOf(o);row.dataset.selected=String(selected?.id===o.id);open.setAttribute('aria-pressed',String(selected?.id===o.id));
  meta.textContent=labels[state]+' · '+o.articles.length+' '+'արտիկուլ'+(o.expires_on?' · '+'Մինչև՝ '+o.expires_on:' · '+'Առանց ժամկետի');meta.className='offer-state';meta.dataset.state=state;row.append(open,meta,availability(o));if(selected?.id===o.id)row.append(node('p','Այս ցանկը բացված է վերևի խմբագրիչում։'));history.append(row);
 }}
 async function load(append=false){const ticket=generation,serial=++loadSerial;if(!busy&&!dirty)notice('loading','Բեռնվում են պահպանված առաջարկները…');
  try{const data=await ZZWS.json('admin/offers'+(append&&next!==null?'?offset='+next:''));if(ticket!==generation||serial!==loadSerial)return;
   const held=selected;if(!append)entries.clear();for(const o of data.offers)entries.set(o.id,o);if(held&&!entries.has(held.id))entries.set(held.id,held);next=data.nextOffset??null;if(!dirty&&!selected)restore(data.offers.find(o=>!o.deleted_at));render();controls();if(status.dataset.state==='loading'&&!busy)notice('info','Պահպանված առաջարկները բեռնված են։ Ցանկը ներկայացված է ստորև։');
  }catch(e){if(ticket===generation&&serial===loadSerial&&!busy)notice('error',ZZWS.message(e),true);throw e;}
 }
 async function persist({deleting=false,toggling=false}={}){
  if(busy||deleting&&!selected)return;
  if(deleting&&!confirm('Ջնջե՞լ այս առաջարկը։ Այն այլևս չի ցուցադրվի հաճախորդներին։ Ապրանքները կատալոգից չեն ջնջվի։'))return;
  const ticket=generation;++loadSerial;busy=true;controls();notice('loading',deleting?'Առաջարկը ջնջվում է…':'Պահպանվում է ամբողջ ցանկը… Խնդրում ենք սպասել։',true);
  const payload=deleting?{id:selected.id,revision:selected.revision,requestId}:{id:selected?.id||null,revision:selected?.revision,title:title.value,articles:codes.value.split(/[,;\n\s]+/).filter(Boolean),active:toggling?!selected.active:active.checked,expiresOn:expires.value||null,requestId};
  try{const saved=await ZZWS.json(deleting?'admin/offers/delete':'admin/offers',{method:'POST',body:JSON.stringify(payload)});if(ticket!==generation)return;
   dirty=false;entries.set(saved.id,saved);restore(deleting?null:saved);render();
   const message=deleting?'Առաջարկը ջնջված է։':'Պահպանված է սերվերում։ «'+saved.title+'» · '+saved.articles.length+' արտիկուլ։ '+(saved.active?'Առաջարկը միացված է։':'Առաջարկն անջատված է։ Այն չի ցուցադրվի հաճախորդներին։')+' Ցանկը բացեք ստորև՝ «Պահպանված առաջարկներ» բաժնում։';notice('success',message,true);
   try{await load();}catch{if(ticket===generation)notice('success',message+' Ցանկի թարմացումը չհաջողվեց։ Պահպանված տվյալները չեն կորել։',true);}
  }catch(e){if(ticket===generation)notice('error',ZZWS.message(e),true);}finally{if(ticket===generation){busy=false;render();controls();}}
 }
 fresh.onclick=()=>{if(!busy&&discard()){restore(null);render();notice('info','');}};save.onclick=()=>persist();toggle.onclick=()=>{if(discard()){dirty=false;restore(selected);persist({toggling:true});}};remove.onclick=()=>persist({deleting:true});more.onclick=()=>load(true).catch(()=>{});
 window.ZZWS_OFFERS={load,reset(){generation++;loadSerial++;busy=false;entries.clear();next=null;restore(null);history.replaceChildren();notice('info','');controls();}};restore(null);
})();
