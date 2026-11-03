(() => {
  const copy = {
    hy: {subtitle:'Ձեր օգնականը տեխնիկայի աշխարհում',title:'Բարև, ես ԶիգԶագ AI եմ։',intro:'Գտնենք բնութագրերը և համեմատենք տեխնիկան։ Գրեք ապրանքի մոդելը կամ արտիկուլը։',placeholder:'Մոդել, արտիկուլ կամ հարց…',send:'Ուղարկել',close:'Փակել',clear:'Նոր զրույց',you:'Դուք',pending:'Ստուգում եմ բնութագրերը…',mode:'Բնութագրերի որոնում',ai:'Խելացի օգնական',note:'Տվյալների աղբյուրը՝ zigzag.am · ստուգման ամսաթիվը՝ պատասխանում',choose:'Համեմատել',compare:'Համեմատել ընտրվածները',resetContext:'Մաքրել ընտրությունը',missing:'Ճշգրիտ մոդելի հաստատված բնութագրեր դեռ չկան։',checked:'Ստուգված է՝ ',saved:'Պահպանված տվյալներ',live:'Հենց նոր ստուգված',refresh:'Թարմացնել zigzag.am-ից',unavailable:'Կայքն այժմ հասանելի չէ թարմացման համար։ Ցուցադրված են պահպանված տվյալները։',modelUnavailable:'AI պատասխանը հիմա հասանելի չէ։ Ցուցադրված են հաստատված բնութագրերը։',error:'Չհաջողվեց ստանալ պատասխանը։ Կրկին փորձեք։',notDeployed:'Օգնականը պատրաստվում է գործարկման։ Փորձեք ավելի ուշ։',retry:'Կրկին փորձել',limit:'Համեմատելու համար ընտրեք առավելագույնը երկու ապրանք։',example:'Բնութագրեր՝ ',ask:'Հարցնել ԶիգԶագ AI-ին'},
  };
  const shoppingCopy={
    hy:{intro:'Նկարագրեք՝ ինչ տեխնիկա է պետք։ Կօգնեմ ընտրել ըստ բյուջեի, չափի և ցանկությունների, իսկ անհրաժեշտության դեպքում կհարցնեմ մանրամասները։',placeholder:'Օրինակ՝ մատչելի լվացքի մեքենա, 60 սմ…',selection:'Տեխնիկայի ընտրություն',shoppingExample:'Պետք է մատչելի լվացքի մեքենա, 60 սմ',price:'Ձեր գինը',retailPrice:'Մանրածախ գին',catalogPrice:'Գինը՝ ձեր ընթացիկ կատալոգից',offerDetails:'Բնութագրերը',newSelection:'Նոր ընտրություն'},
  };
  for(const lang of Object.keys(shoppingCopy))Object.assign(copy[lang],shoppingCopy[lang]);
  Object.assign(copy.hy,{addToCart:'Ավելացնել զամբյուղ',quantity:'Քանակ',inCart:'Զամբյուղում՝ ',pieces:' հատ',noPhoto:'Նկարը հասանելի չէ',notOrderable:'Այս ապրանքը հիմա հասանելի չէ զամբյուղում ավելացնելու համար։',invalidQuantity:'Նշեք թույլատրելի ամբողջ քանակը։',cartFull:'Հասել եք այս ապրանքի առավելագույն քանակին։'});
  Object.assign(copy.hy,{detailsTitle:'Ապրանքի մանրամասները',details:'Բոլոր բնութագրերը',requirements:'Ընտրված պայմանները',exactMatch:'Ճշգրիտ համապատասխանություն',nearMatch:'Մոտ չափերով տարբերակ',nearGroup:'Մոտ չափերով այլընտրանքներ',nearNote:'Այս տարբերակների չափերը տարբերվում են ձեր նշածից։ Համեմատեք չափերը նախքան ընտրելը։',width:'Լայնություն',depth:'Խորություն',height:'Բարձրություն',requested:'Ձեր նշածը',cm:'սմ'});
  Object.assign(copy.hy,{orderableGroup:'Կարելի է ավելացնել զամբյուղ',managerGroup:'Ճշտել մենեջերի հետ',managerNote:'Այս ապրանքները հիմա հնարավոր չէ ավելացնել զամբյուղ։ Գինը և պատվիրելու հնարավորությունը ճշտեք մենեջերի հետ։',notOrderable:'Այս ապրանքի գինը և պատվիրելու հնարավորությունը ճշտեք մենեջերի հետ։',retailReference:'Մանրածախ գինը՝ որպես տեղեկություն։ Պատվերի գինը ճշտեք մենեջերի հետ։'});
  Object.assign(copy.hy,{contactManager:'Կապվել մենեջերի հետ',copyInquiry:'Պատճենել հարցումը',inquiryCopied:'Հարցումը պատճենված է։',copyFailed:'Չհաջողվեց պատճենել։ Կարող եք բացել նամակը։',sku:'Արտիկուլ',publicGroup:'Ձեր կատալոգից դուրս մոդելներ',publicNote:'Այս մոդելները կան zigzag.am-ի ստուգված տվյալներում, բայց ձեր ընթացիկ կատալոգում չկան։ Գինը, հասանելիությունը և պատվիրելու հնարավորությունը ճշտեք մենեջերի հետ։',outsideCatalog:'Այս ապրանքը ձեր կատալոգում չկա։ Գինը, հասանելիությունը և պատվիրելու հնարավորությունը ճշտեք մենեջերի հետ։',budgetUnconfirmed:'Ձեր բյուջեին համապատասխանությունը դեռ հաստատված չէ։',pricePending:'Գինը՝ ճշտել մենեջերի հետ'});
  Object.assign(copy.hy,{reason:'Ինչու է առաջարկվում',managerNote:'Գինը և պատվերի պայմանները կարող եք ճշտել մենեջերի հետ։',publicGroup:'Լրացուցիչ տարբերակներ',publicNote:'Այս տարբերակների գինը, պատվերի պայմանները և ձեր բյուջեին համապատասխանությունը ճշտեք մենեջերի հետ։',outsideCatalog:'Գինը և պատվերի պայմանները կարող եք ճշտել մենեջերի հետ։',missing:'Եկեք հստակեցնենք, թե որ բնութագիրն է կարևոր ձեզ համար։ Ես դեռ սովորում եմ և կօգնեմ հաստատված տվյալներով։'});
  Object.assign(copy.hy,{typing:'ԶիգԶագ AI-ն գրում է',ready:'Սպասում եմ ձեր հարցին',listening:'Ուղարկեք հաղորդագրությունը՝ կօգնեմ ընտրել'});
  let locale = window.ZZWS_I18N?.language||'hy';
  // Existing administrator reply-to address, checked in the current settings.
  const managerEmail = 'levon.grigoryan@zigzag.am';
  let conversationId=crypto.randomUUID();
  let context = [], selected = [], advisor = null, requirements = '', currentMode = 'specifications', controller, revision = 0, busy = false, owner = null;
  const t = key => copy.hy[key]??key;
  const cartWidgets = new WeakMap(),inquiries=new WeakMap();
  const create = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const button = (text, onClick, className) => { const b = create('button', className, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const avatar = size => { const img = create('img'); img.src = 'zigzag-avatar.svg?v=1.2-hy-blue'; img.alt = ''; img.width = img.height = size; return img; };
  const launcher = button('', open, 'zigzag-launcher'); launcher.id = 'zigzagLauncher'; launcher.setAttribute('aria-haspopup', 'dialog'); launcher.append(avatar(43));
  const launcherText = create('span', '', 'ԶիգԶագ AI'); launcherText.append(create('small', '', 'արհեստական բանականություն')); launcher.append(launcherText,create('b','zigzag-ai-badge','AI'));
  document.getElementById('mainApp').append(launcher);
  const dialog = create('dialog', 'zigzag-dialog'); dialog.id = 'zigzagAssistant'; dialog.setAttribute('aria-labelledby', 'zigzagTitle');
  const header = create('header', 'zigzag-header'), headingCopy = create('div', 'zigzag-header-copy'), title = create('h2'); title.id = 'zigzagTitle';title.append(create('span','zigzag-persona-name','ԶիգԶագ '),create('b','zigzag-ai-badge','AI'));
  const subtitle = create('p'); headingCopy.append(title, subtitle); const close = button('×', () => dialog.close(), 'zigzag-close'); header.append(avatar(52), headingCopy, close);
  const toolbar = create('div', 'zigzag-toolbar'), mode = create('span', 'zigzag-mode');
  const clear = button('', () => reset(false)); toolbar.append(mode, clear);
  const messages = create('div', 'zigzag-messages'); messages.setAttribute('role', 'log'); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-relevant', 'additions');
  const contextBar = create('div', 'zigzag-context');
  const form = create('form', 'zigzag-composer'), row = create('div', 'zigzag-input-row'), input = create('input'), send = create('button', 'zigzag-send', '↑'), note = create('p');
  input.id = 'zigzagInput'; input.maxLength = 1200; input.autocomplete = 'off'; input.required = true; send.type = 'submit'; row.append(input, send); form.append(row, note);
  dialog.append(header, toolbar, messages, contextBar, form); document.body.append(dialog);
  const detailsDialog=create('dialog','zigzag-details-dialog');detailsDialog.id='zigzagProductDetails';detailsDialog.lang='hy';detailsDialog.setAttribute('aria-labelledby','zigzagDetailsTitle');
  const detailsHeader=create('header','zigzag-details-header'),detailsTitle=create('h2','',t('detailsTitle')),detailsBody=create('div','zigzag-details-body');detailsTitle.id='zigzagDetailsTitle';
  const detailsClose=button('×',()=>detailsDialog.close(),'zigzag-details-close');detailsClose.setAttribute('aria-label',t('close'));detailsHeader.append(detailsTitle,detailsClose);detailsDialog.append(detailsHeader,detailsBody);document.body.append(detailsDialog);
  detailsDialog.addEventListener('close',syncCartControls);
  function chatStatus(){subtitle.textContent=t(busy?'typing':input.value.trim()?'listening':'ready');subtitle.classList.add('zigzag-chat-status');subtitle.classList.toggle('is-typing',busy);}
  function labels() { dialog.lang = locale;title.querySelector('.zigzag-persona-name').textContent=locale==='ru'?'ЗигЗаг ':'ԶիգԶագ ';for(const badge of document.querySelectorAll('.zigzag-ai-badge')){badge.lang='en';badge.dataset.i18nSkip='true';badge.setAttribute('aria-label',locale==='ru'?'Искусственный интеллект':'արհեստական բանականություն');} chatStatus(); close.setAttribute('aria-label', t('close')); clear.textContent = t('clear'); input.placeholder = t('placeholder'); input.setAttribute('aria-label', t('placeholder')); send.setAttribute('aria-label', t('send')); note.textContent = t('note'); mode.textContent = t(currentMode==='selection'?'selection':currentMode==='ai'?'ai':'mode'); launcher.setAttribute('aria-label', t('ask')); }
  function visibleProduct(id) { return allProducts.find(p => p.articul === id); }
  function updateContext() {
    contextBar.replaceChildren();
    if(advisor){if(requirements){const selectedDetails=create('details','zigzag-selected-requirements');selectedDetails.append(create('summary','',t('requirements')),create('p','zigzag-requirements',requirements));contextBar.append(selectedDetails);}contextBar.append(button(t('newSelection'),()=>reset(false)));return;}
    if (!context.length && !selected.length) return;
    for (const id of [...new Set([...context, ...selected])]) { const p = visibleProduct(id); if (p) contextBar.append(create('span', '', p.name)); }
    contextBar.append(button(t('resetContext'), () => { context = []; selected = []; updateContext(); }));
    if (selected.length === 2) contextBar.append(button(t('compare'), () => { const ids = [...selected]; selected = []; context = ids; submit((locale === 'ru' ? 'Сравни характеристики: ' : locale === 'en' ? 'Compare specifications: ' : 'Համեմատիր բնութագրերը՝ ') + ids.join(', ')); }));
  }
  function welcome() {
    messages.replaceChildren(); const box = create('div', 'zigzag-welcome'); box.append(avatar(94), create('div', 'zigzag-eyebrow', 'ԶԻԳԶԱԳ · ՁԵՐ ՕԳՆԱԿԱՆԸ'), create('h3', '', t('title')), create('p', '', t('intro')));
    const examples = create('div', 'zigzag-examples');
    examples.append(button(t('shoppingExample'),()=>submit(t('shoppingExample'))));
    for (const p of allProducts.slice(0, 2)) examples.append(button(p.name, () => submit(t('example') + p.articul)));
    box.append(examples); messages.append(box);
  }
  function open() {
    if (!serverIdentity || document.getElementById('mainApp').classList.contains('hidden')) return;
    if (owner !== serverIdentity.id) { reset(true); owner = serverIdentity.id; }
    if (!dialog.open) dialog.showModal();
    if (!messages.children.length) welcome(); syncCartControls();chatStatus(); input.focus();
  }
  function reset(closeDialog = true) {
    if(detailsDialog.open)detailsDialog.close();detailsBody.replaceChildren();
    conversationId=crypto.randomUUID();revision++; controller?.abort(); busy = false; controller = null; send.disabled = false; input.value = ''; context = []; selected = []; advisor = null; requirements = ''; currentMode = 'specifications'; messages.replaceChildren(); messages.removeAttribute('aria-busy'); updateContext(); mode.textContent = t('mode');
    chatStatus();if (closeDialog) { if (dialog.open) dialog.close(); owner = null; } else { welcome(); input.focus(); }
  }
  function bubble(text, user = false) { const el = create('div', 'zigzag-message' + (user ? ' zigzag-message-user' : '')); if(user)el.dataset.i18nSkip='true'; el.append(create('span', 'zigzag-message-label', user ? t('you') : 'ԶիգԶագ AI'), document.createTextNode(text)); messages.append(el); return el; }
  function scroll() { messages.scrollTo({top:messages.scrollHeight,behavior:'instant'}); }
  function revealReply(reply){messages.scrollTo({top:reply.getBoundingClientRect().top-messages.getBoundingClientRect().top+messages.scrollTop-8,behavior:'instant'});}
  function syncCartControls(){for(const root of [messages,detailsBody])for(const widget of root.querySelectorAll('.zigzag-cart-controls'))cartWidgets.get(widget)?.();}
  const canOrderProduct=product=>product.catalogScope!=='public'&&serverIdentity?.id===owner&&!!getProduct(product.articul)&&getItemWholesalePrice({articul:product.articul})>0;
  function managerContact(product){
    const links=create('div','zigzag-manager-actions'),status=create('small','zigzag-inquiry-status');status.setAttribute('role','status');
    let source='';try{const u=new URL(product.sourceUrl);if(u.protocol==='https:'&&u.hostname==='www.zigzag.am'&&!u.username&&!u.password&&!u.port)source='\nԱպրանքի էջ՝ '+u.href;}catch{}
    const message='Բարև ձեզ,\n\nԽնդրում եմ ճշտել այս ապրանքի գինը, հասանելիությունը և պատվիրելու հնարավորությունը։\n\nՄոդել՝ '+product.name+'\nԱրտիկուլ՝ '+product.articul+source;
    const email=create('a','zigzag-contact-manager',t('contactManager'));
    const refreshInquiry=()=>{email.href='mailto:'+managerEmail+'?subject='+encodeURIComponent(ZZWS_I18N.t('Հարցում ապրանքի մասին՝ '+product.name))+'&body='+encodeURIComponent(ZZWS_I18N.t(message));};inquiries.set(email,refreshInquiry);refreshInquiry();
    email.setAttribute('aria-label',t('contactManager')+'՝ '+product.name);
    const copy=button(t('copyInquiry'),async()=>{
      if(serverIdentity?.id!==owner)return;
      try{await navigator.clipboard.writeText(ZZWS_I18N.t(message));status.textContent=t('inquiryCopied');}catch{status.textContent=t('copyFailed');}
    },'zigzag-copy-inquiry');
    links.append(email,copy,status);return links;
  }
  function productCartControls(product){
    const controls=create('div','zigzag-cart-controls'), actions=create('div','zigzag-cart-actions'), field=create('label','zigzag-cart-quantity'), qty=create('input'), status=create('p','zigzag-cart-status');
    const contact=managerContact(product);
    qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.inputMode='numeric';qty.setAttribute('aria-label',t('quantity')+'՝ '+product.name);
    field.append(create('span','',t('quantity')),qty);status.setAttribute('role','status');
    const allowed=()=>canOrderProduct(product);
    const add=button(t('addToCart'),()=>{
      if(!allowed()){refresh();return;}
      const amount=Number(qty.value),existing=Number(cart[product.articul]?.qty||0);
      if(!Number.isSafeInteger(amount)||amount<1||amount>MAX_QTY-existing){qty.setCustomValidity(t('invalidQuantity'));status.textContent=existing>=MAX_QTY?t('cartFull'):t('invalidQuantity');qty.reportValidity();return;}
      qty.setCustomValidity('');
      if(amount===1)addToCart(product.articul);else setDirectQty(product.articul,existing+amount);
      window.ZZWS_MEMORY?.capture();syncCartControls();
    },'zigzag-add-to-cart');
    add.setAttribute('aria-label',t('addToCart')+'՝ '+product.name);
    qty.addEventListener('input',()=>qty.setCustomValidity(''));
    const refresh=()=>{
      const available=allowed(),count=Number(cart[product.articul]?.qty||0),full=count>=MAX_QTY;
      qty.max=String(Math.max(1,MAX_QTY-count));qty.disabled=!available||full;add.disabled=!available||full;
      actions.hidden=!available;controls.classList.toggle('zigzag-manager-controls',!available);
      contact.hidden=available;
      status.textContent=!available?t(product.catalogScope==='public'?'outsideCatalog':'notOrderable'):full?t('cartFull'):count?t('inCart')+count+t('pieces'):'';
    };
    actions.append(field,add);controls.append(actions,status,contact);cartWidgets.set(controls,refresh);refresh();return controls;
  }
  function openProductDetails(product){
    if(serverIdentity?.id!==owner)return;
    detailsBody.replaceChildren(showProduct(product,true));if(!detailsDialog.open)detailsDialog.showModal();detailsBody.scrollTop=0;detailsClose.focus();
  }
  function showProduct(product,expanded=false) {
    const box = create('section', 'zigzag-product'+(expanded?' zigzag-product-expanded':'')),summary=create('div','zigzag-product-summary'),photo=create('div','zigzag-product-photo'),info=create('div','zigzag-product-info');
    box.dataset.articul=product.articul;
    // Use the catalogue's verified SKU photo map and existing safe image fallbacks.
    if((visibleProduct(product.articul)||product.catalogScope==='public'&&product.status==='verified')&&typeof getProductImageHtml==='function')photo.innerHTML=getProductImageHtml(product.articul,product.name);else photo.append(create('span','',t('noPhoto')));
    info.append(create('h4','',product.name),create('small','zigzag-product-sku',t('sku')+': '+product.articul));summary.append(photo,info);box.append(summary,productCartControls(product));
    if(product.reasons?.length){const reasons=create('div','zigzag-reasons');reasons.append(create('strong','',t('reason')));const list=create('ul');for(const text of product.reasons.slice(0,6))list.append(create('li','',text));reasons.append(list);box.append(reasons);}
    if(product.catalogScope==='public'){
      info.append(create('p','zigzag-price-pending',t('pricePending')));
      if(product.budgetStatus==='unconfirmed')box.append(create('p','zigzag-budget-unconfirmed',t('budgetUnconfirmed')));
    }
    if(product.price&&typeof product.price.amount==='number'&&product.price.amount>0){
      const orderPrice=canOrderProduct(product)?getItemWholesalePrice({articul:product.articul}):0;
      const price=create('div','zigzag-offer-price');price.append(create('strong','',t(orderPrice||product.price.kind==='customer'?'price':'retailPrice')+': '+(orderPrice||product.price.amount).toLocaleString(locale==='ru'?'ru-RU':locale==='hy'?'hy-AM':'en-GB')+' ֏'),create('small','',t(!orderPrice&&product.price.kind==='retail'?'retailReference':'catalogPrice')));info.append(price);
    }
    if(product.match){
      const match=create('div','zigzag-match zigzag-match-'+product.match.kind);match.append(create('strong','',t(product.match.kind==='near'?'nearMatch':'exactMatch')));
      const deviationUnit=unit=>({hy:{cm:'սմ',kg:'կգ',l:'լ',sets:'հավաքածու',rpm:'պտ/րոպե',AMD:'֏'},ru:{cm:'см',kg:'кг',l:'л',sets:'компл.',rpm:'об/мин',AMD:'֏'}}[locale]?.[unit]||unit||t('cm'));
      for(const difference of product.match.deviations||[])match.append(create('span','',(difference.labels?.[{hy:0,ru:1,en:2}[locale]??0]||t(difference.field))+': '+difference.actual+' '+deviationUnit(difference.unit)+' ('+(difference.difference>0?'+':'')+difference.difference+' '+deviationUnit(difference.unit)+' · '+(difference.fromSource?(locale==='ru'?'Исходное':locale==='en'?'Source':'Սկզբնական'):t('requested'))+': '+difference.requested+')'));
      box.insertBefore(match,summary);
    }
    if (product.status !== 'verified') { box.append(create('p', 'zigzag-source', t('missing'))); return box; }
    if(expanded){
      const dl = create('dl', 'zigzag-specs');
      for (const spec of product.specifications || []) { const pair = create('div', 'zigzag-spec-row'), name=create('dt','',ZZWS_ARMENIAN_SPECS.label(spec.name)), value=create('dd','',ZZWS_ARMENIAN_SPECS.value(spec.value)); name.title=spec.name;value.title=String(spec.value);pair.append(name,value);dl.append(pair); }
      box.append(dl);
    }else{
      const highlights=create('div','zigzag-highlights');let count=0;
      for(const axis of ['width','depth','height'])if(product.matchedDimensions?.[axis]!=null){highlights.append(create('span','',t(axis)+': '+product.matchedDimensions[axis]+' '+t('cm')));count++;}
      const important=window.ZZWS_ASSISTANT_SUMMARY(product.specifications);
      for(const spec of important.slice(0,Math.max(0,4-count)))highlights.append(create('span','',ZZWS_ARMENIAN_SPECS.label(spec.name)+': '+ZZWS_ARMENIAN_SPECS.value(spec.value)));
      if(highlights.children.length)box.append(highlights);
      box.append(button(t('details'),()=>openProductDetails(product),'zigzag-offer-details'));
    }
    const source = create('div', 'zigzag-source');
    try { const url = new URL(product.sourceUrl); if (url.protocol === 'https:' && url.hostname === 'www.zigzag.am' && !url.username && !url.password) { const a = create('a', '', 'zigzag.am ↗'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; source.append(a); } } catch {}
    const date = new Date(product.checkedAt); source.append(create('small', '', t('checked') + (Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale === 'hy' ? 'hy-AM' : locale === 'ru' ? 'ru-RU' : 'en-GB')) + ' · ' + t(product.sourceMode === 'live' ? 'live' : 'saved')));
    if (product.refreshUnavailable) source.append(create('small', '', t('unavailable'))); box.append(source); return box;
  }
  async function submit(text, refresh = false) {
    const message = String(text || '').trim(); if (!message || message.length > 1200 || busy || !serverIdentity) return;
    const userId = serverIdentity.id, currentRevision = revision;
    if (messages.querySelector('.zigzag-welcome')) messages.replaceChildren();
    // A bounded, in-memory transcript is discarded at logout and on a new conversation.
    if (messages.children.length > 42) messages.replaceChildren(...Array.from(messages.children).slice(-30));
    bubble(message, true); input.value = ''; busy = true; send.disabled = true; messages.setAttribute('aria-busy', 'true');chatStatus();
    const pending = create('div', 'zigzag-pending');pending.setAttribute('role','status');pending.append(avatar(28),create('span','zigzag-pending-label',t('typing')));
    const dots=create('span','zigzag-typing-dots');dots.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)dots.append(create('i'));pending.append(dots);messages.append(pending); scroll(); controller = new AbortController();
    // Translated labels can wrap after the first layout on a phone.
    const waitingObserver=new ResizeObserver(()=>{if(busy&&pending.isConnected)scroll();});waitingObserver.observe(pending);waitingObserver.observe(messages);
    const requestController = controller, timeout = setTimeout(() => requestController.abort(), 45000);
    try {
      const orderPriceMode=isAdminUser()&&adminOrderPriceMode==='KP'?'KP':'WS';
      const data = await secureApi('assistant/chat', {method: 'POST', body: JSON.stringify({message, context, refresh, advisor, locale,orderPriceMode,conversationId}), signal: requestController.signal});
      if (currentRevision !== revision || serverIdentity?.id !== userId) return;
      pending.remove(); currentMode=data.mode;mode.textContent = t(data.mode==='selection'?'selection':data.mode === 'ai' ? 'ai' : 'mode'); const reply = bubble(data.answer);
      context = (data.context || []).filter(id => visibleProduct(id)).slice(0, 2); advisor=data.advisor||null;requirements=data.requirementSummary||'';updateContext();
      if (data.modelUnavailable) reply.append(create('p', 'zigzag-note', t('modelUnavailable')));
      if(data.quickReplies?.length){const quick=create('div','zigzag-quick-replies');for(const text of data.quickReplies)quick.append(button(text,()=>submit(text),'zigzag-choice'));reply.append(quick);}
      if(data.recommendations?.length){
        for(const available of [true,false]){
          const candidates=data.recommendations.filter(p=>canOrderProduct(p)===available);if(!candidates.length)continue;
          const section=create('section','zigzag-availability-group zigzag-group-'+(available?'orderable':'manager'));
          section.append(create('h3','zigzag-availability-title',t(available?'orderableGroup':'managerGroup')));
          if(!available)section.append(create('p','zigzag-manager-note',t('managerNote')));
          for(const kind of ['exact','near']){
            const products=candidates.filter(p=>(p.match?.kind||'exact')===kind);if(!products.length)continue;
            const group=create('section','zigzag-recommendation-group zigzag-group-'+kind);group.append(create('h4','zigzag-group-title',t(kind==='near'?'nearGroup':'exactMatch')));
            if(kind==='near')group.append(create('p','zigzag-near-note',t('nearNote')));
            const offers=create('div','zigzag-products zigzag-recommendations');for(const product of products)offers.append(showProduct(product));group.append(offers);section.append(group);
          }
          reply.append(section);
        }
      }
      if(data.publicRecommendations?.length){
        const section=create('section','zigzag-availability-group zigzag-group-public');
        section.append(create('h3','zigzag-availability-title',t('publicGroup')),create('p','zigzag-manager-note',t('publicNote')));
        for(const kind of ['exact','near']){
          const products=data.publicRecommendations.filter(p=>p.catalogScope==='public'&&(p.match?.kind||'exact')===kind);if(!products.length)continue;
          const group=create('section','zigzag-recommendation-group zigzag-group-'+kind);group.append(create('h4','zigzag-group-title',t(kind==='near'?'nearGroup':'exactMatch')));
          if(kind==='near')group.append(create('p','zigzag-near-note',t('nearNote')));
          const offers=create('div','zigzag-products zigzag-public-recommendations');for(const product of products)offers.append(showProduct(product));group.append(offers);section.append(group);
        }
        reply.append(section);
      }
      if (data.products?.length) {
        const cards = create('div', 'zigzag-products'); for (const product of data.products) cards.append(showProduct(product)); reply.append(cards);
        const ids = data.products.map(p => p.articul);
        reply.append(button(t('refresh'), () => { context = ids; submit(t('example') + ids.join(', '), true); }, 'zigzag-refresh'));
      }
      if (data.choices?.length) {
        const choices = create('div', 'zigzag-products zigzag-choices');
        for (const p of data.choices) {
          const entry = showProduct(p), choose = button(locale==='ru'?'Выбрать модель':'Ընտրել մոդելը', () => askProduct(p.articul), 'zigzag-choice');
          const compare = button('+ ' + t('choose'), () => { if (busy) return; if (selected.includes(p.articul)) selected = selected.filter(id => id !== p.articul); else if (selected.length < 2) selected.push(p.articul); else { input.value = ''; input.placeholder = t('limit'); } context = []; compare.setAttribute('aria-pressed', String(selected.includes(p.articul))); updateContext(); }, 'zigzag-choice');
          compare.setAttribute('aria-pressed', 'false'); entry.append(choose, document.createTextNode(' '), compare); choices.append(entry);
        }
        reply.append(choices);
      }
      revealReply(reply);
    } catch (error) {
      if (currentRevision !== revision || serverIdentity?.id !== userId) return;
      pending.remove(); const reply = bubble(error.status === 404 ? t('notDeployed') : error.status === 429 ? error.message : t('error')); reply.classList.add('zigzag-message-error');
      reply.append(create('br'), button(t('retry'), () => submit(message, refresh), 'zigzag-refresh')); scroll();
    } finally {
      waitingObserver.disconnect();clearTimeout(timeout); if (currentRevision === revision) { pending.remove(); busy = false; send.disabled = false; controller = null; messages.removeAttribute('aria-busy');chatStatus(); }
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); submit(input.value); });
  input.addEventListener('input',chatStatus);
  function askProduct(articul){if(busy)return;open();advisor=null;requirements='';context=[];selected=[];updateContext();return submit(t('example')+articul);}
  document.addEventListener('click', event => { const b = event.target.closest?.('[data-zigzag-art]'); if (b) askProduct(b.dataset.zigzagArt); });
  window.addEventListener('zzws:languagechange',()=>{locale=ZZWS_I18N.language;labels();updateContext();for(const email of document.querySelectorAll('.zigzag-contact-manager'))inquiries.get(email)?.();});
  labels();
  window.ZZWS_ASSISTANT = Object.freeze({open, reset, ask: askProduct,viewState:()=>({open:dialog.open,input:input.value,scroll:messages.scrollTop}),restoreView(value){if(!value?.open)return;open();input.value=String(value.input||'').slice(0,1200);messages.scrollTop=Math.max(0,Number(value.scroll)||0);}});
})();
