/* Read-only list matching and stock distribution. No order or reservation writes. */
(function(root){
 'use strict';
 const norm=v=>String(v??'').normalize('NFKC').toUpperCase().trim();
 const tokens=v=>norm(v).match(/[A-Z0-9]+(?:[-/][A-Z0-9]+)*/g)||[];
 const modelTokens=v=>{
  const value=norm(v),isConsole=/\bPLAYSTATION\b/.test(value);
  const words=tokens(isConsole?value.replace(/\/\s*PS5\b/g,' /PS5'):value);
  // Only the redundant opening prefix is ignored; the trailing /PS5 stays.
  return words[0]==='PS5'&&words[1]==='PLAYSTATION'?words.slice(1):words;
 };
 const isMeasure=word=>/^\d+(?:MM|CM|M|ML|L|KG|G|W|KW|V|HZ|KHZ|MHZ|GHZ|GB|TB|MB|MAH|WH|BTU)$/.test(word);
 function parse(rows){
  const result=[];let columns=null;
  for(const cells of rows){
   const row=cells.map(v=>String(v??'').trim());if(!row.some(Boolean))continue;
   if(!result.length&&!columns){
    const q=row.findIndex(v=>/^(քանակ|պատվեր|պատվ|количество|кол-во|qty|quantity)[.։:]?$/i.test(v));
    if(q>=0){columns={qty:q,sku:row.findIndex(v=>/^(արտիկուլ|артикул|sku|articul|код)$/i.test(v)),name:row.findIndex(v=>/^(մոդել|անվանում|название|наименование|модель|model|name)$/i.test(v))};continue;}
   }
   const qtyText=row[columns?.qty??row.length-1]??'';
   const quantity=/^\d+$/.test(qtyText)?Number(qtyText):NaN;
   const sku=columns?.sku>=0?row[columns.sku]:!columns&&row.length===3?row[0]:'';
   const name=columns?.name>=0?row[columns.name]:row.filter((_,i)=>i!==(columns?.qty??row.length-1)&&i!==columns?.sku&&!(sku&&!columns&&i===0)).join(' ');
   result.push({sku,name,quantity,valid:Number.isSafeInteger(quantity)&&quantity>0&&quantity<=999999});
  }
  if(result.length>2000)throw new Error('LIST_TOO_LONG');return result;
 }
 function match(row,products){
  const key=norm(row.sku||row.name);let hits=products.filter(p=>norm(p.articul)===key||norm(p.name)===key);
  if(!hits.length&&!row.sku){
   // Localized category descriptions may surround the Latin brand/model.
   // Compare that complete identity before falling back to a model code:
   // IX/A/52 and PS5 alone are shared by distinct product variants.
   const identity=modelTokens(row.name),full=identity.join(' ');
   if(identity.length>=2&&identity.some(t=>/\d/.test(t)))hits=products.filter(p=>modelTokens(p.name).join(' ')===full);
   // The list may put the platform before Playstation, while the catalog
   // puts the same platform after the complete model as /PS5.
   const rawIdentity=tokens(row.name);
   if(!hits.length&&rawIdentity[0]==='PS5'&&rawIdentity[1]==='PLAYSTATION'&&identity.at(-1)!=='PS5')hits=products.filter(p=>modelTokens(p.name).join(' ')===full+' PS5');
   if(!hits.length){
    const codes=identity.filter(t=>/\d/.test(t)&&/[A-Z]/.test(t)&&!isMeasure(t)&&(t!=='PS5'||identity.length===1));
    const measures=identity.filter(isMeasure);
    hits=codes.length?products.filter(p=>{const words=tokens(p.name);return codes.every(code=>words.includes(code))&&(!words.some(isMeasure)||measures.every(measure=>words.includes(measure)));}):[];
   }
  }
  return hits.length===1?{product:hits[0]}:hits.length?{error:'ambiguous',candidates:hits.map(p=>({articul:p.articul,name:p.name}))}:{error:'missing'};
 }
 function stocks(product){
  const value=String(product.stockStatus??'').trim(),out={};
  if(!value)return out;
  for(const entry of value.split(',')){
   const m=entry.trim().match(/^(\d{3}):\s*(\d+)$/);if(!m||Object.hasOwn(out,m[1]))return {};
   const n=Number(m[2]);if(!Number.isSafeInteger(n))return {};out[m[1]]=n;
  }return out;
 }
 function allocate(rows,products,includeLast=false,priceGroup='Dealers',priority){
  if(!Array.isArray(priority)||priority.some(code=>typeof code!=='string'||!/^\d{3}$/.test(code))||new Set(priority).size!==priority.length)throw new Error('Warehouse policy is missing or invalid');
  if(!['Dealers','KP'].includes(priceGroup)&&!/^cat_[a-z0-9_-]{1,60}$/.test(priceGroup))throw new Error('Invalid price group');
  const remaining=new Map();
  return rows.map(row=>{
   if(!row.valid)return {...row,error:'quantity',allocated:0,allocations:[]};
   const found=match(row,products);if(!found.product)return {...row,...found,allocated:0,shortage:row.quantity,allocations:[]};
   const p=found.product,key=String(p.articul);if(!remaining.has(key))remaining.set(key,stocks(p));
   const pool=remaining.get(key);let need=row.quantity;const allocations=[];
   const singleMain=priority.find(code=>(pool[code]||0)>=need);
   const mainOrder=singleMain?[singleMain]:priority;
   for(const code of mainOrder){const qty=Math.min(need,pool[code]||0);if(qty){allocations.push({warehouse:code,quantity:qty});pool[code]-=qty;need-=qty;}if(!need)break;}
   if(need){
    const reserve=includeLast?0:1;
    const shops=Object.keys(pool).filter(k=>!priority.includes(k)&&pool[k]>reserve).sort((a,b)=>pool[b]-pool[a]||a.localeCompare(b));
    const take=shops.reduce((sum,code)=>Math.min(need,sum+Math.min(need,pool[code]-reserve)),0);
    if(take){
     // Lower the largest stocks towards a common remaining level. This is
     // equivalent to repeatedly taking one unit from the fullest shop,
     // without a loop proportional to the requested quantity.
     let low=reserve,high=pool[shops[0]];
     while(low<high){const mid=low+Math.floor((high-low)/2);let removed=0;for(const code of shops){removed+=Math.min(take+1,Math.max(0,pool[code]-mid));if(removed>take)break;}if(removed>take)low=mid+1;else high=mid;}
     const picked=new Map();let extra=take;
     for(const code of shops){const qty=Math.max(0,pool[code]-low);picked.set(code,qty);extra-=qty;}
     for(const code of [...shops].sort()){if(!extra)break;if(pool[code]>=low&&pool[code]-picked.get(code)>reserve){picked.set(code,picked.get(code)+1);extra--;}}
     for(const code of shops){const qty=picked.get(code);if(qty){allocations.push({warehouse:code,quantity:qty});pool[code]-=qty;need-=qty;}}
    }
   }
   // Current category rules are evaluated by the server on every catalog request.
   const sourcePrice=p.stockPickerPrices?p.stockPickerPrices[priceGroup]:priceGroup==='KP'&&Number.isFinite(Number(p.kpPrice))&&Number(p.kpPrice)>0?p.kpPrice:['Dealers','KP'].includes(priceGroup)?p.wholesale:null;
   const price=sourcePrice==null||sourcePrice===''?null:Number(sourcePrice);
   return {...row,articul:p.articul,matchedName:p.name,price:Number.isFinite(price)&&price>0?price:null,allocated:row.quantity-need,shortage:need,allocations};
  });
 }
 function checkClient(rows,products){
  return rows.map(row=>{
   if(!row.valid)return {...row,error:'quantity',available:false,canAdd:false};
   const found=match(row,products);if(!found.product)return {...row,...found,available:false,canAdd:false};
   const p=found.product,price=Number(p.wholesale),available=(p.stockAvailable===true||p.stockAvailable==null&&p.stockStatus==='Առկա է')&&Number.isFinite(price)&&price>0;
   return {...row,articul:p.articul,matchedName:p.name,price:Number.isFinite(price)&&price>0?price:null,available,canAdd:Number.isFinite(price)&&price>0,error:available?null:'checkStock'};
  });
 }
 const api={parse,allocate,checkClient,match,stocks};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZWS_WAREHOUSE_ALLOCATION=api;
})(typeof window==='object'?window:globalThis);
