// The directory is the plaza's anonymous, unfiltered listing; the quote wall is a separate, narrower feed.
const PLAZA = 'https://astelume.cc.cd/pricing';
const LEASE = 300_000, REFRESH = 60_000;
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const exact = (v,keys) => v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k));
const label = (s,max) => typeof s==='string' && s.length>0 && s.length<=max && s===s.trim() && !/[<>\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(s);
function stamp(s){const t=Date.parse(s);return typeof s==='string'&&Number.isFinite(t)&&new Date(t).toISOString()===s?t:NaN;}
export function readDirectory(value,now=Date.now()) {
  if(!exact(value,['schemaVersion','kind','source','observedAt','validUntil','models'])||value.schemaVersion!==1||value.kind!=='public-model-directory'||value.source!==PLAZA||!Array.isArray(value.models)||value.models.length>10000) throw Error('Invalid public directory');
  const at=stamp(value.observedAt),until=stamp(value.validUntil);
  if(!(at<=now&&now<until&&until-at<=LEASE)) throw Error('Directory is not current');
  const seen=new Set(),byBrand=new Map();
  for(const row of value.models){
    if(!exact(row,['name','brand'])||!label(row.name,256)||(row.brand!==null&&!label(row.brand,128))||seen.has(row.name)) throw Error('Invalid directory member');
    seen.add(row.name);
    if(!byBrand.has(row.brand))byBrand.set(row.brand,[]);
    byBrand.get(row.brand).push(row.name);
  }
  const groups=[...byBrand].map(([brand,names])=>({brand,names:names.sort(compare)}));
  groups.sort((a,b)=>a.brand===null?1:b.brand===null?-1:b.names.length-a.names.length||compare(a.brand,b.brand));
  return {until,groups,modelCount:seen.size,brandCount:byBrand.size-(byBrand.has(null)?1:0)};
}
// Fixed local assets only. Other plaza labels use text, never a remote or guessed manufacturer logo.
const artwork=new Map([['OpenAI',['openai-black.svg','openai-white.svg']],['Anthropic',['claude.svg']],['Google',['gemini.png']],['xAI',['grok.jpg']],['DeepSeek',['deepseek.png']]]);
function element(tag,cls,text){const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;}
export function showDirectory(grid,groups){
  const chipTargets=[];
  const cards=groups.map(({brand,names})=>{
    const display=brand??'未标注品牌';
    const card=element('li','directory-card'),head=element('div','directory-head'),mark=element('span','directory-mark');mark.setAttribute('aria-hidden','true');
    const art=artwork.get(brand);
    if(art){for(const [i,file]of art.entries()){const image=element('img',art.length===2?(i?'mark-night':'mark-day'):'mark-all');image.src='/astelume/marks/'+file;image.alt='';image.width=32;image.height=32;mark.append(image);}if(brand==='OpenAI')mark.classList.add('openai-mark');}
    else{mark.classList.add('text-mark');mark.textContent=brand===null?'—':Array.from(brand)[0];}
    head.append(mark,element('h3','directory-name',display),element('span','directory-number',names.length+' 个型号'));
    const list=element('ul','directory-names');list.setAttribute('aria-label',display+'的型号');
    for(const name of names)list.append(element('li','directory-model',name));
    const chips=element('p','directory-examples');chips.hidden=true;
    card.append(head,list,chips);chipTargets.push({names:new Set(names),chips});return card;
  });
  grid.replaceChildren(...cards);
  // A group's name is shown only if its exact listed model also has a fresh verified quote.
  return rows=>{for(const {names,chips} of chipTargets){const labels=new Set();for(const row of rows){if(names.has(row.model)&&row.group)labels.add(row.group);if(labels.size===2)break;}chips.replaceChildren();chips.hidden=!labels.size;if(labels.size){chips.append(element('span','directory-example-label','分组示例'));for(const s of labels)chips.append(element('span','brand-chip',s));}}};
}
export function mountDirectory({grid,status,brands,models,path='/astelume/live-model-directory'}){
  let request,timer,expiryTimer,validUntil=0,refreshAt=0,signature,paintExamples,quoteRows=[];
  function clear(message){validUntil=0;signature=undefined;paintExamples=undefined;clearTimeout(expiryTimer);grid.replaceChildren();brands.textContent='—';models.textContent='—';status.textContent=message;grid.setAttribute('aria-busy','false');}
  function arm(delay){clearTimeout(timer);refreshAt=Date.now()+delay;if(!document.hidden&&navigator.onLine)timer=setTimeout(load,delay);}
  async function load(){
    if(request||document.hidden||!navigator.onLine)return;
    const controller=new AbortController();request=controller;let delay=REFRESH;
    try{
      const response=await fetch(path,{method:'GET',credentials:'omit',mode:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('application/json')) throw Error('Directory unavailable');
      const view=readDirectory(await response.json());if(request!==controller)return;
      const next=JSON.stringify(view.groups);if(signature!==next){signature=next;paintExamples=showDirectory(grid,view.groups);paintExamples(quoteRows);}
      brands.textContent=String(view.brandCount);models.textContent=String(view.modelCount);status.textContent=view.modelCount?'':'模型广场目前没有展示型号。';grid.setAttribute('aria-busy','false');
      validUntil=view.until;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>clear('目录已过期，等待模型广场更新。'),Math.max(0,validUntil-Date.now()));delay=Math.min(REFRESH,Math.max(1500,validUntil-Date.now()-2000));
    }catch{if(request===controller){clear('暂时无法读取模型广场目录。');delay=30000;}}
    finally{if(request===controller){request=undefined;arm(delay);}}
  }
  function resume(){if(document.hidden){clearTimeout(timer);return;}if(validUntil&&Date.now()>=validUntil)clear('目录已过期，等待模型广场更新。');if(Date.now()>=refreshAt||!validUntil)void load();else arm(refreshAt-Date.now());}
  function reset(){request?.abort();request=undefined;clearTimeout(timer);refreshAt=0;clear('暂时无法读取模型广场目录。');}
  window.addEventListener('offline',reset);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  window.addEventListener('pagehide',reset);window.addEventListener('pageshow',resume);
  if(navigator.onLine)void load();else reset();
  return {setExamples(rows){quoteRows=rows;paintExamples?.(rows);}};
}
