export const PRICE_PAGE = 'https://astelume.cc.cd/pricing';

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const label = (value, length) => typeof value === 'string' && value.length > 0 && value.length <= length
  && value === value.trim() && !/[<>\p{Cc}\p{Cf}\u2028\u2029]/u.test(value);
const ROW_KEYS = ['model', 'groupKey', 'group', 'tier', 'condition', 'subject', 'currency', 'amount', 'unit', 'denominator'];
const QUOTE_UNITS = new Set(['Token', '请求', '字符', '秒', '分钟', '小时', '次', '任务']);

function utcInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return NaN;
  const millis = Date.parse(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  return Number.isFinite(millis) && new Date(millis).toISOString() === canonical ? millis : NaN;
}

// Use only with an explicitly reviewed same-origin adapter. The authority owns model/alias/output
// and group eligibility BEFORE serialization. No browser eligibility list or raw feed is accepted.
export function validatePublicQuotes(value, now) {
  if (!exactKeys(value, ['schemaVersion', 'kind', 'source', 'revision', 'verifiedAt', 'validUntil', 'rows'])
    || value.schemaVersion !== 1 || value.kind !== 'public-final-group-quotes'
    || value.source !== PRICE_PAGE || !label(value.revision, 100)
    || !Array.isArray(value.rows) || value.rows.length > 2000) throw new Error('Invalid quote envelope');
  const verifiedAt = utcInstant(value.verifiedAt);
  const validUntil = utcInstant(value.validUntil);
  if (!Number.isFinite(now) || !(verifiedAt <= now && now < validUntil)) throw new Error('Quote freshness unavailable');
  const groupNames = new Map();
  const groupKeys = new Map();
  const seen = new Set();
  for (const row of value.rows) {
    if (!exactKeys(row, ROW_KEYS) || !label(row.model, 96) || !label(row.groupKey, 120) || !label(row.group, 120)
      || !label(row.tier, 64) || !label(row.condition, 180) || !label(row.subject, 48)
      || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
      || typeof row.amount !== 'string' || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$/.test(row.amount)
      || !QUOTE_UNITS.has(row.unit) || !Number.isSafeInteger(row.denominator) || row.denominator < 1) {
      throw new Error('Invalid final group quote');
    }
    if ((groupNames.has(row.groupKey) && groupNames.get(row.groupKey) !== row.group)
      || (groupKeys.has(row.group) && groupKeys.get(row.group) !== row.groupKey)) throw new Error('Ambiguous public group');
    groupNames.set(row.groupKey, row.group);
    groupKeys.set(row.group, row.groupKey);
    const key = JSON.stringify([row.model, row.groupKey, row.tier, row.subject, row.currency, row.unit, row.denominator]);
    if (seen.has(key)) throw new Error('Duplicate final group quote');
    seen.add(key);
  }
  return { rows: value.rows, verifiedAt, validUntil };
}

// The adapter owns its request deadline, canonical source, HTTP caching, and any documented
// revalidation/revocation mechanism. No implicit poll, guessed TTL, or last-known-good amount.
export function createQuoteSession(source, render, clock = {
  now: () => Date.now(), set: (callback, delay) => setTimeout(callback, delay), clear: id => clearTimeout(id),
}) {
  let request;
  let expires;
  let current;
  let stopped = false;
  const clear = () => {
    request?.abort();
    request = undefined;
    if (expires !== undefined) clock.clear(expires);
    expires = undefined;
    current = undefined;
  };
  function invalidate() {
    if (stopped || !source) return;
    clear();
    render('unavailable');
  }
  function expire() {
    clear();
    render('expired');
  }
  function checkExpiry() {
    if (!current) return;
    if (expires !== undefined) clock.clear(expires);
    const remaining = current.validUntil - clock.now();
    if (remaining <= 0) expire();
    else expires = clock.set(checkExpiry, Math.min(remaining, 2_147_483_647));
  }
  async function refresh({ keepDuringRead = false } = {}) {
    if (stopped || !source || request) return;
    // A pre-expiry recheck may keep the already-verified display while in flight, NEVER past its deadline.
    if (!keepDuringRead || !current || current.validUntil <= clock.now()) {
      clear();
      render('loading');
    }
    const controller = new AbortController();
    request = controller;
    try {
      const result = await source.read({ signal: controller.signal });
      if (request !== controller) return;
      current = validatePublicQuotes(result, clock.now());
      render(current.rows.length ? 'ready' : 'empty', current);
      checkExpiry();
    } catch {
      if (request === controller) invalidate();
    } finally {
      if (request === controller) request = undefined;
    }
  }
  function stop() {
    clear();
    stopped = true;
  }
  if (!source) render('unavailable');
  return { refresh, invalidate, checkExpiry, stop };
}
