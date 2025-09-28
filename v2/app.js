// 第2课优化版 app.js - 搜索体验优化（多语言支持整合版）
// 主要改进：更友好的用户提示、更好的错误处理、以及对 data.json 的多语言字段支持

let raw = [], view = [], activeSource = 'all';
let searchEl, sourcesEl;

// 常用DOM选择器函数
const $ = sel => document.querySelector(sel);

// 获取主要DOM元素
const listEl = $('#list');
const emptyEl = $('#empty');
const controlsEl = $('#controls');

// 全局数据存储，用于语言切换
window.currentData = null;
window.renderWithLanguage = renderWithLanguage;

// 从URL参数获取当前语言，默认为中文
const urlParams = new URLSearchParams(location.search);
window.currentLang = (urlParams.get('lang') || 'zh').toLowerCase();

// 初始化应用
init();

async function init() {
    try {
        // 挂载控制组件
        mountControls();

        // 加载数据
        raw = await loadData();
        window.currentData = raw;

        // 渲染数据源选择器（先通过所有源）
        renderSources(['all', ...new Set(raw.map(x => x.source))]);

        // 绑定事件监听器
        bind();

        // 应用筛选并渲染
        applyAndRender();

        console.log('✅ 应用初始化成功，加载了', raw.length, '篇文章');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        showError('应用加载失败，请刷新页面重试');
    }
}

/**
 * 加载数据文件
 */
async function loadData() {
    let dataUrl;
    if (window.location.pathname.includes('/curated-gems/')) {
        dataUrl = window.location.origin + '/curated-gems/data.json';
    } else {
        dataUrl = './data.json';
    }

    const response = await fetch(dataUrl + '?_=' + Date.now(), {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`数据加载失败: ${response.status}`);
    }

    return await response.json();
}

/**
 * 挂载控制组件（搜索框和筛选器）
 */
function mountControls() {
    const lang = window.currentLang || 'zh';

    // 多语言占位文本（可以按需调整）
    const placeholders = {
        zh: '👋 想找什么好东西？',
        en: '👋 What are you looking for?',
        ja: '👋 何を探していますか？',
        ko: '👋 무엇을 찾고 있나요?'
    };

    const placeholder = placeholders[lang] || placeholders['zh'];

    controlsEl.innerHTML = `
        <div class="controls">
            <input id="search" placeholder="${placeholder}" autocomplete="off"/>
            <div id="sources" class="tags"></div>
        </div>
    `;

    searchEl = $('#search');
    sourcesEl = $('#sources');
}

/**
 * 绑定事件监听器
 */
function bind() {
    if (searchEl) searchEl.addEventListener('input', applyAndRender);

    if (sourcesEl) {
        sourcesEl.addEventListener('click', e => {
            const target = e.target.closest('.tag');
            if (!target) return;

            [...sourcesEl.children].forEach(node => node.classList.remove('active'));
            target.classList.add('active');

            activeSource = target.dataset.source;
            applyAndRender();
        });
    }
}

/**
 * 统一从 item 里读取语言字段
 * base 例如 'title'、'summary'、'best_quote'
 * 回退顺序： base_LANG -> base_en -> base -> ''（安全返回）
 */
function getField(item, base) {
    const lang = window.currentLang || 'zh';
    if (!item) return '';
    const tryKeys = [
        `${base}_${lang}`,
        `${base}_en`,
        `${base}`
    ];
    for (const k of tryKeys) {
        if (k in item && item[k] != null) return item[k];
    }
    return '';
}

/**
 * 读取 tags（数组），支持 tags_zh 等字段回退
 */
function getTags(item) {
    const lang = window.currentLang || 'zh';
    const tryKeys = [`tags_${lang}`, 'tags_en', 'tags'];
    for (const k of tryKeys) {
        if (k in item && Array.isArray(item[k])) return item[k];
    }
    return [];
}

/**
 * 统计、过滤并渲染
 */
function applyAndRender() {
    const query = (searchEl?.value || '').trim().toLowerCase();
    const lang = window.currentLang || 'zh';

    // 统计当前搜索下各 source 的数量
    const counts = { all: 0 };
    for (const item of raw) {
        const summaryField = String(getField(item, 'summary') || '');
        const quoteField = String(getField(item, 'best_quote') || '');
        const titleField = String(getField(item, 'title') || getField(item, 'title_en') || item.title || '');
        const tagsArr = (getTags(item) || []).map(t => String(t || ''));

        const matchesQuery = !query ||
            titleField.toLowerCase().includes(query) ||
            summaryField.toLowerCase().includes(query) ||
            quoteField.toLowerCase().includes(query) ||
            tagsArr.some(tag => tag.toLowerCase().includes(query));

        if (matchesQuery) {
            counts.all += 1;
            const s = item.source || 'unknown';
            counts[s] = (counts[s] || 0) + 1;
        }
    }
    window.__countsForCurrentQuery = counts;

    // 筛选
    view = raw.filter(item => {
        const titleField = String(getField(item, 'title') || item.title || '');
        const summaryField = String(getField(item, 'summary') || '');
        const quoteField = String(getField(item, 'best_quote') || '');
        const tagsArr = (getTags(item) || []).map(t => String(t || ''));

        const matchesQuery = !query ||
            titleField.toLowerCase().includes(query) ||
            summaryField.toLowerCase().includes(query) ||
            quoteField.toLowerCase().includes(query) ||
            tagsArr.some(tag => tag.toLowerCase().includes(query));

        const matchesSource = activeSource === 'all' || item.source === activeSource;

        return matchesQuery && matchesSource;
    });

    render(view);
    renderSources(['all', ...new Set(raw.map(x => x.source))]);

    if (query === 'magic') {
        // 彩蛋：保留
        alert('✨ 哇！你发现了隐藏功能！');
    }
}

/**
 * 渲染数据源选择器（保留原样，但 "All" 文案本地化）
 */
function renderSources(list) {
    const counts = window.__countsForCurrentQuery || { all: raw.length };
    const lang = window.currentLang || 'zh';

    const allLabels = {
        zh: `📚 全部 (${counts.all || 0})`,
        en: `📚 All (${counts.all || 0})`,
        ja: `📚 すべて (${counts.all || 0})`,
        ko: `📚 전체 (${counts.all || 0})`
    };

    sourcesEl.innerHTML = list.map(source => {
        const n = counts[source] || 0;
        let displayText;
        if (source === 'all') {
            displayText = allLabels[lang] || allLabels['zh'];
        } else {
            // 非 "all"：显示源名（若需要本地化，可在 data.json 中添加 source_zh/source_en 等）
            // 这里保持简单：直接显示 source 字符串并附带数量
            displayText = `✨ ${source} (${n})`;
        }
        const isActive = source === activeSource ? 'active' : '';
        return `<span class="tag ${isActive}" data-source="${esc(source)}">${esc(displayText)}</span>`;
    }).join('');
}

/**
 * 渲染文章列表
 */
function render(items) {
    const lang = window.currentLang || 'zh';

    if (!items.length) {
        listEl.innerHTML = '';

        const emptyTexts = {
            zh: '🤔 暂时没找到，换个词试试？或许有惊喜',
            en: '🤔 Nothing so far — try a different word, maybe a surprise awaits.',
            ja: '🤔 見つかりませんでした。別のキーワードを試してみてください。',
            ko: '🤔 아직 찾지 못했어요—다른 단어로 시도해보세요.'
        };

        emptyEl.textContent = emptyTexts[lang] || emptyTexts['zh'];
        emptyEl.classList.remove('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = items.map(item => card(item, lang)).join('');
}

/**
 * 语言切换时重新渲染（暴露给全局）
 */
function renderWithLanguage(items, lang) {
    window.currentLang = (lang || 'zh').toLowerCase();

    // 更新搜索占位（多语言）
    const placeholders = {
        zh: '🔍 输入关键词搜索精彩内容...',
        en: '🔍 Enter keywords to search amazing content...',
        ja: '🔍 キーワードを入力して検索...',
        ko: '🔍 키워드를 입력해 검색하세요...'
    };

    if (searchEl) searchEl.placeholder = placeholders[window.currentLang] || placeholders['zh'];

    applyAndRender();
}

/**
 * 生成文章卡片HTML
 */
function card(item, lang = 'zh') {
    const tagsArray = getTags(item);
    const tags = tagsArray.join(', ');
    const title = getField(item, 'title') || item.title || '';
    const desc = getField(item, 'summary') || '';
    const quote = getField(item, 'best_quote') || '';

    const quoteWrapper = lang === 'zh' ? '「」' : '""';
    const aiSummaryLabel = lang === 'zh' ? 'AI总结：' : (lang === 'ja' ? 'AI要約：' : (lang === 'ko' ? 'AI 요약：' : 'AI Summary: '));

    return `
        <article class="card">
            <h3>
                <a href="${esc(item.link || '#')}" target="_blank" rel="noopener">
                    ${esc(title)}
                </a>
            </h3>
            ${desc ? `
                <p>
                    <span class="ai-label">${esc(aiSummaryLabel)}</span>
                    ${esc(desc)}
                </p>
            ` : ''}
            ${quote ? `
                <blockquote>
                    ${quoteWrapper[0]}${esc(quote)}${quoteWrapper[1]}
                </blockquote>
            ` : ''}
            <div class="meta">
                ${esc(item.source)} · ${esc(tags)} · ${esc(item.date || '')}
            </div>
        </article>
    `;
}

/**
 * 显示错误信息
 */
function showError(message) {
    const lang = window.currentLang || 'zh';
    const errorPrefix = lang === 'zh' ? '❌ 错误：' : (lang === 'ja' ? '❌ エラー：' : (lang === 'ko' ? '❌ 오류：' : '❌ Error: '));

    if (listEl && emptyEl) {
        listEl.innerHTML = '';
        emptyEl.textContent = errorPrefix + message;
        emptyEl.classList.remove('hidden');
    }
}

/**
 * HTML 转义
 */
function esc(str) {
    return String(str || '').replace(/[&<>"']/g, match => ( {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[match]));
}

// 调试信息
console.log('🚀 第2课优化版 app.js（多语言整合）已加载');
console.log('📝 主要改动：');
console.log('   - 支持 data.json 中的 title_zh/title_en/...、summary_zh/...、best_quote_zh/...、tags_zh 等字段');
console.log('   - 本地化搜索占位与空结果提示');
console.log('   - 兼容回退（缺字段时回退到 en 或无后缀字段）');
