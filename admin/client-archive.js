(() => {
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const button=node('button','Հաճախորդների արխիվ');button.type='button';button.id='openClientArchive';document.getElementById('newUser').after(button);
 const dialog=node('dialog'),heading=node('h2','Հաճախորդների արխիվ'),intro=node('p','Արխիվացված հաճախորդների և նրանց աշխատակիցների մուտքը փակված է։ Այստեղ պահպանված են փակման պատճառը, ամսաթիվը և գործողությունը կատարած ադմինիստրատորը։'),form=node('form'),label=node('label','Փնտրել հաճախորդ, կոդ կամ պատճառ'),search=node('input'),find=node('button','Գտնել'),refresh=node('button','Թարմացնել'),error=node('p'),count=node('p'),list=node('div'),pager=node('div'),previous=node('button','Նախորդը'),next=node('button','Հաջորդը'),close=node('button','Փակել');
 dialog.id='clientArchiveDialog';dialog.className='client-archive-dialog';heading.id='clientArchiveHeading';dialog.setAttribute('aria-labelledby',heading.id);search.type='search';search.maxLength=100;search.id='clientArchiveSearch';label.htmlFor=search.id;label.append(search);find.type='submit';refresh.type=previous.type=next.type=close.type='button';error.setAttribute('role','alert');count.setAttribute('role','status');list.id='clientArchiveList';form.className='client-archive-filters';form.append(label,find,refresh);pager.className='client-archive-pager';pager.append(previous,next);const header=node('header');header.append(heading,close);dialog.append(header,intro,form,error,count,list,pager);document.body.append(dialog);
 let serial=0,offset=0,query='',busy=false;
 const date=value=>new Date(value).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan'});
 const dataNode=(tag,text)=>{const n=node(tag,text);n.dataset.i18nSkip='true';return n;};
 async function load(){
  const ticket=++serial;busy=true;find.disabled=refresh.disabled=previous.disabled=next.disabled=true;error.textContent='';list.replaceChildren();count.textContent='Արխիվը բեռնվում է…';
  try{
   const data=await api('admin/users/archive?'+new URLSearchParams({search:query,offset}));if(ticket!==serial||!dialog.open)return;
   count.textContent='Արխիվում հաճախորդներ՝ '+data.total;
   for(const user of data.rows){const card=node('section'),title=dataNode('h3',user.client+(user.customerCode?' ('+user.customerCode+')':'')),details=node('p'),reasonLabel=node('strong','Փակման պատճառ'),reason=dataNode('p',user.archiveReason),restore=node('button','Վերականգնել արխիվից');card.className='client-archive-card';card.dataset.customerId=user.id;details.append(node('span','Արխիվացված է՝ '),dataNode('span',date(user.archivedAt)),node('span',' · '),dataNode('span',user.archivedBy||'—'));restore.type='button';restore.dataset.actionTone='primary';restore.onclick=()=>ZZWS_CLIENT_DELETION.restore(user,async()=>{await loadUsers();await load();status('Հաճախորդը վերականգնված է արխիվից։ Նախկին հասանելիության կարգավորումները վերականգնված են։');});card.append(title,details,reasonLabel,reason,restore);list.append(card);}
   if(!data.rows.length)list.append(node('p','Արխիվում հաճախորդներ չեն գտնվել։'));
   previous.disabled=offset===0;next.disabled=offset+data.rows.length>=data.total;
  }catch(e){if(ticket===serial&&dialog.open){error.textContent=ZZWS.message(e);count.textContent='';}}
  finally{if(ticket===serial){busy=false;find.disabled=refresh.disabled=false;window.ZZWS_I18N?.refresh(dialog);}}
 }
 form.onsubmit=event=>{event.preventDefault();if(busy)return;query=search.value.trim();offset=0;load();};refresh.onclick=()=>{if(!busy)load();};previous.onclick=()=>{if(!busy&&offset){offset=Math.max(0,offset-50);load();}};next.onclick=()=>{if(!busy){offset+=50;load();}};close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(dialog.open)return;serial++;busy=false;list.replaceChildren();});
 button.onclick=()=>{offset=0;query='';search.value='';dialog.showModal();load();};
 window.ZZWS_CLIENT_ARCHIVE={reset(){serial++;busy=false;if(dialog.open)dialog.close();list.replaceChildren();search.value='';},refresh(){if(dialog.open)load();}};
})();
