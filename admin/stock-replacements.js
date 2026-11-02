/* List-only replacements. Never mutates the cart or sends an order. */
(() => {
 'use strict';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const labels={installation:'Տեղադրման տեսակ',connection:'Միացման տեսակ',width:'Լայնություն (սմ)',height:'Բարձրություն (սմ)',depth:'Խորություն (սմ)',nicheWidth:'Խորշի լայնություն (սմ)',nicheHeight:'Խորշի բարձրություն (սմ)',nicheDepth:'Խորշի խորություն (սմ)',capacity:'Բեռնվածք (կգ)',volume:'Ծավալ (լ)',placeSettings:'Սպասքի հավաքածուներ',diagonal:'Էկրանի անկյունագիծ (դյույմ)',drying:'Չորացման գործառույթ',noFrost:'No Frost',inverter:'Ինվերտոր',subtype:'Ենթատեսակ',resolution:'Էկրանի կետայնություն',screen:'Էկրանի տեսակ',type:'Ապրանքի տեսակ',brand:'Ապրանքանիշ'};
 const groups={verified:'Համապատասխանում է ստուգված պահանջներին',differences:'Կան տարբերություններ',insufficient:'Պետք է ճշտել բնութագրերը'};
 let active=null,sequence=0;
 const groupOf=c=>c.matchGroup||c.comparison?.matchGroup||c.comparison?.group||'insufficient';
 const identity=c=>JSON.stringify([c.articul,c.name,c.price,groupOf(c),c.comparison,c.provenance,c.sourceType,c.sourceUrl,c.checkedAt]);
 function reset(){++sequence;const old=active;active=null;if(old){if(old.open)old.close();old.remove();}}
 function factLine(item){if(typeof item==='string'){const key=item.replace(/^manual\./,'');return (item.startsWith('manual.')?'Պահանջ՝ ':'')+(labels[key]||key);}const key=item.key||item.field||item.axis,label=labels[key]||item.label||key||'',value=v=>v===true?'Այո':v===false?'Ոչ':({'built-in':'Ներկառուցվող',built_in:'Ներկառուցվող',freestanding:'Առանձին կանգնած',gas:'Գազային',electric:'Էլեկտրական',induction:'Ինդուկցիոն',combined:'Համակցված'}[v]||v);const before=item.before??item.source??item.expected,after=item.after??item.target??item.actual;return label+(before==null&&after==null?'':': '+value(before??'—')+' → '+value(after??'—'));}
 function provenance(box,value){
  if(!value)return;
  const entries=Array.isArray(value)?value:[value];
  for(const entry of entries){const href=entry.sourceUrl||entry.url;if(href){try{const url=new URL(href);if(url.protocol==='https:'&&!url.username&&!url.password){const a=node('a','Աղբյուր՝ '+url.hostname);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}}catch{}}
   if(entry.checkedAt){const date=new Date(entry.checkedAt);if(Number.isFinite(date.valueOf()))box.append(node('small','Ստուգված է՝ '+date.toLocaleDateString('hy-AM',{timeZone:'Asia/Yerevan'})));}
  }
 }
 async function open(options){
  reset();const dialog=node('dialog',null,'stock-replacement-dialog'),token=sequence;active=dialog;dialog.id='stockReplacementDialog';dialog.setAttribute('aria-labelledby','stockReplacementHeading');
  const valid=()=>active===dialog&&token===sequence&&options.isCurrent();
  const heading=node('h2','Գտնել փոխարինող');heading.id='stockReplacementHeading';const close=node('button','Փակել');close.type='button';close.className='stock-replacement-close';close.onclick=reset;
  const source=node('p',options.source.name+' · '+options.source.articul,'stock-replacement-source');source.id='stockReplacementSource';source.setAttribute('data-i18n-skip','');
  const explanation=node('p','Առաջարկվում են միայն հասանելի ապրանքներ՝ ցանկում արդեն առկա ապրանքներից բացի։ Ընտրությունը կփոխի միայն ցանկը։ Ապրանքները չեն ամրագրվում։');
  const form=node('form');form.id='stockReplacementCriteria';
  const brand=node('input');brand.type='checkbox';brand.id='stockReplacementSameBrand';const brandLabel=node('label','Միայն նույն ապրանքանիշը');brandLabel.prepend(brand);
  const maxPrice=node('input');maxPrice.type='number';maxPrice.min='0';maxPrice.step='any';maxPrice.id='stockReplacementMaxPrice';const priceLabel=node('label','Առավելագույն գին (֏)');priceLabel.append(maxPrice);
  const manual=node('details'),manualSummary=node('summary','Ճշտել կարևոր պահանջները'),manualFields=node('div',null,'stock-replacement-fields');manual.append(manualSummary,node('p','Ձեր նշած պահանջները կիրառվում են միայն այս ընտրության համար և չեն հաստատում ապրանքի բացակայող բնութագրերը։'),manualFields);const fields=new Map(),modes=new Map();
  const sourceAck=node('input');sourceAck.type='checkbox';sourceAck.id='stockReplacementIdentity';const sourceLabel=node('label','Հաստատում եմ՝ սա ցանկում իմ նշած մոդելն է։');sourceLabel.prepend(sourceAck);sourceLabel.hidden=!options.requiresIdentityConfirmation;sourceAck.checked=!options.requiresIdentityConfirmation;
  const search=node('button','Գտնել փոխարինող');search.type='submit';search.id='stockReplacementSearch';search.disabled=!sourceAck.checked;
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const results=node('div');results.id='stockReplacementResults';
  form.append(brandLabel,priceLabel,manual,sourceLabel,search);dialog.append(heading,close,source,explanation,form,status,results);document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();reset();});dialog.showModal();close.focus();
  sourceAck.onchange=()=>{search.disabled=!sourceAck.checked;results.replaceChildren();};
  let requestSequence=0,lastCriteria=null;
  function criteria(){const p={sameBrand:brand.checked};if(maxPrice.value!=='')p.maxPrice=Number(maxPrice.value);const values={},manualModes={};for(const [key,input]of fields){if(input.value==='')continue;values[key]=input.dataset.valueType==='boolean'?input.value==='true':input.type==='number'?Number(input.value):input.value;if(modes.has(key))manualModes[key]=modes.get(key).value;}if(Object.keys(values).length)p.manualRequirements=values;if(Object.keys(manualModes).length)p.manualModes=manualModes;return p;}
  function addRequirements(requirements){
   for(const item of requirements||[]){const key=typeof item==='string'?item:item.key||item.field;if(!labels[key]||fields.has(key))continue;let input;
    if(['drying','noFrost','inverter','installation','connection'].includes(key)){input=node('select');input.append(new Option('Չնշված',''));const boolean=['drying','noFrost','inverter'].includes(key),choices=boolean?[[true,'Այո'],[false,'Ոչ']]:key==='installation'?[['built-in','Ներկառուցվող'],['freestanding','Առանձին կանգնած']]:[['gas','Գազային'],['electric','Էլեկտրական'],['induction','Ինդուկցիոն'],['combined','Համակցված']];for(const [value,label]of choices)input.append(new Option(label,String(value)));if(boolean)input.dataset.valueType='boolean';}
    else{input=node('input');input.type=['resolution','screen','type','subtype'].includes(key)?'text':'number';if(input.type==='number'){input.min='0.01';input.step='any';}input.maxLength=120;}
    input.dataset.stockRequirement=key;const label=node('label',labels[key]);label.append(input);if(input.type==='number'){const mode=node('select');mode.dataset.stockRequirementMode=key;for(const [value,text]of [['exact','Ճիշտ այս արժեքը'],['max','Ոչ ավելի'],['min','Ոչ պակաս']])mode.append(new Option(text,value));label.append(mode);modes.set(key,mode);}manualFields.append(label);fields.set(key,input);
   }
  }
  function render(data){
   results.replaceChildren();addRequirements(data.requirements);
   provenance(results,data.source?.provenance||data.source);
   const candidates=(data.candidates||[]).filter(c=>!options.excluded.has(String(c.articul)));
   if(!candidates.length){status.textContent=data.reason==='source_available'?'Ապրանքն արդեն հասանելի է։ Կրկին կազմեք ցանկը։':data.reason==='unsupported'?'Այս կատեգորիայի ավտոմատ համեմատությունը դեռ հասանելի չէ։ Ընտրեք ապրանքը կատալոգից ձեռքով։':'Հասանելի փոխարինողներ չեն գտնվել։ Կարող եք ճշտել պահանջները կամ թարմացնել ցանկը։';return;}
   status.textContent='Ստուգեք համընկնումները, տարբերությունները և չհաստատված բնութագրերը։';
   for(const [key,title]of Object.entries(groups)){
    const subset=candidates.filter(c=>groupOf(c)===key);if(!subset.length)continue;const section=node('section',null,'stock-replacement-group');section.dataset.stockReplacementGroup=key;section.append(node('h3',title));
    for(const candidate of subset){const card=node('article',null,'stock-replacement-card');card.dataset.stockReplacementArticul=String(candidate.articul);const name=node('h4',candidate.name+' · '+candidate.articul);name.setAttribute('data-i18n-skip','');const price=node('p',Number(candidate.price).toLocaleString('hy-AM')+' ֏');price.setAttribute('data-i18n-skip','');card.append(name,price,node('p','Առկա է'));
     if(Number.isFinite(candidate.availableQty))card.append(node('p','Հասանելի քանակ՝ '+candidate.availableQty));
     if(candidate.quantityConfirmed===false)card.append(node('p','Նշված քանակը պետք է հաստատել պատվերի ժամանակ։'));
     if(Number.isFinite(candidate.priceDifference)){const difference=node('p',(candidate.priceDifference>=0?'+':'')+candidate.priceDifference.toLocaleString('hy-AM')+' ֏');difference.setAttribute('data-i18n-skip','');card.append(difference);}
     const comparison=candidate.comparison||{};
     for(const [kind,title]of [['same','Ստուգված համընկնումներ'],['differences','Տարբերություններ'],['missing','Չհաստատված բնութագրեր']]){const items=comparison[kind]||(kind==='missing'?candidate.missingFacts:kind==='differences'?candidate.featureDifferences:null)||[];if(items.length){card.append(node('h5',title));const list=node('ul');for(const item of items)list.append(node('li',factLine(item)));card.append(list);}}
     provenance(card,candidate.provenance||{sourceUrl:candidate.sourceUrl,checkedAt:candidate.checkedAt});
     let acknowledge=null;if(key!=='verified'){acknowledge=node('input');acknowledge.type='checkbox';acknowledge.dataset.stockReplacementAck=String(candidate.articul);const label=node('label','Հասկանում եմ տարբերություններն ու չհաստատված տվյալները և ընտրում եմ այս տարբերակը։');label.prepend(acknowledge);card.append(label);}
     const choose=node('button','Ընտրել ցանկի համար');choose.type='button';choose.dataset.stockReplacementChoose=String(candidate.articul);choose.disabled=!!acknowledge;acknowledge?.addEventListener('change',()=>{choose.disabled=!acknowledge.checked;});
     choose.onclick=async()=>{if(!valid()||!sourceAck.checked||acknowledge&&!acknowledge.checked)return;const request=++requestSequence;choose.disabled=true;search.disabled=true;status.textContent='Ստուգվում են ընթացիկ գինը և մնացորդները…';
      try{const current=await options.request({...lastCriteria,candidateArticul:String(candidate.articul)});if(!valid()||request!==requestSequence)return;const fresh=current.candidates?.find(c=>String(c.articul)===String(candidate.articul));if(!fresh){render(current);throw Error('Տվյալները փոխվել են։ Կրկին ընտրեք փոխարինողը։');}if(identity(fresh)!==identity(candidate)){render(current);status.textContent='Տվյալները փոխվել են։ Կրկին ընտրեք փոխարինողը։';return;}await options.choose(fresh,current,lastCriteria,()=>valid()&&request===requestSequence);if(active===dialog&&request===requestSequence)reset();}
      catch(error){if(valid()&&request===requestSequence){status.textContent=window.ZZWS?.message(error)||error.message;choose.disabled=!!acknowledge&&!acknowledge.checked;}}
      finally{if(valid()&&request===requestSequence)search.disabled=!sourceAck.checked;}
     };card.append(choose);section.append(card);
    }results.append(section);
   }
  }
  form.addEventListener('input',()=>{++requestSequence;results.replaceChildren();status.textContent='Պահանջները փոխվել են։ Կրկին կատարեք որոնումը։';search.disabled=!sourceAck.checked;});
  form.onsubmit=async event=>{event?.preventDefault();if(!valid()||!sourceAck.checked||!form.reportValidity())return;const request=++requestSequence;search.disabled=true;results.replaceChildren();status.textContent='Փոխարինողները բեռնվում են…';
   try{lastCriteria=criteria();if(Object.keys(lastCriteria.manualRequirements||{}).length>4)throw Error('Միաժամանակ նշեք առավելագույնը չորս կարևոր պահանջ։');const data=await options.request(lastCriteria);if(valid()&&request===requestSequence)render(data);}catch(error){if(valid()&&request===requestSequence)status.textContent=window.ZZWS?.message(error)||error.message;}finally{if(valid()&&request===requestSequence)search.disabled=!sourceAck.checked;}
  };
  if(sourceAck.checked)await form.onsubmit();
 }
 window.ZZWS_STOCK_REPLACEMENTS={open,reset};
})();
