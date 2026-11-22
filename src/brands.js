// First-party marks are fixed local assets, never a URL or SVG supplied by the catalog/market.
const ROOT_FIELDS=['schemaVersion','brands'];
const BRAND_FIELDS=['brand_id','display_name','manufacturer','logo','has_listed_service'];
const MARKET='https://astelume.cc.cd/pricing';
const MARKS=new Map(Object.entries({
  gpt:{name:'GPT',owner:'OpenAI',file:'openai-black.svg',night:'openai-white.svg',blurb:'用于对话、内容创作与编程的模型家族。'},
  claude:{name:'Claude',owner:'Anthropic',file:'claude.svg',blurb:'适用于长文写作、文档分析与代码协作。'},
  gemini:{name:'Gemini',owner:'Google',file:'gemini.png',blurb:'结合文本、图像等输入理解问题和上下文。'},
  grok:{name:'Grok',owner:'xAI',file:'grok.jpg',blurb:'面向问答、推理与编程任务。'},
  deepseek:{name:'DeepSeek',owner:'DeepSeek',file:'deepseek.png',blurb:'面向中文对话、逻辑推理与代码生成。'},
}));
const keys=(obj,fields)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).length===fields.length&&fields.every(k=>Object.hasOwn(obj,k));
export function validateBrands(data){
  if(!keys(data,ROOT_FIELDS)||data.schemaVersion!==4||!Array.isArray(data.brands)||data.brands.length>MARKS.size)throw new Error('Invalid brand schema');
  const seen=new Set();for(const b of data.brands){if(!keys(b,BRAND_FIELDS))throw new Error('Unexpected public brand field');const m=MARKS.get(b.brand_id);if(!m||seen.has(b.brand_id)||b.display_name!==m.name||b.manufacturer!==m.owner||b.has_listed_service!==true)throw new Error('Invalid public brand');if(!keys(b.logo,['kind','id'])||b.logo.kind!=='official-mark'||b.logo.id!==b.brand_id)throw new Error('Invalid official brand mark');seen.add(b.brand_id);}
  return data;
}
// This is only a presentation association, not a capability/admission check. Input must already
// be the reviewed, expiring market projection; no stored group labels, model names or fallback rates.
export function groupExamples(rows=[]){
  const result=new Map();for(const r of rows){const id=r.model?.split(/[-.\d]/,1)[0];if(!MARKS.has(id)||!r.group)continue;const arr=result.get(id)||[];if(arr.length<2&&!arr.includes(r.group)){arr.push(r.group);result.set(id,arr);}}
  return result;
}
function node(make,tag,cls,text){const el=make(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function renderChips(host,groups,make){host.replaceChildren();if(!groups?.length){host.hidden=true;return;}host.hidden=false;for(const g of groups){host.append(node(make,'span','brand-chip',g));}}
export function renderBrands(container,brands,create=tag=>document.createElement(tag)){
  const chipHosts=new Map();const cards=brands.map(b=>{
    const spec=MARKS.get(b.brand_id);const card=node(create,'li','brand-card');card.setAttribute('data-brand',b.brand_id);
    const top=node(create,'div','brand-card-head'),mark=node(create,'span','brand-mark');mark.setAttribute('aria-hidden','true');
    function image(filename,variant){const e=node(create,'img',variant);e.setAttribute('src','/astelume/marks/'+filename);e.setAttribute('alt','');e.setAttribute('width','40');e.setAttribute('height','40');return e;}
    mark.append(image(spec.file,spec.night?'mark-day':'mark-all'));if(spec.night)mark.append(image(spec.night,'mark-night'));
    const titles=node(create,'div','brand-titles');titles.append(node(create,'h3','brand-name',b.display_name),node(create,'p','brand-maker',b.manufacturer));top.append(mark,titles);
    const desc=node(create,'p','brand-blurb',spec.blurb),chips=node(create,'div','brand-examples');chips.setAttribute('aria-label',b.display_name+' 的公开分组示例');chips.hidden=true;
    const link=node(create,'a','brand-market','在广场查看');link.setAttribute('href',MARKET);link.setAttribute('aria-label','去模型广场查看 '+b.display_name);const arrow=node(create,'span','brand-arrow','↗');arrow.setAttribute('aria-hidden','true');link.append(arrow);
    card.append(top,desc,chips,link);chipHosts.set(b.brand_id,chips);return card;
  });container.replaceChildren(...cards);
  return rows=>{const groups=groupExamples(rows);for(const [id,host] of chipHosts)renderChips(host,groups.get(id),create);};
}
