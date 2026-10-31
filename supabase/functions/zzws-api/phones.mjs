// Store only normalized international numbers; accept Armenian local notation in cards.
export function phoneNumber(value){
 if(typeof value!=='string'||value.length>40)throw Error('Ստուգեք հեռախոսահամարը');
 let phone=value.trim();if(!phone)return '';
 if(!/^\+?[\d ()-]+$/.test(phone))throw Error('Ստուգեք հեռախոսահամարը');
 phone=phone.replace(/[ ()-]/g,'');
 if(phone.startsWith('00'))phone='+'+phone.slice(2);
 if(/^0\d{8}$/.test(phone))phone='+374'+phone.slice(1);
 else if(/^\d{8}$/.test(phone))phone='+374'+phone;
 else if(!phone.startsWith('+'))phone='+'+phone;
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Ստուգեք հեռախոսահամարը');
 return phone;
}
export function phoneNumbers(value){
 if(!Array.isArray(value)||value.length>5)throw Error('Կարելի է լրացնել մինչև հինգ հեռախոսահամար');
 const phones=value.map(phoneNumber).filter(Boolean);
 if(new Set(phones).size!==phones.length)throw Error('Հեռախոսահամարները չպետք է կրկնվեն');
 return phones;
}
