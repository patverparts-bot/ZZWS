/* Existing company orders: the author stays immutable; the primary may respond. */
(() => {
 const text=value=>typeof value==='string'?value.trim().slice(0,200):'';
 function canRespond(user,order){return !!(user?.role==='client'&&user.active!==false&&user.id&&order?.user_id&&(user.id===order.user_id||user.clientRole==='manager'&&user.id===order.customer_id));}
 function actingForAuthor(user,order){return canRespond(user,order)&&user.id!==order.user_id;}
 function displayName(person){return ([text(person?.firstName),text(person?.lastName)].filter(Boolean).join(' ')||text(person?.name)||text(person?.login)||'Անունը չի պահպանվել').slice(0,300);}
 function line(root,label,person,cls){if(!person)return;const p=document.createElement('p');p.className=cls;const caption=document.createElement('span'),name=document.createElement('strong');caption.textContent=label;name.textContent=displayName(person);name.dataset.i18nSkip='true';p.append(caption,name);root.append(p);return p;}
 function author(root,order){if(!order?.user_id)return;return line(root,'Պատվերի հեղինակը՝ ',order.customer?.author||{},'order-author');}
 function onBehalf(root,user,order){if(!actingForAuthor(user,order))return;const p=document.createElement('p');p.className='order-on-behalf';p.textContent='Դուք պատասխանում եք աշխատակցի պատվերի համար՝ որպես ընկերության գլխավոր օգտատեր։';root.append(p);}
 function actor(root,person,label){return line(root,label,person,'order-response-actor');}
 window.ZZWS_ORDER_ACTORS=Object.freeze({canRespond,actingForAuthor,displayName,author,onBehalf,actor});
})();
