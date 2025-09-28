const listEl = document.querySelector('#list');
const emptyEl = document.querySelector('#empty');

// expose for console / other scripts
window.currentData = null;
window.renderWithLanguage = renderWithLanguage;
window.changeLang = changeLang;

// supported langs and default
const SUPPORTED_LANGS = ['zh','en','ja','ko'];
const DEFAULT_LANG = 'zh';

// read lang from URL or default
const urlParams = new URLSearchParams(location.search);
window.currentLang = (urlParams.get('lang') || DEFAULT_LANG).toLowerCase();
if (!SUPPORTED_LANGS.includes(window.currentLang)) window.currentLang = DEFAULT_LANG;

init();

async function init() {
  try {
    const dataUrl = resolveDataUrl('data.json');
    const res = await fetch(dataUrl + '?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('load fail');
    const items = await res.json();
    window.currentData = items;
    render(items);
  } catch (e) {
    listEl.innerHTML = '';
    const errorTexts = {
      zh: '数据加载失败',
      en: 'Failed to load data',
      ja: 'データの読み込みに失敗しました',
      ko: '데이터 로드 실패'
    };
    emptyEl.textContent = errorTexts[window.currentLang || DEFAULT_LANG];
    emptyEl.classList.remove('hidden');
    console.error(e);
  }
}

/** Resolve data.json URL robustly for GitHub Pages or local */
function resolveDataUrl(filename) {
  // If hosted on github.io, derive base path like /repo/
  const host = location.hostname;
  if (host.endsWith('github.io')) {
    const pathParts = location.pathname.split('/').filter(Boolean); // ['repo', ...] or []
    const base = pathParts.length > 0 ? '/' + pathParts[0] + '/' : '/';
    return location.origin + base + filename;
  }
  // otherwise, local / development
  return './' + filename;
}

function render(items) {
  if (!items?.length) {
    const emptyTexts = {
      zh: '暂无内容',
      en: 'No content available',
      ja: 'コンテンツがありません',
      ko: '콘텐츠 없음'
    };
    emptyEl.textContent = emptyTexts[window.currentLang || DEFAULT_LANG];
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = items.map(item => card(item, window.currentLang || DEFAULT_LANG)).join('');
}

function renderWithLanguage(items, lang) {
  lang = (lang || DEFAULT_LANG).toLowerCase();
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  if (!items?.length) {
    const emptyTexts = {
      zh: '暂无内容',
      en: 'No content available',
      ja: 'コンテンツがありません',
      ko: '콘텐츠 없음'
    };
    emptyEl.textContent = emptyTexts[lang];
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = items.map(item => card(item, lang)).join('');
}

/** Change language at runtime (update URL, state, re-render) */
function changeLang(lang) {
  lang = (lang || DEFAULT_LANG).toLowerCase();
  if (!SUPPORTED_LANGS.includes(lang)) return;
  window.currentLang = lang;
  // update URL param without reload
  const u = new URL(location.href);
  u.searchParams.set('lang', lang);
  history.replaceState({}, '', u.toString());
  if (window.currentData) {
    renderWithLanguage(window.currentData, lang);
  } else {
    // fallback: re-init to fetch data
    init();
  }
}

/** Build a card: select translated fields if present, fallback to others */
function card(item, lang = DEFAULT_LANG) {
  // helper to fetch field like 'title', 'summary', 'best_quote', 'tags'
  function getField(baseName) {
    // prefer exact language field: e.g. title_ja
    const tryKeys = [
      `${baseName}_${lang}`,
      `${baseName}_${DEFAULT_LANG}`,
      baseName,
      `${baseName}_en`,
      `${baseName}_zh`
    ];
    for (const k of tryKeys) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') return item[k];
    }
    return '';
  }

  const tagsValue = getField('tags') || [];
  // tags might be array or string
  const tagsArray = Array.isArray(tagsValue) ? tagsValue : String(tagsValue || '').split(',').map(s => s.trim()).filter(Boolean);
  const tags = tagsArray.join(', ');

  const title = getField('title') || '';
  const desc = getField('summary') || getField('description') || '';
  const quote = getField('best_quote') || '';
  const aiSummaryLabelMap = { zh: 'AI总结：', en: 'AI Summary: ', ja: 'AIまとめ：', ko: 'AI 요약：' };
  const aiSummaryLabel = aiSummaryLabelMap[lang] || aiSummaryLabelMap[DEFAULT_LANG];
  const quoteWrapperMap = { zh: ['「','」'], ja: ['「','」'], en: ['“','”'], ko: ['“','”'] };
  const quoteWrap = quoteWrapperMap[lang] || ['“','”'];

  return `
    <article class="card">
      <h3><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h3>
      ${desc ? `<p><span class="ai-label">${esc(aiSummaryLabel)}</span>${esc(desc)}</p>` : ''}
      ${quote ? `<blockquote>${quoteWrap[0]}${esc(quote)}${quoteWrap[1]}</blockquote>` : ''}
      <div class="meta">${esc(item.source)} · ${esc(tags)} · ${esc(item.date||'')}</div>
    </article>
  `;
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
