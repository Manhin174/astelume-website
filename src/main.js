import { mountDirectory } from './home-directory.js';
import { mountQuoteWall } from './home-quote-view.js';
import { homeMarketSource } from './home-market-source.js';
import { mountServiceStatus } from './home-status.js';
import { mountProtocols } from './home-protocols.js';

const $ = selector => document.querySelector(selector);
const setText = (selector, value) => { $(selector).textContent = value; };
const root = document.documentElement;
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* A private context may block storage. */ }
  },
};

const themeControl = $('#theme-control');
const mobileControl = $('#mobile-control');
const documentDialog = $('#document-dialog');
const themeChoices = [...themeControl.querySelectorAll('[data-theme-choice]')];
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopLayout = matchMedia('(min-width: 900px)');
const storedTheme = store.get('astelume.theme');
let theme = ['light', 'dark'].includes(storedTheme) ? storedTheme : 'system';

function applyTheme() {
  const dark = theme === 'system' ? systemTheme.matches : theme === 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name="theme-color"]').content = dark ? '#071426' : '#F3F7FC';
  $('#theme-toggle use').setAttribute('href', dark ? '#icon-moon' : '#icon-sun');
  for (const button of themeChoices) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  }
}

function applyMotion() {
  root.dataset.motion = reduceMotion.matches ? 'reduced' : 'normal';
}

applyTheme();
applyMotion();
systemTheme.addEventListener('change', applyTheme);
reduceMotion.addEventListener('change', applyMotion);
mountProtocols($('#protocols'));

for (const button of themeChoices) {
  button.addEventListener('click', () => {
    theme = button.dataset.themeChoice;
    // The unchanged docs page shares this key and recognizes only light/dark.
    store.set('astelume.theme', theme === 'system' ? null : theme);
    applyTheme();
    themeControl.open = false;
    $('#theme-toggle').focus();
  });
}

const disclosures = [themeControl, mobileControl];
const phoneLayout = matchMedia('(max-width: 599px)');
function updateMobileOverlay() {
  const open = mobileControl.open && phoneLayout.matches;
  for (const selector of ['.skip-link', '#main', '.home-footer']) $(selector).inert = open;
  root.classList.toggle('home-menu-open', open);
}
for (const disclosure of disclosures) {
  disclosure.addEventListener('toggle', () => {
    if (disclosure.open) {
      for (const other of disclosures) if (other !== disclosure) other.open = false;
    }
    updateMobileOverlay();
    if (disclosure.open && document.activeElement === disclosure.querySelector('summary')) {
      disclosure.querySelector('button[aria-pressed="true"], nav a')?.focus({ preventScroll: true });
    }
  });
}
phoneLayout.addEventListener('change', updateMobileOverlay);

desktopLayout.addEventListener('change', () => { mobileControl.open = false; });
document.addEventListener('click', event => {
  for (const disclosure of disclosures) {
    if (disclosure.open && !disclosure.contains(event.target)) disclosure.open = false;
  }
});
document.addEventListener('keydown', event => {
  if (documentDialog.open) return;
  const openDisclosure = disclosures.find(disclosure => disclosure.open);
  if (!openDisclosure) return;
  if (event.key === 'Escape') {
    openDisclosure.open = false;
    updateMobileOverlay();
    openDisclosure.querySelector('summary').focus();
  }
});
$('#mobile-nav').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  mobileControl.open = false;
  updateMobileOverlay();
  const target = link.hash && link.pathname === location.pathname && document.getElementById(link.hash.slice(1));
  if (target) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
});

const masthead = $('.masthead');
const updateMasthead = () => { masthead.classList.toggle('is-compact', scrollY >= 64); };
updateMasthead();
window.addEventListener('scroll', updateMasthead, { passive: true });
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

$('#copy-api-address').addEventListener('click', async () => {
  const value = $('#api-base-url').textContent.trim();
  try {
    await navigator.clipboard.writeText(value);
    setText('#copy-api-address .copy-label', 'API 地址已复制');
    setText('#copy-api-status', '已复制到剪贴板');
  } catch {
    setText('#copy-api-address .copy-label', '复制 API 地址');
    setText('#copy-api-status', '浏览器未允许复制，请选中上方地址手动复制。');
  }
});
const documents = {
 terms: { title:'服务条款 · 服务说明', sections:[['服务范围','Astelume提供统一模型API、账户权限和请求用量管理。模型能力由第三方模型服务提供，实际可用型号、协议、价格及限制以控制台和已发布说明为准。品牌展示用于说明模型家族，不表示原厂授权、合作背书或全部型号可用。'],['负责任地使用','请仅提交你有权处理的内容，遵守适用法律与对应模型服务的使用条款。不得用于违法活动、侵犯他人权利或规避账号权限限制。'],['费用与可用性','模型请求可能消耗账户额度。请事先确认价格、输出限制和可用余额；待核验价格不表示免费。服务不作零延迟、永不故障或模型身份绝对保证。'],['服务主体与运营信息','运营主体名称、联系渠道、退款和争议处理规则仍需运营方确认并正式公布。此说明不冒充已经完整审定的法律协议；使用前请核对控制台最新条款。']] },
 privacy: {title:'隐私说明',sections:[['本主页','页面由Cloudflare分发；现有线上响应包含Cloudflare Insights性能统计脚本，其数据范围与保留政策仍需运营方确认。主题偏好保存在当前浏览器本地存储；动画跟随系统设置。品牌目录与状态从本站读取。'],['API与控制台','登录、API Key、用量与模型请求由控制台及API服务处理。请求内容可能传输至你选择的第三方模型服务；提交前请确认数据处理权限，避免不必要的敏感个人信息。'],['密钥保护','将API Key仅保存在受控客户端或服务端环境变量，不应嵌入公开网页、代码仓库、URL或普通日志。本主页不读取或保存真实API Key。'],['运营信息','日志保留周期、处理地点、运营主体和联系渠道须由运营方依据实际配置确认。未核实前不作不留存、自动删除或官方合作承诺。']]},
};
let policyTrigger;
for (const button of document.querySelectorAll('[data-document]')) {
  button.addEventListener('click', () => {
    const doc = documents[button.dataset.document];
    setText('#document-title', doc.title);
    const fragment = document.createDocumentFragment();
    for (const [title, text] of doc.sections) fragment.append(element('h3', title), element('p', text));
    $('#document-body').replaceChildren(fragment);
    policyTrigger = button;
    documentDialog.showModal();
  });
}

documentDialog.addEventListener('close', () => policyTrigger?.focus());
documentDialog.addEventListener('click', event => {
  if (event.target !== documentDialog || event.detail === 0) return;
  const {left, right, top, bottom} = documentDialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) documentDialog.close();
});

setText('#copyright-year', String(new Date().getFullYear()));
const directory=mountDirectory({grid:$('#brand-grid'),status:$('#brand-status'),brands:$('#fact-brands'),models:$('#fact-models')});
mountQuoteWall({source:homeMarketSource(),onRows:rows=>directory.setExamples(rows)});
mountServiceStatus({
  statusUrl: `${import.meta.env.BASE_URL}astelume/service-status.json`,
  label: $('#overall-status'), detail: $('#status-updated'), dot: $('#newapi-status'),
});
