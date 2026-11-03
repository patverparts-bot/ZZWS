import fs from 'node:fs';
import {classifyCategory,FAMILY_LABELS} from '../supabase/functions/zzws-api/appliance-taxonomy.mjs';
const folder=new URL('../supabase/functions/zzws-api/',import.meta.url),input=process.argv.includes('--stdin')?JSON.parse(fs.readFileSync(0,'utf8')):null;
const knowledge=input?.knowledge||JSON.parse(fs.readFileSync(new URL('assistant-knowledge.json',folder),'utf8'));
const enriched=input?.enriched||JSON.parse(fs.readFileSync(new URL('../outputs/product-enrichment/zzws_products_enriched.json',import.meta.url),'utf8'));
const products={},profiles={},counts={};
for(const p of enriched.products){const row=knowledge.products[p.articul];if(!row||row[0]!==p.name)continue;const profile=classifyCategory(p.category);if(!Object.hasOwn(FAMILY_LABELS,profile.family))continue;products[p.articul]=profile.family;profiles[p.articul]=profile;counts[profile.family]=(counts[profile.family]||0)+1;}
const result={generatedAt:knowledge.generatedAt,products,profiles};
if(input)console.log(JSON.stringify(result));else{
 fs.writeFileSync(new URL('assistant-public-catalog.json',folder),JSON.stringify(result)+'\n');
 console.log(JSON.stringify({indexed:Object.keys(products).length,counts}));
}
