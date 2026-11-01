const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
module.exports=async function serveSite(){
 const root=path.resolve(__dirname,'../..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
 const server=http.createServer((req,res)=>{
  try{
   let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
   const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||!types[path.extname(file)])throw Error('Not an asset');
   const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(data);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port+'/',close:()=>new Promise(resolve=>server.close(resolve))};
};
