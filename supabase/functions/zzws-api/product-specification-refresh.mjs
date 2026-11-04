// Manual provider refresh. Jobs advance only through an owner's explicit HTTP steps.
const GRAPHQL = 'https://www.zigzag.am/graphql', BATCH_SIZE = 10, STEP_MS = 35000, USER_AGENT = 'ZZWSProductEnrichment/1.0';
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const commercial = /(?:^|_)(?:price|stock|discount|promo|gift|special|problem|usage_level|reward|tax|cart|wishlist|sale|cost)(?:_|$)/i;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const safeCode = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 100 && !forbidden.has(value);
const key = value => clean(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function entities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|sup2);/gi, (all, part) => {
    if (part[0] === '#') { const n = part[1].toLowerCase() === 'x' ? parseInt(part.slice(2), 16) : Number(part.slice(1)); return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all; }
    return {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', sup2:'²'}[part.toLowerCase()] || all;
  });
}
function clean(value) { return entities(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function safeZigzagSource(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'www.zigzag.am' && !u.username && !u.password && !u.port; } catch { return false; }
}
function specPairs(values) {
  if (!Array.isArray(values) || values.length > 500) throw Error('invalid_specifications');
  const result = [], seen = new Set();
  for (const entry of values) {
    if (!Array.isArray(entry) || entry.length !== 2 || !['string','number'].includes(typeof entry[1])) throw Error('invalid_specifications');
    const name = clean(entry[0]), value = clean(entry[1]), code = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_');
    if (!name || !key(name) || name.length > 500 || !value || value.length > 5000 || ['-', '—', 'N/A'].includes(value) || commercial.test(code) || /promo details|special offer|gift/i.test(value) || seen.has(key(name))) continue;
    seen.add(key(name)); result.push([name, value]);
  }
  if (!result.length || result.length > 200) throw Error('no_specifications');
  return result;
}

// Narrow, non-executing HTML tree sufficient for Zigzag's full #additional list.
function htmlTree(body) {
  body = body.replace(/<(script|style|template|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const root = {tag:'root', attrs:{}, children:[], parent:null}, stack = [root];
  let count = 0;
  for (const token of body.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g)) {
    if (++count > 250000) throw Error('html_too_complex');
    const value = token[0];
    if (value.startsWith('<!--') || value.startsWith('<!')) continue;
    if (value.startsWith('</')) {
      const tag = /^<\/\s*([^\s>]+)/.exec(value)?.[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
    } else if (value.startsWith('<')) {
      const tag = /^<([^\s/>]+)/.exec(value)?.[1].toLowerCase(); if (!tag) continue;
      const attrs = Object.create(null);
      for (const match of value.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) if (!forbidden.has(match[1].toLowerCase())) attrs[match[1].toLowerCase()] = entities(match[2] ?? match[3] ?? match[4] ?? '');
      const node = {tag, attrs, children:[], parent:stack.at(-1)}; node.parent.children.push(node);
      if (!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !value.endsWith('/>')) { if (stack.length > 150) throw Error('html_too_complex'); stack.push(node); }
    } else if (!['script','style'].includes(stack.at(-1).tag)) stack.at(-1).children.push(entities(value));
  }
  return root;
}
function nodes(root, accept) { const result = []; const visit = n => { if (typeof n === 'string') return; if (accept(n)) result.push(n); for (const child of n.children) visit(child); }; visit(root); return result; }
const textOf = node => typeof node === 'string' ? node : node.children.map(textOf).join(' ');
export function parseZigzagDetails(body, product, item = product) {
  const doc = htmlTree(body), secondary = node => {for (let n = node; n; n = n.parent) if (n.tag === 'aside' || /(?:^|\s)(?:related|upsell|crosssell|recommend|product-items)(?:\s|$)/i.test(n.attrs.class || '')) return true; return false;};
  const primary = nodes(doc, n => (n.attrs.class || '').split(/\s+/).includes('product-info-main') && !secondary(n));
  let titleNodes = nodes(doc, n => n.tag === 'h1' && !secondary(n));
  // Zigzag's live Magento template uses section_title/itemprop=name, with no h1.
  // A present h1 remains authoritative; related/sidebar names never rescue it.
  if (!titleNodes.length && primary.length === 1) titleNodes = nodes(primary[0], n => ((n.attrs.class || '').split(/\s+/).includes('product_title') || ['div','span','h2'].includes(n.tag) && n.attrs.itemprop === 'name' && (n.parent?.attrs.class || '').split(/\s+/).includes('section_title')) && !secondary(n));
  const titles = titleNodes.map(n => clean(textOf(n)));
  const belongs = node => {if (primary.length !== 1) return true;for (let n=node;n;n=n.parent) if(n===primary[0])return true;return false;};
  const blocks = nodes(doc, n => {const classes = (n.attrs.class || '').split(/\s+/); return classes.includes('product') && classes.includes('attribute') && classes.includes('sku') && !secondary(n) && belongs(n);});
  const skus = blocks.flatMap(block => nodes(block, n => ['div','span'].includes(n.tag) && n.attrs.itemprop === 'sku').map(n => clean(textOf(n))));
  if (!titles.length || titles.some(title => key(title) !== key(product.name)) || !skus.length || skus.some(sku => sku !== product.articul) || item.sku && item.sku !== product.articul) throw Error('identity_mismatch');
  const pairs = [], areas = nodes(doc, n => n.tag === 'div' && n.attrs.id === 'additional' && !secondary(n));
  if (areas.length !== 1) throw Error('no_specifications');
  for (const area of areas) {
    for (const label of nodes(area, n => ['div','span'].includes(n.tag) && (n.attrs.class || '').split(/\s+/).includes('detail_name'))) {
      if (label.parent?.tag !== 'li') continue;
      const siblings = label.parent.children, pos = siblings.indexOf(label);
      pairs.push([clean(textOf(label)), clean(siblings.slice(pos + 1).map(textOf).join(' '))]);
    }
  }
  return specPairs(pairs);
}

async function boundedRead(url, options, {fetcher, signal, maxBytes, timeoutMs = 8000, kind}) {
  const controller = new AbortController(), state = {reader:null};
  let interrupt;
  const interrupted = new Promise((_, reject) => { interrupt = reject; });
  const stop = () => { controller.abort(); void state.reader?.cancel().catch(() => {}); interrupt(Error('step_timeout')); };
  if (signal?.aborted) throw Error('step_timeout');
  signal?.addEventListener('abort', stop, {once:true});
  let timer;
  const work = async () => {
    const response = await fetcher(url, {...options, headers:{'User-Agent':USER_AGENT,...options.headers}, redirect:'error', credentials:'omit', signal:controller.signal});
    if (controller.signal.aborted) throw Error('upstream_timeout');
    if (!response?.ok || response.status !== 200 || response.redirected || !new RegExp(kind === 'json' ? '^application/json' : '^text/html', 'i').test(response.headers.get('content-type') || '')) { void response?.body?.cancel().catch(() => {}); throw Error('upstream_unavailable'); }
    const size = response.headers.get('content-length');
    if (size !== null && (!/^\d+$/.test(size) || Number(size) > maxBytes)) { void response.body?.cancel().catch(() => {}); throw Error('upstream_too_large'); }
    const reader = state.reader = response.body?.getReader(); if (!reader) throw Error('upstream_unavailable');
    const chunks = []; let length = 0;
    try {
      for (;;) { const part = await reader.read(); if (controller.signal.aborted) throw Error('upstream_timeout'); if (part.done) break; length += part.value.byteLength; if (length > maxBytes) throw Error('upstream_too_large'); chunks.push(part.value); }
      const bytes = new Uint8Array(length); let pos = 0; for (const part of chunks) { bytes.set(part, pos); pos += part.byteLength; }
      return new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    } finally { state.reader = null; void reader.cancel().catch(() => {}); }
  };
  try {
    return await Promise.race([work(), interrupted, new Promise((_, reject) => { timer = setTimeout(() => {controller.abort(); void state.reader?.cancel().catch(() => {}); reject(Error('upstream_timeout'));}, timeoutMs); })]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
}
const errorCode = error => ['identity_mismatch','no_specifications','invalid_specifications','upstream_timeout','upstream_too_large','upstream_unavailable','step_timeout'].includes(error?.message) ? error.message : 'source_unavailable';

export async function fetchZigzagSpecifications(batch, {fetcher = fetch, now = Date.now, signal, deadlineMs = STEP_MS} = {}) {
  if (!Array.isArray(batch) || !batch.length || batch.length > BATCH_SIZE || batch.some(p => !safeCode(p.articul) || typeof p.name !== 'string' || !safeZigzagSource(p.source_url))) throw Error('invalid_refresh_batch');
  const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, deadlineMs), updates = [], errors = [];
  signal?.addEventListener('abort', abort, {once:true});
  try {
    const query = 'query { products(filter:{sku:{in:' + JSON.stringify(batch.map(p => p.articul)) + '}},pageSize:10){items{sku name url_key url_suffix product_attributes{group_name attributes{attribute_code attribute_label value}}}}}';
    const raw = await boundedRead(GRAPHQL, {method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json', Store:'en'}, body:JSON.stringify({query})}, {fetcher, signal:controller.signal, maxBytes:1500000, kind:'json'});
    const data = JSON.parse(raw), items = data?.data?.products?.items;
    if (data.errors || !Array.isArray(items)) throw Error('upstream_unavailable');
    let cursor = 0, nextReadAt = 0;
    const worker = async () => {
      while (cursor < batch.length) {
        const product = batch[cursor++];
        try {
          const matches = items.filter(item => item?.sku === product.articul);
          if (matches.length !== 1 || key(matches[0].name || '') !== key(product.name)) throw Error('identity_mismatch');
          const item = matches[0];
          if (!/^[a-zA-Z0-9_-]+$/.test(item.url_key) || !['.html','',null,undefined].includes(item.url_suffix)) throw Error('identity_mismatch');
          const source = 'https://www.zigzag.am/en/' + item.url_key + (item.url_suffix || '.html');
          const wait = Math.max(0, nextReadAt - now()); nextReadAt = Math.max(now(), nextReadAt) + 500;
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          const html = await boundedRead(source, {method:'GET', headers:{Accept:'text/html'}}, {fetcher, signal:controller.signal, maxBytes:3000000, kind:'html'});
          const full = parseZigzagDetails(html, product, item), seen = new Set(full.map(([name]) => key(name)));
          const api = (item.product_attributes || []).flatMap(g => g?.attributes || []).filter(a => typeof a?.attribute_code === 'string' && !commercial.test(a.attribute_code) && typeof a.attribute_label === 'string' && ['string','number'].includes(typeof a.value)).map(a => [a.attribute_label, String(a.value)]);
          for (const pair of api) if (!seen.has(key(pair[0]))) { seen.add(key(pair[0])); full.push(pair); }
          updates.push({articul:product.articul, name:product.name, source_url:source, provider:'zigzag', checked_at:new Date(now()).toISOString(), specifications:specPairs(full)});
        } catch (error) { errors.push({articul:product.articul, code:errorCode(error)}); }
      }
    };
    await Promise.all(Array.from({length:Math.min(3, batch.length)}, worker));
  } catch (error) {
    for (const product of batch) if (!updates.some(p => p.articul === product.articul) && !errors.some(p => p.articul === product.articul)) errors.push({articul:product.articul, code:errorCode(error)});
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  return {updates, errors};
}
export const ZIGZAG_SPECIFICATION_PROVIDER = Object.freeze({id:'zigzag', refreshBatch:fetchZigzagSpecifications, validateSource:safeZigzagSource});

let cacheEpoch = 0;
const caches = new WeakMap();
function validSaved(row, baseline, provider = ZIGZAG_SPECIFICATION_PROVIDER) {
  const original = Object.hasOwn(baseline.products || {}, row.articul) ? baseline.products[row.articul] : null;
  if (!original || !safeCode(row.articul) || typeof row.name !== 'string' || key(row.name) !== key(original[0]) || row.provider !== provider.id || !provider.validateSource(row.source_url) || !date(row.checked_at) || Date.parse(row.checked_at) < Date.parse(original[2])) return null;
  try { return [row.name, row.source_url, row.checked_at, specPairs(row.specifications)]; } catch { return null; }
}
async function savedOverrides({table, query, baseline, sourceProvider = ZIGZAG_SPECIFICATION_PROVIDER, now = Date.now}) {
  let entry = caches.get(baseline);
  if (entry?.epoch === cacheEpoch && entry.providerId === sourceProvider.id && entry.until > now()) return entry;
  if (entry?.pending && entry.epoch === cacheEpoch && entry.providerId === sourceProvider.id) return entry.pending;
  const previous = entry;
  entry = {epoch:cacheEpoch, providerId:sourceProvider.id, until:0, rows:[], revision:null}; caches.set(baseline, entry);
  entry.pending = (async () => {
    try {
      const rows = [];
      for (let start = 0; start < 100000; start += 1000) {
        const page = await query(table('product_specifications').select('articul,name,source_url,provider,checked_at,specifications,updated_at').order('articul').range(start, start + 999));
        if (!Array.isArray(page)) throw Error('invalid_saved_data'); rows.push(...page); if (page.length < 1000) break;
      }
      entry.rows = rows.filter(row => validSaved(row, baseline, sourceProvider));
      entry.revision = entry.rows.reduce((latest, row) => !latest || Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest, null);
      entry.until = now() + 60000;
    } catch { entry.rows = previous?.rows || []; entry.revision = previous?.revision || null; entry.until = now() + 15000; }
    return entry;
  })();
  try { return await entry.pending; } finally { entry.pending = null; }
}
export async function getKnowledgeOverrides(context) {
  const {baseline, sourceProvider = ZIGZAG_SPECIFICATION_PROVIDER} = context, saved = await savedOverrides(context);
  if (saved.knowledge) return saved.knowledge;
  const products = Object.assign(Object.create(null), baseline.products);
  for (const row of saved.rows) { const value = validSaved(row, baseline, sourceProvider); if (value) products[row.articul] = value; }
  saved.knowledge = {generatedAt:saved.revision && Date.parse(saved.revision) > Date.parse(baseline.generatedAt || '') ? saved.revision : baseline.generatedAt, products};
  return saved.knowledge;
}
function jobDTO(job) {
  return job ? {id:job.id, state:job.state, status:job.state, providerId:job.provider, total:job.total, processed:job.processed, refreshed:job.refreshed, retained:job.retained, startedAt:job.created_at, updatedAt:job.updated_at, finishedAt:job.finished_at, errors:(job.errors || []).map(e => ({articul:e.articul, code:e.code})).slice(-30)} : null;
}
export async function productSpecificationRoutes(context) {
  const {path, req, user, body, table, query, json, fail, current, project, service, sourceProvider = ZIGZAG_SPECIFICATION_PROVIDER, fetcher = fetch, now = Date.now} = context;
  if (!['admin/product-specifications','catalog/product-specifications'].includes(path)) return null;
  if (!user?.id) fail(401, 'Մուտք գործեք համակարգ');
  if (!sourceProvider || !/^[a-z][a-z0-9_-]{0,31}$/.test(sourceProvider.id) || typeof sourceProvider.refreshBatch !== 'function' || typeof sourceProvider.validateSource !== 'function') throw Error('invalid_source_provider');
  const baseline = context.baseline || context.knowledge;
  const shared = {table, query, baseline, sourceProvider, now};
  if (path === 'catalog/product-specifications') {
    if (req.method !== 'GET') fail(405, 'Սխալ գործողություն');
    const snapshot = await current(), saved = await savedOverrides(shared), catalogRevision = snapshot.id || snapshot.version || '';
    const revision = saved.revision ? saved.revision + (catalogRevision ? '|' + String(catalogRevision) : '') : null;
    const wanted = new URL(req.url || 'https://zzws.invalid/catalog/product-specifications').searchParams.get('revision');
    if (revision !== null && wanted === revision) return json({unchanged:true, revision});
    const visible = project(snapshot.products, user, snapshot.rules, {mainWarehouses:snapshot.mainWarehouses}), allowed = new Map(visible.map(p => [p.articul, p.name])), items = Object.create(null);
    for (const row of saved.rows) if (allowed.has(row.articul) && key(allowed.get(row.articul)) === key(row.name)) { const value = validSaved(row, baseline, sourceProvider); if (value) items[row.articul] = value; }
    return json({items, revision});
  }
  if (user.role !== 'admin' || user.adminScope !== 'owner') fail(403, 'Հասանելի է միայն սեփականատիրոջը');
  const availableCount = Object.keys(baseline.products || {}).length;
  const wrap = async (job, extra = {}) => { const saved = await savedOverrides(shared); return json({job:jobDTO(job), source:sourceProvider.id, providerId:sourceProvider.id, availableCount, lastCheckedAt:saved.revision, ...extra}); };
  const rpc = (name, args) => query(service.rpc('zzws_specification_refresh_' + name, args));
  if (req.method === 'GET') return wrap(await query(table('specification_refresh_jobs').select('*').order('created_at', {ascending:false}).limit(1).maybeSingle()));
  if (req.method !== 'POST') fail(405, 'Սխալ գործողություն');
  const payload = await body();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => !['action','jobId','articul'].includes(k)) || !['start','step','cancel'].includes(payload.action)) fail(400, 'Ստուգեք գործողությունը');
  if (payload.action === 'start') {
    if (payload.jobId != null || payload.articul != null && (!safeCode(payload.articul) || !Object.hasOwn(baseline.products, payload.articul))) fail(400, 'Սխալ ապրանք');
    const knowledge = await getKnowledgeOverrides(shared), entries = payload.articul ? [[payload.articul, knowledge.products[payload.articul]]] : Object.entries(knowledge.products);
    const queue = entries.filter(([code,row]) => safeCode(code) && row && typeof row[0] === 'string' && sourceProvider.validateSource(row[1])).map(([code,row]) => [code,row[0],row[1]]);
    if (!queue.length || queue.length > 100000) fail(400, 'Պահպանված բնութագրեր չկան');
    return wrap(await rpc('start', {p_owner:user.id, p_queue:queue, p_provider:sourceProvider.id}));
  }
  if (!uuid(payload.jobId) || payload.articul != null) fail(400, 'Սխալ առաջադրանք');
  if (payload.action === 'cancel') { const job = await rpc('cancel', {p_id:payload.jobId}); if (!job) fail(404, 'Առաջադրանքը չի գտնվել'); return wrap(job); }
  const lease = crypto.randomUUID(), claimed = await rpc('claim', {p_id:payload.jobId, p_lease:lease});
  if (!claimed?.job) fail(404, 'Առաջադրանքը չի գտնվել');
  if (!claimed.claimed) return wrap(claimed.job, {busy:claimed.job.state === 'running'});
  const job = claimed.job;
  if (job.provider !== sourceProvider.id) return wrap(job, {busy:true});
  const batch = job.queue.slice(job.cursor, job.cursor + BATCH_SIZE).map(([articul,name,source_url]) => ({articul,name,source_url}));
  let result, timer;
  const stepController = new AbortController(), stop = () => stepController.abort();
  req.signal?.addEventListener('abort', stop, {once:true});
  try {
    result = await Promise.race([sourceProvider.refreshBatch(batch, {fetcher, now, signal:stepController.signal, deadlineMs:STEP_MS}), new Promise((_, reject) => {timer=setTimeout(() => {stepController.abort(); reject(Error('step_timeout'));}, STEP_MS+1000);})]);
  } catch (error) { result = {updates:[], errors:batch.map(p => ({articul:p.articul, code:errorCode(error)}))}; }
  finally {clearTimeout(timer);req.signal?.removeEventListener('abort', stop);}
  const updates = [], seen = new Set(), errors = [];
  for (const row of Array.isArray(result?.updates) ? result.updates : []) {
    const expected = batch.find(p => p.articul === row?.articul);
    if (!expected || seen.has(row.articul) || row.provider !== sourceProvider.id || key(row.name || '') !== key(expected.name) || !sourceProvider.validateSource(row.source_url) || !date(row.checked_at)) continue;
    try { updates.push({...row, name:expected.name, specifications:specPairs(row.specifications)}); seen.add(row.articul); } catch {}
  }
  for (const product of batch) if (!seen.has(product.articul)) { const error = result?.errors?.find(e => e?.articul === product.articul); errors.push({articul:product.articul, code:error?.code && /^[a-z_]{1,50}$/.test(error.code) ? error.code : 'source_unavailable'}); }
  const finished = await rpc('finish', {p_id:job.id, p_lease:lease, p_count:batch.length, p_updates:updates, p_errors:errors});
  if (finished?.committed) cacheEpoch++;
  return wrap(finished?.job || job);
}
