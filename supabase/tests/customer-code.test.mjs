import test from 'node:test';
import assert from 'node:assert/strict';
import {customerCode,customerCodeKey} from '../functions/zzws-api/client-accounts.mjs';
import {parseUsers} from '../functions/zzws-api/catalog.mjs';
import {parseUserSheet,SHEET_COLUMNS} from '../functions/zzws-api/user-sheet.mjs';

test('customer code labels preserve printable text and leading zeros while links use the six-digit prefix',()=>{
 const full='001234 Երևան / Shop (Կենտրոն)';
 assert.equal(customerCode('  '+full+'  '),full);
 for(const value of ['001234',full,'001234-Other','0012347'])assert.equal(customerCodeKey(value),'001234');
 for(const [value,key] of [['QA-ONLY','qa-only'],['Նախկին_կոդ','նախկին_կոդ'],['12345','12345'],['','']])assert.equal(customerCodeKey(value),key);
 assert.equal(customerCode('Legacy.Code-1'),'Legacy.Code-1');
 assert.throws(()=>customerCode('001234 Shop\nHidden line'));
 assert.throws(()=>customerCode('001234 '+String.fromCharCode(0)+' Shop'));
 assert.throws(()=>customerCode('001234 '+('x'.repeat(74))));
 assert.throws(()=>customerCode('Legacy code with spaces'));
});

test('both client import formats match a labelled code by prefix and reject duplicate relationship keys',()=>{
 const existing=[{id:'11111111-1111-4111-8111-111111111111',login:'chosen.manager',customer_id:null,profile_revision:7,active:true,profile:{role:'client',client:'Saved company',customerCode:'001234 Հիմնական խանութ',sheet:'Dealers',allBrands:true,rowsList:[]}}];
 const legacyHeader=['login','client','sheet','customerCode'];
 const legacy=parseUsers([legacyHeader,['','Imported company','Dealers','001234']],existing);
 assert.equal(legacy[0].login,'chosen.manager');
 assert.equal(legacy[0].profile.customerCode,'001234');
 assert.throws(()=>parseUsers([legacyHeader,['','First','Dealers','001234 First'],['','Second','Dealers','001234 Second']],existing),/Կրկնվող/);
 const headers=SHEET_COLUMNS.map(c=>c[1]);
 const values=code=>SHEET_COLUMNS.map(([key])=>({customerCode:code,client:'Imported company',sheet:'Dealers',role:'Հաճախորդ'})[key]||'');
 const current=parseUserSheet([headers,values('001234 New description')],{existing});
 assert.equal(current[0].expectedUserId,existing[0].id);
 assert.equal(current[0].expectedProfileRevision,7);
 assert.equal(current[0].action,'update');
 assert.equal(current[0].login,'chosen.manager');
 assert.equal(current[0].profile.customerCode,'001234 New description');
 assert.throws(()=>parseUserSheet([headers,values('001234 First'),values('001234 Second')],{existing}),/Կրկնվող/);
 const old=[{...existing[0],profile:{...existing[0].profile,customerCode:'Legacy.Code'}}];
 assert.equal(parseUserSheet([headers,values('legacy.code')],{existing:old})[0].expectedUserId,old[0].id);
 const ambiguous=[existing[0],{...existing[0],id:'22222222-2222-4222-8222-222222222222',login:'different.manager',profile:{...existing[0].profile,customerCode:'001234 Another historical card'}}];
 assert.throws(()=>parseUserSheet([headers,values('001234')],{existing:ambiguous}),'Ambiguous pre-migration prefixes must never choose an arbitrary company');
 assert.throws(()=>parseUsers([legacyHeader,['','Imported company','Dealers','001234']],ambiguous),'Legacy import also refuses ambiguous pre-migration prefixes');
});
