import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {statuses} from '../supabase/functions/zzws-api/orders.mjs';
import {orderExportData} from '../supabase/functions/zzws-api/order-export.mjs';
test('the exported order keeps the canonical processing state and uses the new human label',()=>{
 const order={id:'order',number:18,revision:4,status:'in_progress',lines:[],total:0};const result=orderExportData(order);
 assert.equal(result.status,'in_progress');assert.equal(result.statusLabel,'Ձևակերպված է');assert.equal(result.rows[0][4],'Ձևակերպված է');assert.equal(order.status,'in_progress');assert.equal(statuses.confirmed,'Հաստատված');
});
test('client status-change notifications say the order is placed in both languages',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/order-comparison.js','utf8'),scope);vm.runInNewContext(fs.readFileSync('js/i18n-dictionary.js','utf8'),scope);
 const notice=scope.window.ZZWS_ORDER_COMPARE.eventNotice({detail:{status:'in_progress'}});assert.equal(notice.text,'Պատվերը ձևակերպված է');assert.equal(scope.window.ZZWS_TRANSLATIONS[notice.text],'Заказ оформлен');assert.equal(scope.window.ZZWS_TRANSLATIONS['Ձևակերպված է'],'Оформлен');
});
test('web and native dictionaries use the new status label in existing full help sentences',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/i18n-dictionary.js','utf8'),scope);const native=JSON.parse(fs.readFileSync('android/assets/i18n-ru.json','utf8'));
 for(const dictionary of [scope.window.ZZWS_TRANSLATIONS,native]){assert.equal(dictionary['Ձևակերպված է'],'Оформлен');assert.equal(dictionary['Պատվերը ձևակերպված է'],'Заказ оформлен');for(const [key,value]of Object.entries(dictionary)){assert.ok(!key.includes('Ընթացքում'));assert.ok(!value.includes('В работе'));}assert.equal(dictionary['Ուղարկման արդյունքը՝ ըստ հասցեների'],'Результат отправки по адресам');}
});
