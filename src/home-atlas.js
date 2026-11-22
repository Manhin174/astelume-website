// Original line illustrations for the connection manual; no sample catalog or pricing here.
const svgNS = 'http://www.w3.org/2000/svg';
function svgEl(parent, name, props, text) {
  const e = document.createElementNS(svgNS, name);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  parent.append(e); return e;
}
function star(parent, x, y, r, color) {
  return svgEl(parent,'path',{d:`M${x} ${y-r} Q${x+1} ${y-1} ${x+r} ${y} Q${x+1} ${y+1} ${x} ${y+r} Q${x-1} ${y+1} ${x-r} ${y} Q${x-1} ${y-1} ${x} ${y-r}Z`,fill:color});
}
function diagram(card,i) {
  const svg=svgEl(card,'svg',{viewBox:'0 0 260 96',class:`atlas-diagram diagram-${i}`,role:'presentation','aria-hidden':'true',preserveAspectRatio:'xMidYMid meet'});
  const g=svgEl(svg,'g',{fill:'none',stroke:'currentColor','stroke-width':1.2});
  const line=(d,extras={})=>svgEl(g,'path',{d,...extras});
  const nodes=(list)=>list.forEach(([cx,cy,r])=>svgEl(g,'circle',{cx,cy,r,fill:'var(--diagram-node)'}));
  if(i===0){
    const xy=[[23,55],[68,28],[112,64],[155,23],[204,39],[244,12]];
    line('M12 82 68 28 112 64 155 23 204 39 244 12 M23 55 112 64 204 39 M68 28 155 23',{opacity:.38});
    const d='M23 55 68 28 112 64 155 23 204 39 244 12';line(d);line(d,{class:'dia-beam',pathLength:100,'stroke-dasharray':'12 88'});nodes(xy.map(([x,y],n)=>[x,y,n===3?5:2.6]));star(svg,155,23,9,'var(--diagram-light)');
  } else if(i===1){
    for(let j=0;j<25;j++){const x=31+j*5.6,y=60-j*1.25+Math.sin(j*.43)*6;line(`M${x} ${y}l13 -25`,{'stroke-width':[1,2.5,1,1][j%4],opacity:.32+(j%5)*.13});}
    line('M20 75 21 85 188 46 190 37 M58 18 207 3',{opacity:.45});line('M37 72 181 36',{class:'dia-beam',pathLength:100,'stroke-dasharray':'16 84'});star(svg,191,37,7,'var(--diagram-light)');
  } else if(i===2){
    const paths=['M14 19H67Q76 19 86 29L112 50Q119 56 133 56H241','M14 50H82Q99 50 110 54Q119 58 137 58H241','M14 80H74Q84 80 98 70Q118 58 140 58H241'];
    paths.forEach((d,n)=>{line(d,{opacity:.62});const p=line(d,{class:'dia-beam',pathLength:100,'stroke-dasharray':'9 91'});p.style.setProperty('--delay',`${-n*1.4}s`);});nodes([[14,19,2.5],[14,50,2.5],[14,80,2.5],[241,57,3.5]]);
  } else {
    for(let n=0;n<15;n++){const y=36+n*2,amp=Math.sin(n*Math.PI/14)*13;line(`M10 ${y}H48Q62 ${y} 71 ${y-amp-6}T96 ${y-4}Q108 ${y+amp+6} 123 ${y-amp*1.8}T145 ${y-amp*.3}Q159 ${y+amp} 176 ${y}H243`,{opacity:.25+Math.sin(n*Math.PI/14)*.4});}
    line('M12 53H243',{class:'dia-beam',pathLength:100,'stroke-dasharray':'9 91'});
  }
}
export function mountAtlas() {
  const hero=document.querySelector('.home-hero');
  if(!hero) return;
  document.querySelectorAll('.feature-card').forEach(diagram);
  const root=document.documentElement;
  const animated=[hero,...document.querySelectorAll('.feature-card')];
  const inView=new Set([hero]);
  function signal(){for(const el of animated)el.dataset.skyActive=String(!document.hidden && inView.has(el));}
  if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>{for(const e of entries)e.isIntersecting?inView.add(e.target):inView.delete(e.target);signal();});animated.forEach(x=>io.observe(x));}
  else animated.forEach(x=>inView.add(x));
  document.addEventListener('visibilitychange',signal);window.addEventListener('pageshow',signal);signal();
  let frame=0;
  function paint(){frame=0;const reduced=root.dataset.motion==='reduced';const top=window.scrollY;
    const progress=Math.min(1,Math.max(0,top/Math.max(1,document.documentElement.scrollHeight-innerHeight)));
    root.style.setProperty('--atlas-reading',String(progress));
    if(inView.has(hero)||reduced||top===0) hero.style.setProperty('--atlas-y', reduced?'0px':`${Math.min(top*.17,70)}px`);
  }
  function queue(){if(!frame&&!document.hidden) frame=requestAnimationFrame(paint);}
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});
  new MutationObserver(queue).observe(root,{attributes:true,attributeFilter:['data-motion']});paint();
  for(const card of document.querySelectorAll('.feature-card')){
    card.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||root.dataset.motion==='reduced')return;const b=card.getBoundingClientRect();card.style.setProperty('--glint-x',`${(e.clientX-b.left)/b.width*100}%`);card.style.setProperty('--glint-y',`${(e.clientY-b.top)/b.height*100}%`);},{passive:true});
  }
}
