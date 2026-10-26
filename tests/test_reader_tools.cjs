const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context={window:{},URL,console};vm.createContext(context);
vm.runInContext(readFileSync('math-daily/reader-tools.js','utf8'),context);
const r=context.window.MathReader;
assert.equal(r.cleanLink('https://example.org/math-daily/?date=old&ai=explicit#paper-x',{paper:'2610.1'}),'https://example.org/math-daily/?paper=2610.1');
assert.equal(r.cleanLink('https://example.org/math-daily/?paper=2610.1',{subjects:'math.DG,math.MG'}),'https://example.org/math-daily/?subjects=math.DG%2Cmath.MG');
assert.equal(JSON.stringify(r.parseSubjects('math.DG,evil,math.DG,math.MG',{'math.DG':1,'math.MG':1})),'["math.DG","math.MG"]');
assert.equal(r.rss(['math.DG','math.MG']),'https://rss.arxiv.org/rss/math.DG+math.MG');assert.equal(r.rss([]),'');
const papers=[{id:'2610.10',occurrences:[{date:'2026-10-20'}]},{id:'2610.2',occurrences:[{date:'2026-10-21'}]},{id:'2610.11',occurrences:[{date:'2026-10-20'}]}];
assert.equal(r.sort(papers,'latest',()=>false).map(p=>p.id).join(','),'2610.2,2610.11,2610.10');
assert.equal(r.sort(papers,'followed',p=>p.id==='2610.10').map(p=>p.id).join(','),'2610.10,2610.2,2610.11');
assert.equal(papers[0].id,'2610.10');
assert.match(r.updateMessage({result:'error'}),/失败/);
assert.match(r.updateMessage({empty:true,last_success:'2026-10-25T04:00:00Z'},Date.parse('2026-10-26T04:00:00Z')),/未发现/);
assert.match(r.updateMessage({last_success:'2026-10-20T04:00:00Z'},Date.parse('2026-10-26T04:00:00Z')),/48/);
// Existing choices survive a shared link; new visitors do not inherit the owner's six defaults.
let store={},events=[];const prefs={window:{dispatchEvent:e=>events.push(e.type)},localStorage:{getItem:key=>store[key]||null,setItem:(key,value)=>store[key]=value},Event:class{constructor(type){this.type=type}}};
vm.createContext(prefs);if(require('node:fs').existsSync('math-daily/storage.js')){vm.runInContext(readFileSync('math-daily/storage.js','utf8'),prefs);prefs.MathStorage=prefs.window.MathStorage;}const code=readFileSync('math-daily/subjects.js','utf8');vm.runInContext(code,prefs);assert.equal(prefs.window.MathSubjects.hasSaved,false);assert.equal(prefs.window.MathSubjects.selected.length,0);
prefs.window.MathSubjects.save(['math.DG','invalid','math.DG']);assert.equal(prefs.window.MathSubjects.selected.join(','),'math.DG');
vm.runInContext(code,prefs);assert.equal(prefs.window.MathSubjects.hasSaved,true);assert.equal(prefs.window.MathSubjects.selected.join(','),'math.DG');
console.log('Reader regression checks passed.');

if(require('node:fs').existsSync('math-daily/storage.js')){
  const ctx={window:{},localStorage:{getItem:key=>store[key]??null,setItem:(key,value)=>store[key]=value}};
  vm.createContext(ctx);vm.runInContext(readFileSync('math-daily/storage.js','utf8'),ctx);
  const app=readFileSync('math-daily/app.js','utf8');vm.runInContext(app.slice(app.indexOf('function validatePersonal('),app.indexOf('const personalStore=')),ctx);
  const storage=ctx.window.MathStorage,validate=ctx.validatePersonal,empty={saved:[],read:[],authors:[]};
  store={p:JSON.stringify({...empty,saved:['old'],futureField:'keep'})};
  const a=storage.open('p',validate,empty),b=storage.open('p',validate,empty);
  a.write({...a.value,saved:['old','new-a']},storage.mergePersonal);
  b.write({...b.value,read:['read-b']},storage.mergePersonal);
  assert.equal(JSON.parse(store.p).saved.join(','),'old,new-a');assert.equal(JSON.parse(store.p).read.join(','),'read-b');assert.equal(JSON.parse(store.p).futureField,'keep');
  assert.equal(JSON.parse(store['p-backup']).saved.join(','),'old,new-a');
  b.write({...b.value,saved:b.value.saved.filter(x=>x!=='old')},storage.mergePersonal);assert.equal(JSON.parse(store.p).saved.join(','),'new-a');
  b.restore();assert.equal(JSON.parse(store.p).saved.join(','),'old,new-a');
  store.p='{invalid';const broken=storage.open('p',validate,empty);assert.equal(broken.blocked,true);assert.throws(()=>broken.write(empty));assert.equal(store.p,'{invalid');broken.restore();assert.equal(broken.blocked,false);
  store.p=JSON.stringify({...empty,schemaVersion:99});const future=storage.open('p',validate,empty);assert.equal(future.blocked,true);assert.throws(()=>future.write(empty));assert.equal(JSON.parse(store.p).schemaVersion,99);
  assert.equal(validate({...empty}).saved.length,0);assert.equal(validate({...empty,schemaVersion:1}).read.length,0);
  console.log('Storage compatibility, concurrent tabs, backups and corrupt-data guards passed.');
}
