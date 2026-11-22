import {createQuoteSession} from './home-quotes.js';

export function columnCount(w) { return w>=1120?8:w>=880?6:w>=690?5:w>=560?4:w>=435?3:2; }

// One representative, currently verified public INPUT price per exact model. Do not rank on
// amount or combine brackets. The public plaza is the place to look up the exact alternatives.
export function wallRows(rows) {
  const byId=new Map();
  for(const r of rows){
    if(r.subject!=='输入'||r.currency!=='CNY'||r.unit!=='Token'||r.denominator!==1000000||byId.has(r.model))continue;
    byId.set(r.model,r);
  }
  // Weave different families so a column is not a stack of almost-identical model names.
  const bins=new Map();for(const r of byId.values()){const family=r.model.split(/[-.\d]/,1)[0];if(!bins.has(family))bins.set(family,[]);bins.get(family).push(r);}
  const woven=[];for(let i=0;woven.length<byId.size;i++)for(const b of bins.values())if(b[i])woven.push(b[i]);
  return woven;
}
function element(tag,name,txt){const e=document.createElement(tag);e.className=name;if(txt!==undefined)e.textContent=txt;return e;}
function tracks(visual,rows,columns){
  const all=[],height=columns<=3?25:24;
  const slots=Math.max(6,Math.ceil(visual.clientHeight/height)+1);
  for(let c=0;c<columns;c++){
    const speed=[14.2,11.7,10,8.5,7.9,13.8,11.2,9.7][c];
    const t=element('div','quote-track'),seq=element('div','quote-segment');
    t.style.setProperty('--row-height',height+'px');const period=slots*height/speed;
    t.style.setProperty('--quote-speed',period+'s');t.style.setProperty('--quote-offset',-period*((c*.231+.27)%1)+'s');
    const start=Math.floor(c*rows.length/columns);
    for(let j=0;j<slots;j++){
      const r=rows[(start+j)%rows.length],line=element('div','quote-line');
      line.append(element('span','quote-model',r.model),element('span','quote-amount','¥'+r.amount));seq.append(line);
    }
    t.append(seq,seq.cloneNode(true));all.push(t);
  }
  visual.style.setProperty('--quote-columns',columns);visual.replaceChildren(...all);
}
export function mountQuoteWall({source,clock,onRows=()=>{}}={}) {
  const hero=document.querySelector('.home-hero'), visual=document.getElementById('quote-visual');
  const legend=document.getElementById('hero-quote-key'), status=document.getElementById('quote-status');
  let visibleRows=[],lastWall='',lastRows='',shape='',timer,nextCheck=0,stopped=false,inView=false;
  function resize(){if(!visibleRows.length)return;const count=columnCount(visual.parentElement.clientWidth),key=count+':'+visual.clientHeight;if(key===shape)return;shape=key;tracks(visual,visibleRows,count);}
  function arm(at){if(!source?.minimumRefreshMs||stopped)return;nextCheck=at;clearTimeout(timer);timer=setTimeout(()=>recheck(),Math.max(500,at-Date.now()));}
  function recheck(force=false){if(stopped||document.hidden||!navigator.onLine)return;if(source.canRead?.()===false){arm(Math.max(Date.now()+1000,source.nextAttemptAt?.()||Date.now()+60000));return;}if(!force&&Date.now()+10<nextCheck){arm(nextCheck);return;}void session.refresh({keepDuringRead:true});}
  const session=createQuoteSession(source,(state,data)=>{
    hero.dataset.quoteState=state;
    if(source?.minimumRefreshMs){if(state==='ready'||state==='empty')arm(Math.min(data.verifiedAt+source.minimumRefreshMs,data.validUntil-15000));else if(state==='expired')arm(Date.now()+500);else if(state==='unavailable')arm(Math.max(Date.now()+60000,source.nextAttemptAt?.()||0));}
    const safe=state==='ready'?data.rows:[],signature=JSON.stringify(safe);
    if(signature!==lastRows){lastRows=signature;onRows(safe);}
    visibleRows=wallRows(safe);
    const ready=visibleRows.length>0;legend.hidden=!ready;visual.hidden=!ready;
    status.textContent=ready?'背景为当前输入价示例，单位为人民币／百万输入 Token。完整报价请查看模型广场。':state==='loading'?'正在读取模型广场的输入价。':'当前没有可展示的输入价，请查看模型广场。';
    const wallSignature=JSON.stringify(visibleRows.map(r=>[r.model,r.amount]));if(wallSignature===lastWall)return;lastWall=wallSignature;shape='';
    if(ready)resize();else visual.replaceChildren();
  },clock);
  if(!source)return session;
  const setRun=()=>visual.toggleAttribute('data-visible',inView&&!document.hidden);
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;setRun();}):null;
  if(observer)observer.observe(visual.parentElement);else{inView=true;setRun();}
  const resizer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;resizer?.observe(visual.parentElement);
  const onVisible=()=>{session.checkExpiry();setRun();if(source.minimumRefreshMs)recheck();};const online=()=>recheck(true),back=e=>{if(e.persisted)recheck(true);};
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('resize',resize);window.addEventListener('offline',session.invalidate);window.addEventListener('online',online);window.addEventListener('pageshow',back);window.addEventListener('pagehide',session.invalidate);void session.refresh();
  return {...session,stop(){stopped=true;clearTimeout(timer);session.invalidate();session.stop();observer?.disconnect();resizer?.disconnect();document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('resize',resize);window.removeEventListener('offline',session.invalidate);window.removeEventListener('online',online);window.removeEventListener('pageshow',back);window.removeEventListener('pagehide',session.invalidate);}};
}
