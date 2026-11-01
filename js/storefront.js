/* Authenticated storefront. All goods/prices come from the projected server catalogue. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,action,cls='sf-button')=>{const b=node('button',text,cls);b.type='button';b.onclick=action;return b;};
 const labels={home:'Գլխավոր',catalog:'Կատալոգ',promo:'Ակցիաներ',new:'Նորույթներ',terms:'Աշխատանքի պայմաններ',delivery:'Առաքում',contacts:'Կոնտակտներ',help:'Օգնություն'};
 let owner=null,config={},controls={},offer=new Set(),route='home',bannerIndex=0,bannerTimer=null,bannerPaused=false,expiryTimer=null,lastStamp='',sectionDialog=null;
 const app=el('mainApp'),header=document.querySelector('.catalog-header'),main=document.querySelector('.catalog-main'),bar=el('stickySearchBar');
 const home=node('section',null,'sf-home');home.id='storefrontHome';home.setAttribute('aria-label',labels.home);bar.before(home);
 const footer=node('footer',null,'sf-footer');footer.id='storefrontFooter';main.after(footer);
 const top=document.querySelector('.catalog-header-main'),brand=document.querySelector('.catalog-brand'),actions=document.querySelector('.catalog-header-actions');
 const homeLink=node('a');homeLink.href='#home';homeLink.className='sf-brand-link';homeLink.setAttribute('aria-label',labels.home);brand.before(homeLink);homeLink.append(brand);homeLink.onclick=e=>{e.preventDefault();navigate('home');};
 const search=node('form',null,'sf-search'),searchBox=el('searchInput').parentElement;search.append(searchBox,button('Որոնել',()=>navigate('catalog',false),'sf-button sf-primary'));search.setAttribute('role','search');search.onsubmit=e=>{e.preventDefault();navigate('catalog',false);};
 top.append(search);el('searchInput').placeholder='Ապրանքի անվանում կամ արտիկուլ';
 const utilities=node('div',null,'sf-header-tools'),account=node('details',null,'sf-account'),accountSummary=node('summary','Իմ հաշիվը'),accountPanel=node('div',null,'sf-account-panel');account.id='storefrontAccount';accountPanel.append(actions,document.querySelector('.catalog-header-utilities'));account.append(accountSummary,accountPanel);top.append(utilities);utilities.append(account);
 const cart=document.querySelector('#stickySearchActions .header-primary');if(cart)utilities.append(cart);
 const notices=document.querySelector('#stickySearchActions .header-notifications');if(notices)actions.append(notices);
 const bulletins=el('catalogBulletinsButton');if(bulletins)document.querySelector('.catalog-header-meta').append(bulletins);
 const nav=node('nav',null,'sf-nav');nav.id='storefrontNavigation';nav.setAttribute('aria-label','Հիմնական բաժիններ');header.append(nav);
 for(const key of ['home','catalog','promo','new']){const a=node('a',labels[key]);a.href='#'+key;a.dataset.sfRoute=key;a.onclick=e=>{e.preventDefault();navigate(key);};nav.append(a);}
 const tools=node('details',null,'sf-tools-menu');tools.id='storefrontTools';tools.append(node('summary','Վաճառողի գործիքներ'));const toolItems=node('div',null,'sf-tools-items');tools.append(toolItems);nav.append(tools);
 const dealerActions=document.querySelector('.dealer-workspace-actions'),advanced=el('dealerAdvancedTools');
 if(advanced){for(const b of [...advanced.querySelectorAll('button')])toolItems.append(b);advanced.remove();}
 const bulk=document.querySelector('button[onclick="openBulkAddModal()"]');if(bulk)toolItems.append(bulk);
 toolItems.append(button('Արտահանել գնացուցակը',()=>downloadFullPriceList()),button('Համեմատել ընտրվածները',()=>ZZWS_DEALER.compare()));
 nav.append(button('Իմ պատվերները',()=>openPersonalCabinet(),'sf-nav-action'));
 const crumb=node('div',null,'sf-catalog-heading');crumb.append(button('Գլխավոր',()=>navigate('home'),'sf-link'),node('span',' / '));const heading=node('h2',labels.catalog);heading.id='storefrontCatalogTitle';crumb.append(heading);main.prepend(crumb);crumb.after(bar);
 // Filters start closed on every catalogue opening, including desktop.
 el('filtersContainer').classList.add('hidden');el('filtersContainer').classList.remove('md:block');ZZWS_STICKY?.refreshSummary();
 const mobile=node('nav',null,'sf-mobile-nav');mobile.setAttribute('aria-label','Արագ անցումներ');
 for(const key of ['home','catalog']){const b=button(labels[key],()=>navigate(key));b.dataset.sfRoute=key;mobile.append(b);}mobile.append(button('Իմ պատվերները',()=>openPersonalCabinet()),button('Իմ հաշիվը',()=>{account.open=!account.open;accountSummary.focus();window.scrollTo({top:0});}));app.append(mobile);
 function inStock(p){return p.stockAvailable===true||(p.stockAvailable==null&&(p.targetWarehousesStock>=3||p.stockStatus==='Առկա է'));}
 function isNew(p){return !!p?.isNew&&(!p.newUntil||Date.parse(p.newUntil)>Date.now());}
 function isPromo(p){return !!p&&(p.isWholesalePromo===true||(catalogIsAdmin()&&p.kpIsPromo===true)||offer.has(p.articul));}
 function ribbons(p){if(!p)return '';return (isPromo(p)?'<span class="sf-ribbon sf-ribbon-promo"><span>Ակցիա</span></span>':'')+(isNew(p)?'<span class="sf-ribbon sf-ribbon-new'+(isPromo(p)?' sf-ribbon-right':'')+'"><span>Նորույթ</span></span>':'');}
 const money=value=>value>0?Number(value).toLocaleString(ZZWS_I18N.language==='ru'?'ru-RU':'hy-AM')+' ֏':'—';
 function prices(p){
  const root=node('dl',null,'sf-prices'),domus=/ԴՈՄՈՒՍ|ДОМУՍ|DOMUS/i.test(catalogIdentity()?.client||authorizedClient),margin=p.retail>0&&p.wholesale>0?Number(p.marginVal).toFixed(domus?2:1)+(domus?'':'%'):'—';
  for(const [key,label,value] of [['retail','Մանրածախ',money(p.retail)],['wholesale','Մեծածախ',money(p.wholesale)],['margin','Եկամտաբերություն',margin]]){const row=node('div',null,'sf-price-'+key);row.append(node('dt',label),node('dd',value));root.append(row);}
  if(catalogIsAdmin()){const row=node('div');row.append(node('dt','Խոշոր գործընկերոջ գին'),node('dd',money(p.kpPrice)));root.append(row);}
  return root;
 }
 function card(p){
  const root=node('article',null,'sf-product');root.dataset.storefrontSku=p.articul;
  const photo=node('div',null,'sf-product-photo');photo.innerHTML=getProductImageHtml(p.articul,p.name);root.append(photo);
  const favorite=button(favoritesSet.has(p.articul)?'★':'♡',()=>toggleFavorite(p.articul),'star-btn sf-favorite');favorite.dataset.art=p.articul;favorite.setAttribute('aria-label','Ավելացնել ընտրվածներում');root.append(favorite);
  root.append(node('p',p.category,'sf-product-category'));
  const title=node('h4'),details=button(p.name,()=>ZZWS_DEALER.openProduct(p.articul),'sf-product-title');details.dataset.dealerDetails=p.articul;title.append(details);root.append(title);
  const code=button(p.articul,()=>copyArticul(p.articul),'sf-product-code');code.setAttribute('aria-label','Պատճենել արտիկուլը '+p.articul);root.append(code);
  const badges=node('div');badges.innerHTML=window.ZZWS_CATALOG_CONTROLS?.badges(p.articul)||'';root.append(badges,prices(p));
  const stock=node('p',p.stockStatus,'sf-stock');root.append(stock);
  const row=node('div',null,'sf-product-actions'),buy=node('div',null,'js-action');buy.dataset.art=p.articul;buy.innerHTML=getActionControlHtml(p.articul,cart[p.articul],true);
  const compare=button('Համեմատել',()=>ZZWS_DEALER.toggleCompare(p.articul),'sf-button sf-compare');compare.dataset.dealerCompare=p.articul;compare.setAttribute('aria-pressed',String(ZZWS_DEALER.isSelected(p.articul)));compare.setAttribute('aria-label','Համեմատել՝ '+p.name);row.append(buy,compare);root.append(row);return root;
 }
 function navigate(next,clear=true,historyMode='push'){
  if(!owner)return;const previousRoute=route;route=['home','catalog','promo','new'].includes(next)?next:'home';if(route==='promo'&&controls.promo===false)route='catalog';
  if(clear){resetCatalogFiltersOnOpen();ZZWS_DEALER.clearFilters();}
  else if(previousRoute==='promo'&&route!=='promo')el('promoOnlyFilter').checked=false;
  if(route==='promo')el('promoOnlyFilter').checked=true;
  document.documentElement.dataset.storefrontPage=route;heading.textContent=labels[route]||labels.catalog;
  for(const a of document.querySelectorAll('[data-sf-route]'))a.setAttribute('aria-current',a.dataset.sfRoute===route||a.closest('.sf-mobile-nav')&&a.dataset.sfRoute==='catalog'&&route!=='home'?'page':'false');
  if(historyMode==='push')history.pushState({...history.state,zzwsStorefront:true},'','#'+route);
  if(catalogLoaded)resetAndRender();if(route==='home')render();else home.replaceChildren();account.open=false;tools.open=false;
  if(route!=='home'){el('filtersContainer').classList.add('hidden');ZZWS_STICKY?.refreshSummary();}window.scrollTo({top:0});
 }
 function openSection(key){
  const row=config.sections?.[key];if(!row||!row.enabled)return;const text=ZZWS_I18N.language==='ru'?(row.ru||row.hy):(row.hy||row.ru);if(!text)return;
  sectionDialog?.remove();const d=node('dialog',null,'sf-section-dialog'),head=node('header'),title=node('h2',labels[key]),close=button('Փակել',()=>{d.close();d.remove();sectionDialog=null;});d.dataset.key=key;title.id='storefrontSectionTitle';d.setAttribute('aria-labelledby',title.id);head.append(title,close);d.append(head,node('div',text,'sf-section-text'));app.append(d);sectionDialog=d;d.showModal();close.focus();
 }
 function renderFooter(){
  footer.replaceChildren();const inner=node('div',null,'sf-footer-inner'),logo=node('img');logo.src='logo-dark.svg';logo.alt='ZIGZAG';logo.width=150;inner.append(logo,node('p','Մեծածախ ապրանքների կատալոգ'));
  for(const key of ['terms','delivery','contacts','help']){const row=config.sections?.[key];if(row?.enabled&&(row.hy?.trim()||row.ru?.trim())){const b=button(labels[key],()=>openSection(key),'sf-footer-link');b.dataset.storefrontSection=key;inner.append(b);}}
  footer.append(inner);
 }
 function collection(title,list,mode){
  if(!list.length)return;const section=node('section',null,'sf-collection');section.dataset.storefrontCollection=mode;const head=node('div',null,'sf-section-heading');head.append(node('h2',title),button('Տեսնել բոլորը →',()=>navigate(mode),'sf-link'));const grid=node('div',null,'sf-product-grid');for(const p of list.slice(0,8))grid.append(card(p));section.append(head,grid);home.append(section);
 }
 function renderHero(){
  const available=new Map(allProducts.filter(inStock).map(p=>[p.articul,p])),banners=(config.banners||[]).filter(a=>available.has(a));bannerIndex%=Math.max(1,banners.length);
  const chosen=banners.length?available.get(banners[bannerIndex]):null;
  const row=node('div',null,'sf-hero-row'),hero=node('section',null,'sf-hero'),copy=node('div',null,'sf-hero-copy'),art=node('div',null,'sf-hero-art');hero.id='storefrontHero';
  copy.append(node('p',chosen?((config.manualBanners||[]).includes(chosen.articul)?'Մեր ընտրությունը':'Հաճախ են գնում'):'ZIGZAG · Մեծածախ','sf-eyebrow'),node('h1',chosen?chosen.name:'Տեխնիկա ձեր բիզնեսի համար'),node('p',chosen?'Ընտրեք ձեր պայմաններով և ավելացրեք պատվերին։':'Կատալոգը, ձեր գները և պատվերները՝ մեկ տեղում։'));
  if(chosen)copy.append(prices(chosen));copy.append(button(chosen?'Դիտել ապրանքը':'Բացել կատալոգը',()=>chosen?ZZWS_DEALER.openProduct(chosen.articul):navigate('catalog'),'sf-button sf-primary'));
  const photos=chosen?[chosen]:[...available.values()].filter((p,i,arr)=>arr.findIndex(v=>v.category===p.category)===i).slice(0,3);
  for(const p of photos){const box=node('div');box.innerHTML=getProductImageHtml(p.articul,p.name);art.append(box);}hero.append(copy,art);
  if(banners.length>1){const controls=node('div',null,'sf-slide-controls'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const move=(delta,index)=>{bannerIndex=(bannerIndex+banners.length+delta)%banners.length;renderHero();el('storefrontHero').querySelectorAll('.sf-slide-arrow')[index]?.focus({preventScroll:true});};const prev=button('‹',()=>move(-1,0),'sf-slide-arrow'),next=button('›',()=>move(1,1),'sf-slide-arrow'),pause=button(bannerPaused||reduced?'▶':'Ⅱ',()=>{bannerPaused=!bannerPaused;startBannerTimer();pause.textContent=bannerPaused||reduced?'▶':'Ⅱ';pause.setAttribute('aria-pressed',String(bannerPaused));},'sf-slide-arrow');prev.setAttribute('aria-label','Նախորդ բաններ');next.setAttribute('aria-label','Հաջորդ բաններ');pause.setAttribute('aria-label','Բանների ինքնաշխատ փոփոխում');pause.setAttribute('aria-pressed',String(bannerPaused));controls.append(prev,node('span',(bannerIndex+1)+' / '+banners.length),next,pause);hero.append(controls);}
  const partners=node('aside',null,'sf-partners');partners.append(node('h2','Գործընկերների համար'),button('Ներբեռնել գնացուցակը',()=>downloadFullPriceList(),'sf-partner-link'),button('Իմ պատվերները',()=>openPersonalCabinet(),'sf-partner-link'));
  if(config.sections?.terms?.enabled&&(config.sections.terms.hy||config.sections.terms.ru))partners.append(button(labels.terms,()=>openSection('terms'),'sf-partner-link'));row.append(hero,partners);const previous=home.querySelector('.sf-hero-row');if(previous)previous.replaceWith(row);else home.append(row);
 }
 function render(){
  home.replaceChildren();if(!catalogLoaded){home.append(node('p','Կատալոգը բեռնվում է…','sf-home-loading'));return;}renderHero();
  const groups=new Map();for(const p of allProducts)if(p.category&&!groups.has(p.category))groups.set(p.category,p);
  const categories=node('section',null,'sf-category-grid');categories.setAttribute('aria-label','Կատեգորիաներ');categories.hidden=controls.category===false;
  for(const [category,p] of [...groups].slice(0,5)){const tile=button('',()=>{navigate('catalog');selectedCategories=[category];updateCategorySelectionSummary();resetAndRender();},'sf-category');const image=node('div');image.innerHTML=getProductImageHtml(p.articul,p.name);const img=image.querySelector('img');if(img){img.removeAttribute('onload');img.removeAttribute('onerror');tile.append(img);}tile.append(node('span',category));categories.append(tile);}
  categories.append(button('Բոլոր կատեգորիաները →',()=>{navigate('catalog');toggleMobileFilters(true);el('categoryInput').focus();},'sf-category sf-all-categories'));home.append(categories);
  const available=allProducts.filter(inStock);if(controls.promo!==false)collection('Ակցիաներ',available.filter(isPromo),'promo');
  const strip=node('section',null,'sf-editorial');strip.append(node('div','Համեմատեք, ընտրեք և առաջարկեք գնորդին'),button('Վաճառողի գործիքներ',()=>{tools.open=true;tools.querySelector('button')?.focus();window.scrollTo({top:0});},'sf-button'));home.append(strip);
  collection('Նորույթներ',available.filter(isNew),'new');
  if(!available.some(isPromo)&&!available.some(isNew))collection('Առկա ապրանքներ',available,'catalog');
  const brands=node('section',null,'sf-brands');brands.setAttribute('aria-label','Բրենդներ');for(const brand of [...new Set(allProducts.map(p=>p.brand).filter(Boolean))].slice(0,12))brands.append(button(brand,()=>{navigate('catalog');selectedBrands=[brand];updateBrandSelectionSummary();resetAndRender();},'sf-brand'));if(brands.childElementCount&&controls.brand!==false)home.append(brands);
  renderFooter();ZZWS_I18N.refresh(home);
 }
 function startBannerTimer(){clearInterval(bannerTimer);bannerTimer=null;if(bannerPaused||(config.banners||[]).length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;bannerTimer=setInterval(()=>{if(!owner||document.hidden||route!=='home'||document.querySelector('dialog[open]')||home.contains(document.activeElement)||el('storefrontHero')?.matches(':hover'))return;bannerIndex++;renderHero();},(config.bannerSeconds||8)*1000);}
 function refresh(){
  if(!owner||!catalogLoaded)return;if(route==='home')render();else{home.replaceChildren();renderFooter();}startBannerTimer();clearTimeout(expiryTimer);
  const next=Math.min(...allProducts.filter(isNew).map(p=>Date.parse(p.newUntil)).filter(Number.isFinite));if(Number.isFinite(next))expiryTimer=setTimeout(()=>{refresh();if(route!=='home')resetAndRender();},Math.max(50,Math.min(2147483647,next-Date.now()+50)));
 }
 function configure(data){config=data.storefront||{};controls=data.controls||{};search.hidden=controls.search===false;nav.querySelector('[data-sf-route=promo]').hidden=controls.promo===false;offer=new Set(data.specialOffer?.articles||[]);const stamp=JSON.stringify([config,[...offer],controls]);if(stamp!==lastStamp&&catalogLoaded)refresh();lastStamp=stamp;}
 function reset(){owner=null;config={};controls={};lastStamp='';offer.clear();clearInterval(bannerTimer);bannerTimer=null;bannerPaused=false;clearTimeout(expiryTimer);home.replaceChildren();footer.replaceChildren();sectionDialog?.remove();sectionDialog=null;route='home';document.documentElement.dataset.storefrontPage='home';account.open=false;tools.open=false;}
 window.ZZWS_STOREFRONT={card,ribbons,isPromo,isNew,inStock,configure,refresh,navigate,reset,matches:p=>route==='new'?isNew(p)&&inStock(p):route!=='promo'||inStock(p),start(){reset();owner=serverIdentity?.id;ZZWS_DEALER.setView('cards');navigate('home',false,'replace');history.replaceState({...history.state,zzwsStorefront:true},'','#home');}};
 el('searchInput').addEventListener('input',()=>{if(owner&&route==='home'&&el('searchInput').value.trim())navigate('catalog',false);});
 window.addEventListener('popstate',()=>{if(owner)navigate(location.hash.slice(1),true,'restore');});window.addEventListener('zzws:languagechange',()=>{if(owner){refresh();if(sectionDialog?.open){const key=sectionDialog.dataset.key;if(key)openSection(key);}}});
 document.documentElement.dataset.storefrontPage='home';
})();
