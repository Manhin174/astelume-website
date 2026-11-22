// Visual enhancement only. Directory counts, model prices, and the semantic final values are never animated.
const COUNT_MS = 1200;
export function countAt(goal, elapsed) {
  const t = Math.max(0, Math.min(1, elapsed / COUNT_MS));
  return Math.floor(goal * (1 - (1 - t) ** 2));
}

function prepareCounters(list, motionBlocked) {
  if (!list || motionBlocked() || typeof IntersectionObserver !== 'function') return () => {};
  const entries = [...list.querySelectorAll('dd')].map(dd => ({dd, text: dd.textContent.trim()}));
  if (!entries.length || entries.some(({text}) => !/^\d{1,4}\+$/.test(text))) return () => {};

  // Keep each final number in the accessibility tree and in normal flow so neither AT nor layout ticks.
  const counters = entries.map(({dd, text}) => {
    const final = document.createElement('span');
    final.className = 'fact-final';
    final.textContent = text;
    const visual = document.createElement('span');
    visual.className = 'fact-tick';
    visual.setAttribute('aria-hidden', 'true');
    visual.textContent = '0+';
    dd.replaceChildren(final, visual);
    return {dd, text, visual, goal: Number.parseInt(text, 10), last: 0};
  });
  let frame = 0, started = null, visible = false, done = false;
  const observer = new IntersectionObserver(([entry]) => {
    if (done) return;
    visible = entry.isIntersecting && entry.intersectionRatio >= .2;
    if (visible) start();
    else if (!entry.isIntersecting && started !== null) finish();
  }, {threshold: [0, .2]});

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    for (const {dd, text} of counters) dd.textContent = text;
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', finish);
  }
  function tick(now) {
    if (done) return;
    if (motionBlocked() || document.hidden || now - started >= COUNT_MS) { finish(); return; }
    for (const item of counters) {
      const next = countAt(item.goal, now - started);
      if (next !== item.last) { item.visual.textContent = next + '+'; item.last = next; }
    }
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (done || !visible || document.hidden || started !== null) return;
    if (motionBlocked()) { finish(); return; }
    started = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function visibility() { if (document.hidden && started !== null) finish(); else start(); }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', finish);
  observer.observe(list);
  return finish;
}

function connectPointerLight(home, motionBlocked) {
  const layer = document.createElement('div'), halo = document.createElement('i');
  layer.className = 'home-pointer-light';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.append(halo);
  home.append(layer);
  const listeners = new AbortController();
  const options = {signal: listeners.signal, passive: true};
  let active = false, frame = 0, x = 0, y = 0, toX = 0, toY = 0, previous = 0;
  function hide() {
    cancelAnimationFrame(frame); frame = 0; active = false;
    layer.removeAttribute('data-lit');
    layer.removeAttribute('data-surface');
  }
  function draw(now) {
    frame = 0;
    if (!active) return;
    if (motionBlocked() || document.hidden) { hide(); return; }
    const gain = 1 - Math.exp(-Math.max(1, Math.min(64, now - previous)) / 35);
    previous = now;
    x += (toX - x) * gain; y += (toY - y) * gain;
    const moving = Math.abs(toX - x) + Math.abs(toY - y) > .45;
    if (!moving) { x = toX; y = toY; }
    halo.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    layer.setAttribute('data-lit', '');
    if (moving) frame = requestAnimationFrame(draw);
  }
  function move(event) {
    if (event.pointerType !== 'mouse' || motionBlocked() || document.hidden || event.target.closest?.('dialog[open]')) { hide(); return; }
    toX = event.clientX; toY = event.clientY;
    if (!active) { x = toX; y = toY; previous = performance.now(); active = true; }
    layer.toggleAttribute('data-surface', !!event.target.closest?.('.guide-facts,.cap-card,.directory-card,.protocol-lab'));
    if (!frame) frame = requestAnimationFrame(draw);
  }
  document.addEventListener('pointermove', move, options);
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) hide(); }, options);
  document.addEventListener('pointercancel', hide, options);
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') hide(); }, options);
  document.addEventListener('keydown', hide, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); }, options);
  window.addEventListener('blur', hide, options);
  window.addEventListener('pagehide', hide, options);
  return () => { hide(); listeners.abort(); layer.remove(); };
}

export function mountHomeEffects(home, reducedMotion) {
  if (!home) return;
  const forcedColors = matchMedia('(forced-colors: active)');
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const blocked = () => reducedMotion.matches || forcedColors.matches;
  const finish = prepareCounters(home.querySelector('.guide-facts'), blocked);
  let disconnect;
  function sync() {
    if (blocked()) finish();
    if (finePointer.matches && !blocked()) disconnect ??= connectPointerLight(home, blocked);
    else if (disconnect) { disconnect(); disconnect = undefined; }
  }
  for (const media of [reducedMotion, forcedColors, finePointer]) media.addEventListener('change', sync);
  sync();
}
