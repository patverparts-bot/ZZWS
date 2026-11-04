(() => {
 'use strict';
 const script=document.currentScript,base=new URL('../',script.src),site=new URL('./',base),admin=new URL('admin/',base);
 const allowed=user=>user?.role==='admin'&&!!user.adminScope&&Array.isArray(user.permissions)&&user.permissions.length>0;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function navigation(user){
  document.getElementById('zzwsWorkspaceSwitch')?.remove();if(!allowed(user))return;
  const inAdmin=location.pathname===admin.pathname||location.pathname.startsWith(admin.pathname),button=node('a',inAdmin?'Անցնել կայք':'Անցնել կառավարման վահանակ');button.id='zzwsWorkspaceSwitch';button.href=(inAdmin?site:admin).href;button.className='zzws-workspace-switch';
  const mount=inAdmin?document.querySelector('body>header'):document.querySelector('.catalog-header-utilities');mount?.append(button);
 }
 function reset(){document.getElementById('zzwsWorkspaceSwitch')?.remove();document.getElementById('workspaceChoiceDialog')?.remove();}
 async function choose(user,continueCurrent){
  if(!allowed(user)){await continueCurrent();return;}
  return new Promise((resolve,reject)=>{
   const dialog=node('dialog'),title=node('h2','Ընտրեք աշխատանքային միջավայրը'),info=node('p','Մուտքը հաստատված է։ Ընտրեք՝ որտեղ շարունակել աշխատանքը։'),error=node('p'),badge=node('span','Մուտքը հաստատված է'),choices=node('div');dialog.id='workspaceChoiceDialog';dialog.className='zzws-workspace-choice';title.id='workspaceChoiceTitle';info.id='workspaceChoiceDescription';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',info.id);badge.className='workspace-choice-badge';choices.className='workspace-choice-grid';error.className='workspace-choice-error';error.setAttribute('role','alert');dialog.append(badge,title,info,choices);
   const currentAdmin=location.pathname.startsWith(admin.pathname),current=currentAdmin?'admin':'site';let pending=false;const buttons=[];
   const busy=value=>{pending=value;dialog.setAttribute('aria-busy',String(value));for(const button of buttons)button.disabled=value;};
   const close=()=>{dialog.close();dialog.remove();};
   const add=(label,target,description,icon)=>{const button=node('button'),symbol=node('span',icon),copy=node('span'),name=node('strong',label),detail=node('small',description);button.type='button';button.dataset.workspace=target;symbol.className='workspace-choice-icon';symbol.setAttribute('aria-hidden','true');copy.className='workspace-choice-copy';copy.append(name,detail);button.append(symbol,copy);button.onclick=async()=>{
    if(pending)return;busy(true);error.textContent='';let extra=null;
    try{
     if(target==='both'){
      // Create a same-origin blank tab during the click. Never put credentials in a URL or localStorage.
      extra=window.open('about:blank','_blank');if(!extra)throw Error('Բրաուզերը արգելափակել է նոր պատուհանը։ Թույլատրեք այն կամ ընտրեք մեկ միջավայր։');
      const token=sessionStorage.getItem('zzws_session_v3');if(!token)throw Error('Մուտքը ավարտվել է։ Կրկին մուտք գործեք։');
      extra.sessionStorage.setItem('zzws_session_v3',token);extra.opener=null;extra.location.replace((currentAdmin?site:admin).href);
      await continueCurrent();close();resolve();return;
     }
     if(target===current){await continueCurrent();close();resolve();}
     else{location.assign((target==='admin'?admin:site).href);close();resolve();}
    }catch(e){extra?.close();error.textContent=window.ZZWS.message(e);busy(false);button.focus();}
   };buttons.push(button);(target==='both'?dialog:choices).append(button);};
   add('Բացել կառավարման վահանակը','admin','Պատվերներ, հաճախորդներ և աշխատանքային գործիքներ','▦');add('Բացել կայքը','site','Ապրանքներ, գներ և պատվերի ձևավորում','▤');add('Բացել երկուսն էլ','both','Երկու միջավայր՝ առանձին ներդիրներում','↗');dialog.append(error);dialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(dialog);dialog.showModal();
  });
 }
 window.ZZWS_ENTRY=Object.freeze({choose,navigation,reset});
})();
