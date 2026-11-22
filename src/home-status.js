export const STATUS_MAX_AGE = 15 * 60 * 1000; // Existing service-status snapshot policy; not a quote TTL.
const statusTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short',
});

export function servicePresentation(value, now = Date.now()) {
  const unknown = { label: '尚未核验', detail: '暂无可用检查时间，请查看控制台。', healthy: false };
  if (value?.schemaVersion !== 1 || typeof value.checkedAt !== 'string'
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value.checkedAt)
    || typeof value.services?.newapi !== 'string') return unknown;
  const checked = Date.parse(value.checkedAt);
  if (!Number.isFinite(checked) || checked > now) return unknown;
  const expiry = checked + STATUS_MAX_AGE;
  const stale = now >= expiry;
  const healthy = !stale && value.services.newapi === 'HEALTHY';
  const label = stale ? '检查快照已失效' : healthy ? '本次入口检查通过' : '当前状态待核对';
  const note = stale ? '不代表实时状态。' : '仅说明当次入口检查。';
  return { label, healthy, expiry: stale ? undefined : expiry, detail: `检查时间：${statusTime.format(checked)}（北京时间）。${note}` };
}

export function mountServiceStatus({ statusUrl, label, detail, dot }) {
  let data;
  let currentRequest;
  let timer;
  function render() {
    clearTimeout(timer);
    const state = servicePresentation(data);
    label.textContent = state.label;
    detail.textContent = state.detail;
    dot.classList.toggle('healthy', state.healthy);
    dot.classList.toggle('unknown', !state.healthy);
    if (state.expiry !== undefined) timer = setTimeout(render, Math.max(0, state.expiry - Date.now()));
  }
  function invalidate() {
    currentRequest?.abort();
    currentRequest = undefined;
    data = undefined;
    render();
  }
  async function load() {
    if (currentRequest) return;
    const controller = new AbortController();
    currentRequest = controller;
    try {
      const response = await fetch(statusUrl, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error('Status not available');
      const value = await response.json();
      if (currentRequest === controller) data = value;
    } catch {
      if (currentRequest === controller) data = undefined;
    } finally {
      if (currentRequest === controller) {
        currentRequest = undefined;
        render();
      }
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('offline', invalidate);
  window.addEventListener('online', load);
  window.addEventListener('pageshow', event => { if (event.persisted) { render(); void load(); } });
  void load();
}
