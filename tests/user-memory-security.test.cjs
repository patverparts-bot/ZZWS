const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),copy=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
class Storage{constructor(){this.values=new Map();}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}removeItem(key){this.values.delete(key);}}
function fixture({localStorage=new Storage(),sessionStorage=new Storage(),states}={}){
 const initial=id=>({data:{cart:{},favorites:[],history:[{id:id+'-history',organization:id+' company',cartSnapshot:{}}],preferences:{theme:'light',filtersOpen:'false',hiddenColumns:[],dealerOffers:[]},draft:{}},versions:{history:1},cleared:{}});
 states=states||{A:initial('A'),B:initial('B')};if(!sessionStorage.getItem('zzws_session_v3'))sessionStorage.setItem('zzws_session_v3','token-A');
 const events=new Map(),nodes=new Map(),requests=[],confirmations=[];let heldPost=null,heldGet=null,failWrites=false,failLogout=false,confirmDiscard=false;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',hidden:false,textContent:'',selectedIndex:0,after(){},setAttribute(){},replaceChildren(){},classList:{toggle(){},contains(){return true;}}});return nodes.get(id);};
 const c={console,Headers,FormData,Response,URL,AbortSignal,localStorage,sessionStorage,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},Date,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,
  document:{hidden:false,documentElement:{classList:{toggle(){}}},getElementById:node,createElement:()=>node('new'),addEventListener(){}},
  ZZWS_CONFIG:{api:'https://offline.invalid/',publishableKey:'offline-public'},ZZWS_I18N:{language:'ru'},serverIdentity:{id:'A'},cart:{},favoritesSet:new Set(),adminOrderPriceMode:'WS',clientRowsData:[{id:'variant'}],catalogLoaded:false,modalFieldsInitialized:false,
  userStorageId:()=>c.serverIdentity?.id,normalizeCart:copy,isAdminUser:()=>false,selectedOrderContact:()=>({address:'Address',contact:'Contact'}),resetCatalogFiltersOnOpen(){},populateOrderModalFields(){},handleDeliveryMethodChange(){},checkDeliveryBadge(){},renderOrderHistoryList(){},
  confirm:message=>{confirmations.push(message);return confirmDiscard;},lockCatalog(){c.ZZWS_MEMORY?.stop();c.serverIdentity=null;c.cart={};c.favoritesSet.clear();},
  addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);},dispatchEvent(event){for(const handler of events.get(event.type)||[])handler(event);}
 };
 c.window=c;c.top=c;c.self=c;
 c.fetch=async(url,options={})=>{
  const route=new URL(url).pathname.slice(1),token=new Headers(options.headers).get('authorization')?.replace('Bearer ',''),id=token?.split('-')[1],method=options.method||'GET';requests.push({route,method,id,body:options.body});
  if(route==='login'){const user=JSON.parse(options.body).login;return Response.json({id:user,sessionToken:'token-'+user});}
  if(route==='logout'){if(failLogout)throw Error('offline');return Response.json({ok:true});}
  if(!states[id])return Response.json({error:'unauthorized'},{status:401});
  if(route==='me')return Response.json({id});
  assert.equal(route,'me/state');
  if(method==='GET'){if(heldGet&&heldGet.id===id){const held=heldGet;heldGet=null;held.entered.resolve();await held.release.promise;}return Response.json(copy(states[id]));}
  if(failWrites)throw Error('offline');
  if(heldPost&&heldPost.id===id){const held=heldPost;heldPost=null;held.entered.resolve();await held.release.promise;}
  const item=JSON.parse(options.body),state=states[id],version=state.versions[item.section]||0;
  if(item.version!==version)return Response.json({value:state.data[item.section],version},{status:409});
  state.data[item.section]=copy(item.value);state.versions[item.section]=version+1;return Response.json({version:version+1});
 };
 vm.createContext(c);for(const name of ['account-cache.js','api-client.js','user-memory.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',name),'utf8'),c,{filename:name});
 return {c,states,localStorage,sessionStorage,requests,confirmations,start:async id=>{c.serverIdentity={id};sessionStorage.setItem('zzws_session_v3','token-'+id);await c.ZZWS_MEMORY.start({id});},history:()=>JSON.parse(localStorage.getItem('zigzag_history_'+c.serverIdentity.id)||'[]'),editHistory(value){localStorage.setItem('zigzag_history_'+c.serverIdentity.id,JSON.stringify(value));c.ZZWS_MEMORY.capture();},holdPost(id){return heldPost={id,entered:deferred(),release:deferred()};},holdGet(id){return heldGet={id,entered:deferred(),release:deferred()};},set failWrites(value){failWrites=value;},set failLogout(value){failLogout=value;},set confirmDiscard(value){confirmDiscard=value;}};
}
test('explicit logout saves history, removes only account business caches, and relogin restores server history',async()=>{
 const f=fixture();await f.start('A');f.localStorage.setItem('zigzag_theme','dark');f.localStorage.setItem('zigzag_columns_A','["brand"]');f.localStorage.setItem('unrelated-setting','keep');f.localStorage.setItem('zigzag_history_B','[{"id":"B-private"}]');
 const next=[{id:'A-new',organization:'Saved before logout',cartSnapshot:{}}];f.editHistory(next);await f.c.ZZWS.json('logout',{method:'POST'});
 for(const name of ['zigzag_history_A','zigzag_cart_A','zzws_pending_A'])assert.equal(f.localStorage.getItem(name),null,name);assert.equal(f.sessionStorage.getItem('zzws_session_v3'),null);assert.deepEqual(f.states.A.data.history,next);
 assert.equal(f.localStorage.getItem('zigzag_theme'),'dark');assert.equal(f.localStorage.getItem('zigzag_columns_A'),'["brand"]');assert.equal(f.localStorage.getItem('unrelated-setting'),'keep');assert.ok(f.localStorage.getItem('zigzag_history_B'));
 const signedIn=await f.c.ZZWS.json('login',{method:'POST',body:JSON.stringify({login:'A'})});await f.start(signedIn.id);assert.deepEqual(f.history(),next);assert.equal(f.confirmations.length,0);
});
test('normal reload retains the actual unsynchronized journal and later saves it',async()=>{
 const f=fixture();await f.start('A');const next=[{id:'unsynced',organization:'Not lost on reload',cartSnapshot:{}}];f.editHistory(next);f.c.cart={SKU:{articul:'SKU',qty:2}};f.c.ZZWS_MEMORY.capture();f.failWrites=true;assert.equal(await f.c.ZZWS_MEMORY.flush(),false);f.c.ZZWS_MEMORY.stop();
 const reloaded=fixture({localStorage:f.localStorage,sessionStorage:f.sessionStorage,states:f.states});await reloaded.start('A');assert.deepEqual(reloaded.history(),next);assert.equal(reloaded.c.cart.SKU.qty,2);assert.equal(await reloaded.c.ZZWS_MEMORY.flush(),true);assert.deepEqual(reloaded.states.A.data.history,next);assert.equal(reloaded.localStorage.getItem('zzws_pending_A'),null);
});
test('failed sync offers stay or explicit discard; offline logout still clears credentials after consent',async()=>{
 const f=fixture();await f.start('A');f.editHistory([{id:'unsynced',cartSnapshot:{}}]);f.failWrites=true;
 await assert.rejects(f.c.ZZWS.json('logout',{method:'POST'}),error=>error.logoutCancelled===true);assert.equal(f.sessionStorage.getItem('zzws_session_v3'),'token-A');assert.ok(f.localStorage.getItem('zzws_pending_A'));assert.equal(f.requests.filter(r=>r.route==='logout').length,0);assert.equal(f.confirmations.length,1);
 f.confirmDiscard=true;f.failLogout=true;await assert.rejects(f.c.ZZWS.json('logout',{method:'POST'}));assert.equal(f.sessionStorage.getItem('zzws_session_v3'),null);assert.equal(f.localStorage.getItem('zzws_pending_A'),null);assert.equal(f.localStorage.getItem('zigzag_history_A'),null);assert.equal(f.confirmations.length,2);
});
test('real login token transition saves old account before adopting the new token and does not leak its history',async()=>{
 const f=fixture();await f.start('A');f.editHistory([{id:'A-pending',cartSnapshot:{}}]);const user=await f.c.ZZWS.json('login',{method:'POST',body:JSON.stringify({login:'B'})});assert.equal(user.id,'B');assert.equal(f.sessionStorage.getItem('zzws_session_v3'),'token-B');assert.equal(f.localStorage.getItem('zigzag_history_A'),null);assert.deepEqual(f.states.A.data.history,[{id:'A-pending',cartSnapshot:{}}]);assert.ok(f.requests.filter(r=>r.route==='me/state'&&r.method==='POST').every(r=>r.id==='A'));
 await f.start('B');assert.deepEqual(f.history(),f.states.B.data.history);assert.ok(!JSON.stringify(f.history()).includes('A-pending'));
});
test('logout waits for an in-flight write rather than discarding its journal',async()=>{
 const f=fixture();await f.start('A');f.editHistory([{id:'in-flight',cartSnapshot:{}}]);const held=f.holdPost('A'),flush=f.c.ZZWS_MEMORY.flush();await held.entered.promise;let finished=false;const logout=f.c.ZZWS.json('logout',{method:'POST'}).then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);assert.equal(f.requests.filter(r=>r.route==='logout').length,0);held.release.resolve();await flush;await logout;assert.deepEqual(f.states.A.data.history,[{id:'in-flight',cartSnapshot:{}}]);assert.equal(f.localStorage.getItem('zigzag_history_A'),null);
});
test('delayed old start and flush responses cannot repaint, clear or acknowledge a new account journal',async()=>{
 const f=fixture(),get=f.holdGet('A'),oldStart=f.start('A');await get.entered.promise;await f.start('B');get.release.resolve();await oldStart;assert.deepEqual(f.history(),f.states.B.data.history);assert.equal(f.localStorage.getItem('zigzag_history_A'),null);
 await f.start('A');f.editHistory([{id:'old-A-write',cartSnapshot:{}}]);const held=f.holdPost('A'),flush=f.c.ZZWS_MEMORY.flush();await held.entered.promise;await f.start('B');const current=[{id:'new-B-pending',cartSnapshot:{}}];f.editHistory(current);const journal=f.localStorage.getItem('zzws_pending_B');held.release.resolve();await flush;assert.equal(f.localStorage.getItem('zzws_pending_B'),journal);assert.deepEqual(f.history(),current);assert.deepEqual(f.states.B.data.history,[{id:'B-history',organization:'B company',cartSnapshot:{}}]);
});
test('same-account logout storage event clears another tab and invalidates its delayed sync',async()=>{
 const f=fixture();await f.start('A');f.editHistory([{id:'tab-private',cartSnapshot:{}}]);f.c.dispatchEvent({type:'storage',key:'zzws_account_logout_A',newValue:'signal'});assert.equal(f.sessionStorage.getItem('zzws_session_v3'),null);assert.equal(f.localStorage.getItem('zigzag_history_A'),null);assert.equal(await f.c.ZZWS_MEMORY.flush(),false);assert.equal(f.c.serverIdentity,null);
});
