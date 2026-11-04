import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '../../tests/node_modules/@electric-sql/pglite/dist/index.js';
import {productSpecificationRoutes, getKnowledgeOverrides, parseZigzagDetails, fetchZigzagSpecifications, ZIGZAG_SPECIFICATION_PROVIDER} from '../functions/zzws-api/product-specification-refresh.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111';
const oldTime = '2026-10-30T00:00:00Z', newTime = '2026-11-04T00:00:00Z';
const product = (articul = '00123', name = 'Bosch AB123') => ({articul, name, source_url:'https://www.zigzag.am/en/bosch-ab123.html'});
const saved = (p = product(), specs = [['Warranty','24 months'],['Power','900 W']]) => [p.name, p.source_url, oldTime, specs];
const baselineOf = products => ({generatedAt:oldTime, products:Object.fromEntries(products.map(p => [p.articul, saved(p)]))});
// Zigzag's real parse_details markup contract: exact itemprop SKU, full title,
// and #additional > list items with direct .detail_name labels. No network in tests.
const html = (sku = '00123', name = 'Bosch AB123', specs = [['Warranty','0'],['Power (W)','900'],['Volume (l)','20']]) => '<!doctype html><html><body><h1 class="page-title"><span itemprop="name">' + name + '</span></h1><div class="product attribute sku product_code"><div class="value" itemprop="sku">' + sku + '</div></div><div id="additional"><ul>' + specs.map(([n,v]) => '<li><span class="detail_name">' + n + '</span><span class="value">' + v + '</span></li>').join('') + '</ul></div></body></html>';
const json = data => new Response(JSON.stringify(data), {headers:{'content-type':'application/json'}});

// Reduced from the real 200 response captured on2026-11-04; product title is not an h1.
const realPanasonicFixture = "<div class=\"product_info product-info-main\"><div class=\"product attribute section_title\"><strong class=\"type\"></strong><div class=\"value\" data-dynamic=\"name\" itemprop=\"name\"> Panasonic TX-65MZ800E </div></div><div class=\"product attribute sku product_code\"><strong class=\"type\">SKU</strong><div class=\"value\" itemprop=\"sku\"> 013411 </div></div></div><div class=\"tab_block additional_tab selected\" aria-labelledby=\"tab-label-additional-title\" id=\"additional\" data-role=\"content\"><h2 class=\"section_title\">Specifications Panasonic TX-65MZ800E</h2><div class=\"details_list\"><div class=\"details_block\"><div class=\"details_type\">General</div><ul><li><div class=\"detail_name\">*</div><div class=\"detail_unit\"><a href=\"https://docs.google.com/document/d/1MGjPvrv5pc0tldXQexY9--p9TfabfoTo/edit?usp=sharing&amp;ouid=113406240421525208290&amp;rtpof=true&amp;sd=true\"> View full promo details</a></div></li><li><div class=\"detail_name\">Manufacturer</div><div class=\"detail_unit\"> Panasonic </div></li><li><div class=\"detail_name\">Warranty</div><div class=\"detail_unit\"> 24 months </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Display</div><ul><li><div class=\"detail_name\">Display</div><div class=\"detail_unit\"> OLED </div></li><li><div class=\"detail_name\">Diagonal</div><div class=\"detail_unit\"> 65&quot; </div></li><li><div class=\"detail_name\">Diagonal (cm)</div><div class=\"detail_unit\"> 165 </div></li><li><div class=\"detail_name\">Resolution (px)</div><div class=\"detail_unit\"> 3840 x 2160 </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Smart TV Capability</div><ul><li><div class=\"detail_name\">Smart TV supported</div><div class=\"detail_unit\"> Yes </div></li><li><div class=\"detail_name\">Operating system</div><div class=\"detail_unit\"> Google TV </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Image Processing System</div><ul><li><div class=\"detail_name\">Refresh Rate (Hz)</div><div class=\"detail_unit\"> 120 </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Tuner</div><ul><li><div class=\"detail_name\">Digital TV tuner</div><div class=\"detail_unit\"> DVB-T/T2/C/S/S2 </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Sound</div><ul><li><div class=\"detail_name\">Front Speakers Power (W)</div><div class=\"detail_unit\"> 24 </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Bluetooth</div><ul><li><div class=\"detail_name\">Bluetooth Built-in Мodule</div><div class=\"detail_unit\"> Yes </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Remote control</div><ul><li><div class=\"detail_name\">Remote control Type</div><div class=\"detail_unit\"> RCU </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Interface</div><ul><li><div class=\"detail_name\">HDMI input</div><div class=\"detail_unit\"> 4 </div></li><li><div class=\"detail_name\">CI/CI+</div><div class=\"detail_unit\"> Yes </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Installing</div><ul><li><div class=\"detail_name\">Wall Mount</div><div class=\"detail_unit\"> VESA 400x200 </div></li></ul></div><div class=\"details_block\"><div class=\"details_type\">Color, Dimensions, Weight</div><ul><li><div class=\"detail_name\">Color</div><div class=\"detail_unit\"> Black </div></li><li><div class=\"detail_name\">Dimensions</div><div class=\"detail_unit\"> 1449 x 874 x 281 mm </div></li><li><div class=\"detail_name\">Dimensions (without stand)(cm)</div><div class=\"detail_unit\"> 144.9 x 83.9 x 4.9 </div></li><li><div class=\"detail_name\">Weight (kg)</div><div class=\"detail_unit\"> 34.5 </div></li><li><div class=\"detail_name\">Weight (without stand) (kg)</div><div class=\"detail_unit\"> 28.5 </div></li><li><div class=\"detail_name\"></div><div class=\"detail_unit\" style=\"color: red; font-size: 10px;\"> * Sizes may differ from the ones on the site </div></li></ul></div></div></div>";
test('actual Panasonic Magento title/SKU/details structure verifies the exact model without h1', () => {
 const specs=parseZigzagDetails(realPanasonicFixture,{articul:'013411',name:'Panasonic TX-65MZ800E'},{sku:'013411'});
 assert.equal(specs.length,21);assert.deepEqual(specs.find(([n])=>/^warranty$/i.test(n)),["Warranty","24 months"]);
 assert.throws(()=>parseZigzagDetails('<h1>Wrong Product</h1>'+realPanasonicFixture,{articul:'013411',name:'Panasonic TX-65MZ800E'}),/identity_mismatch/);
 assert.throws(()=>parseZigzagDetails(realPanasonicFixture,{articul:'013411',name:'Panasonic TX-65MZ800EA'}),/identity_mismatch/);
 const seller=realPanasonicFixture.replace('product-info-main">','product-info-main"><div itemprop="seller"><span itemprop="name">Other Organization</span></div><meta itemprop="name" content="Other Organization" />');
 assert.equal(parseZigzagDetails(seller,{articul:'013411',name:'Panasonic TX-65MZ800E'}).length,21,'schema seller names are not product titles');
});

test('full technical HTML includes facts absent from GraphQL and preserves warranty zero', () => {
  const specs = parseZigzagDetails(html(), product(), {sku:'00123'});
  assert.deepEqual(specs, [['Warranty','0'],['Power (W)','900'],['Volume (l)','20']]);
  assert.throws(() => parseZigzagDetails(html('123'), product()), /identity_mismatch/);
  assert.throws(() => parseZigzagDetails(html('00123','Bosch AB123 PLUS'), product()), /identity_mismatch/);
  assert.throws(() => parseZigzagDetails('<h1>Wrong Product</h1><div itemprop="sku">999</div><aside><span itemprop="name">Bosch AB123</span><span itemprop="sku">00123</span></aside><div id="additional"><li><span class="detail_name">Warranty</span>99 months</li></div>', product()), /identity_mismatch/);
  assert.throws(() => parseZigzagDetails(html('999','Bosch AB123') + '<aside><div class="product attribute sku"><span itemprop="sku">00123</span></div></aside>', product()), /identity_mismatch/);
  assert.throws(() => parseZigzagDetails('<script>' + html() + '</script>', product()), /identity_mismatch/);
  for (const tag of ['script','style','template','textarea','title']) {
    const fake = '<' + tag + '>' + html('00123','Bosch AB123',[['Warranty','99 months']]) + '</' + tag + '>';
    assert.deepEqual(parseZigzagDetails(fake + html('00123','Bosch AB123',[['Warranty','24 months']]),product()), [['Warranty','24 months']]);
  }
  assert.deepEqual(parseZigzagDetails('<aside><div id="additional"><li><span class="detail_name">Warranty</span>99 months</li></div></aside>'+html('00123','Bosch AB123',[['Warranty','24 months']]),product()), [['Warranty','24 months']]);
  assert.throws(() => parseZigzagDetails(html()+html(), product()), /no_specifications/);
  const cleaned = parseZigzagDetails(html('00123','Bosch AB123',[['Price','100000'],['Power (W)','<b>900</b>'],['Color','Black &amp; silver']]),product());
  assert.deepEqual(cleaned, [['Power (W)','900'],['Color','Black & silver']]);
});

test('provider reads a fixed bounded GraphQL request and the verified complete HTML section', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options}); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); assert.equal(options.headers['User-Agent'], 'ZZWSProductEnrichment/1.0');
    if (url.endsWith('/graphql')) {
      assert.equal(options.method, 'POST'); assert.equal(options.headers.Store, 'en');
      assert.ok(JSON.parse(options.body).query.includes('"00123"'));
      return json({data:{products:{items:[{sku:'00123',name:'Bosch AB123',url_key:'bosch-ab123',url_suffix:'.html',product_attributes:[{attributes:[{attribute_code:'warranty',attribute_label:'Warranty',value:'24 months'},{attribute_code:'special_price',attribute_label:'Price',value:'100000'}]}]}]}}});
    }
    return new Response(html(), {headers:{'content-type':'text/html; charset=utf-8'}});
  };
  const result = await fetchZigzagSpecifications([product()], {fetcher, now:() => Date.parse(newTime)});
  assert.equal(result.errors.length, 0); assert.equal(result.updates.length, 1);
  assert.deepEqual(result.updates[0].specifications, [['Warranty','0'],['Power (W)','900'],['Volume (l)','20']]);
  assert.equal(result.updates[0].provider, 'zigzag'); assert.equal(calls.length, 2);
  assert.equal(calls[1].url, product().source_url);
});

test('HTTP failures, wrong variants, absent full details and byte/deadline limits retain facts', async () => {
  const item = {sku:'00123',name:'Bosch AB123',url_key:'bosch-ab123',product_attributes:[]};
  for (const mode of ['http','name','sku','empty','size','timeout']) {
    const fetcher = async url => {
      if (url.endsWith('/graphql')) return mode === 'http' ? new Response('Forbidden',{status:403}) : json({data:{products:{items:[{...item,...(mode==='name'?{name:'Bosch AB123A'}:{})}]}}});
      if (mode === 'timeout') return new Promise(() => {});
      if (mode === 'size') return new Response('x', {headers:{'content-type':'text/html','content-length':'999999999'}});
      return new Response(mode === 'empty' ? html('00123','Bosch AB123',[]) : html(mode === 'sku' ? '99999' : '00123'), {headers:{'content-type':'text/html'}});
    };
    const result = await fetchZigzagSpecifications([product()], {fetcher, deadlineMs:mode==='timeout'?20:1000});
    assert.equal(result.updates.length, 0, mode); assert.equal(result.errors.length, 1, mode);
  }
  await assert.rejects(() => fetchZigzagSpecifications([product('00123','Bosch AB123'),...Array(10).fill(product())]), /invalid_refresh_batch/);
});

async function database() {
  const db = await PGlite.create();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await fs.readFile(new URL('../migrations/20261104124356_manual_product_specification_refresh.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role;');
  return db;
}
function harness(db, baseline, provider) {
  let providerCalls = 0, clock = Date.now();
  const sourceProvider = {...ZIGZAG_SPECIFICATION_PROVIDER, refreshBatch:async(batch, options) => {providerCalls++; return provider ? provider(batch, options) : {updates:batch.map(p => ({...p, provider:'zigzag',checked_at:newTime,specifications:[['Power','1200 W']]})),errors:[]};}};
  const table = name => {
    assert.ok(['product_specifications','specification_refresh_jobs'].includes(name));
    let ordering = '', limit = '', offset = '', single = false;
    const chain = {select(){return chain;},order(column, options={}){assert.ok(['articul','created_at'].includes(column));ordering=' order by '+column+(options.ascending===false?' desc':' asc');return chain;},range(a,b){limit=' limit '+(b-a+1);offset=' offset '+a;return chain;},limit(n){limit=' limit '+n;return chain;},maybeSingle(){single=true;return chain;},then(resolve,reject){return db.query('select * from zzws_'+name+ordering+limit+offset).then(r => {const rows=JSON.parse(JSON.stringify(r.rows));return single?rows[0]||null:rows;}).then(resolve,reject);}};
    return chain;
  };
  const service = {rpc:async(name,args) => {
    const types = {zzws_specification_refresh_start:['uuid','jsonb','text'],zzws_specification_refresh_claim:['uuid','uuid'],zzws_specification_refresh_finish:['uuid','uuid','integer','jsonb','jsonb'],zzws_specification_refresh_cancel:['uuid']}[name]; assert.ok(types);
    const keys = Object.keys(args), values = keys.map((k,i) => types[i]==='jsonb'?JSON.stringify(args[k]):args[k]);
    return (await db.query('select public.'+name+'('+keys.map((k,i) => k+'=> $'+(i+1)+'::'+types[i]).join(',')+') as value',values)).rows[0].value;
  }};
  const base = {table,service,baseline,knowledge:baseline,sourceProvider,now:()=>clock,query:async q=>await q,current:async()=>({id:'catalog-v1',products:Object.entries(baseline.products).map(([articul,row]) => ({articul,name:row[0],wholesale:1234567,secret:'private'})),rules:{}}),project:(rows,user)=>user.visible?rows.filter(p=>user.visible.includes(p.articul)):rows,json:v=>v,fail:(code,message)=>{throw Object.assign(Error(message),{code});},user:{id:OWNER,role:'admin',adminScope:'owner'}};
  const call = (payload, user=base.user, path='admin/product-specifications', search='') => productSpecificationRoutes({...base,path,user,req:{method:payload===undefined?'GET':'POST',url:'https://zzws.invalid/'+path+search},body:async()=>payload});
  return {base,call,service,advance(ms){clock+=ms;},get providerCalls(){return providerCalls;}};
}

test('actual SQL jobs enforce owner auth, exact saved-only scope, durable resume, lease exclusion and cancellation', {timeout:30000}, async () => {
  const db = await database(), products = Array.from({length:12},(_,i)=>product(String(i).padStart(5,'0'),'Bosch AB'+i)), baseline = baselineOf(products);
  const h = harness(db,baseline,(batch)=>({updates:batch.filter(p=>p.articul!=='00001').map(p=>({...p,provider:'zigzag',checked_at:newTime,specifications:[['Power','1200 W']]})),errors:[{articul:'00001',code:'upstream_unavailable'}]}));
  try {
    for (const user of [null,{id:OWNER,role:'client'}, {id:OWNER,role:'admin',adminScope:'manager'}]) await assert.rejects(()=>h.call(undefined,user),e=>[401,403].includes(e.code));
    for (const payload of [{action:'start',articul:'unknown'},{action:'start',source:'https://evil.example'},{action:'step',jobId:'invalid'}]) await assert.rejects(()=>h.call(payload),e=>e.code===400);
    let response = await h.call({action:'start'}), id = response.job.id;
    assert.equal(response.job.total,12); assert.equal(response.availableCount,12); assert.equal(response.source,'zigzag');
    assert.equal(JSON.stringify(response).includes('queue'),false);assert.equal(JSON.stringify(response).includes('lease'),false);assert.equal(JSON.stringify(response).includes(OWNER),false);
    assert.equal((await h.call({action:'start'})).job.id,id,'multiple admin starts reuse one active job');
    response = await h.call({action:'step',jobId:id});
    assert.equal(response.job.processed,10);assert.equal(response.job.refreshed,9);assert.equal(response.job.retained,1);assert.equal(response.job.status,'running');
    assert.equal((await h.call()).job.processed,10,'status survives page/controller replacement');
    const resumed = harness(db,baseline);
    response = await resumed.call({action:'step',jobId:id});assert.equal(response.job.status,'completed');assert.equal(response.job.processed,12);
    let rows = (await db.query('select * from zzws_product_specifications order by articul')).rows;assert.equal(rows.length,11);
    assert.equal(rows.find(r=>r.articul==='00001'),undefined,'failed source never creates or erases facts');
    const merged = await getKnowledgeOverrides(h.base);assert.equal(merged.products['00000'][3][0][1],'1200 W');assert.equal(merged.products['00001'][2],oldTime);assert.equal(merged.products['00000'][3].some(p=>p[0]==='Warranty'),false,'verified removal replaces full facts');
    const client = {id:'client',role:'client',visible:['00000']};
    const dto = await h.call(undefined,client,'catalog/product-specifications');assert.deepEqual(Object.keys(dto.items),['00000']);assert.equal(JSON.stringify(dto).includes('1234567'),false);assert.equal(JSON.stringify(dto).includes('private'),false);
    assert.ok(dto.revision.endsWith('|catalog-v1'));
    const unchanged=await h.call(undefined,client,'catalog/product-specifications','?revision='+encodeURIComponent(dto.revision));assert.deepEqual(unchanged,{unchanged:true,revision:dto.revision});assert.equal(Object.hasOwn(unchanged,'items'),false);
    const versionChanged=await productSpecificationRoutes({...h.base,path:'catalog/product-specifications',user:client,req:{method:'GET',url:'https://zzws.invalid/catalog/product-specifications?revision='+encodeURIComponent(dto.revision)},current:async()=>({...await h.base.current(),id:'catalog-v2'})});assert.ok(versionChanged.items);assert.notEqual(versionChanged.revision,dto.revision);
    await db.query("update zzws_product_specifications set updated_at=clock_timestamp()+interval '1 second' where articul='00000'");h.advance(61000);
    const changed=await h.call(undefined,client,'catalog/product-specifications','?revision='+encodeURIComponent(dto.revision));assert.ok(changed.items);assert.notEqual(changed.revision,dto.revision);assert.deepEqual(Object.keys(changed.items),['00000']);
    response = await h.call({action:'start',articul:'00000'});id=response.job.id;assert.equal(response.job.total,1);assert.equal(response.availableCount,12);
    const lease=crypto.randomUUID(), claimed=await h.service.rpc('zzws_specification_refresh_claim',{p_id:id,p_lease:lease});assert.equal(claimed.claimed,true);
    const calls=h.providerCalls;assert.equal((await h.call({action:'step',jobId:id})).busy,true);assert.equal(h.providerCalls,calls,'a second lease cannot call upstream');
    const cancelled = await h.call({action:'cancel',jobId:id});assert.equal(cancelled.job.status,'cancelled');
    const late = await h.service.rpc('zzws_specification_refresh_finish',{p_id:id,p_lease:lease,p_count:1,p_updates:[{articul:'00000',name:'Bosch AB0',source_url:product().source_url,provider:'zigzag',checked_at:'2026-12-01T00:00:00Z',specifications:[['Warranty','84 months']]}],p_errors:[]});assert.equal(late.committed,false,'cancel prevents a late write');
    rows=(await db.query("select specifications from zzws_product_specifications where articul='00000'")).rows;assert.equal(rows[0].specifications[0][1],'1200 W');
    await db.exec('reset role; set role authenticated;');
    await assert.rejects(()=>db.query('select * from zzws_product_specifications'),/permission denied/);
    await assert.rejects(()=>db.query('select zzws_specification_refresh_cancel($1::uuid)',[id]),/permission denied/);
  } finally {await db.close();}
});

test('expired durable leases can resume, while SQL rejects a forged queue identity and stale fact replacement', {timeout:30000}, async () => {
  const db=await database(), baseline=baselineOf([product()]),h=harness(db,baseline);
  try {
    const id=(await h.call({action:'start'})).job.id,lease=crypto.randomUUID();
    await h.service.rpc('zzws_specification_refresh_claim',{p_id:id,p_lease:lease});
    await db.query("update zzws_specification_refresh_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id]);
    const freshLease=crypto.randomUUID(), claimed=await h.service.rpc('zzws_specification_refresh_claim',{p_id:id,p_lease:freshLease});assert.equal(claimed.claimed,true);
    await assert.rejects(()=>h.service.rpc('zzws_specification_refresh_finish',{p_id:id,p_lease:freshLease,p_count:1,p_updates:[{articul:'00123',name:'Bosch AB123 PLUS',source_url:product().source_url,provider:'zigzag',checked_at:newTime,specifications:[['Warranty','0']]}],p_errors:[]}),/Refresh identity mismatch/);
    await db.query("update zzws_specification_refresh_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id]);
    assert.equal((await h.call({action:'step',jobId:id})).job.refreshed,1);
    const next=(await h.call({action:'start',articul:'00123'})).job.id;
    const old=harness(db,baseline,batch=>({updates:batch.map(p=>({...p,provider:'zigzag',checked_at:oldTime,specifications:[['Warranty','0']]})),errors:[]}));
    const result=await old.call({action:'step',jobId:next});assert.equal(result.job.retained,1);assert.equal(result.job.refreshed,0);
    assert.equal((await db.query('select specifications from zzws_product_specifications')).rows[0].specifications[0][1],'1200 W');
  } finally {await db.close();}
});
