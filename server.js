// Zero-dependency server: serves /public and a tiny JSON API over /data. Needs Node 18+.
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000;
// Works with the normal layout (public/index.html) OR everything dumped flat in one folder.
const PUB=fs.existsSync(path.join(__dirname,'public','index.html'))?path.join(__dirname,'public'):__dirname;
const DATA=path.join(process.cwd(),'data');fs.mkdirSync(DATA,{recursive:true});
if(!fs.existsSync(path.join(PUB,'index.html')))console.error('!! index.html not found. Put it in a folder named "public" next to server.js (looked in '+PUB+')');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.pdf':'application/pdf'};
const json=(r,o,c=200)=>{r.writeHead(c,{'content-type':'application/json'});r.end(JSON.stringify(o))};
const files=()=>fs.readdirSync(DATA).filter(f=>/^courses-\w+\.json$/.test(f));
http.createServer((q,r)=>{
  const u=new URL(q.url,'http://x');
  if(u.pathname==='/api/terms'){
    const out=files().map(f=>{const j=JSON.parse(fs.readFileSync(path.join(DATA,f)));return{code:j.term,name:j.name||j.term,updated:j.updated}});
    return json(r,out.sort((a,b)=>b.code.localeCompare(a.code)));
  }
  if(u.pathname==='/api/courses'){
    const t=u.searchParams.get('term')||'';
    if(!/^\w+$/.test(t)||!fs.existsSync(path.join(DATA,`courses-${t}.json`)))return json(r,{error:'unknown term'},404);
    r.writeHead(200,{'content-type':'application/json','cache-control':'public, max-age=300'});
    return fs.createReadStream(path.join(DATA,`courses-${t}.json`)).pipe(r);
  }
  let p=path.normalize(path.join(PUB,u.pathname==='/'?'index.html':u.pathname));
  if(!p.startsWith(PUB)||(PUB===__dirname&&!['index.html','plans.json','worksheet.pdf','pdf-lib.min.js'].includes(path.basename(p)))||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end('Not found')}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);
}).listen(PORT,()=>console.log('UNH Schedule Studio on http://localhost:'+PORT));
