const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'data/classes.json'),'utf8'));
const datasets=Object.fromEntries(catalog.classes.map(e=>[e.path,JSON.parse(fs.readFileSync(path.join(root,e.path),'utf8'))]));
const scripts=['app-data.js','app.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')),copy=v=>JSON.parse(JSON.stringify(v));
function store(initial={}){const records=new Map(Object.entries(initial));return {getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),records}}
async function boot(storage=store(),fetcher,storageGetter){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},clientWidth:900,value:'',scrollTop:0,scrollLeft:0,setAttribute(){},removeAttribute(){},querySelectorAll:()=>[]});return elements.get(id)};
 const ctx={document:{getElementById:get,documentElement:{style:{setProperty(){}}}},localStorage:storage,window:{addEventListener(){},location:{href:'https://atlas.example/'},history:{replaceState(){}}},console,URL,fetch:fetcher|| (async url=>({ok:true,json:async()=>copy(url==='data/classes.json'?catalog:datasets[url])}))};
 if(storageGetter)Object.defineProperty(ctx,'localStorage',{get:storageGetter,configurable:true});
 vm.createContext(ctx);scripts.forEach(s=>vm.runInContext(s,ctx));await ctx.window.atlas.ready;return {api:ctx.window.atlas,dataApi:ctx.AtlasData,get,storage};
}
(async()=>{
const{api,get}=await boot();let total=0;
for(const b of api.data.boards){const ids=new Set(),positions=new Set();assert.equal(b.nodes.filter(n=>n[4]===0).length,1);for(const n of b.nodes){assert(!ids.has(n[0]));ids.add(n[0]);assert(!positions.has(n[1]+','+n[2]));positions.add(n[1]+','+n[2]);const r=api.route(b,n[0],new Set());assert(r,`${b.name} ${n[0]} unreachable`);assert.equal(r.cost,r.steps.reduce((sum,n)=>sum+n[5],0));for(let i=1;i<r.path.length;i++)assert.equal(Math.abs(r.path[i][1]-r.path[i-1][1])+Math.abs(r.path[i][2]-r.path[i-1][2]),1);for(const[k]of n[6])assert(api.data.stats[k]||api.data.skills[k]);total++}}
const b=api.data.boards.find(b=>b.name==='Ariel'),target=b.nodes.find(n=>n[1]===1&&n[2]===8),r=api.route(b,target[0],new Set());assert.equal(r.cost,13);assert.equal(api.getState().target,null);assert(get('detail').innerHTML.includes('MEVCUT DAĞILIMIN BİLİNMİYOR'));
const owned=new Set(r.path.slice(0,4).map(n=>n[0])),m=api.route(b,target[0],owned);assert.equal(m.cost,13-r.path.slice(0,4).reduce((sum,n)=>sum+n[5],0));assert.equal(api.route(b,target[0],new Set([target[0]])).cost,13,'disconnected stored target must not lower cost');
api.setMode('owned');api.choose(target[0]);assert.equal(api.acquired(b).size,1,'cannot acquire remote target');const first=r.path[1],second=r.path[2];api.choose(first[0]);api.choose(second[0]);assert.equal(api.acquired(b).size,3);api.choose(first[0]);assert.equal(api.acquired(b).size,3,'cannot disconnect owned branch');api.choose(second[0]);assert.equal(api.acquired(b).size,2);api.setMode('target');api.choose(target[0]);assert.equal(api.acquired(b).size,2,'target mode must never acquire');api.switchBoard(0);assert.equal(api.getState().target,null);assert(!get('detail').innerHTML.includes('13 <small>'));
const broken=await boot({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});broken.api.setMode('owned');broken.api.choose(first[0]);assert.equal(broken.api.acquired(b).size,2);assert(get('grid').innerHTML.includes('aria-label'));
const fit=await boot();for(const [width,height]of [[900,430],[1450,740]]){fit.get('viewport').clientWidth=width;fit.get('viewport').clientHeight=height;for(let board=0;board<fit.api.data.boards.length;board++){fit.api.switchBoard(board);fit.api.fitBoard();const state=fit.api.getState(),nodes=fit.api.data.boards[board].nodes,cols=Math.max(...nodes.map(n=>n[2]))-Math.min(...nodes.map(n=>n[2]))+1,rows=Math.max(...nodes.map(n=>n[1]))-Math.min(...nodes.map(n=>n[1]))+1;assert(46+cols*(64*state.zoom+6)<=width+.1,'fit exceeds viewport width');assert(46+rows*(64*state.zoom+6)<=height+.1,'fit exceeds viewport height');assert(state.autoFit)}}
fit.api.switchBoard(4);fit.api.choose(target[0]);assert(fit.get('detail').innerHTML.includes('effect attack'));assert.equal((fit.get('detail').innerHTML.match(/class="effect /g)||[]).length,6);fit.get('page-next').onclick();assert.equal(fit.api.getState().detailPage,1);fit.get('steps-tab').onclick();assert.equal(fit.api.getState().detailTab,'steps');assert.equal((fit.get('detail').innerHTML.match(/<li>/g)||[]).length,4);fit.get('page-next').onclick();assert.equal(fit.api.getState().detailPage,1);fit.api.setZoom(.2);assert.equal(fit.api.getState().autoFit,false);fit.api.fitBoard();assert.equal(fit.api.getState().autoFit,true);
fit.get('detail').clientHeight=555;fit.get('bonus-tab').onclick();assert.equal((fit.get('detail').innerHTML.match(/class="effect /g)||[]).length,4,'short sidebar uses four cards');assert(fit.get('detail').innerHTML.includes('page-next'));fit.get('viewport').clientHeight=300;fit.api.fitBoard();assert(fit.get('grid').className.includes('tiny'),'small fit uses uncluttered colored nodes');
console.log(`PASS: ${total} nodes / ${api.data.boards.length} boards; all routes, Ariel 13, marginal costs, modes, storage, removal guard, fit width+height at 2 desktop sizes across all boards, bonus/step pagination, explicit zoom.`);

let allClassRoutes=0;
for(const entry of catalog.classes){
 const dataset=datasets[entry.path];
 for(const board of dataset.boards)for(const node of board.nodes){
  const result=api.route(board,node[0],new Set());
  assert(result,entry.slug+' node unreachable: '+node[0]);
  assert.equal(result.cost,result.steps.reduce((sum,step)=>sum+step[5],0));
  assert.equal(result.path.at(-1)[0],node[0]);
  allClassRoutes++;
 }
}
console.log(`PASS: ${allClassRoutes} reachable target routes across ${catalog.classes.length} classes.`);
for(const entry of catalog.classes){
 const value=copy(datasets[entry.path]),{dataApi}=await boot();dataApi.validateDataset(value,entry);
 const skill=value.boards.flatMap(b=>b.nodes).find(n=>n[4]===2);delete value.skills[skill[6][0][0]];
 assert.throws(()=>dataApi.validateDataset(value,entry),/referansı/);
}
const isolated=await boot(store({'sorcerer-atlas-acquired-v1':JSON.stringify({[b.id]:[first[0]]})}));
assert.equal(isolated.api.acquired(b).size,2);assert(isolated.storage.records.has('daevanion-atlas-acquired-v1:sorcerer'));
const other=catalog.classes.find(e=>e.slug!=='sorcerer');
if(other){await isolated.api.switchClass(other.slug);assert.equal(isolated.api.getState().target,null);assert.equal(Object.keys(isolated.api.getState().saved).length,0);await isolated.api.switchClass('sorcerer');assert.equal(isolated.api.acquired(b).size,2)}
const failure=await boot();await failure.api.switchClass('missing');assert.equal(failure.api.data,null);assert(failure.get('planner').hidden);assert(failure.get('load-status').textContent.includes('yüklenemedi'));
const unavailable=await boot(store(),async url=>url==='data/classes.json'?{ok:true,json:async()=>copy(catalog)}:{ok:false,status:503});assert.equal(unavailable.api.data,null);assert(unavailable.get('load-status').textContent.includes('503'));
let release;const race=await boot(),normal=race.dataApi.fetchJson;
race.dataApi.fetchJson=url=>url===catalog.classes[0].path?new Promise(resolve=>release=resolve):normal(url);
const slow=race.api.switchClass(catalog.classes[0].slug);await race.api.switchClass('missing');release(copy(datasets[catalog.classes[0].path]));await slow;assert.equal(race.api.data,null);assert.equal(race.api.getState().activeClass,'missing');
const bad = copy(datasets['data/sorcerer.json']);
const badSkill=bad.boards.flatMap(board=>board.nodes).find(node=>node[4]===2);delete bad.skills[badSkill[6][0][0]];
const invalid=await boot(store(),async url=>({ok:true,json:async()=>copy(url==='data/classes.json'?catalog:bad)}));
assert.equal(invalid.api.data,null,'invalid skill dataset cannot enable planner');assert(invalid.get('planner').hidden);
const denied=await boot({getItem:key=>key==='sorcerer-atlas-acquired-v1'?JSON.stringify({[b.id]:[first[0]]}):null,setItem(){throw Error('blocked')}});
assert.equal(denied.api.acquired(b).size,2,'legacy data survives denied migration write');
const blockedGetter=()=>{const error=new Error('Access denied');error.name='SecurityError';throw error};
const initialGetter=await boot(store(),undefined,blockedGetter);
assert.equal(initialGetter.api.data.classSlug,'sorcerer');assert(!initialGetter.get('planner').hidden);
assert(initialGetter.get('grid').innerHTML.includes('data-node'));
assert(initialGetter.get('detail').innerHTML.includes('Yerel kayıt okunamadı'));
let denyGetter=false;const initialStore=store();
const switchedGetter=await boot(initialStore,undefined,()=>denyGetter?blockedGetter():initialStore);
switchedGetter.api.choose(target[0]);denyGetter=true;
assert(await switchedGetter.api.switchClass(other.slug));
assert.equal(switchedGetter.api.data.classSlug,other.slug);assert.equal(switchedGetter.api.getState().target,null);
assert(!switchedGetter.get('planner').hidden);assert(switchedGetter.get('grid').innerHTML.includes('data-node'));
assert(switchedGetter.get('detail').innerHTML.includes('Yerel kayıt okunamadı'));
const nextBoard=switchedGetter.api.data.boards[switchedGetter.api.getState().current],nextFirst=switchedGetter.api.route(nextBoard,nextBoard.nodes[0][0]).path[1];
switchedGetter.api.setMode('owned');switchedGetter.api.choose(nextFirst[0]);
assert(switchedGetter.get('detail').innerHTML.includes('Tarayıcı kaydı kapalı'));
console.log('PASS: SecurityError localStorage getter on initial load and class switch, usable in-memory acquisition; every class runtime references/counts, legacy Sorcerer migration, storage isolation, invalid/unavailable classes, async stale response guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
