// Bounded identity from the immutable event at the leased order revision.
export function orderSummary(order){
 const customer=order?.customer?.client;
 if(typeof customer!=='string'||!Number.isSafeInteger(order.number)||order.number<1||!Number.isFinite(order.total)||order.total<0||order.total>Number.MAX_SAFE_INTEGER)return null;
 const customerName=customer.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
 if(!customerName||customerName.length>200)return null;
 const code=order.customer?.customerCode;
 if(code!==undefined&&(typeof code!=='string'||code.length>100||/[\u0000-\u001f\u007f]/.test(code)))return null;
 const status=order.status;
 if(status!==undefined&&!['new','confirmed','in_progress','completed','received','rejected'].includes(status))return null;
 return {customerName,number:order.number,total:order.total,...(code?.trim()?{customerCode:code.trim()}:{}),...(status?{status}:{})};
}
export async function readOrderSummary(client,id,revision){
 const r=await client.from('zzws_order_activity').select('order_number,customer,snapshot').eq('order_id',id).eq('revision',revision).maybeSingle();
 if(r.error)throw Error('Order summary unavailable');
 const event=r.data;return orderSummary(event?{number:event.order_number,customer:event.customer,total:event.snapshot?.total,status:event.snapshot?.status}:null);
}
