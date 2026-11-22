// The plaza is authoritative for current membership. A family needs both its reviewed owner and a matching model ID.
const PLAZA = 'https://astelume.cc.cd/pricing';
const LEASE = 300_000, REFRESH = 60_000;
const exact = (v,keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
const label = (s,max) => typeof s === 'string' && s.length > 0 && s.length <= max && s === s.trim() && !/[<>\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(s);
function stamp(s) { const t=Date.parse(s); return typeof s==='string' && Number.isFinite(t) && new Date(t).toISOString()===s ? t : NaN; }

// Display names and artwork are for the model line, not the parent company. No feed-supplied images or display names.
const families = [
  {name:'GPT',          owners:['OpenAI'],                  model:/^gpt(?=$|[-.\d])/i,       marks:['openai-black.svg','openai-white.svg']},
  {name:'Claude',       owners:['Anthropic'],               model:/^claude(?=$|[-.\d])/i,    marks:['claude.svg']},
  {name:'Gemini',       owners:['Google'],                  model:/^gemini(?=$|[-.\d])/i,    marks:['gemini.png']},
  {name:'Grok',         owners:['xAI'],                     model:/^grok(?=$|[-.\d])/i,      marks:['grok.jpg']},
  {name:'DeepSeek',     owners:['DeepSeek'],                model:/^deepseek(?=$|[-.\d])/i,  marks:['deepseek.png']},
  {name:'Qwen',         owners:['Alibaba','阿里巴巴','Alibaba Group','阿里巴巴集团'], model:/^qwen(?=$|[-.\d])/i, marks:['qwen-47a769cd.png']},
  {name:'GLM',          owners:['Z.AI','智谱','Zhipu AI','智谱AI'], model:/^(?:chat)?glm(?=$|[-.\d])/i, marks:['glm-79d08d48.png']},
  {name:'MiniMax M 系列',owners:['MiniMax','MiniMax (minimax.cn)','MiniMax（minimax.cn）'], model:/^minimax[-.]m(?=$|[-.\d])/i, marks:['minimax-94944f81.png']},
  {name:'Kimi',         owners:['Moonshot AI','月之暗面'],    model:/^kimi(?=$|[-.\d])/i,      marks:['kimi-08380815.png']},
];
const normalize = s => s.normalize('NFKC').trim().toLowerCase();
const byOwner = new Map();
for (const family of families) for (const owner of family.owners) {
  const key=normalize(owner);
  if (!byOwner.has(key)) byOwner.set(key,[]);
  byOwner.get(key).push(family);
}
export function readDirectory(value, now=Date.now()) {
  if (!exact(value,['schemaVersion','kind','source','observedAt','validUntil','models']) || value.schemaVersion!==1 || value.kind!=='public-model-directory' || value.source!==PLAZA || !Array.isArray(value.models) || value.models.length>10000) throw Error('Invalid public directory');
  const at=stamp(value.observedAt), until=stamp(value.validUntil);
  if (!(at<=now && now<until && until-at<=LEASE)) throw Error('Directory is not current');
  const seen=new Set(), members=new Map();
  for (const row of value.models) {
    if (!exact(row,['name','brand']) || !label(row.name,256) || (row.brand!==null && !label(row.brand,128)) || seen.has(row.name)) throw Error('Invalid directory member');
    seen.add(row.name);
    const family=row.brand && byOwner.get(normalize(row.brand))?.find(f=>f.model.test(row.name));
    if (!family) continue; // Neither an unlabelled model nor a different product from the same owner is sufficient.
    if (!members.has(family)) members.set(family,new Set());
    members.get(family).add(row.name); // Exact join for optional verified groups; never render a version or ID.
  }
  return {until, families:families.filter(f=>members.has(f)).map(family=>({family,members:members.get(family)}))};
}
const excludedGroup = s => /gemini[\s\p{P}\p{Cf}]*4(?!\d)/iu.test(s.normalize('NFKC'));
function element(tag,cls,text) { const el=document.createElement(tag); el.className=cls; if(text!==undefined) el.textContent=text; return el; }

export function showDirectory(grid,lines) {
  const targets=[];
  const cards=lines.map(({family,members})=>{
    const card=element('li','directory-card'), head=element('div','directory-head'), mark=element('span','directory-mark');
    mark.setAttribute('aria-hidden','true');
    for (const [i,file] of family.marks.entries()) {
      const image=element('img',family.marks.length===2 ? (i?'mark-night':'mark-day') : 'mark-all');
      image.src='/astelume/marks/'+file; image.alt=''; image.width=32; image.height=32; mark.append(image);
    }
    if (family.name==='GPT') mark.classList.add('openai-mark');
    head.append(mark,element('h3','directory-name',family.name));
    const chips=element('p','directory-examples'); chips.hidden=true;
    card.append(head,chips); targets.push({members,chips}); return card;
  });
  grid.replaceChildren(...cards);
  // At most two fresh, independently verified public group examples for models actually in this family.
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

export function mountDirectory({grid,status,count,path='/astelume/live-model-directory'}) {
  let request,timer,expiryTimer,validUntil=0,refreshAt=0,signature,paintExamples,quoteRows=[];
  function clear(message){validUntil=0;signature=undefined;paintExamples=undefined;clearTimeout(expiryTimer);grid.replaceChildren();count.textContent='—';status.textContent=message;grid.setAttribute('aria-busy','false');}
  function arm(delay){clearTimeout(timer);refreshAt=Date.now()+delay;if(!document.hidden&&navigator.onLine)timer=setTimeout(load,delay);}
  async function load(){
    if(request||document.hidden||!navigator.onLine)return;
    const controller=new AbortController();request=controller;let delay=REFRESH;
    try{
      const response=await fetch(path,{method:'GET',credentials:'omit',mode:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('application/json')) throw Error('Directory unavailable');
      const view=readDirectory(await response.json());if(request!==controller)return;
      const next=JSON.stringify(view.families.map(({family,members})=>[family.name,[...members].sort()]));
      if(signature!==next){signature=next;paintExamples=showDirectory(grid,view.families);paintExamples(quoteRows);}
      count.textContent=String(view.families.length);status.textContent=view.families.length?'':'模型广场暂无可展示的模型家族。';grid.setAttribute('aria-busy','false');
      validUntil=view.until;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>clear('模型家族信息已过期，等待广场更新。'),Math.max(0,validUntil-Date.now()));delay=Math.min(REFRESH,Math.max(1500,validUntil-Date.now()-2000));
    }catch{if(request===controller){clear('暂时无法读取模型家族信息。');delay=30000;}}
    finally{if(request===controller){request=undefined;arm(delay);}}
  }
  function resume(){if(document.hidden){clearTimeout(timer);return;}if(validUntil&&Date.now()>=validUntil)clear('模型家族信息已过期，等待广场更新。');if(Date.now()>=refreshAt||!validUntil)void load();else arm(refreshAt-Date.now());}
  function reset(){request?.abort();request=undefined;clearTimeout(timer);refreshAt=0;clear('暂时无法读取模型家族信息。');}
  window.addEventListener('offline',reset);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  window.addEventListener('pagehide',reset);window.addEventListener('pageshow',resume);
  if(navigator.onLine)void load();else reset();
  return {setExamples(rows){quoteRows=rows;paintExamples?.(rows);}};
}
