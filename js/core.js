function userStorageId(){return serverIdentity?.id||authorizedClient;}

let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
const PAGE_SIZE = 40;
const MAX_QTY = 9999;
let isLoadingMore = false;
let observer = null;
let catalogLoaded = false;
let productIndex = new Map();
let modalFieldsInitialized = false;
let pendingRestoreToast = false;
let favoritesSet = new Set();
let cachedPriceDateText = "";
let backgroundPollTimer = null;

const DEBOUNCE_MS = 280;
const desktopMQ = window.matchMedia('(min-width: 768px)');

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

const debouncedResetAndRender = debounce(() => resetAndRender(), DEBOUNCE_MS);

function getProduct(articul) {
  return window.ZZWS_PROPOSAL_CART?.product(articul) || productIndex.get(articul) || null;
}

let copyToastTimer = null;
async function copyArticul(articul) { return copyCatalogValue(articul, 'Չհաջողվեց պատճենել արտիկուլը'); }
async function copyModel(model) { return copyCatalogValue(model, 'Չհաջողվեց պատճենել մոդելը'); }
async function copyCatalogValue(articul, failureText) {
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(articul));
      copied = true;
    }
  } catch (e) {}

  if (!copied) {
    const origin = document.activeElement;
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = String(articul);
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    temporaryInput.style.left = '-9999px';
    (origin?.closest('dialog[open]') || document.body).appendChild(temporaryInput);
    temporaryInput.focus({ preventScroll: true });
    temporaryInput.select();
    temporaryInput.setSelectionRange(0, temporaryInput.value.length);
    try { copied = document.execCommand('copy'); } catch (e) {}
    temporaryInput.remove();
    origin?.focus({ preventScroll: true });
  }

  const toast = document.getElementById('copyToast');
  if (toast) {
    toast.textContent = copied ? `Պատճենվեց՝ ${articul}` : failureText;
    toast.classList.remove('hidden');
    if (copyToastTimer) clearTimeout(copyToastTimer);
    copyToastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }
  return copied;
}

let cart = {};
let authorizedClient = '';
let userSheetType = '';
let adminOrderPriceMode = 'WS';

function catalogIdentity(){return window.ZZWS_CATALOG_VIEW?.identity()||serverIdentity;}
function catalogIsAdmin(){return catalogIdentity()?.role==='admin';}
function isAdminUser() {
  return !!serverIdentity && serverIdentity.role === 'admin';
}
let clientRowsData = [];

let availableBrands = [];
let availableCategories = [];
let selectedBrands = [];
let selectedCategories = [];
let catalogFiltersForOpening = null;


const brandDomains = {
'wanbo': 'wanbo.cn', 'epson': 'epson.com', 'blaupunkt': 'blaupunkt.com', 'apple': 'apple.com',
'samsung': 'samsung.com', 'sony': 'sony.com', 'lg': 'lg.com', 'xiaomi': 'mi.com',
'jbl': 'jbl.com', 'marshall': 'marshallheadphones.com', 'haier': 'haier.com', 'philips': 'philips.com',
'bosch': 'bosch.com', 'dyson': 'dyson.com', 'midea': 'midea.com', 'tefal': 'tefal.com',
'moulinex': 'moulinex.com', 'delonghi': 'delonghi.com', 'braun': 'braun.com', 'canon': 'canon.com',
'nikon': 'nikon.com', 'asus': 'asus.com', 'acer': 'acer.com', 'lenovo': 'lenovo.com',
'hp': 'hp.com', 'dell': 'dell.com', 'huawei': 'huawei.com', 'babyliss': 'babyliss.com',
'elica': 'elica.com', 'indesit': 'indesit.com'
};

function loadFavorites() {
  if (!authorizedClient) return;
  try {
    const saved = localStorage.getItem('zigzag_favs_' + userStorageId());
    favoritesSet = saved ? new Set(JSON.parse(saved)) : new Set();
  } catch(e) {
    favoritesSet = new Set();
  }
}

function saveFavorites() {
  if (!authorizedClient) return;
  try {
    localStorage.setItem('zigzag_favs_' + userStorageId(), JSON.stringify([...favoritesSet]));
  } catch(e) {}
}

function toggleFavorite(articul) {
  if (favoritesSet.has(articul)) {
    favoritesSet.delete(articul);
  } else {
    favoritesSet.add(articul);
  }
  saveFavorites();
  
  document.querySelectorAll('.star-btn').forEach(btn => {
    if (btn.dataset.art !== articul) return;
    const isFav = favoritesSet.has(articul);
    btn.innerText = isFav ? '⭐' : '☆';
    btn.title = isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում';
    btn.setAttribute('aria-label', isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում');
  });

  if (document.getElementById('favOnlyFilter').checked) {
    resetAndRender();
  }
}

function updateMobileFilterBadge() {
  let count = 0;
  if (selectedBrands.length) count++;
  if (selectedCategories.length) count++;
  if ((document.getElementById('searchInput').value || '').trim()) count++;
  if (document.getElementById('sortBy').value !== 'default') count++;
  if (document.getElementById('favOnlyFilter').checked) count++;
  if (document.getElementById('promoOnlyFilter').checked) count++;
  if (document.getElementById('stockOnlyFilter').checked) count++;
  const wholesaleFilter = document.getElementById('wholesaleOnlyFilter');
  if (wholesaleFilter && wholesaleFilter.checked) count++;

  const btnText = document.getElementById('mobileFilterBtnText');
  if (btnText) {
    btnText.innerText = count > 0 ? `⚙️ Ֆիլտրեր · ${count}` : '⚙️ Ֆիլտրեր';
  }
  window.ZZWS_STICKY?.refreshSummary();
}

function toggleMobileFilters(forcedState) {
  if(window.ZZWS_CATALOG_COMMAND&&document.documentElement.dataset.storefrontPage!=='home'&&document.documentElement.dataset.dealerView!=='cards'){if(forcedState===false)ZZWS_CATALOG_COMMAND.close();else ZZWS_CATALOG_COMMAND.open('filters');return;}
  const container = document.getElementById('filtersContainer');
  const icon = document.getElementById('filterToggleIcon');
  if (!container || !icon) return;

  const shouldHide = forcedState !== undefined ? !forcedState : !container.classList.contains('hidden');
  
  if (shouldHide) {
    container.classList.add('hidden');
    icon.style.transform = 'rotate(0deg)';
  } else {
    container.classList.remove('hidden');
    icon.style.transform = 'rotate(180deg)';
  }

  if (authorizedClient) {
    try { localStorage.setItem('zigzag_filters_open_' + userStorageId(), shouldHide ? '0' : '1'); } catch(e) {}
  }
  window.ZZWS_STICKY?.filtersToggled(!shouldHide);
}

function toggleDeliveryDetails() {
  const content = document.getElementById('deliveryDetailsContent');
  const icon = document.getElementById('deliveryToggleIcon');
  content.classList.toggle('hidden');
  icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function getSelectedDeliveryMethod() {
  const methodInput = document.getElementById('deliveryMethodInput');
  return methodInput && methodInput.value ? methodInput.value : 'Առաքում';
}

function getDeliveryAddressValue() {
  return getSelectedDeliveryMethod() === 'Ինքնաառաքում'
    ? ''
    : (document.getElementById('deliveryAddressInput').value || '').trim();
}

function handleDeliveryMethodChange() {
  const addressField = document.getElementById('deliveryAddressField');
  if (addressField) addressField.classList.toggle('hidden', getSelectedDeliveryMethod() === 'Ինքնաառաքում');
  checkDeliveryBadge();
}

function checkDeliveryBadge() {
  const dateVal = (document.getElementById('deliveryDateInput').value || '').trim();
  const addrVal = getDeliveryAddressValue();
  const commVal = (document.getElementById('orderCommentInput').value || '').trim();
  const contactVal = (document.getElementById('contactPersonInput').value || '').trim();
  const pickupSelected = getSelectedDeliveryMethod() === 'Ինքնաառաքում';
  const badge = document.getElementById('deliveryBadge');

  if (pickupSelected || dateVal || addrVal || commVal || contactVal) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function loadWholesaleOnlyFilter() {
  const input=document.getElementById('wholesaleOnlyFilter');if(!input)return;
  let enabled=false;try{enabled=localStorage.getItem('zigzag_wholesale_only_'+userStorageId())==='1';}catch{}
  input.checked=isAdminUser()&&enabled&&window.ZZWS_CATALOG_CONTROLS?.enabled('wholesale')!==false;
}

function storeWholesaleOnlyFilter(value) {
  const input=document.getElementById('wholesaleOnlyFilter');const enabled=isAdminUser()&&value===true;
  if(input)input.checked=enabled;
  if(isAdminUser())try{localStorage.setItem('zigzag_wholesale_only_'+userStorageId(),enabled?'1':'0');}catch{}
}

function changeWholesaleOnlyFilter() {
  storeWholesaleOnlyFilter(document.getElementById('wholesaleOnlyFilter')?.checked===true);
  resetAndRender();
}

function saveFiltersToStorage() {
  if (!authorizedClient) return;
  try {
    const filtersState = {
      brands: selectedBrands,
      categories: selectedCategories,
      brand: selectedBrands[0] || '',
      category: selectedCategories[0] || '', 
      search: document.getElementById('searchInput').value || '',
      sortBy: document.getElementById('sortBy').value || 'default',
      sortPrice: document.getElementById('sortPrice').value || 'wholesale',
      sortColumn: document.getElementById('sortColumn').value || 'wholesale',
      favOnly: document.getElementById('favOnlyFilter').checked || false,
      promoOnly: document.getElementById('promoOnlyFilter').checked || false,
      stockOnly: document.getElementById('stockOnlyFilter').checked || false,
      wholesaleOnly: document.getElementById('wholesaleOnlyFilter')?.checked || false
    };
    if(window.ZZWS_CATALOG_VIEW?.active())ZZWS_CATALOG_VIEW.rememberFilters(filtersState);else catalogFiltersForOpening=structuredClone(filtersState);
  } catch(e) {}
  updateMobileFilterBadge();
}

function resetCatalogFiltersOnOpen() {
  window.ZZWS_CATALOG_LAYOUT?.clearPrice();
  catalogFiltersForOpening=null;
  selectedBrands=[];selectedCategories=[];
  for(const id of ['searchInput','brandInput','categoryInput'])document.getElementById(id).value='';
  for(const [id,value]of [['sortBy','default'],['sortPrice','wholesale'],['sortColumn','wholesale']])document.getElementById(id).value=value;
  for(const id of ['favOnlyFilter','promoOnlyFilter','stockOnlyFilter','wholesaleOnlyFilter'])document.getElementById(id).checked=false;
  loadWholesaleOnlyFilter();
  document.getElementById('clearSearchBtn').classList.add('hidden');
  try{localStorage.removeItem('zigzag_filters_'+userStorageId());}catch{}
  if(window.ZZWS_CATALOG_VIEW?.active())ZZWS_CATALOG_VIEW.rememberFilters({});
  if(catalogLoaded){updateBrandSelectionSummary();updateCategorySelectionSummary();renderDependentFilterOptions();resetAndRender();}
  updateMobileFilterBadge();
}

function loadSavedFilters() {
  if(window.ZZWS_CATALOG_VIEW?.active())return ZZWS_CATALOG_VIEW.restoreFilters();
  if (!authorizedClient) return;
  try {
    const saved = catalogFiltersForOpening;
    if (saved) {
      const f = saved;
      selectedBrands = Array.isArray(f.brands) ? f.brands : (f.brand ? [f.brand] : []);
      selectedCategories = Array.isArray(f.categories) ? f.categories : (f.category ? [f.category] : []);
      updateBrandSelectionSummary();
      updateCategorySelectionSummary();
      reconcileFilterSelections();
      updateBrandSelectionSummary();
      updateCategorySelectionSummary();
      renderDependentFilterOptions();
      if (f.search) {
        document.getElementById('searchInput').value = f.search;
        document.getElementById('clearSearchBtn').classList.remove('hidden');
      }
      document.getElementById('sortColumn').value=allowedSortColumns().includes(f.sortColumn)?f.sortColumn:'wholesale';
      const priceSelect=document.getElementById('sortPrice');
      priceSelect.value=[...priceSelect.options].some(o=>o.value===f.sortPrice)?f.sortPrice:'wholesale';
      if (f.sortBy) {
        document.getElementById('sortBy').value = f.sortBy;
      }
      if (f.favOnly !== undefined) {
        document.getElementById('favOnlyFilter').checked = f.favOnly;
      }
      if (f.promoOnly !== undefined) {
        document.getElementById('promoOnlyFilter').checked = f.promoOnly;
      }
      if (f.stockOnly !== undefined) {
        document.getElementById('stockOnlyFilter').checked = f.stockOnly;
      }
    }

    loadWholesaleOnlyFilter();
    const openState = localStorage.getItem('zigzag_filters_open_' + userStorageId());
    if (openState === '1') {
      toggleMobileFilters(true);
    } else if (openState === '0') {
      toggleMobileFilters(false);
    }
  } catch(e) {}
  updateMobileFilterBadge();
}

function clearAllFilters() {
  window.ZZWS_CATALOG_LAYOUT?.clearPrice();
  window.ZZWS_DEALER?.clearFilters();
  clearBrandSelection();
  clearCategorySelection();
  document.getElementById('sortBy').value = 'default';
  document.getElementById('favOnlyFilter').checked = false;
  document.getElementById('promoOnlyFilter').checked = false;
  document.getElementById('stockOnlyFilter').checked = false;
  storeWholesaleOnlyFilter(false);
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  
  if (authorizedClient) {
    try { localStorage.removeItem('zigzag_filters_' + userStorageId()); } catch(e) {}
  }
  resetAndRender();
}

function getBrandLogoHtml(brandName) {
  if (!brandName || brandName === 'Այլ' || brandName === '—') {
    return `<span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">${escapeHtml(brandName || '—')}</span>`;
  }

  const cleanBrand = brandName.trim().toLowerCase();
  const domain = brandDomains[cleanBrand] || `${cleanBrand.replace(/\s+/g, '')}.com`;
  const logoUrl = window.ZZWS_CONFIG?.offline ? '/logo.svg' : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const safeBrand = escapeHtml(brandName);

  return `
<div class="flex items-center gap-1 catalog-brand-cell">
<img src="${escapeHtml(logoUrl)}" alt="${safeBrand}" class="h-4 w-4 object-contain rounded flex-shrink-0 catalog-brand-mark" loading="lazy" 
onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
<span class="font-semibold text-gray-800 dark:text-gray-200 text-xs whitespace-normal catalog-brand-name">${safeBrand}</span>
</div>
`;
}

function productPhotoCandidates(articul) {
  const art = String(articul).trim();
  const folder = `${encodeURIComponent(art.charAt(0) || '0')}/${encodeURIComponent(art.charAt(1) || '0')}/`;
  const file = encodeURIComponent(art);
  const origin = 'https://www.zigzag.am';
  const original = `${origin}/media/catalog/product/${folder}${file}`;
  const cached = `${origin}${window.ZZWS_PRODUCT_PHOTO_FALLBACK_PREFIX || '/media/catalog/product/cache/811d9bdbaebf1cf745388b9849057259/'}${folder}${file}`;
  const mapped = window.ZZWS_PRODUCT_PHOTO_PATHS?.[art];
  const explicit = mapped ? ((mapped.startsWith('https://www.zigzag.am/') || mapped.startsWith('js/product-images/')) ? mapped : `${origin}${window.ZZWS_PRODUCT_PHOTO_PREFIX}${mapped}`) : '';
  return [...new Set([explicit, `${original}.jpg`, `${cached}.jpg`, `${cached}.png`, `${cached}.jpeg`, `${cached}.webp`, `${original}.png`, `${original}.jpeg`, `${original}.webp`, `${origin}/pub/media/catalog/product/${folder}${file}.jpg`, `${origin}/media/catalog/product/${file}.jpg`].filter(Boolean))];
}

function markProductImageLoaded(imgElement) {
  if (!imgElement) return;
  const width = Number(imgElement.naturalWidth) || 0;
  const height = Number(imgElement.naturalHeight) || 0;
  // Missing source files return a 2200x2200 PNG with HTTP 200, so onerror alone never advances.
  const localPhoto = String(imgElement.getAttribute('src') || '').startsWith('js/product-images/');
  const missingPhotoPlaceholder = width === 2200 && height === 2200 && !localPhoto;
  if (missingPhotoPlaceholder) { handleImageError(imgElement); return; }
  const hasRealPhoto = width >= 160 && height >= 160 && !missingPhotoPlaceholder;
  imgElement.classList.toggle("image-loaded", hasRealPhoto);
}

function handleImageError(imgElement) {
  imgElement.classList.remove("image-loaded");
  if(window.ZZWS_CONFIG?.offline){imgElement.onerror=null;imgElement.src='/logo.svg';return;}
  const container = imgElement.parentElement;
  if (!container) return;
  
  const step = Number(imgElement.dataset.step || 0) + 1;
  const cleanArt = imgElement.dataset.articul || '';
  const next = productPhotoCandidates(cleanArt)[step];
  if (next) {
    imgElement.dataset.step = String(step);
    imgElement.src = next;
  } else {
    container.innerHTML = `
      <div class="w-full h-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-0.5" title="Նկարը բացակայում է">
        <span class="text-[10px]">📦</span>
        <span class="text-[8px] font-bold text-gray-500 dark:text-gray-400">Նկար չկա</span>
      </div>`;
    container.insertAdjacentHTML('beforeend',window.ZZWS_STOREFRONT?.ribbons(getProduct(cleanArt))||'');
  }
}
function getProductImageHtml(articul, productName) {
  const cleanArt = String(articul).trim();
  const initialUrl = productPhotoCandidates(cleanArt)[0];

  return `
    <button type="button" class="product-img-container product-technical-trigger" data-product-technical="${escapeHtml(cleanArt)}" data-product-name="${escapeHtml(productName)}" aria-label="Բացել տեխնիկական բնութագրերը՝ ${escapeHtml(productName)}" aria-haspopup="dialog">
      <img src="${escapeHtml(initialUrl)}" 
           data-articul="${escapeHtml(cleanArt)}"
           data-step="0"
           data-fallback-url="${escapeHtml(initialUrl)}"
           alt="${escapeHtml(productName)}" 
           class="product-img dark:border-gray-700 dark:bg-gray-800" 
           loading="lazy"
           onload="markProductImageLoaded(this)"
           onerror="handleImageError(this)">
      ${window.ZZWS_STOREFRONT?.ribbons(getProduct(cleanArt))||''}
    </button>
  `;
}

