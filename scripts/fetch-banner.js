// Pulls every section for a term from a Banner 9 "Student Registration SSB" site and writes data/courses-<term>.json
// Defaults to UNH's webcat Banner. Run with no term to list term codes.
// Usage: BANNER_BASE="https://<unh-banner-host>/StudentRegistrationSsb" node scripts/fetch-banner.js <termCode>
// Be polite: run it a few times a day at most, not on every page view.
const fs=require('fs'),path=require('path');
const base=(process.env.BANNER_BASE||'https://webcat.unh.edu/StudentRegistrationSsb').replace(/\/$/,''),term=process.argv[2];
const jar=new Map();
async function call(p,o={}){
  const r=await fetch(base+p,{...o,headers:{...(o.headers||{}),cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}});
  for(const c of (r.headers.getSetCookie?.()||[])){const [kv]=c.split(';');const i=kv.indexOf('=');jar.set(kv.slice(0,i),kv.slice(i+1))}
  if(!r.ok)throw new Error(r.status+' '+p);const t=await r.text();try{return JSON.parse(t)}catch{return t}
}
const hm=s=>s.slice(0,2)+':'+s.slice(2);
function meets(sec){
  const out=[];
  for(const mf of sec.meetingsFaculty||[]){const m=mf.meetingTime;if(!m||!m.beginTime||!m.endTime)continue;
    const d=[['monday','M'],['tuesday','T'],['wednesday','W'],['thursday','R'],['friday','F']].filter(([k])=>m[k]).map(x=>x[1]).join('');
    if(d)out.push({t:`${d} ${hm(m.beginTime)}-${hm(m.endTime)}`,y:m.meetingScheduleType||m.meetingTypeDescription||''});}
  const seen=new Set();return out.filter(x=>{const k=x.t+x.y;return!seen.has(k)&&seen.add(k)});
}
const part=x=>({ty:x.type,crn:x.crn,sec:x.sec,t:x.t,lk:x.link,mt:x.mt});
function bundle(secs){ // sections sharing a Banner link id are lecture+lab(+recitation) groups; everything else stands alone
  const groups={};for(const s of secs)(groups[s.link||'_']=groups[s.link||'_']||[]).push(s);
  const out=[];
  for(const g of Object.values(groups)){
    const types={};for(const s of g)(types[s.type]=types[s.type]||[]).push(s);
    const names=Object.keys(types);
    if(names.length<2){g.forEach(s=>out.push([s]));continue}
    const main=names.find(n=>/lecture/i.test(n)&&!/lab|combined/i.test(n))||names[0];
    let combos=types[main].map(s=>[s]);
    for(const n of names.filter(n=>n!==main))combos=combos.flatMap(c=>types[n].map(o=>[...c,o]));
    out.push(...combos);
  }
  return out.map(c=>({crn:c.map(x=>x.crn).join('+'),sec:c.map(x=>x.sec).join('/'),inst:[...new Set(c.flatMap(x=>x.inst.split(', ')))].filter(Boolean).join(', '),
    seats:Math.min(...c.map(x=>x.seats)),t:c.map(x=>x.t).filter(Boolean).join(';'),parts:c.map(part)}));
}
(async()=>{
  await call('/ssb/term/termSelection?mode=search');
  const terms=await call('/ssb/classSearch/getTerms?searchTerm=&offset=1&max=100');
  if(!term){console.log('Pass one of these term codes:');(terms||[]).forEach(t=>console.log('  '+t.code+'  '+t.description));return}
  const name=(Array.isArray(terms)&&terms.find(t=>t.code===term)||{}).description||term;
  await call('/ssb/term/search?mode=search',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({term,studyPath:'',studyPathText:'',startDatepicker:'',endDatepicker:''})});
  const by={},attrs={};let off=0,total=1;
  while(off<total){
    const j=await call(`/ssb/searchResults/searchResults?txt_term=${term}&startDatepicker=&endDatepicker=&pageOffset=${off}&pageMaxSize=500&sortColumn=subjectDescription&sortDirection=asc`);
    if(!j||!j.data)throw new Error('Unexpected response — check BANNER_BASE / term code');
    total=j.totalCount;off+=500;
    for(const s of j.data){
      (s.sectionAttributes||[]).forEach(a=>{attrs[a.code]=a.description});
      const k=`${s.subject} ${s.courseNumber}`;
      const c=by[k]=by[k]||{c:k,t:s.courseTitle,cr:s.creditHourLow||s.creditHours||4,d:[...new Set((s.sectionAttributes||[]).map(a=>a.code))],raw:[]};
      c.raw.push({crn:s.courseReferenceNumber,sec:s.sequenceNumber,type:s.scheduleTypeDescription,link:s.linkIdentifier,
        inst:(s.faculty||[]).map(f=>f.displayName).join(', '),seats:s.seatsAvailable,t:meets(s).map(x=>x.t).join(';'),mt:meets(s)});
    }
    console.log(`fetched ${Math.min(off,total)}/${total}`);
  }
  const courses=Object.values(by).map(c=>({c:c.c,t:c.t,cr:c.cr,d:c.d,s:bundle(c.raw)})).filter(c=>c.s.length);
  fs.mkdirSync(path.join(process.cwd(),'data'),{recursive:true});fs.writeFileSync(path.join(process.cwd(),'data',`courses-${term}.json`),JSON.stringify({term,name,attrs,updated:new Date().toISOString(),courses}));
  console.log(`Wrote ${courses.length} courses for ${name}`);
})().catch(e=>{console.error(e.message);process.exit(1)});