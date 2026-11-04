import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const publicRoot=path.resolve(process.env.ZZWS_UI_ROOT||'.');

const phrases={
  'Մուտքը հաստատված է':'Вход выполнен',
  'Պատվերներ, հաճախորդներ և աշխատանքային գործիքներ':'Заказы, клиенты и рабочие инструменты',
  'Ապրանքներ, գներ և պատվերի ձևավորում':'Товары, цены и оформление заказа',
  'Երկու միջավայր՝ առանձին ներդիրներում':'Два пространства в отдельных вкладках'
};

for(const page of ['index.html','admin/index.html'])test(page+' loads navigation without mutating the captured translation dictionary',async()=>{
  class Field {setCustomValidity(){}}
  class Observer {observe(){}takeRecords(){return [];}}
  const scope={
    window:{alert(){},confirm(){},prompt(){},addEventListener(){}},
    document:{currentScript:null,readyState:'loading',documentElement:{},addEventListener(){}},
    location:{href:'https://zzws.test/'+page},localStorage:{getItem(){return 'ru';},setItem(){}},
    URL,MutationObserver:Observer,HTMLInputElement:Field,HTMLTextAreaElement:Field,HTMLSelectElement:Field,
    queueMicrotask
  };
  const context=vm.createContext(scope);
  const scripts=[...fs.readFileSync(path.join(publicRoot,page),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
    .map(match=>new URL(match[1],scope.location.href).pathname.slice(1))
    .filter(file=>/(?:i18n-dictionary|storefront-i18n|stock-picker-i18n|price-review-i18n|warehouse-i18n|entry-navigation|\/i18n)\.js$/.test(file));
  const readerIndex=scripts.indexOf('js/i18n.js'),entryIndex=scripts.indexOf('js/entry-navigation.js');
  assert.ok(scripts.indexOf('js/storefront-i18n.js')<readerIndex);
  assert.ok(readerIndex>=0&&entryIndex>readerIndex);
  let captured;
  for(const file of scripts){
    if(file==='js/i18n.js'){
      captured=scope.window.ZZWS_TRANSLATIONS;
      Object.freeze(captured);
    }
    scope.document.currentScript={src:'https://zzws.test/'+file};
    assert.doesNotThrow(()=>vm.runInContext(fs.readFileSync(path.join(publicRoot,file),'utf8'),context,{filename:file}));
  }
  assert.equal(scope.window.ZZWS_TRANSLATIONS,captured,'navigation preserves the dictionary captured by i18n');
  assert.equal(Object.isFrozen(captured),true);
  for(const [armenian,russian]of Object.entries(phrases)){
    assert.equal(scope.window.ZZWS_I18N.t(armenian,'ru'),russian);
    assert.equal(scope.window.ZZWS_I18N.t(armenian,'hy'),armenian);
    assert.equal(scope.window.ZZWS_I18N.t('«'+armenian+'»','ru'),'«'+russian+'»','phrases are in the original translation trie');
  }
  assert.equal(scope.window.ZZWS_I18N.t('Գլխավոր','ru'),'Главная','existing translations remain available');
  let continued=0;
  await scope.window.ZZWS_ENTRY.choose({role:'client'},async()=>{continued++;});
  assert.equal(continued,1,'normal client entry continues after module initialization');
});
