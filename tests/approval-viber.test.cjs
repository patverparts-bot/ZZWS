const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},URL};vm.runInNewContext(fs.readFileSync('admin/approval-viber.js','utf8'),context);
const {phone,message,shareLink}=context.window.ZZWS_APPROVAL_VIBER;
test('Armenian contact formats keep country code and drop only the local trunk zero',()=>{
 for(const input of ['+37491123456','+374 (91) 123-456','00374 91 123456','37491123456','091 123456','(091) 123-456','91123456','  +37491123456  '])assert.equal(phone(input),'+37491123456',input);
 assert.equal(phone('+1 (202) 555-0100'),'+12025550100');assert.equal(phone('0044 20 7946 0958'),'+442079460958');
 for(const input of ['',null,5,'+374091123456','+3749112345','+374911234567','+37400123456','+012345678','+374 91\n123456','\n091123456','091\t123456','abc91123456','+37491123456&text=x','viber://chat','+37491123456 ext 1','+1111111111111111'])assert.equal(phone(input),'',String(input));
});
test('message is Armenian with order, public ZZWS URL and normalized manager contact',()=>{
 const text=message({number:42,managerPhone:'099 654321'},'https://patverparts-bot.github.io/ZZWS/?token=private#admin');
 assert.ok(text.includes('№42'));assert.ok(text.includes('հաստատել'));assert.ok(text.includes('https://patverparts-bot.github.io/ZZWS/'));assert.ok(text.includes('+37499654321'));assert.ok(!/private|token|#admin/.test(text));assert.ok(text.length<=200);
 assert.ok(!message({number:123},'https://example.am/ZZWS/').includes('undefined'));
 assert.throws(()=>message({number:42},'javascript:alert(1)'));
});
test('documented forward scheme round trips the complete draft; never claims a recipient',()=>{
 for(const text of ['Բարև Ձեզ։ №42\nhttps://example.am/ZZWS/?a=1&b=2#42','A&B ? #42 + 50% "text"','a'.repeat(2000)]){
  const link=shareLink('091123456',text),url=new URL(link);assert.equal(url.protocol,'viber:');assert.equal(url.hostname,'forward');assert.equal(url.searchParams.get('text'),text);assert.deepEqual([...url.searchParams.keys()],['text']);assert.ok(!link.includes('draft='));assert.ok(!link.includes('number='));
 }
 for(const [number,text] of [['bad','Hello'],['+374091123456','Hello'],['091123456',''],['091123456','  '],['091123456','a'.repeat(2001)],['091123456','\u0000'],['091123456','\u007f'],['091123456','\ud800']])assert.equal(shareLink(number,text),'');
});
