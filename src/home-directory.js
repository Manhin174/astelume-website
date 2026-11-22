// The plaza supplies current membership, not brand identity. Only reviewed manufacturer aliases get cards.
const PLAZA = 'https://astelume.cc.cd/pricing';
const LEASE = 300_000, REFRESH = 60_000;
const exact = (v,keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
const label = (s,max) => typeof s === 'string' && s.length > 0 && s.length <= max && s === s.trim() && !/[<>\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(s);
function stamp(s) { const t=Date.parse(s); return typeof s==='string' && Number.isFinite(t) && new Date(t).toISOString()===s ? t : NaN; }

// Stable display order. Files are local, first-party marks; never load URLs or titles from a vendor row.
const makers = [
  {name:'OpenAI',     marks:['openai-black.svg','openai-white.svg']},
  {name:'Anthropic',  marks:['anthropic-8ef3f655.png']},
  {name:'Google',     marks:['google-04bf0d59.png']},
  {name:'xAI',        marks:['xai-bc8b568f.png']},
  {name:'DeepSeek',   marks:['deepseek.png']},
  {name:'阿里巴巴',   marks:['alibaba-55f405aa.png'], aliases:['Alibaba','Alibaba Group','阿里巴巴集团']},
  {name:'智谱',       marks:['zai-3962b7d8.png'], aliases:['Z.AI','Zhipu AI','智谱AI']},
  {name:'MiniMax',    marks:['minimax-94944f81.png'], aliases:['MiniMax (minimax.cn)','MiniMax（minimax.cn）']},
  {name:'Moonshot AI',marks:['moonshot-0ff51da6.png'], aliases:['月之暗面']},
];
const normalize = s => s.normalize('NFKC').trim().toLowerCase();
const byAlias = new Map(makers.flatMap(m => [m.name,...(m.aliases || [])].map(alias => [normalize(alias),m])));
export function readDirectory(value, now=Date.now()) {
  if (!exact(value,['schemaVersion','kind','source','observedAt','validUntil','models']) || value.schemaVersion!==1 || value.kind!=='public-model-directory' || value.source!==PLAZA || !Array.isArray(value.models) || value.models.length>10000) throw Error('Invalid public directory');
  const at=stamp(value.observedAt), until=stamp(value.validUntil);
  if (!(at<=now && now<until && until-at<=LEASE)) throw Error('Directory is not current');
  const seen=new Set(), members=new Map();
  for (const row of value.models) {
    if (!exact(row,['name','brand']) || !label(row.name,256) || (row.brand!==null && !label(row.brand,128)) || seen.has(row.name)) throw Error('Invalid directory member');
    seen.add(row.name);
    const maker=row.brand && byAlias.get(normalize(row.brand));
    if (!maker) continue; // Never infer a manufacturer from a model name, product or gateway label.
    if (!members.has(maker)) members.set(maker,new Set());
    members.get(maker).add(row.name); // Internal join key for group evidence only, never a DOM node or attribute.
  }
  return {until, brands:makers.filter(m => members.has(m)).map(m => ({maker:m, members:members.get(m)}))};
}
const excludedGroup = s => /gemini[\s\p{P}\p{Cf}]*4(?!\d)/iu.test(s.normalize('NFKC'));
function element(tag,cls,text) { const el=document.createElement(tag); el.className=cls; if(text!==undefined) el.textContent=text; return el; }

export function showDirectory(grid,brands) {
  const targets=[];
  const cards=brands.map(({maker,members})=>{
    const card=element('li','directory-card'), head=element('div','directory-head'), mark=element('span','directory-mark');
    mark.setAttribute('aria-hidden','true');
    for (const [i,file] of maker.marks.entries()) {
      const image=element('img',maker.marks.length===2 ? (i?'mark-night':'mark-day') : 'mark-all');
      image.src='/astelume/marks/'+file; image.alt=''; image.width=32; image.height=32; mark.append(image);
    }
    if (maker.name==='OpenAI') mark.classList.add('openai-mark');
    head.append(mark,element('h3','directory-name',maker.name));
    const chips=element('p','directory-examples'); chips.hidden=true;
    card.append(head,chips); targets.push({members,chips}); return card;
  });
  grid.replaceChildren(...cards);
  // The independent quote adapter has already verified these are current public group names. At most two per maker.
  return rows => { for (const {members,chips} of targets) {
    const labels=new Set();
    for (const row of rows) {
      if (!members.has(row.model) || !label(row.group,120) || excludedGroup(row.group)) continue;
      labels.add(row.group); if (labels.size===2) break;
    }
    chips.replaceChildren(); chips.hidden=!labels.size;
    if (labels.size) { chips.append(element('span','directory-example-label','分组示例')); for (const s of labels) chips.append(element('span','brand-chip',s)); }
  }};
}

export function mountDirectory({grid,status,brands,path='/astelume/live-model-directory'}) {
  let request,timer,expiryTimer,validUntil=0,refreshAt=0,signature,paintExamples,quoteRows=[];
  function clear(message){validUntil=0;signature=undefined;paintExamples=undefined;clearTimeout(expiryTimer);grid.replaceChildren();brands.textContent='—';status.textContent=message;grid.setAttribute('aria-busy','false');}
  function arm(delay){clearTimeout(timer);refreshAt=Date.now()+delay;if(!document.hidden&&navigator.onLine)timer=setTimeout(load,delay);}
  async function load(){
    if(request||document.hidden||!navigator.onLine)return;
    const controller=new AbortController();request=controller;let delay=REFRESH;
    try{
      const response=await fetch(path,{method:'GET',credentials:'omit',mode:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('application/json')) throw Error('Directory unavailable');
      const view=readDirectory(await response.json());if(request!==controller)return;
      const next=JSON.stringify(view.brands.map(({maker,members})=>[maker.name,[...members].sort()]));
      if(signature!==next){signature=next;paintExamples=showDirectory(grid,view.brands);paintExamples(quoteRows);}
      brands.textContent=String(view.brands.length);status.textContent=view.brands.length?'':'模型广场暂无可展示的原厂品牌。';grid.setAttribute('aria-busy','false');
      validUntil=view.until;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>clear('品牌信息已过期，等待模型广场更新。'),Math.max(0,validUntil-Date.now()));delay=Math.min(REFRESH,Math.max(1500,validUntil-Date.now()-2000));
    }catch{if(request===controller){clear('暂时无法读取模型广场的品牌信息。');delay=30000;}}
    finally{if(request===controller){request=undefined;arm(delay);}}
  }
  function resume(){if(document.hidden){clearTimeout(timer);return;}if(validUntil&&Date.now()>=validUntil)clear('品牌信息已过期，等待模型广场更新。');if(Date.now()>=refreshAt||!validUntil)void load();else arm(refreshAt-Date.now());}
  function reset(){request?.abort();request=undefined;clearTimeout(timer);refreshAt=0;clear('暂时无法读取模型广场的品牌信息。');}
  window.addEventListener('offline',reset);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  window.addEventListener('pagehide',reset);window.addEventListener('pageshow',resume);
  if(navigator.onLine)void load();else reset();
  return {setExamples(rows){quoteRows=rows;paintExamples?.(rows);}};
}
