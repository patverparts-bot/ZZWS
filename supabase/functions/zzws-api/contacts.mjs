import {phoneNumber} from './phones.mjs';
import {emailRows} from './report-email.mjs';

// One record belongs to one person. Keep email row positions aligned with that person.
export function personContacts(value){
 if(!Array.isArray(value)||value.length>5)throw Error('Կարելի է լրացնել մինչև հինգ կոնտակտ');
 const result=[];
 for(const row of value){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['name','phone','email'].includes(k)))throw Error('Ստուգեք կոնտակտի տվյալները');
  if(['name','phone','email'].some(k=>row[k]!==undefined&&typeof row[k]!=='string'))throw Error('Ստուգեք կոնտակտի տվյալները');
  const name=(row.name||'').trim(),phone=phoneNumber(row.phone||''),email=emailRows([row.email||''])[0];
  if(!name&&!phone&&!email)continue;
  if(!name||name.length>200||/[\u0000-\u001f\u007f\u2028\u2029]/u.test(name))throw Error('Լրացրեք կոնտակտային անձի անունը');
  if(!phone&&!email)throw Error('Լրացրեք կոնտակտի հեռախոսը կամ էլ․ փոստը');
  if(phone&&result.some(c=>c.phone===phone))throw Error('Հեռախոսահամարները չպետք է կրկնվեն');
  result.push({name,phone,email});
 }
 return result;
}
export function contactEmailRows(profile){return emailRows(Array.isArray(profile?.contacts)?profile.contacts.map(c=>c.email):profile?.emailRows||[]);}
export function viberContacts(profile){
 if(Array.isArray(profile?.contacts))return profile.contacts.filter(c=>c.phone).map(({name,phone})=>({name,phone}));
 // Older saved cards have only the account/customer name; do not invent person names.
 return (profile?.phoneNumbers||[]).filter(Boolean).map(phone=>({name:profile.client,phone}));
}
