(() => {
 const root=document.getElementById('offers'),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const editor=node('div'),actions=node('div'),history=node('div'),status=node('p'),current=node('p');editor.className='offer-editor';actions.className='offer-actions';history.className='offer-history';status.setAttribute('role','status');
 const title=node('input'),codes=node('textarea'),expires=node('input'),active=node('input');title.id='offerTitle';title.maxLength=200;codes.id='offerArticles';codes.rows=6;expires.id='offerExpires';expires.type='date';active.type='checkbox';active.id='offerActive';
 const field=(label,input)=>{const l=node('label',label);l.append(input);return l;};
 const fresh=node('button','Նոր առաջարկ'),save=node('button','Հրապարակել առաջարկը'),toggle=node('button','Անջատել առաջարկը'),remove=node('button','Ջնջել առաջարկը'),more=node('button','Բեռնել ավելին');
 fresh.id='offerNew';save.id='offerSave';toggle.id='offerToggle';remove.id='offerDelete';more.id='offerMore';remove.className='danger';for(const b of [fresh,save,toggle,remove,more])b.type='button';
 const hint=node('p','Հաճախորդը կտեսնի միայն այս ցանկի իրեն հասանելի ապրանքները՝ իր մեծածախ ակցիայի գնով։ Միայն մանրածախ ակցիա ունեցող ապրանքները չեն ցուցադրվի։');hint.className='help';
 const timing=node('p','Ավարտի ամսաթիվը պարտադիր չէ։ Նշված դեպքում առաջարկը կգործի մինչև այդ օրվա 23:59-ը՝ Երևանի ժամանակով։ Առանց ամսաթվի այն գործում է մինչև անջատելը։ Միաժամանակ գործում է մեկ առաջարկ։');timing.className='help';
 const enabled=field('Առաջարկը միացված է',active);enabled.className='offer-enabled';actions.append(fresh,save,toggle,remove);
 editor.append(current,field('Վերնագիր',title),field('Արտիկուլներ՝ ստորակետով կամ նոր տողով',codes),hint,field('Գործում է մինչև՝ ներառյալ',expires),timing,enabled,actions,status);
 root.append(editor,node('h2','Պահպանված առաջարկներ'),history,more);
 let selected=null,requestId=crypto.randomUUID(),busy=false,dirty=false,generation=0,loadSerial=0,next=null,entries=new Map();
 const labels={active:'Գործող',disabled:'Անջատված',expired:'Ժամկետն ավարտված է',deleted:'Ջնջված'};
 function controls(){for(const e of [title,codes,expires,active,fresh,save,...history.querySelectorAll('button')])e.disabled=busy||e.dataset.deleted==='true';toggle.disabled=remove.disabled=busy||!selected;more.disabled=busy;toggle.hidden=remove.hidden=!selected;more.hidden=next===null;}
 function restore(o){selected=o||null;title.value=o?.title||'';codes.value=o?.articles.join(', ')||'';expires.value=o?.expires_on||'';active.checked=o?o.active===true:true;requestId=crypto.randomUUID();dirty=false;save.textContent=o?'Պահպանել փոփոխությունները':'Հրապարակել առաջարկը';toggle.textContent=o?.active?'Անջատել առաջարկը':'Միացնել առաջարկը';current.textContent=o?'Ընտրված առաջարկ՝ '+o.title:'Նոր առաջարկ';controls();}
 function discard(){return !dirty||confirm('Չպահպանված փոփոխությունները կկորչեն։ Շարունակե՞լ։');}
 for(const input of [title,codes,expires,active])input.addEventListener('input',()=>{dirty=true;requestId=crypto.randomUUID();});
 function render(){history.replaceChildren();if(!entries.size)history.append(node('p','Պահպանված առաջարկներ դեռ չկան։'));for(const o of entries.values()){
  const row=node('div'),open=node('button',o.title),meta=node('p');row.className='offer-history-row';row.dataset.offerId=o.id;open.type='button';open.disabled=busy||!!o.deleted_at;open.dataset.deleted=String(!!o.deleted_at);open.onclick=()=>{if(!busy&&discard())restore(o);};
  meta.textContent=(labels[o.status]||labels.disabled)+' · '+o.articles.length+' '+'արտիկուլ'+(o.expires_on?' · '+'Մինչև՝ '+o.expires_on:' · '+'Առանց ժամկետի');row.append(open,meta);history.append(row);
 }}
 async function load(append=false){const ticket=generation,serial=++loadSerial,data=await ZZWS.json('admin/offers'+(append&&next!==null?'?offset='+next:''));if(ticket!==generation||serial!==loadSerial)return;if(!append)entries.clear();for(const o of data.offers)entries.set(o.id,o);next=data.nextOffset??null;render();if(!dirty&&!selected)restore(data.offers.find(o=>!o.deleted_at));controls();}
 async function persist({deleting=false,toggling=false}={}){
  if(busy||deleting&&!selected)return;
  if(deleting&&!confirm('Ջնջե՞լ այս առաջարկը։ Այն այլևս չի ցուցադրվի հաճախորդներին։ Ապրանքները կատալոգից չեն ջնջվի։'))return;
  const ticket=generation;busy=true;controls();status.textContent='Պահպանվում է…';
  const payload=deleting?{id:selected.id,revision:selected.revision,requestId}:{id:selected?.id||null,revision:selected?.revision,title:title.value,articles:codes.value.split(/[,;\n\s]+/).filter(Boolean),active:toggling?!selected.active:active.checked,expiresOn:expires.value||null,requestId};
  try{const saved=await ZZWS.json(deleting?'admin/offers/delete':'admin/offers',{method:'POST',body:JSON.stringify(payload)});if(ticket!==generation)return;dirty=false;restore(deleting?null:saved);status.textContent=deleting?'Առաջարկը ջնջված է։':saved.active?'Առաջարկը պահպանված է։ Հաճախորդի բաններն ու ցանկը կթարմացվեն մոտ մեկ րոպեում։':'Առաջարկն անջատված է։ Այն չի ցուցադրվի հաճախորդներին։';await load();}
  catch(e){if(ticket===generation)status.textContent=ZZWS.message(e);}finally{if(ticket===generation){busy=false;render();controls();}}
 }
 fresh.onclick=()=>{if(!busy&&discard()){restore(null);status.textContent='';}};save.onclick=()=>persist();toggle.onclick=()=>{if(discard()){dirty=false;restore(selected);persist({toggling:true});}};remove.onclick=()=>persist({deleting:true});more.onclick=()=>load(true).catch(e=>{status.textContent=ZZWS.message(e);});
 window.ZZWS_OFFERS={load,reset(){generation++;loadSerial++;busy=false;entries.clear();next=null;restore(null);history.replaceChildren();status.textContent='';controls();}};restore(null);
})();
