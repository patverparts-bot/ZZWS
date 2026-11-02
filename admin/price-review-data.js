(function(root){
 'use strict';
 const sources={ws:'WS (Dealer)',kp:'KP',kpPromo:'KP Promo'},reportSources={'Մեծածախ':'ws','KP':'kp','KP ակցիա':'kpPromo'};
 function changes(details){return details.filter(row=>row.kind==='changed').flatMap(row=>(row.changes||[]).filter(v=>Object.hasOwn(sources,v.source)&&Number(v.before)!==Number(v.after)).map(v=>({articul:String(row.articul),name:row.name,source:v.source,before:Number(v.before),after:Number(v.after)})));}
 function fromRows(rows){return rows.filter(row=>row[0]==='Փոփոխված'&&Object.hasOwn(reportSources,row[3])&&Number(row[4])!==Number(row[5])).map(row=>({articul:String(row[1]),name:String(row[2]),source:reportSources[row[3]],before:Number(row[4]),after:Number(row[5])}));}
 function grouped(rows){const groups=new Map();for(const row of rows){if(!groups.has(row.articul))groups.set(row.articul,{articul:row.articul,name:row.name,changes:[]});groups.get(row.articul).changes.push(row);}return [...groups.values()];}
 const api={sources,changes,fromRows,grouped};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZWS_PRICE_REVIEW_DATA=api;
})(typeof window==='object'?window:globalThis);
