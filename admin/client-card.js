(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;},form=document.getElementById('userForm'),box=node('fieldset');box.id='clientMembers';const legend=node('legend','Գլխավոր մենեջեր և աշխատակիցներ');box.append(legend);(form.querySelector('.user-card-actions')||form.lastElementChild).before(box);let serial=0;
 const states={invited:'Հրավիրված է',active:'Ակտիվ է',disabled:'Հասանելիությունն անջատված է',deleted:'Աշխատակիցը ջնջված է'};
 const date=value=>new Date(value).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan'});
 window.ZZWS_CLIENT_CARD={async edit(user){
  const ticket=++serial;box.hidden=!user.id||user.role!=='client'||user.clientRole==='employee';box.replaceChildren(legend);if(box.hidden)return;const error=node('p');box.append(error);
  try{
   const data=await ZZWS.json('admin/users/team?'+new URLSearchParams({id:user.id}));if(ticket!==serial)return;
   const deleted=data.members.filter(m=>m.status==='deleted'),history=node('details');history.className='client-members-history';history.id='deletedClientMembers';history.open=true;history.append(node('summary','Ջնջված աշխատակիցների պատմություն'),node('p','Աշխատակցի մուտքը փակված է։ Նրա տվյալները և նախկին պատվերները պահպանված են պատմության համար։'));
   for(const m of data.members){
    const p=m.person||{},row=node('section');row.dataset.memberId=m.id;row.append(node('strong',[p.firstName,p.lastName].filter(Boolean).join(' ')||p.label||'Գրանցումը չի ավարտվել'),node('p',m.status==='deleted'?states.deleted:(m.clientRole==='manager'?'Գլխավոր մենեջեր':'Աշխատակից')+' · '+states[m.status]),node('p',[m.login,p.phone,p.email].filter(Boolean).join(' · ')));if(m.lastLogin)row.append(node('p','Վերջին մուտքը՝ '+date(m.lastLogin)));
    if(m.status==='deleted'){
     if(m.deletedAt)row.append(node('p','Ջնջված է՝ '+date(m.deletedAt)));
     const by=m.deletedBy;if(by){const who=node('span',[by.name,by.login&&by.login!==by.name?'('+by.login+')':''].filter(Boolean).join(' '));who.dataset.i18nSkip='true';const line=node('p','Ջնջել է՝ ');line.append(who);row.append(line);}history.append(row);continue;
    }
    if(m.clientRole==='employee'){
     const access=node('button',m.status==='disabled'?'Միացնել հասանելիությունը':'Անջատել հասանելիությունը');access.type='button';access.dataset.actionTone=m.status==='disabled'?'primary':'warning';access.onclick=async()=>{access.disabled=true;try{await ZZWS.json('admin/users/team/access',{method:'POST',body:JSON.stringify({id:m.id,active:m.status==='disabled'})});if(ticket===serial&&!form.hidden&&form.elements.id.value===user.id)await this.edit(user);}catch(e){error.textContent=e.message;access.disabled=false;}};row.append(access);
     if(m.status==='invited'){const invite=node('button','Նոր հրավեր');invite.type='button';invite.dataset.actionTone='warning';invite.onclick=async()=>{invite.disabled=true;try{const r=await ZZWS.json('admin/users/invitation',{method:'POST',body:JSON.stringify({id:m.id})});if(ticket===serial&&!form.hidden&&form.elements.id.value===user.id)showInvitation('',r.invitation,m.id);}catch(e){error.textContent=e.message;}finally{invite.disabled=false;}};row.append(invite);}
    }
    box.append(row);
   }
   if(deleted.length)box.append(history);
  }catch(e){if(ticket===serial)error.textContent=e.message;}
 }};
})();
