const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/product-photos.js'),'utf8'),context);
const web=context.window,result={};let bundled=0;
for(const [code,value] of Object.entries(web.ZZWS_PRODUCT_PHOTO_PATHS)){
 assert.match(code,/^[0-9]/);
 if(value.startsWith('js/product-images/')){
  const name=path.basename(value),target=path.join(root,'android/assets/product-images',name);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,value),target);
  result[code]='product-images/'+name;bundled++;
 }else result[code]=value.startsWith('https://')?value:'https://www.zigzag.am'+(value.startsWith('/media/')?value:web.ZZWS_PRODUCT_PHOTO_PREFIX+value);
}
fs.writeFileSync(path.join(root,'android/assets/product-photos.json'),JSON.stringify(result));
console.log(JSON.stringify({photos:Object.keys(result).length,bundled,article528117:result['528117']}));
