// --- 1. Constants & Variables ---
// 115年預算案_各機關別_給美編：https://docs.google.com/spreadsheets/d/11OXVLqRUfySckHFAWJLEciSxqA-XmTqAUS62j59Syzs/edit?usp=sharing
const FILE_ID = '11OXVLqRUfySckHFAWJLEciSxqA-XmTqAUS62j59Syzs';
const getQueryUrl = (gid) => `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:json&tq&gid=${gid}&_=${new Date().getTime()}`;

const dataSources = {
    'page-a': './data_page_a.json',
    'page-b': './data_page_b.json',
    'page-c': './data_page_c.json',
    'page-d': './data_page_d.json'
};

// Global Chart.js theme (align with civic-ledger typography/colors)
(() => {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = '"IBM Plex Mono","Noto Sans TC",ui-sans-serif,system-ui,sans-serif';
    Chart.defaults.font.weight = '600';
    Chart.defaults.color = 'rgba(20,22,29,0.82)';
    Chart.defaults.borderColor = 'rgba(20,22,29,0.12)';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;

    const cssVar = (name, fallback) => {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue(name);
            const s = String(v || '').trim();
            return s || fallback;
        } catch (_) {
            return fallback;
        }
    };
    // Stronger separation for stacked/adjacent segments (accessibility-first)
    Chart.defaults.elements.bar.borderSkipped = false;
    Chart.defaults.elements.bar.borderWidth = 2;
    Chart.defaults.elements.bar.borderColor = cssVar('--chart-segment-border', 'rgba(247,248,251,0.96)');
    Chart.defaults.elements.arc.borderWidth = 2;
    Chart.defaults.elements.arc.borderColor = cssVar('--chart-segment-border', 'rgba(247,248,251,0.96)');
    Chart.defaults.scale.grid.color = cssVar('--chart-grid', 'rgba(20,22,29,0.16)');
})();

// Mock Data
const MOCK_DATA_A = [{ '計畫編號': 'TEST001', '所屬部會': '行政院', '主管機關': '國防部', '計畫名稱': '國防自主強化計畫 (測試資料)', '預算金額': '5000000000', '114年預算金額': '4800000000', '政事別': '國防', '工作內容': '測試說明。', '分支計畫': '潛艦國造:3000000000:這是潛艦的詳細說明|無人機研發:2000000000:這是無人機的詳細說明', '用途比例': '人事費:50000000|業務費:30000000|設備及投資:4000000000|獎補助費:10000000|債務費:0|預備金:0' }];
const MOCK_DATA_B = [{ '計畫編號': 'TEST001', '計畫名稱': '國防自主強化計畫', '主管機關': '國防部', '預算金額': '5000000000', '刪減金額': '1000000', '凍結金額': '50000000', '委員會刪減': '500000', '委員會凍結': '20000000', '院會表決刪減': '500000', '院會表決凍結': '30000000', '通案刪減': '100000', '通案凍結': '0', '提案紀錄': '王小明:凍結:人事費:理由A', '資料類型': '計畫' }];
const MOCK_DATA_C = [{ '委員姓名': '王小明', '黨籍': '無黨籍', '刪減案數': '5', '凍結案數': '10', '主決議數': '2', '照片': '', '更新時間': '2026/01/20', '提案明細': '刪減#國防自主強化計畫 (測試資料)#設備採購#100萬#理由B#TEST001#通過#114/05/20' }];
const MOCK_DATA_D = [{ '日期': '113/08/22', '事項': '行政院通過總預算案', '連結': '' }, { '日期': '113/08/30', '事項': '預算案送立法院審議', '連結': '' }, { '日期': '113/11/08', '事項': '付委審查', '連結': '' }];

let allDataPageA = [], allDataPageB = [], allDataPageB_Plans = [], allDataPageC = [], allDataPageD = [];
let mainChartsRendered = false;
let isDemoMode = false;

// Chart Instances
let chartStatusInstance = null;
let chartAllocationInstance = null;
let chartMinistryBar = null;
let chartMinistryPie = null;

// Modal Chart Instances
let chartModalPlanRatio = null;
let chartModalCatRatio = null;
let chartModalAgencyReview = null;
let chartBranchRatio = null; // [v163] New Chart Instance
let chartPieA = null, chartB1 = null, chartB2 = null;

let chartMilMndRatio = null, chartMilUnitRatio = null, chartMilMndCat = null, chartMilUnitCat = null;

function cssVar(name, fallback) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        const s = String(v || '').trim();
        return s || fallback;
    } catch (_) {
        return fallback;
    }
}

const CHART_COLORS = {
    pass: cssVar('--pen-color-pass', '#2a8f3e'),
    freeze: cssVar('--pen-color-freeze', '#5a8fc4'),
    cut: cssVar('--pen-color-cut', '#b84848'),
    hero: cssVar('--pen-color-hero-blue', '#355899'),
    heroSoft: cssVar('--pen-color-pass-blue', '#3f78b8'),
    heroSofter: cssVar('--pen-color-freeze-blue', '#6f95cf'),
    neutralMid: cssVar('--chart-neutral-mid', '#b9bcc5'),
    neutralLight: cssVar('--chart-neutral-light', '#e5e5ea'),
    segmentBorder: cssVar('--chart-segment-border', 'rgba(247,248,251,0.96)')
};

function hexToRgba(hex, alpha = 1) {
    const h = String(hex || '').replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLightHex(hex) {
    const h = String(hex || '').replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length !== 6) return false;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.74;
}

const categoryColorMap = {
    '社會福利': '#c76a6e',
    // Revert to the previous (original) category palette
    '教育科學文化': '#7a9fcf',
    '國防': '#97b1de',
    '經濟發展': '#5a8fc4',
    '一般政務': '#355899',
    '退休撫卹': '#b84848',
    '債務還本付息': '#c7c7cc',
    '補助及其他': '#e5e5ea',
    '社區發展及環境保護': '#326d5e',
    '其他': '#8e8e93'
};

// Allocation (115年度預算結構) uses a dedicated high-distinctness palette
// to match the reference “rainbow” look, without affecting other charts.
const allocationColorMap = {
    '社會福利': '#e74c3c',          // red
    '教育科學文化': '#f0c808',      // yellow
    '國防': '#086788',              // teal-blue
    '經濟發展': '#2ecc71',          // green
    '一般政務': '#9b59b6',          // purple
    '退休撫卹': '#3498db',          // blue
    '債務還本付息': '#e67e22',      // orange
    '補助及其他': '#1abc9c',        // teal
    '社區發展及環境保護': '#34495e' // slate
};

// Diverging palette for charts/figures (negative ↔ zero ↔ positive). Use for growth, deltas, above/below baseline.
const CHART_DIVERGING_RED_BLUE = ['#a82d3a', '#d4866a', cssVar('--chart-diverging-zero', '#f7f8fb'), cssVar('--chart-diverging-pos-1', '#3f78b8'), cssVar('--chart-diverging-pos-2', '#1f4e86')];
/** @param {number} value - e.g. growth %
 *  @param {number} zero - baseline (default 0)
 *  @param {number} step - magnitude for strong red/blue (default 10)
 */
function getDivergingColor(value, zero = 0, step = 10) {
    if (value == null || value === '') return CHART_DIVERGING_RED_BLUE[2];
    const v = Number(value);
    if (v < zero) return v <= zero - step ? CHART_DIVERGING_RED_BLUE[0] : CHART_DIVERGING_RED_BLUE[1];
    if (v > zero) return v >= zero + step ? CHART_DIVERGING_RED_BLUE[4] : CHART_DIVERGING_RED_BLUE[3];
    return CHART_DIVERGING_RED_BLUE[2];
}

// Multi-page detection: which page are we on?
const currentPage = (() => {
    const cl = document.body.classList;
    if (cl.contains('page-budget')) return 'budget';
    if (cl.contains('page-legislators')) return 'legislators';
    if (cl.contains('page-other')) return 'other';
    return 'overview';
})();

const TOUR_STEPS = {
    overview: [
        {
            target: '#heading-review-progress',
            title: '先看「審查進度」這張卡',
            body: '這裡用時間軸整理預算案目前卡在哪個節點，先快速掌握大局。'
        },
        {
            target: '#heading-allocation-115',
            title: '再看「分配與審查概況」',
            body: '這區說明預算如何分配，以及整體刪減／凍結概況，幫你抓出重點領域。'
        }
    ],
    budget: [
        {
            target: '#bp-filter-ministry',
            focus: 'target',
            title: '第 1 步：先選部會',
            body: '先從下拉選單選一個部會，畫面下方的審查比例圖會一起更新。'
        },
        {
            target: '#bp-filter-unit',
            focus: 'target',
            title: '第 2 步：細到機關',
            body: '再選擇該部會底下的具體機關，查看這個機關被刪減／凍結／通過的比例。'
        },
        {
            target: '.js-search-budget-input',
            focus: 'target',
            title: '第 3 步：用關鍵字找計畫',
            body: '輸入「國防、潛艦、凍結…」等關鍵字，或點熱門標籤，快速找到關心的工作計畫。'
        },
        {
            target: '#results-container-budget',
            focus: 'target',
            title: '第 4 步：點結果看詳情',
            body: '在結果列表中點任一筆，可打開詳情視窗，查看預算用途與具體審查意見。'
        }
    ],
    legislators: [
        {
            target: '.filter-tag[data-party="all"]',
            focus: 'target',
            title: '先用黨籍縮小範圍',
            body: '先選擇「全部」或特定政黨，縮小你要觀察的立委範圍。'
        },
        {
            target: '#leg-sort-by',
            focus: 'target',
            title: '再用排序找出關鍵立委',
            body: '改變排序依據（刪減案數／凍結案數／主決議數），找出在預算審查上最積極的立委。'
        },
        {
            target: '#leg-container-c',
            focus: 'target',
            title: '點卡片看提案明細',
            body: '點任一立委卡片，即可打開詳情，查看他（她）提出的刪減／凍結案與理由。'
        }
    ],
    other: [
        {
            target: '#page-other',
            focus: 'target',
            title: '這頁是說明與資料來源',
            body: '這裡集中相關新聞、資料來源、誤差提醒與使用方式，不會有互動圖表。'
        },
        {
            target: '#page-other h3',
            focus: 'target',
            title: '往下看「使用方式」',
            body: '如果想馬上開始操作，可直接往下捲到「使用方式」段落照著做。'
        }
    ]
};

function initTour() {
    const startBtn = document.querySelector('.js-tour-start');
    if (!startBtn) return;

    const pageSteps = TOUR_STEPS[currentPage] || [];

    const storageKeyDismiss = `tourDismissed:${currentPage}`;
    const storageKeyAutoShown = `tourAutoShown:${currentPage}`;

    let overlay = null;
    let spotlight = null;
    let dialog = null;
    let titleEl = null;
    let bodyEl = null;
    let progressEl = null;
    let btnBack = null;
    let btnNext = null;
    let btnSkip = null;
    let btnDone = null;

    let activeIndex = 0;
    let lastFocus = null;

    const safeGet = (key) => {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    };
    const safeSet = (key, val) => {
        try { localStorage.setItem(key, val); } catch (_) { /* ignore */ }
    };

    const getStepTarget = (step) => {
        if (!step || !step.target) return null;
        return document.querySelector(step.target);
    };

    const getStepFocusEl = (step, target) => {
        if (!target) return null;

        const focus = step && step.focus;

        if (focus === 'card') {
            return target.closest?.('.card') || target;
        }

        if (focus && typeof focus === 'object' && focus.selector) {
            const card = target.closest?.('.card');
            const sub = card ? card.querySelector(focus.selector) : null;
            return sub || target;
        }

        // Default: spotlight the target element itself for more precise guidance.
        return target;
    };

    const findNextValidIndex = (start, direction = 1) => {
        let i = start;
        while (i >= 0 && i < pageSteps.length) {
            if (getStepTarget(pageSteps[i])) return i;
            i += direction;
        }
        return -1;
    };

    const validStepCount = pageSteps.reduce((count, step) => {
        return count + (getStepTarget(step) ? 1 : 0);
    }, 0);

    const buildOverlay = () => {
        overlay = document.createElement('div');
        overlay.className = 'tour-overlay';
        overlay.innerHTML = `
            <div class="tour-backdrop" data-tour-close></div>
            <div class="tour-spotlight" aria-hidden="true"></div>
            <div class="tour-dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
                <div class="tour-dialog__head">
                    <div class="tour-dialog__meta">
                        <div class="tour-progress" id="tour-progress"></div>
                    </div>
                    <button type="button" class="tour-close" data-tour-close aria-label="關閉導覽">×</button>
                </div>
                <h2 class="tour-title" id="tour-title" tabindex="-1"></h2>
                <div class="tour-body" id="tour-body"></div>
                <div class="tour-actions">
                    <button type="button" class="tour-btn tour-btn--ghost" data-tour-back>上一步</button>
                    <button type="button" class="tour-btn tour-btn--ghost" data-tour-skip>略過</button>
                    <div class="tour-actions__spacer"></div>
                    <button type="button" class="tour-btn tour-btn--primary" data-tour-next>下一步</button>
                    <button type="button" class="tour-btn tour-btn--primary" data-tour-done>完成</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        spotlight = overlay.querySelector('.tour-spotlight');
        dialog = overlay.querySelector('.tour-dialog');
        titleEl = overlay.querySelector('#tour-title');
        bodyEl = overlay.querySelector('#tour-body');
        progressEl = overlay.querySelector('#tour-progress');

        btnBack = overlay.querySelector('[data-tour-back]');
        btnNext = overlay.querySelector('[data-tour-next]');
        btnSkip = overlay.querySelector('[data-tour-skip]');
        btnDone = overlay.querySelector('[data-tour-done]');

        overlay.querySelectorAll('[data-tour-close]').forEach((el) => {
            el.addEventListener('click', () => closeTour({ persistDismissal: false }));
        });

        btnBack.addEventListener('click', () => go(-1));
        btnNext.addEventListener('click', () => go(1));
        btnSkip.addEventListener('click', () => closeTour({ persistDismissal: true }));
        btnDone.addEventListener('click', () => closeTour({ persistDismissal: true }));

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeTour({ persistDismissal: false });
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                go(1);
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                go(-1);
                return;
            }
            if (e.key === 'Tab') {
                trapFocus(e);
            }
        });
    };

    const trapFocus = (e) => {
        if (!dialog) return;
        const focusables = dialog.querySelectorAll(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex=\"-1\"])'
        );
        const list = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
            if (active === first || !dialog.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    let scrollRaf = 0;
    let stepResizeObserver = null;

    const positionForStep = (idx, { shouldScroll } = { shouldScroll: true }) => {
        const step = pageSteps[idx];
        const target = getStepTarget(step);
        const focusEl = getStepFocusEl(step, target);
        if (!focusEl) return;

        if (shouldScroll) {
            focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const measureAndPlace = () => {
            const rectFocus = focusEl.getBoundingClientRect();
            const rectTarget = target ? target.getBoundingClientRect() : rectFocus;
            const pad = 10;
            const safe = 8;
            const nav = document.querySelector('.js-float-nav');
            const navRect = nav ? nav.getBoundingClientRect() : null;
            const safeTop = Math.max(safe, (navRect ? navRect.bottom : 0) + 8);
            const safeBottom = safe;
            const rawLeft = rectFocus.left - pad;
            const rawTop = rectFocus.top - pad;
            const rawRight = rectFocus.right + pad;
            const rawBottom = rectFocus.bottom + pad;

            const left = Math.max(safe, Math.min(rawLeft, window.innerWidth - safe));
            const top = Math.max(safeTop, Math.min(rawTop, window.innerHeight - safeBottom));
            const right = Math.max(left + 8, Math.min(rawRight, window.innerWidth - safe));
            const bottom = Math.max(top + 8, Math.min(rawBottom, window.innerHeight - safeBottom));

            const w = right - left;
            const h = bottom - top;

            spotlight.style.left = `${left}px`;
            spotlight.style.top = `${top}px`;
            spotlight.style.width = `${w}px`;
            spotlight.style.height = `${h}px`;

            const gap = 16;
            const isNarrow = window.innerWidth < 720;
            const dialogRect = dialog.getBoundingClientRect();

            const spaceBelow = (window.innerHeight - safeBottom) - rectFocus.bottom;
            const spaceAbove = rectFocus.top - safeTop;

            const canBelow = spaceBelow >= (dialogRect.height + gap);
            const canAbove = spaceAbove >= (dialogRect.height + gap);

            const bottomSheet = isNarrow || (!canBelow && !canAbove);
            if (bottomSheet) {
                dialog.style.left = `var(--space-4)`;
                dialog.style.right = `var(--space-4)`;
                dialog.style.top = 'auto';
                dialog.style.bottom = `var(--space-4)`;
                dialog.style.transform = 'none';
                return;
            }

            const dialogW = dialogRect.width || 360;
            const safeX = safe;
            const maxLeft = Math.max(safeX, window.innerWidth - safeX - dialogW);
            const desiredLeft = rectTarget.left;
            const leftPx = Math.min(maxLeft, Math.max(safeX, desiredLeft));

            const placeBelow = canBelow;
            if (placeBelow) {
                dialog.style.left = `${leftPx}px`;
                dialog.style.top = `${Math.min(window.innerHeight - safeBottom - dialogRect.height, rect.bottom + gap)}px`;
                dialog.style.right = 'auto';
                dialog.style.bottom = 'auto';
                dialog.style.transform = 'none';
            } else {
                // place above
                dialog.style.left = `${leftPx}px`;
                dialog.style.top = `${Math.max(safeTop + gap, rect.top - gap)}px`;
                dialog.style.right = 'auto';
                dialog.style.bottom = 'auto';
                dialog.style.transform = 'translateY(-100%)';
            }
        };

        // Wait for smooth scroll to settle (stable rect) before placing.
        if (!shouldScroll) {
            measureAndPlace();
            return;
        }

        let last = null;
        let stableFrames = 0;
        const start = performance.now();
        const timeoutMs = 700;
        const eps = 1;
        const tick = () => {
            const r = focusEl.getBoundingClientRect();
            if (last) {
                const dx = Math.abs(r.left - last.left);
                const dy = Math.abs(r.top - last.top);
                if (dx < eps && dy < eps) stableFrames += 1;
                else stableFrames = 0;
            }
            last = r;

            const timedOut = (performance.now() - start) > timeoutMs;
            if (stableFrames >= 2 || timedOut) {
                measureAndPlace();
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    const renderStep = (idx) => {
        const step = pageSteps[idx];
        const target = getStepTarget(step);
        const focusEl = getStepFocusEl(step, target);
        if (!step || !target || !focusEl) return;

        const stepNum = idx + 1;
        const total = pageSteps.length;
        progressEl.textContent = `${stepNum} / ${total}`;
        titleEl.textContent = step.title || '';
        bodyEl.textContent = step.body || '';

        btnBack.style.display = idx === 0 ? 'none' : 'inline-flex';
        const isLast = idx === total - 1;
        btnNext.style.display = isLast ? 'none' : 'inline-flex';
        btnDone.style.display = isLast ? 'inline-flex' : 'none';

        // Keep overlay aligned even if the target resizes (charts render, fonts load, etc.)
        if (stepResizeObserver) {
            try { stepResizeObserver.disconnect(); } catch (_) { /* ignore */ }
            stepResizeObserver = null;
        }
        if (typeof ResizeObserver !== 'undefined') {
            stepResizeObserver = new ResizeObserver(() => {
                if (!overlay) return;
                positionForStep(activeIndex, { shouldScroll: false });
            });
            try { stepResizeObserver.observe(focusEl); } catch (_) { /* ignore */ }
        }

        positionForStep(idx, { shouldScroll: true });
        titleEl.focus({ preventScroll: true });
    };

    const go = (delta) => {
        const next = findNextValidIndex(activeIndex + delta, delta >= 0 ? 1 : -1);
        if (next === -1) return;
        activeIndex = next;
        renderStep(activeIndex);
    };

    const closeTour = ({ persistDismissal }) => {
        if (!overlay) return;
        if (persistDismissal) safeSet(storageKeyDismiss, '1');
        if (stepResizeObserver) {
            try { stepResizeObserver.disconnect(); } catch (_) { /* ignore */ }
            stepResizeObserver = null;
        }
        overlay.remove();
        overlay = null;
        spotlight = null;
        dialog = null;
        if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus({ preventScroll: true });
        } else {
            startBtn.focus({ preventScroll: true });
        }
    };

    const openTour = ({ auto } = { auto: false }) => {
        if (!pageSteps || pageSteps.length === 0) return;
        lastFocus = document.activeElement;

        if (!overlay) buildOverlay();

        const firstValid = findNextValidIndex(0, 1);
        if (firstValid === -1) return;
        activeIndex = firstValid;
        renderStep(activeIndex);

        if (auto) safeSet(storageKeyAutoShown, '1');
    };

    startBtn.addEventListener('click', () => openTour({ auto: false }));

    // Auto-start once per page for first-time visitors (skippable).
    const dismissed = safeGet(storageKeyDismiss) === '1';
    const autoShown = safeGet(storageKeyAutoShown) === '1';
    if (!dismissed && !autoShown && validStepCount >= 2) {
        setTimeout(() => openTour({ auto: true }), 600);
    }

    window.addEventListener('resize', () => {
        if (!overlay) return;
        positionForStep(activeIndex, { shouldScroll: false });
    });

    window.addEventListener('scroll', () => {
        if (!overlay) return;
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0;
            if (!overlay) return;
            positionForStep(activeIndex, { shouldScroll: false });
        });
    }, { passive: true });
}

function initFloatNavCollapseMenu() {
    const nav = document.querySelector('.js-float-nav');
    if (!nav) return;

    const seg = nav.querySelector('.float-nav__seg');
    const btn = nav.querySelector('.js-float-nav-menuBtn');
    if (!seg || !btn) return;

    const closeMenu = () => {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
        nav.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
    };

    const toggleMenu = () => {
        if (!nav.classList.contains('is-collapsed')) return;
        if (nav.classList.contains('is-open')) closeMenu();
        else openMenu();
    };

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
    });

    document.addEventListener('click', (e) => {
        if (!nav.classList.contains('is-open')) return;
        if (!nav.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (nav.classList.contains('is-open')) closeMenu();
    });

    const mq = window.matchMedia ? window.matchMedia('(max-width: 560px)') : null;

    const updateCollapsed = () => {
        const overflow = seg.scrollWidth > (seg.clientWidth + 1);
        const shouldCollapse = overflow || (mq ? mq.matches : false);

        if (shouldCollapse) {
            nav.classList.add('is-collapsed');
        } else {
            nav.classList.remove('is-collapsed');
            closeMenu();
        }
    };

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => updateCollapsed());
        ro.observe(seg);
        ro.observe(nav);
    }

    window.addEventListener('resize', updateCollapsed, { passive: true });
    if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', updateCollapsed);
    } else if (mq && typeof mq.addListener === 'function') {
        mq.addListener(updateCollapsed);
    }

    updateCollapsed();
}

function isCaucusName(name) {
    return typeof name === 'string' && name.includes('黨團');
}

function getPartyTheme(partyOrName) {
    const s = (partyOrName || '').toString();
    if (s.includes('民進')) return { bg: '#2a8f3e', fg: '#FFFFFF' };
    if (s.includes('國民')) return { bg: '#354899', fg: '#FFFFFF' };
    if (s.includes('民眾')) return { bg: '#4a9e9e', fg: '#FFFFFF' };
    return { bg: '#8e8e93', fg: '#FFFFFF' };
}

function toSvgDataUri(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function initScrollReveal() {
    const targets = Array.from(document.querySelectorAll('.animate-in'));
    if (!targets.length) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
        targets.forEach(el => el.classList.add('is-in'));
        return;
    }

    if (typeof IntersectionObserver === 'undefined') {
        targets.forEach(el => el.classList.add('is-in'));
        return;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
        });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    targets.forEach(el => io.observe(el));
}

function makeCaucusAvatarDataUri(label, partyOrName) {
    const { bg, fg } = getPartyTheme(partyOrName || label);
    const text = (label || '').toString().slice(0, 6);
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#0B1220"/>
    </linearGradient>
    <pattern id="p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
      <rect width="14" height="14" fill="none"/>
      <path d="M0 13 L14 13" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
    </pattern>
  </defs>
  <rect x="16" y="16" width="224" height="224" rx="64" fill="url(#g)"/>
  <rect x="16" y="16" width="224" height="224" rx="64" fill="url(#p)" opacity="0.85"/>
  <circle cx="196" cy="72" r="10" fill="rgba(255,255,255,0.35)"/>
  <text x="128" y="142" text-anchor="middle" font-size="44" font-weight="900"
        font-family="Noto Serif TC, Noto Sans TC, ui-serif, serif"
        fill="${fg}" letter-spacing="2">${text}</text>
  <text x="128" y="182" text-anchor="middle" font-size="18" font-weight="600"
        font-family="IBM Plex Mono, Noto Sans TC, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        fill="rgba(255,255,255,0.85)">CAUCUS</text>
</svg>`;
    return toSvgDataUri(svg);
}

function getLegislatorPhotoSrc(name, party, photoFromData) {
    if (!name) return null;
    if (photoFromData != null && photoFromData !== '') {
        const t = String(photoFromData).trim();
        if (t) return t;
    }
    if (isCaucusName(name)) {
        const s = ((party || '') + ' ' + name).toString();
        if (s.includes('民進')) return './img/dpp.svg';
        if (s.includes('國民')) return './img/kmt..png';
        if (s.includes('民眾')) return './img/tpp.svg';
        return makeCaucusAvatarDataUri(name, party || name);
    }
    // Local headshots: add files under photos/ as 姓名.jpg and commit (see GitHub Actions deploy).
    return `./photos/${encodeURIComponent(name)}.jpg`;
}
// --- [v172] 工作內容分頁：機關審查結果儀表板 ---

let chartBudgetPageReview = null; // 全域變數儲存圖表實例

// 1. 初始化下拉選單
function initBudgetPageFilters() {
    const ministrySelect = document.querySelector(".js-bp-filter-ministry");
    if (!allDataPageA || allDataPageA.length === 0) return;

    // 取得所有部會清單
    const ministries = [...new Set(allDataPageA.map(item => item['所屬部會']))].filter(m => m).sort();

    let html = '<option value="">請選擇所屬部會</option>';
    ministries.forEach(m => { html += `<option value="${m}">${m}</option>`; });
    ministrySelect.innerHTML = html;

    // [關鍵修正] 選單建立後，立刻執行一次更新，顯示「全國總覽」
    updateBudgetPageReview();
}

// 2. 更新圖表與連動選單
function updateBudgetPageReview() {
    const ministrySelect = document.querySelector(".js-bp-filter-ministry");
    const unitSelect = document.querySelector(".js-bp-filter-unit");
    const selectedMinistry = ministrySelect.value;

    // 連動邏輯：選部會 -> 更新機關選單
    if (selectedMinistry) {
        const agencies = [...new Set(allDataPageA
            .filter(d => d['所屬部會'] === selectedMinistry)
            .map(d => d['主管機關']))]
            .filter(a => a).sort();

        const lastMinistry = unitSelect.getAttribute('data-last-ministry');
        if (lastMinistry !== selectedMinistry) {
            let html = '<option value="">請選擇主管機關 (全部)</option>';
            agencies.forEach(a => { html += `<option value="${a}">${a}</option>`; });
            unitSelect.innerHTML = html;
            unitSelect.value = "";
            unitSelect.setAttribute('data-last-ministry', selectedMinistry);
        }
    } else {
        unitSelect.innerHTML = '<option value="">請選擇主管機關</option>';
        unitSelect.value = "";
    }

    const selectedAgency = unitSelect.value;
    const captionEl = document.querySelector(".js-bp-review-caption");

    // --- 計算邏輯 ---
    let totalBudget = 0;
    let totalCut = 0;
    let totalFreeze = 0;
    let titleText = "";

    if (selectedAgency) {
        // [情境 3] 已選擇特定機關
        const stats = calculateAgencyStats(selectedAgency);
        totalBudget = stats.totalBudget;
        totalCut = stats.totalCut;
        totalFreeze = stats.totalFreeze;
        titleText = selectedAgency;
    } else if (selectedMinistry) {
        // [情境 2] 只選部會
        titleText = selectedMinistry + " (全體)";
        const ministryProjects = allDataPageA.filter(d => d['所屬部會'] === selectedMinistry);

        if (selectedMinistry === '國防部') {
            const statsMND = calculateAgencyStats('國防部');
            const statsSub = calculateAgencyStats('國防部所屬');
            totalBudget = statsMND.totalBudget + statsSub.totalBudget;
            totalCut = statsMND.totalCut + statsSub.totalCut;
            totalFreeze = statsMND.totalFreeze + statsSub.totalFreeze;
        } else {
            ministryProjects.forEach(p => { totalBudget += parseMoney(p['預算金額']); });

            // 找出該部會的機關清單，再從B表加總
            const agenciesInMinistry = [...new Set(ministryProjects.map(p => p['主管機關']))];
            allDataPageB.forEach(r => {
                if (agenciesInMinistry.includes(r['主管機關'])) {
                    totalCut += parseMoney(r['刪減金額']);
                    totalFreeze += parseMoney(r['凍結金額']);
                }
            });
        }

    } else {
        // [情境 1] 兩個都沒選 (預設狀態) -> 加總全部
        titleText = "中央政府總預算案 (全體)";

        // 預算總額 (A表) + 國防部機密預算補正
        let rawTotalA = 0;
        allDataPageA.forEach(p => rawTotalA += parseMoney(p['預算金額']));

        const mndExisting = allDataPageA.filter(p => {
            const id = String(p['計畫編號']).trim();
            return id.startsWith('0901') || id.startsWith('0902');
        }).reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);

        const mndTarget = 1750857000 + 559611869000;
        const diff = mndTarget - mndExisting;

        totalBudget = rawTotalA + (diff > 0 ? diff : 0);

        // 刪減凍結總額 (B表)
        allDataPageB.forEach(r => {
            totalCut += parseMoney(r['刪減金額']);
            totalFreeze += parseMoney(r['凍結金額']);
        });
    }

    // --- 繪圖數據準備 ---
    const totalPass = totalBudget - totalCut - totalFreeze;
    // 避免分母為0
    const pctPass = (totalBudget > 0) ? (totalPass / totalBudget * 100).toFixed(1) : 0;
    const pctCut = (totalBudget > 0) ? (totalCut / totalBudget * 100).toFixed(1) : 0;
    const pctFreeze = (totalBudget > 0) ? (totalFreeze / totalBudget * 100).toFixed(1) : 0;

    // 更新文字說明
    captionEl.innerHTML = `
        <span style="color:#1c1c1e; font-weight:bold;">${titleText}</span> 總預算：${formatCurrency(totalBudget)}<br>
        通過：<b>${pctPass}%</b> | 
        <span style="color:${CHART_COLORS.cut}">刪減：<b>${pctCut}%</b> (${formatCurrency(totalCut)})</span> |
        <span style="color:${CHART_COLORS.freeze}">凍結：<b>${pctFreeze}%</b> (${formatCurrency(totalFreeze)})</span>
    `;

    // 繪製圖表
    const ctx = document.querySelector(".js-chartBudgetPageReview").getContext('2d');
    if (chartBudgetPageReview) chartBudgetPageReview.destroy();

    chartBudgetPageReview = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['審查結果'],
            datasets: [
                { label: '通過', data: [totalPass], backgroundColor: CHART_COLORS.pass, barThickness: 50 },
                { label: '凍結', data: [totalFreeze], backgroundColor: CHART_COLORS.freeze, barThickness: 50 },
                { label: '刪減', data: [totalCut], backgroundColor: CHART_COLORS.cut, barThickness: 50 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, display: false, max: totalBudget },
                y: { stacked: true, display: false }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: tooltipCurrencyCallback
            }
        }
    });
}
// --- 2. Helper Functions ---
function parseMoney(str) {
    if (!str) return 0;
    let s = str + '';
    let val = parseFloat(s.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    if (isNaN(val)) return 0;
    if (s.includes('億')) return val * 100000000;
    else if (s.includes('萬')) return val * 10000;
    else return val * 1000;
}
function formatCurrency(num) {
    let val = parseFloat(num);
    if (isNaN(val) || val === 0) return "0";
    let absVal = Math.abs(val);
    if (absVal >= 1000000000000) return (val / 1000000000000).toFixed(1).replace(/\.0$/, '') + "兆";
    else if (absVal >= 100000000) return (val / 100000000).toFixed(1).replace(/\.0$/, '') + "億";
    else if (absVal >= 10000) return (val / 10000).toFixed(1).replace(/\.0$/, '') + "萬";
    else return val.toLocaleString() + "元";
}
function getColorByType(type) {
    for (const key in categoryColorMap) {
        if (type && type.includes(key)) return categoryColorMap[key];
    }
    return categoryColorMap['其他'];
}
const tooltipCurrencyCallback = {
    callbacks: {
        label: function (context) {
            let label = context.dataset.label || '';
            if (label) { label += ': '; }
            let value = context.raw;
            if (value !== null && value !== undefined) { label += formatCurrency(value); }
            return label;
        }
    }
};

// --- 3. Chart & Render Functions ---

// [v163] Completely Overhauled for Interactive Branch Plans
// [v171] 修正分支計畫分隔符號為 #，避免與文字內容冒號衝突
function renderDetailChartsA(row) {
    // 1. Pie Chart (用途比例) - 維持使用冒號 : 分隔
    let pieLabels = [], pieData = [];
    let usageString = row['用途比例'] || '';
    if (usageString && usageString.includes(':')) {
        usageString.split('|').forEach(item => {
            let parts = item.split(':');
            if (parts.length === 2) {
                pieLabels.push(parts[0].trim());
                pieData.push(parseInt(parts[1].trim()));
            }
        })
    }
    const ctxPie = document.querySelector(".js-chartDetailPie").getContext('2d');
    if (chartPieA) chartPieA.destroy();
    chartPieA = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieData,
                backgroundColor: [CHART_COLORS.cut, categoryColorMap['教育科學文化'], CHART_COLORS.hero, CHART_COLORS.heroSoft, CHART_COLORS.heroSofter],
                borderWidth: 2,
                borderColor: CHART_COLORS.segmentBorder
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: tooltipCurrencyCallback
            }
        }
    });

    // 2. Branch Plans (分支計畫) - [修改] 改用 # 分隔
    const btnContainer = document.querySelector(".js-branch-btn-container");
    const detailDisplay = document.querySelector(".js-branch-detail-display");
    const noDataMsg = document.querySelector(".js-branch-no-data");
    const totalProjectBudget = parseMoney(row['預算金額']);

    btnContainer.innerHTML = ''; // 清空舊按鈕

    let branchString = row['分支計畫'] || '';
    let branches = [];

    if (branchString && (branchString.includes('#') || branchString.includes(':'))) {
        branchString.split('|').forEach(item => {
            // [修改] 優先支援 # 分隔 (新格式)，但也保留對 : 的兼容性 (若未更新資料庫)
            let separator = item.includes('#') ? '#' : ':';
            let parts = item.split(separator);

            if (parts.length >= 2) {
                // 處理說明文字中可能包含分隔符號的情況
                // 名稱 = parts[0], 金額 = parts[1], 說明 = 剩下的全部接起來
                let descText = parts.length > 2 ? parts.slice(2).join(separator).trim() : '無詳細說明';

                branches.push({
                    name: parts[0].trim(),
                    amount: parseMoney(parts[1].trim()),
                    desc: descText
                });
            }
        });
    }

    if (branches.length === 0) {
        detailDisplay.style.display = 'none';
        noDataMsg.style.display = 'block';
        return;
    }

    noDataMsg.style.display = 'none';
    detailDisplay.style.display = 'block';

    // 生成按鈕
    branches.forEach((branch, index) => {
        const btn = document.createElement('button');
        btn.className = 'branch-tag';
        btn.innerText = branch.name;
        btn.onclick = () => showBranchDetail(index, branch, totalProjectBudget, branches);
        btnContainer.appendChild(btn);
    });

    // 初始化顯示第一個分支
    showBranchDetail(0, branches[0], totalProjectBudget, branches);
}

// [v163] New Helper Function for Branch Switching
function showBranchDetail(index, branch, total, allBranches) {
    // Update Active Button
    const btns = document.querySelector(".js-branch-btn-container").children;
    for (let btn of btns) btn.classList.remove('active');
    if (btns[index]) btns[index].classList.add('active');

    // Update Description
    document.querySelector(".js-b-desc-text").innerText = branch.desc;
    document.querySelector(".js-b-desc-container").classList.remove('expanded');
    document.querySelector(".js-b-toggle-btn").innerText = '展開說明';

    // Render Ratio Bar Chart
    const ctx = document.querySelector(".js-chartBranchRatio").getContext('2d');
    if (chartBranchRatio) chartBranchRatio.destroy();

    const restAmount = total - branch.amount;
    const ratio = (total > 0) ? (branch.amount / total * 100).toFixed(1) : 0;

    chartBranchRatio = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['預算比例'],
            datasets: [
                { label: branch.name, data: [branch.amount], backgroundColor: CHART_COLORS.hero, barPercentage: 0.6 },
                { label: '其他計畫', data: [restAmount], backgroundColor: CHART_COLORS.neutralLight, barPercentage: 0.6 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: tooltipCurrencyCallback,
                title: { display: true, text: `該分支佔總計畫 ${ratio}%` }
            }
        }
    });
}

// [v163] Toggle function for Branch Description
function toggleBranchDesc() {
    const container = document.querySelector(".js-b-desc-container");
    const btn = document.querySelector(".js-b-toggle-btn");
    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        btn.innerText = '展開說明';
    } else {
        container.classList.add('expanded');
        btn.innerText = '收合說明';
    }
}

function renderDetailChartsB(row) {
    const total = parseMoney(row['預算金額']);
    const cut = parseMoney(row['刪減金額']);
    const freeze = parseMoney(row['凍結金額']);
    const pass = total - cut - freeze;

    const ctx1 = document.querySelector(".js-chartBResult").getContext('2d');
    if (chartB1) chartB1.destroy();
    chartB1 = new Chart(ctx1, { type: 'bar', data: { labels: ['結果'], datasets: [{ label: '通過', data: [pass], backgroundColor: CHART_COLORS.pass }, { label: '凍結', data: [freeze], backgroundColor: CHART_COLORS.freeze }, { label: '刪減', data: [cut], backgroundColor: CHART_COLORS.cut }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } }, plugins: { tooltip: tooltipCurrencyCallback } } });

    const cCut = parseMoney(row['委員會刪減']);
    const cFreeze = parseMoney(row['委員會凍結']);
    const nCut = parseMoney(row['院會表決刪減'] || row['協商刪減']);
    const nFreeze = parseMoney(row['院會表決凍結'] || row['協商凍結']);
    const fCut = parseMoney(row['通案刪減'] || row['院會刪減']);
    const fFreeze = parseMoney(row['通案凍結'] || row['院會凍結']);

    const ctx2 = document.querySelector(".js-chartBStages").getContext('2d');
    if (chartB2) chartB2.destroy();
    chartB2 = new Chart(ctx2, {
        type: 'bar', data: {
            labels: ['委員會', '院會表決', '通案'],
            datasets: [{ label: '刪減', data: [cCut, nCut, fCut], backgroundColor: CHART_COLORS.cut }, { label: '凍結', data: [cFreeze, nFreeze, fFreeze], backgroundColor: CHART_COLORS.freeze }]
        }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: tooltipCurrencyCallback } }
    });
}

function renderMainCharts() {
    if (mainChartsRendered) return;
    new Chart(document.querySelector(".js-chartYearly").getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['115年度', '114年度', '113年度', '112年度', '111年度', '110年度', '109年度', '108年度', '107年度', '106年度'],
            datasets: [{
                label: '歲出總額',
                data: [3034974371000, 3132468909000, 2881782095000, 2719098790000, 2262064189000, 2161517070000, 2102196982000, 2022029637000, 1991773071000, 1997995520000],
                backgroundColor: CHART_COLORS.hero,
                hoverBackgroundColor: CHART_COLORS.heroSoft,
                borderColor: CHART_COLORS.hero,
                hoverBorderColor: CHART_COLORS.heroSofter
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: tooltipCurrencyCallback }, scales: { y: { ticks: { callback: function (value) { return formatCurrency(value); } } } } }
    });

    const budgetDetails = [
        { label: '社會福利', value: 831800000000, arrow: '▲', display: '8318億' },
        { label: '教育科學文化', value: 556600000000, arrow: '▼', display: '5566億' },
        { label: '國防', value: 548800000000, arrow: '▲', display: '5488億' },
        { label: '經濟發展', value: 427500000000, arrow: '▲', display: '4275億' },
        { label: '一般政務', value: 302600000000, arrow: '▲', display: '3026億' },
        { label: '退休撫卹', value: 184400000000, arrow: '▲', display: '1844億' },
        { label: '債務還本付息', value: 106300000000, arrow: '–', display: '1063億' },
        { label: '補助及其他', value: 50400000000, arrow: '▼', display: '504億' },
        { label: '社區發展及環境保護', value: 26600000000, arrow: '▼', display: '266億' }
    ].map((d) => {
        const hex = allocationColorMap[d.label] || categoryColorMap[d.label] || categoryColorMap['其他'] || '#8e8e93';
        // Keep legend chips solid, but let the banknote background show through the chart.
        return { ...d, colorHex: hex, color: hexToRgba(hex, 0.58) };
    });

    const ctx = document.querySelector(".js-chartAllocation").getContext('2d');
    const totalBudget = budgetDetails.reduce((acc, curr) => acc + curr.value, 0);

    chartAllocationInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['115年度預算結構'], datasets: budgetDetails.map(d => ({ label: d.label, data: [d.value], backgroundColor: d.color, barPercentage: 1.0, categoryPercentage: 1.0 })) },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false, min: 0, max: totalBudget }, y: { stacked: true, display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } }, layout: { padding: 0 } }
    });

    const legendContainer = document.querySelector(".js-chartAllocationLegend");
    if (legendContainer) {
        let legendHtml = '';
        budgetDetails.forEach((ds, index) => {
            const border = isLightHex(ds.colorHex) ? 'border:1px solid rgba(20,22,29,0.22);' : 'border:none;';
            legendHtml += `<div class="legend-item" onclick="updateBillOverlay(${index}, '${ds.label}', '${ds.display}', '${ds.arrow}')"><div class="legend-color-box" style="background-color:${ds.colorHex}; ${border}"></div><span>${ds.label}</span></div>`;
        });
        legendContainer.innerHTML = legendHtml;
    }

    window.updateBillOverlay = function (index, label, display, arrow) {
        const infoOverlay = document.querySelector(".js-bill-info-overlay");
        const arrowLine = document.querySelector(".js-dynamic-arrow");
        infoOverlay.innerHTML = `<p class="bill-info-text">${label} ${display} (${arrow})</p>`;
        document.querySelectorAll('.legend-item').forEach((el, i) => { if (i === index) el.classList.add('active'); else el.classList.remove('active'); });

        if (!chartAllocationInstance) return;

        const meta = chartAllocationInstance.getDatasetMeta(index);
        const bar = meta.data[0];

        if (bar) {
            const containerRect = document.querySelector('.bill-container').getBoundingClientRect();
            const canvasRect = chartAllocationInstance.canvas.getBoundingClientRect();

            const startX_CSS = containerRect.width / 2;
            const startY_CSS = containerRect.height - 5;

            const scaleX_ChartToCSS = canvasRect.width / chartAllocationInstance.width;
            const scaleY_ChartToCSS = canvasRect.height / chartAllocationInstance.height;

            const barCenterX_Internal = (bar.x + bar.base) / 2;
            const barCenterY_Internal = bar.y;

            const targetX_CSS = (canvasRect.left - containerRect.left) + (barCenterX_Internal * scaleX_ChartToCSS);
            const targetY_CSS = (canvasRect.top - containerRect.top) + (barCenterY_Internal * scaleY_ChartToCSS);

            const pathData = `M ${startX_CSS} ${startY_CSS} L ${targetX_CSS} ${targetY_CSS}`;
            arrowLine.setAttribute('d', pathData);
            arrowLine.style.opacity = '1';
        }
    };
    mainChartsRendered = true;
}

// [v175 新增] 首頁總預算圖表 (邏輯同步工作分頁：A表算總額+國防校正、B表算刪凍)
function computeCutFreezeStatsFromPageB(rows) {
    const data = Array.isArray(rows) ? rows : [];

    let cutCount = 0;
    let cutTotal = 0;
    let freezeCount = 0;
    let freezeTotal = 0;

    data.forEach((row) => {
        const type = String(row['資料類型'] || '計畫').trim();
        if (type !== '計畫') return;

        const planId = String(row['計畫編號'] || '').trim();
        const planName = String(row['計畫名稱'] || '').trim();
        if (planId.includes('000000')) return;
        if (planName.includes('統刪')) return;

        const cutMoney = parseMoney(row['刪減金額']);
        const freezeMoney = parseMoney(row['凍結金額']);

        const committeeCut = parseMoney(row['委員會刪減']);
        const committeeFreeze = parseMoney(row['委員會凍結']);
        const floorCut = parseMoney(row['院會表決刪減'] || row['協商刪減']);
        const floorFreeze = parseMoney(row['院會表決凍結'] || row['協商凍結']);
        const generalCut = parseMoney(row['通案刪減'] || row['院會刪減']);
        const generalFreeze = parseMoney(row['通案凍結'] || row['院會凍結']);

        const cutDetailSum = committeeCut + floorCut + generalCut;
        const freezeDetailSum = committeeFreeze + floorFreeze + generalFreeze;

        const isCutCase = (cutMoney > 0) || (cutDetailSum > 0);
        const isFreezeCase = (freezeMoney > 0) || (freezeDetailSum > 0);

        if (isCutCase) {
            cutCount += 1;
            cutTotal += (cutMoney > 0 ? cutMoney : cutDetailSum);
        }
        if (isFreezeCase) {
            freezeCount += 1;
            freezeTotal += (freezeMoney > 0 ? freezeMoney : freezeDetailSum);
        }
    });

    return { cutCount, cutTotal, freezeCount, freezeTotal };
}

function initScrollToTriggers() {
    document.querySelectorAll('.js-scroll-to').forEach((el) => {
        if (el.__scrollToBound) return;
        el.__scrollToBound = true;
        // Make non-button elements keyboard-accessible
        if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        }

        const run = () => {
            const target = (el.getAttribute('data-target') || '').trim();
            if (!target) return;
            if (target.startsWith('http://') || target.startsWith('https://')) {
                window.open(target, '_blank');
                return;
            }
            if (target === 'page-budget' || target === 'page-legislator' || target === 'home') {
                showPage(target);
                return;
            }
            scrollToSection(target);
        };

        const maybeSetActive = () => {
            if (!el.classList.contains('nav-wheel__item')) return;
            document.querySelectorAll('.nav-wheel__item').forEach((n) => n.classList.remove('is-active'));
            el.classList.add('is-active');
            updateNavWheelIndicator();
        };

        el.addEventListener('click', () => {
            maybeSetActive();
            run();
        });
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            maybeSetActive();
            run();
        });

        // Hover 時讓指示條跟著滑鼠所在的 nav-wheel 項目
        if (el.classList.contains('nav-wheel__item')) {
            el.addEventListener('mouseenter', () => {
                updateNavWheelIndicator(el);
            });
            el.addEventListener('mouseleave', () => {
                updateNavWheelIndicator();
            });
        }
    });
}

function initRankSwitches() {
    document.querySelectorAll('.rank-group-block').forEach((block) => {
        const switcher = block.querySelector('.rank-switch');
        const body = block.querySelector('.rank-group-body--switch');
        if (!switcher || !body) return;

        const btns = Array.from(switcher.querySelectorAll('.rank-switch__btn'));
        const panels = Array.from(body.querySelectorAll('.rank-column[data-panel]'));
        if (btns.length < 2 || panels.length < 2) return;

        const setActive = (key) => {
            btns.forEach((b) => {
                const active = b.getAttribute('data-target') === key;
                b.classList.toggle('is-active', active);
                b.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            panels.forEach((p) => p.classList.toggle('is-active', p.getAttribute('data-panel') === key));
        };

        btns.forEach((b) => {
            b.addEventListener('click', () => {
                const key = b.getAttribute('data-target');
                if (!key) return;
                setActive(key);
            });
        });

        const initial = btns.find((b) => b.classList.contains('is-active'))?.getAttribute('data-target') || 'cut';
        setActive(initial);
    });
}

function updateNavWheelIndicator(targetEl) {
    const indicator = document.querySelector('.nav-wheel__indicator');
    const list = document.querySelector('.nav-wheel__list');
    if (!indicator || !list) return;
    const base = targetEl || list.querySelector('.nav-wheel__item.is-active') || list.querySelector('.nav-wheel__item');
    if (!base) return;

    const activeRect = base.getBoundingClientRect();
    const bodyRect = indicator.parentElement?.getBoundingClientRect();
    if (!bodyRect) return;

    const indicatorHeight = Math.min(46, Math.max(28, activeRect.height));
    const top = Math.max(0, (activeRect.top - bodyRect.top) + (activeRect.height - indicatorHeight) / 2);

    indicator.style.height = `${indicatorHeight}px`;
    indicator.style.setProperty('--nav-wheel-indicator-y', `${top}px`);
}

function renderHomeCutFreezeCards() {
    const stats = computeCutFreezeStatsFromPageB(allDataPageB);

    const cutCountEls = document.querySelectorAll(".js-summary-cut-count");
    const freezeCountEls = document.querySelectorAll(".js-summary-freeze-count");
    cutCountEls.forEach((el) => { el.textContent = String(stats.cutCount); });
    freezeCountEls.forEach((el) => { el.textContent = String(stats.freezeCount); });

    const cutAmountEls = document.querySelectorAll(".js-summary-cut-amount");
    const freezeAmountEls = document.querySelectorAll(".js-summary-freeze-amount");

    // For hero summary cards (amount-only), show "X 件 / NT$ Y"
    const cutCombined = `${stats.cutCount} 件 / NT$ ${formatCurrency(stats.cutTotal)}`;
    const freezeCombined = `${stats.freezeCount} 件 / NT$ ${formatCurrency(stats.freezeTotal)}`;

    cutAmountEls.forEach((el) => {
        if (cutCountEls.length === 0) el.textContent = cutCombined;
        else if (el.closest('.summary-card')) el.textContent = cutCombined;
        else el.textContent = formatCurrency(stats.cutTotal);
    });
    freezeAmountEls.forEach((el) => {
        if (freezeCountEls.length === 0) el.textContent = freezeCombined;
        else if (el.closest('.summary-card')) el.textContent = freezeCombined;
        else el.textContent = formatCurrency(stats.freezeTotal);
    });

    // Apply YoY (較去年) placeholders; when prior-year data exists, can show % here
    const cutYoyEls = document.querySelectorAll(".js-summary-cut-yoy");
    const freezeYoyEls = document.querySelectorAll(".js-summary-freeze-yoy");
    const yoyPlaceholder = '—';
    cutYoyEls.forEach((el) => { el.textContent = yoyPlaceholder; });
    freezeYoyEls.forEach((el) => { el.textContent = yoyPlaceholder; });

    const cutNoteEls = document.querySelectorAll(".js-summary-cut-note");
    const freezeNoteEls = document.querySelectorAll(".js-summary-freeze-note");
    const showCutNote = (stats.cutCount === 0 && stats.cutTotal === 0);
    const showFreezeNote = (stats.freezeCount === 0 && stats.freezeTotal === 0);
    cutNoteEls.forEach((el) => { el.hidden = !showCutNote; });
    freezeNoteEls.forEach((el) => { el.hidden = !showFreezeNote; });
}

function renderHomeStatusChart() {
    // 1. 計算總預算 (來源 Page A + 國防部強制校正)
    let rawTotalA = 0;
    // 計算目前資料庫中 0901 和 0902 的總額
    let mndExisting = 0;

    allDataPageA.forEach(p => {
        const amt = parseMoney(p['預算金額']);
        rawTotalA += amt;

        const id = String(p['計畫編號'] || '').trim();
        if (id.startsWith('0901') || id.startsWith('0902')) {
            mndExisting += amt;
        }
    });

    // 國防部正確總額 (本部 17.5億 + 所屬 5596億)
    const mndTarget = 1750857000 + 559611869000;
    const diff = mndTarget - mndExisting;

    // 最終總預算 (A表總和 + 補上國防部差額)
    const totalBudget = rawTotalA + (diff > 0 ? diff : 0);

    // 2. 計算刪減與凍結 (來源 Page B)
    let totalCut = 0;
    let totalFreeze = 0;

    allDataPageB.forEach(r => {
        totalCut += parseMoney(r['刪減金額']);
        totalFreeze += parseMoney(r['凍結金額']);
    });

    // 3. 計算通過金額
    const totalPass = totalBudget - totalCut - totalFreeze;

    // 4. 繪製圖表
    const ctxStatus = document.querySelector(".js-chartStatusB");
    if (ctxStatus) {
        if (chartStatusInstance) { chartStatusInstance.destroy(); }

        chartStatusInstance = new Chart(ctxStatus.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['總體審查結果'],
                datasets: [
                    { label: '通過', data: [totalPass], backgroundColor: CHART_COLORS.pass, barThickness: 40 },
                    { label: '凍結', data: [totalFreeze], backgroundColor: CHART_COLORS.freeze, barThickness: 40 },
                    { label: '刪減', data: [totalCut], backgroundColor: CHART_COLORS.cut, barThickness: 40 }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, display: false, max: totalBudget }, // 設定 max 確保比例正確
                    y: { stacked: true, display: false }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: tooltipCurrencyCallback
                }
            }
        });
    }
}
// --- 4. UI & Data Functions ---
function showPage(pageId) {
    const pageMap = {
        'home': 'index.html',
        'page-budget': 'budget.html',
        'page-legislator': 'legislators.html'
    };
    const url = pageMap[pageId];
    if (url) window.location.href = url;
}

function scrollToSection(sectionId) {
    const resolvedId = window.NavigationState ? window.NavigationState.resolveSectionId(sectionId) : sectionId;
    const el = document.getElementById(resolvedId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    const sectionPageMap = {
        'section-review-progress': 'index.html',
        'section-review-stats': 'index.html',
        'section-agency-review-home': 'index.html',
        'section-allocation-115': 'index.html',
        'section-ministry-compare': 'index.html',
        'section-ministry-detail': 'index.html',
        'section-search': 'budget.html',
        'section-plan-search-home': 'budget.html'
    };
    const targetPage = sectionPageMap[resolvedId];
    if (targetPage) window.location.href = targetPage + '#' + resolvedId;
}

function handleNavSearch(val) {
    if (currentPage === 'budget') {
        const budgetInput = document.querySelector(".js-search-budget-input");
        if (budgetInput) { budgetInput.value = val; handleSearchBudget(val); }
    } else {
        window.location.href = 'budget.html?q=' + encodeURIComponent((val || '').trim());
    }
}

// SPEC v1: 側欄點擊（外連 / 切頁 / 錨點）
function initSidebarNav() {
    const list = document.querySelector(".js-sidebar-nav-list");
    if (!list) return;
    list.addEventListener('click', function (e) {
        const a = e.target.closest('a[data-action]');
        if (!a) return;
        e.preventDefault();
        const action = a.getAttribute('data-action');
        if (action === 'external') {
            window.open(a.getAttribute('data-href'), '_blank');
            return;
        }
        if (action === 'page') {
            showPage(a.getAttribute('data-page'));
            return;
        }
        if (action === 'anchor') {
            const id = a.getAttribute('href').replace('#', '');
            scrollToSection(id);
        }
    });
}

// SPEC v1: 浮動回到頁首
function initFloatBackTop() {
    const btn = document.querySelector(".js-float-back-top");
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// SPEC v1: Nav 選單展開（手機）
function initNavToggle() {
    const toggle = document.querySelector(".js-nav-toggle");
    const menu = document.querySelector(".js-nav-menu");
    if (toggle && menu) toggle.addEventListener('click', () => menu.classList.toggle('is-open'));
}

function switchTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (tabName === 'plan') {
        document.querySelector('.modal-tab:first-child').classList.add('active');
        document.querySelector(".js-tab-content-plan").classList.add('active');
    } else {
        document.querySelector('.modal-tab:last-child').classList.add('active');
        document.querySelector(".js-tab-content-review").classList.add('active');
    }
    setTimeout(() => {
        const modalBody = document.querySelector('#unifiedModal .modal-body-area');
        if (modalBody) modalBody.scrollTop = 0;
    }, 0);
}

function toggleDesc() {
    const container = document.querySelector(".js-u-desc-container");
    const btn = document.querySelector(".js-toggle-desc-btn");
    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        btn.innerText = '展開閱讀全文';
    } else {
        container.classList.add('expanded');
        btn.innerText = '收合內容';
    }
}

function closeModal(e, modalId) {
    if (e && e.target !== e.currentTarget && e.target.className !== 'close-btn') return;
    if (window.ModalRenderers && typeof window.ModalRenderers.hideModal === 'function') {
        window.ModalRenderers.hideModal(modalId);
        return;
    }
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
}

async function jumpToProjectB(projectId) {
    if (currentPage !== 'budget') {
        window.location.href = 'budget.html?plan=' + encodeURIComponent(String(projectId).trim());
        return;
    }
    const loader = document.querySelector(".js-loader");
    if (loader) loader.style.display = 'flex';
    if (allDataPageA.length === 0) await fetchData('page-a', true);
    if (allDataPageB.length === 0) await fetchData('page-b', true);
    const targetId = String(projectId).trim();
    openUnifiedDetail(targetId);
    switchTab('review');
    if (loader) loader.style.display = 'none';
}

async function jumpToC(name) {
    if (currentPage !== 'legislators') {
        window.location.href = 'legislators.html?name=' + encodeURIComponent(String(name).trim());
        return;
    }
    const loader = document.querySelector(".js-loader");
    if (loader) loader.style.display = 'flex';
    closeModal(null, 'unifiedModal');
    if (allDataPageC.length === 0) { try { await fetchData('page-c'); } catch (e) { if (loader) loader.style.display = 'none'; return; } }
    const targetName = String(name).trim();
    const target = allDataPageC.find(r => String(r['委員姓名']).trim() === targetName);
    if (loader) loader.style.display = 'none';
    if (target) { const str = encodeURIComponent(JSON.stringify(target)); openDetailC(str); }
    else { alert(`查無此委員資料 (${targetName})`); }
}

// [v162] Restored openDetailC Function + Update button logic to includes('000000')
// [v166/167 新增功能] 支援時間戳記與進度日期
// [v170] 立委詳情函式：含時間戳記 + 日期格式化 (YYYY/MM/DD)
// [v171] 支援雙表格獨立時間戳記 (右下角顯示)
function openDetailC(jsonStr) {
    const data = JSON.parse(decodeURIComponent(jsonStr));

    // 1. 設定基本資料
    document.querySelector(".js-mc-name").innerText = data['委員姓名'] || '-';

    const party = data['黨籍'] || '無黨籍';
    const partyEl = document.querySelector(".js-mc-party");
    partyEl.innerText = party;

    let partyClass = 'tag-other';
    if (party.includes('民進')) partyClass = 'tag-dpp';
    else if (party.includes('國民')) partyClass = 'tag-kmt';
    else if (party.includes('民眾')) partyClass = 'tag-tpp';

    partyEl.className = `leg-party-tag ${partyClass}`;

    // 2. [修改] 處理兩個不同的更新時間

    // Helper: 日期格式化函式
    const formatUpdateDate = (dateStr) => {
        if (!dateStr) return '無更新紀錄';
        if (typeof dateStr === 'number' && !Number.isNaN(dateStr)) {
            const d = new Date(dateStr);
            if (!Number.isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}/${m}/${day}`;
            }
        }

        let str = dateStr.toString();
        if (/^\d{12,14}$/.test(str)) {
            const n = parseInt(str, 10);
            if (!Number.isNaN(n)) return formatUpdateDate(n);
        }
        if (str.startsWith('Date')) {
            const dParts = str.match(/\d+/g);
            if (dParts && dParts.length >= 3) {
                const y = parseInt(dParts[0]);
                const m = parseInt(dParts[1]) + 1;
                const d = parseInt(dParts[2]);
                const mm = m < 10 ? '0' + m : m;
                const dd = d < 10 ? '0' + d : d;
                return `${y}/${mm}/${dd}`;
            }
        }
        return str;
    };

    // 讀取並填入「刪減案」更新時間
    const cutTime = formatUpdateDate(data['刪減案更新時間']); // 需確認資料庫欄位名稱
    const cutEl = document.querySelector(".js-mc-updated-cut");
    if (cutEl) cutEl.innerText = `資料更新時間：${cutTime}`;

    // 讀取並填入「凍結案」更新時間
    const freezeTime = formatUpdateDate(data['凍結案更新時間']); // 需確認資料庫欄位名稱
    const freezeEl = document.querySelector(".js-mc-updated-freeze");
    if (freezeEl) freezeEl.innerText = `資料更新時間：${freezeTime}`;


    // 3. 設定頭像 (不變)
    const avatarEl = document.querySelector(".js-mc-avatar");
    avatarEl.innerHTML = '';
    const imgPath = getLegislatorPhotoSrc(data['委員姓名'], party, data['照片']);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'default-icon';
    iconSpan.style.zIndex = '1';
    iconSpan.innerText = '🧑‍💼';

    const imgEl = document.createElement('img');
    if (imgPath) imgEl.src = imgPath;
    imgEl.style.position = 'absolute';
    imgEl.style.top = '0'; imgEl.style.left = '0';
    imgEl.style.width = '100%'; imgEl.style.height = '100%';
    imgEl.style.objectFit = 'cover'; imgEl.style.objectPosition = 'center 25%';
    imgEl.style.display = 'none';

    imgEl.onload = function () { this.style.display = 'block'; iconSpan.style.display = 'none'; };
    imgEl.onerror = function () { this.style.display = 'none'; };

    avatarEl.appendChild(iconSpan);
    avatarEl.appendChild(imgEl);

    // 4. 生成提案表格 (含日期欄位與格式化) (不變)
    const details = data['提案明細'] || '';
    const cutsTbody = document.querySelector(".js-table-cut-c");
    const freezesTbody = document.querySelector(".js-table-freeze-c");
    cutsTbody.innerHTML = ''; freezesTbody.innerHTML = '';

    const noDataHtml = '<tr><td colspan="6" style="text-align:center; color:#999;">無資料</td></tr>';

    if (!details) {
        cutsTbody.innerHTML = noDataHtml;
        freezesTbody.innerHTML = noDataHtml;
    } else {
        details.split('|').forEach(item => {
            const parts = item.split('#');
            if (parts.length >= 8) {
                const projectId = parts[5] ? parts[5].trim() : '';
                const isAgencyLevel = projectId.includes('000000') || parts[1].includes('統刪');
                const btnHtml = (projectId && !isAgencyLevel) ? `<br><button class="jump-btn" onclick="jumpToProjectB('${projectId}')">查看計畫</button>` : '';

                const manualResult = parts[6] ? parts[6].trim() : '-';
                const dateRaw = parts[7] ? parts[7].trim() : '-';

                // 表格內的日期也套用同樣的格式化 (選用)
                let displayDate = formatUpdateDate(dateRaw);
                if (displayDate === '無更新紀錄') displayDate = '-';

                let resultText = `<span style="font-weight:bold; color:var(--primary-color);">${manualResult}</span>`;

                const rowHtml = `<tr>
                            <td style="font-size:0.85rem; color:#666; font-weight:bold; white-space:nowrap;">${displayDate}</td>
                            <td>${parts[1]}${btnHtml}</td>
                            <td>${parts[2]}</td>
                            <td>${parts[3]}</td>
                            <td>${parts[4]}</td>
                            <td>${resultText}</td>
                        </tr>`;

                if (parts[0].includes('刪減')) cutsTbody.innerHTML += rowHtml;
                else freezesTbody.innerHTML += rowHtml;
            }
            // Fallback (舊格式)
            else if (parts.length === 7) {
                const projectId = parts[5] ? parts[5].trim() : '';
                const isAgencyLevel = projectId.includes('000000') || parts[1].includes('統刪');
                const btnHtml = (projectId && !isAgencyLevel) ? `<br><button class="jump-btn" onclick="jumpToProjectB('${projectId}')">查看計畫</button>` : '';
                const manualResult = parts[6] ? parts[6].trim() : '-';
                let resultText = `<span style="font-weight:bold; color:var(--primary-color);">${manualResult}</span>`;

                const rowHtml = `<tr>
                            <td>-</td>
                            <td>${parts[1]}${btnHtml}</td>
                            <td>${parts[2]}</td>
                            <td>${parts[3]}</td>
                            <td>${parts[4]}</td>
                            <td>${resultText}</td>
                        </tr>`;
                if (parts[0].includes('刪減')) cutsTbody.innerHTML += rowHtml;
                else freezesTbody.innerHTML += rowHtml;
            }
        });
    }

    if (cutsTbody.innerHTML === '') cutsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">無刪減提案</td></tr>';
    if (freezesTbody.innerHTML === '') freezesTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">無凍結提案</td></tr>';

    if (window.ModalRenderers && typeof window.ModalRenderers.showModal === 'function') {
        window.ModalRenderers.showModal('detailModalC');
    } else {
        document.querySelector(".js-detailModalC").style.display = 'flex';
    }
}

// --- 5. Data Processing Logic (ALL functions here) ---
function parseUsageString(usageStr) {
    let breakdown = { '人事費': 0, '業務費': 0, '設備及投資': 0, '獎補助費': 0, '債務費': 0, '預備金': 0 };
    if (!usageStr) return breakdown;
    usageStr.split('|').forEach(item => {
        const parts = item.split(':');
        if (parts.length === 2) {
            let key = parts[0].trim();
            let val = parseMoney(parts[1]);
            if (key.includes('人事')) breakdown['人事費'] += val;
            else if (key.includes('業務')) breakdown['業務費'] += val;
            else if (key.includes('設備') || key.includes('投資')) breakdown['設備及投資'] += val;
            else if (key.includes('補助') || key.includes('獎助')) breakdown['獎補助費'] += val;
            else if (key.includes('債務')) breakdown['債務費'] += val;
            else if (key.includes('預備')) breakdown['預備金'] += val;
        }
    });
    return breakdown;
}

// [v155] Fixed calculateAgencyStats to handle loose match
function calculateAgencyStats(agencyName) {
    // [v155 Fix] Separate 0901 and 0902 Logic
    let agencyProjects = [];
    let agencyTotalBudget = 0;
    let forceValue = 0;

    if (agencyName === '國防部' || (agencyName.includes('國防') && !agencyName.includes('所屬'))) {
        // 0901 Case
        agencyProjects = allDataPageA.filter(p => String(p['計畫編號']).trim().startsWith('0901'));
        agencyTotalBudget = agencyProjects.reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);
        forceValue = 1750857000;
    } else if (agencyName.includes('國防部所屬') || (agencyName.includes('國防') && agencyName.includes('所屬'))) {
        // 0902 Case
        agencyProjects = allDataPageA.filter(p => String(p['計畫編號']).trim().startsWith('0902'));
        agencyTotalBudget = agencyProjects.reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);
        forceValue = 559611869000;
    } else {
        // Normal Case
        agencyProjects = allDataPageA.filter(p => (p['主管機關'] || '').includes(agencyName));
        agencyTotalBudget = agencyProjects.reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);
    }

    // Apply Force Value if incomplete
    if (forceValue > 0 && agencyTotalBudget < forceValue) {
        agencyTotalBudget = forceValue;
    }

    let agencyUsageTotal = { '人事費': 0, '業務費': 0, '設備及投資': 0, '獎補助費': 0, '債務費': 0, '預備金': 0 };
    agencyProjects.forEach(p => {
        const breakdown = parseUsageString(p['用途比例']);
        for (let k in agencyUsageTotal) {
            agencyUsageTotal[k] += breakdown[k];
        }
    });

    const agencyReviews = allDataPageB.filter(r => (r['主管機關'] || '').includes(agencyName));
    let totalCut = 0, totalFreeze = 0;
    agencyReviews.forEach(r => {
        totalCut += parseMoney(r['刪減金額']);
        totalFreeze += parseMoney(r['凍結金額']);
    });

    return {
        totalBudget: agencyTotalBudget,
        usageBreakdown: agencyUsageTotal,
        totalCut: totalCut,
        totalFreeze: totalFreeze
    };
}

// [v175 修改] 只負責計算排行榜，移除圖表繪製 (移至 renderHomeStatusChart)
function processPageBData(data) {
    let deptStats = {};
    allDataPageB_Plans = [];

    data.forEach(row => {
        const cut = parseMoney(row['刪減金額']);
        const freeze = parseMoney(row['凍結金額']);
        const dept = row['主管機關'] || '其他';
        const type = row['資料類型'] || '計畫';

        // 排行榜統計
        if (!deptStats[dept]) deptStats[dept] = { name: dept, cut: 0, freeze: 0 };
        deptStats[dept].cut += cut;
        deptStats[dept].freeze += freeze;

        // 收集計畫資料給排行榜用
        if (type === '計畫') {
            allDataPageB_Plans.push(row);
        }
    });

    // 渲染部會排行榜
    const deptArray = Object.values(deptStats);
    renderRankList('rank-dept-cut', [...deptArray].sort((a, b) => b.cut - a.cut).slice(0, 5), 'cut');
    renderRankList('rank-dept-freeze', [...deptArray].sort((a, b) => b.freeze - a.freeze).slice(0, 5), 'freeze');

    // 渲染計畫排行榜
    const planArray = allDataPageB_Plans.map(r => ({
        name: (r['主管機關'] ? r['主管機關'] + '/' : '') + r['計畫名稱'],
        cut: parseMoney(r['刪減金額']),
        freeze: parseMoney(r['凍結金額'])
    })).filter(r => r.name);

    renderRankList('rank-plan-cut', [...planArray].sort((a, b) => b.cut - a.cut).slice(0, 5), 'cut');
    renderRankList('rank-plan-freeze', [...planArray].sort((a, b) => b.freeze - a.freeze).slice(0, 5), 'freeze');
}

// [v142] Restored; party filter + sort applied together
function filterLegislators(party) {
    const btns = document.querySelectorAll('.filter-tag');
    if (btns.length) {
        btns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.party === party) btn.classList.add('active');
        });
    }
    applyLegislatorFilterAndSort();
}

function sortLegislators(data, sortBy, order) {
    const key = sortBy || '刪減案數';
    const asc = order === 'asc';
    return [...data].sort((a, b) => {
        const va = Number(a[key]) || 0;
        const vb = Number(b[key]) || 0;
        return asc ? va - vb : vb - va;
    });
}

function applyLegislatorFilterAndSort() {
    const container = document.querySelector(".js-leg-container-c");
    if (!container || !allDataPageC || allDataPageC.length === 0) return;
    const activeBtn = document.querySelector('.filter-tag.active');
    const party = (activeBtn && activeBtn.dataset.party) ? activeBtn.dataset.party : 'all';
    let filtered = party === 'all' ? allDataPageC : allDataPageC.filter(r => (r['黨籍'] || '').includes(party));
    const sortByEl = document.getElementById('leg-sort-by');
    const orderEl = document.getElementById('leg-sort-order');
    const sortBy = (sortByEl && sortByEl.value) || '刪減案數';
    const order = (orderEl && orderEl.value) || 'desc';
    const sorted = sortLegislators(filtered, sortBy, order);
    renderLegislatorGrid(sorted);
}

// [v142] Restored
function initMinistrySection() {
    const ministrySelect = document.getElementById("filter-ministry");
    if (!ministrySelect) return;
    if (!allDataPageA || allDataPageA.length === 0) return;
    const ministries = [...new Set(allDataPageA.map(item => item['所屬部會']))].filter(m => m).sort();
    let html = '<option value="">請選擇所屬部會</option>';
    ministries.forEach(m => { html += `<option value="${m}">${m}</option>`; });
    ministrySelect.innerHTML = html;
}

// [v161] Restored: Ministry Section logic with MND 0902 force fix
function updateMinistryStats() {
    const ministrySelect = document.getElementById("filter-ministry");
    const unitSelect = document.getElementById("filter-unit");
    if (!ministrySelect || !unitSelect) return;
    const selectedMinistry = ministrySelect.value;

    if (selectedMinistry) {
        const agencies = [...new Set(allDataPageA
            .filter(d => d['所屬部會'] === selectedMinistry)
            .map(d => d['主管機關']))]
            .filter(a => a).sort();

        const lastMinistry = unitSelect.getAttribute('data-last-ministry');
        if (lastMinistry !== selectedMinistry) {
            let html = '<option value="">全部主管機關 (總計)</option>';
            agencies.forEach(a => { html += `<option value="${a}">${a}</option>`; });
            unitSelect.innerHTML = html;
            unitSelect.value = "";
            unitSelect.setAttribute('data-last-ministry', selectedMinistry);
        }
    } else {
        unitSelect.innerHTML = '<option value="">請選擇主管機關 (全部)</option>';
        unitSelect.value = "";
    }

    const selectedAgency = unitSelect.value;
    const statsSection = document.querySelector('.js-ministry-stats-section');
    let currentData = [];

    // [v161] Special Handling for MND Subordinate (0902)
    if (selectedMinistry === '國防部' && selectedAgency === '國防部所屬') {
        currentData = allDataPageA.filter(d => String(d['計畫編號']).trim().startsWith('0902'));
    } else if (selectedMinistry) {
        if (selectedAgency) { currentData = allDataPageA.filter(d => d['主管機關'] === selectedAgency); }
        else { currentData = allDataPageA.filter(d => d['所屬部會'] === selectedMinistry); }
    } else {
        const valThisYear = document.querySelector(".js-val-this-year");
        const valLastYear = document.querySelector(".js-val-last-year");
        const valGrowth = document.querySelector(".js-val-growth");
        if (valThisYear) valThisYear.innerText = '-';
        if (valLastYear) valLastYear.innerText = '-';
        if (valGrowth) valGrowth.innerText = '-';
        if (chartMinistryBar) chartMinistryBar.destroy();
        if (chartMinistryPie) chartMinistryPie.destroy();
        if (statsSection) statsSection.style.display = 'none';
        return;
    }

    if (!currentData.length) {
        if (statsSection) statsSection.style.display = 'none';
        if (chartMinistryBar) chartMinistryBar.destroy();
        if (chartMinistryPie) chartMinistryPie.destroy();
        return;
    }

    let totalThisYear = 0, totalLastYear = 0;
    let pieMap = {};

    currentData.forEach(d => {
        const thisYear = parseMoney(d['預算金額']);
        const lastYear = parseMoney(d['114年預算金額'] || 0);
        totalThisYear += thisYear;
        totalLastYear += lastYear;
        const category = d['政事別'] || '其他';
        pieMap[category] = (pieMap[category] || 0) + thisYear;
    });

    // [v161] Force Values for MND
    if (selectedMinistry === '國防部' && selectedAgency === '國防部所屬') {
        if (totalThisYear < 559611869000) totalThisYear = 559611869000;
    } else if (selectedMinistry === '國防部' && selectedAgency === '國防部') {
        if (totalThisYear < 1750857000) totalThisYear = 1750857000;
    }

    const pieLabels = Object.keys(pieMap);
    const pieData = Object.values(pieMap);
    const pieColors = pieLabels.map(label => getColorByType(label));

    let growth = 0;
    if (totalLastYear > 0) { growth = ((totalThisYear - totalLastYear) / totalLastYear) * 100; }

    const valThisYear = document.querySelector(".js-val-this-year");
    const valLastYear = document.querySelector(".js-val-last-year");
    const growthEl = document.querySelector(".js-val-growth");

    if (valThisYear) valThisYear.innerText = formatCurrency(totalThisYear);
    if (valLastYear) valLastYear.innerText = formatCurrency(totalLastYear);

    if (growthEl) {
        if (totalLastYear === 0) {
            growthEl.innerText = "無去年資料";
            growthEl.className = 'val js-val-growth';
            growthEl.style.color = '';
        } else {
            growthEl.innerText = (growth > 0 ? '+' : '') + growth.toFixed(1) + '%';
            growthEl.className = 'val js-val-growth ' + (growth > 0 ? 'm-trend-up' : 'm-trend-down');
            growthEl.style.color = getDivergingColor(growth);
        }
    }

    if (statsSection) statsSection.style.display = 'block';

    const chartBarEl = document.querySelector(".js-chartMinistryBar");
    if (chartBarEl) {
        const ctxBar = chartBarEl.getContext('2d');
        if (chartMinistryBar) chartMinistryBar.destroy();
        chartMinistryBar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['今年預算', '去年預算'],
                datasets: [{ label: '金額', data: [totalThisYear, totalLastYear], backgroundColor: [CHART_COLORS.hero, CHART_COLORS.neutralMid], barThickness: 40 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipCurrencyCallback }, scales: { x: { ticks: { callback: function (value) { return formatCurrency(value); } } } } }
        });

        const ctxPie = document.querySelector(".js-chartMinistryPie").getContext('2d');
        if (chartMinistryPie) chartMinistryPie.destroy();
        chartMinistryPie = new Chart(ctxPie, {
            type: 'pie',
            data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 2, borderColor: CHART_COLORS.segmentBorder }] },
        });
    }
}

// --- 6. Render Functions ---

// [v142] Restored
function renderRankList(elementId, list, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!list || list.length === 0) { el.innerHTML = '<li style="color:#999;">無資料</li>'; return; }
    let html = '';
    list.slice(0, 5).forEach((item, index) => {
        const val = type === 'cut' ? item.cut : item.freeze;
        const valDisplay = formatCurrency(val);
        const colorClass = type === 'cut' ? 'color-cut' : 'color-freeze';
        html += `<li><div class="rank-row-main"><span class="rank-idx">${index + 1}</span> ${item.name}</div><div class="rank-row-val ${colorClass}">${valDisplay}</div></li>`;
    });
    el.innerHTML = html;
}

// [v142] Restored
function renderLegislatorGrid(data) {
    const container = document.querySelector(".js-leg-container-c");
    if (!data || data.length === 0) { container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">無資料</p>'; return; }

    let html = '';
    data.forEach(row => {
        const name = row['委員姓名'] || '未知委員';
        const party = row['黨籍'] || '無黨籍';
        const photoPath = getLegislatorPhotoSrc(name, party, row['照片']);
        const imgHtml = photoPath
            ? `<img src="${photoPath}" 
                             style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; object-position: center 25%; display:none;" 
                             onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
                             onerror="this.style.display='none';">`
            : '';

        let partyClass = 'tag-other';
        if (party.includes('民進')) partyClass = 'tag-dpp';
        else if (party.includes('國民')) partyClass = 'tag-kmt';
        else if (party.includes('民眾')) partyClass = 'tag-tpp';

        // 編碼整行資料，傳給 openDetailC
        const rowStr = encodeURIComponent(JSON.stringify(row));

        html += `
                <div class="leg-card" onclick="openDetailC('${rowStr}')">
                    <div class="leg-avatar" id="avatar-${name}" style="position:relative; overflow:hidden;">
                        <span class="default-icon" style="z-index:1;">🧑‍💼</span>
                        ${imgHtml}
                    </div>
                    <div class="leg-name">${name}</div>
                    <span class="leg-party-tag ${partyClass}">${party}</span>
                    <div class="leg-stats-box">
                        <div class="stat-item"><span class="stat-val" style="color:var(--danger-color);">${row['刪減案數'] || 0}</span><span class="stat-label">刪減案</span></div>
                        <div class="stat-item"><span class="stat-val" style="color:var(--freeze-color);">${row['凍結案數'] || 0}</span><span class="stat-label">凍結案</span></div>
                        <div class="stat-item"><span class="stat-val" style="color:var(--pen-color-main-resolution);">${row['主決議數'] || 0}</span><span class="stat-label">主決議</span></div>
                    </div>
                </div>`;
    });
    container.innerHTML = html;
}

// [v153] Updated renderProposalTable
function renderProposalTable(data) {
    const container = document.querySelector(".js-proposal-table-body");
    if (!container) return;
    container.innerHTML = '';

    let proposalsStr = data['提案紀錄'] || '';
    if (!proposalsStr) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">無提案紀錄</td></tr>';
        return;
    }

    let rows = '';
    proposalsStr.split('|').forEach(p => {
        let parts = p.split(':');
        if (parts.length >= 4) { // Expect 4 parts: Name:Type:Item:Reason
            const name = parts[0].trim();
            const type = parts[1].trim();
            const item = parts[2].trim();
            const reason = parts[3].trim();

            const linkHtml = `<span class="clickable-link" onclick="jumpToC('${name}')">${name}</span>`;

            rows += `<tr>
                        <td>${linkHtml}</td>
                        <td>${item}</td>
                        <td><span class="p-tag ${type.includes('刪') ? 'p-cut' : 'p-freeze'}">${type}</span></td>
                        <td>${reason}</td>
                    </tr>`;
        } else {
            // Fallback for old data or incorrect format
            rows += `<tr><td colspan="4">${p}</td></tr>`;
        }
    });
    container.innerHTML = rows;
}

// [v162] Fixed displayUnifiedBlocks to hide agency-level or 'general cut' items
function displayUnifiedBlocks(data, targetContainer) {
    const container = targetContainer || document.querySelector(".js-results-container-budget");

    const validData = data.filter(row => {
        const amt = parseMoney(row['預算金額']);
        const cut = parseMoney(row['刪減金額']);
        const freeze = parseMoney(row['凍結金額']);
        // Allow if budget is > 0 OR if there are cuts/freezes (even if budget is 0)
        const hasValue = (amt !== 0 || cut !== 0 || freeze !== 0);

        // [v162 Fix] Using includes('000000') to catch all agency levels
        const isAgencySummary = (row['計畫編號'] || '').trim().includes('000000');
        const isGeneralCut = (row['計畫名稱'] || '').includes('統刪');

        return hasValue && !isAgencySummary && !isGeneralCut;
    });

    if (!validData || validData.length === 0) {
        container.innerHTML = '<p align="center" style="color:#999; padding:30px; font-size:1.1rem;">查無資料</p>';
        return;
    }

    let html = '';
    validData.forEach(row => {
        const id = row['計畫編號'];
        const amountRaw = parseMoney(row['預算金額']);
        html += `<div class="project-block" onclick="openUnifiedDetail('${id}')">
                    <div class="pb-info">
                        <span class="pb-dept">${row['主管機關']}</span>
                        <h3 class="pb-title">${row['計畫名稱']}</h3>
                    </div>
                    <div class="pb-amount">${formatCurrency(amountRaw)}</div>
                </div>`;
    });
    container.innerHTML = html;
}
// --- [v174] 搜尋與分頁系統 ---

// 全域變數：記錄目前的搜尋結果與頁碼
let currentSearchResults = [];
let searchCurrentPage = 1;
const ITEMS_PER_PAGE = 5;
let currentSearchKeyword = '';

function syncSearchInputs(keyword) {
    if (window.DashboardRenderers && typeof window.DashboardRenderers.syncSearchInputs === 'function') {
        window.DashboardRenderers.syncSearchInputs(keyword);
        return;
    }
    const normalized = (keyword || '').trim();
    const homeInput = document.querySelector(".js-search-home-input");
    const budgetInput = document.querySelector(".js-search-budget-input");
    if (homeInput && homeInput.value !== normalized) homeInput.value = normalized;
    if (budgetInput && budgetInput.value !== normalized) budgetInput.value = normalized;
}

function updateHomeSearchCtaVisibility() {
    if (window.DashboardRenderers && typeof window.DashboardRenderers.updateHomeSearchCtaVisibility === 'function') {
        window.DashboardRenderers.updateHomeSearchCtaVisibility(currentSearchResults.length, ITEMS_PER_PAGE);
        return;
    }
    const cta = document.querySelector(".js-home-search-cta");
    if (!cta) return;
    cta.style.display = currentSearchResults.length > ITEMS_PER_PAGE ? 'block' : 'none';
}

function goToFullSearchResults() {
    if (currentPage === 'budget') {
        const section = document.getElementById('section-search');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const keyword = currentSearchKeyword || '';
        window.location.href = 'budget.html?q=' + encodeURIComponent(keyword);
    }
}
window.goToFullSearchResults = goToFullSearchResults;

// 1. 處理搜尋 (含分支計畫搜尋 + 符號過濾)
function handleSearchBudget(val) {
    const container = document.querySelector(".js-results-container-budget");
    const pagination = document.querySelector(".js-pagination-budget");
    currentSearchKeyword = (val || '').trim();
    syncSearchInputs(currentSearchKeyword);

    // 重置分頁
    searchCurrentPage = 1;

    if (!currentSearchKeyword) {
        container.innerHTML = '<p align="center" style="color:#999; padding:30px; font-size:1.1rem;">請輸入關鍵字開始搜尋...</p>';
        pagination.innerHTML = ''; // 清空分頁
        currentSearchResults = [];
        const homeContainer = document.querySelector(".js-results-container-home");
        if (homeContainer) homeContainer.innerHTML = '<p align="center" style="color:#999; padding:20px;">請輸入關鍵字開始搜尋，結果將顯示於此</p>';
        updateHomeSearchCtaVisibility();
        return;
    }

    if (window.SearchEngine && typeof window.SearchEngine.filterBudgetPlans === 'function') {
        currentSearchResults = window.SearchEngine.filterBudgetPlans(allDataPageA, currentSearchKeyword, parseMoney);
    } else {
        const keywords = currentSearchKeyword.toLowerCase().replace(/\s+and\s+/g, ' ').split(/\s+/).filter(k => k.trim() !== '');
        currentSearchResults = allDataPageA.filter(r => {
            const amt = parseMoney(r['預算金額']);
            const planId = (r['計畫編號'] || '').trim();
            const planName = (r['計畫名稱'] || '');
            if (amt === 0 && !r['刪減金額']) return false;
            if (planId.includes('000000') || planName.includes('統刪')) return false;
            const cleanText = (planName + (r['工作內容'] || '') + (r['主管機關'] || '') + (r['分支計畫'] || ''))
                .toLowerCase()
                .replace(/(\d+\.|\(\d+\)|<\d+>|（\d+）)/g, '');
            return keywords.every(k => cleanText.includes(k));
        });
    }

    renderPagedResults();
    if (document.querySelector(".js-home").classList.contains('active')) {
        const homeContainer = document.querySelector(".js-results-container-home");
        if (homeContainer && currentSearchResults.length > 0) displayUnifiedBlocks(currentSearchResults.slice(0, ITEMS_PER_PAGE), homeContainer);
        else if (homeContainer) homeContainer.innerHTML = '<p align="center" style="color:#999; padding:20px;">查無資料</p>';
    }
    updateHomeSearchCtaVisibility();
    if (window.NavigationState) window.NavigationState.saveSearchState(currentSearchKeyword, searchCurrentPage);
}

// 2. 渲染分頁結果
function renderPagedResults() {
    const container = document.querySelector(".js-results-container-budget");
    const pagination = document.querySelector(".js-pagination-budget");

    if (currentSearchResults.length === 0) {
        container.innerHTML = '<p align="center" style="color:#999; padding:30px; font-size:1.1rem;">查無資料</p>';
        pagination.innerHTML = '';
        return;
    }

    // 計算切片
    const start = (searchCurrentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = currentSearchResults.slice(start, end);

    // 呼叫顯示函式 (顯示區塊)
    displayUnifiedBlocks(pageData);

    // 渲染分頁按鈕
    renderPaginationControls();
}

// Use unified displayUnifiedBlocks logic (deleted duplicate declaration).

// 4. 渲染分頁按鈕控制項
function renderPaginationControls() {
    const pagination = document.querySelector(".js-pagination-budget");
    const totalPages = Math.ceil(currentSearchResults.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // 上一頁
    html += `<button class="page-btn" onclick="changeSearchPage(${searchCurrentPage - 1})" ${searchCurrentPage === 1 ? 'disabled' : ''}>&lt;</button>`;

    // 頁碼邏輯 (最多顯示 5 個數字，保持當前頁在中間)
    let startPage = Math.max(1, searchCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === searchCurrentPage ? 'active' : ''}" onclick="changeSearchPage(${i})">${i}</button>`;
    }

    // 下一頁
    html += `<button class="page-btn" onclick="changeSearchPage(${searchCurrentPage + 1})" ${searchCurrentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;

    // 顯示總筆數資訊
    html += `<div style="width:100%; text-align:center; font-size:0.85rem; color:#888; margin-top:5px;">共 ${currentSearchResults.length} 筆資料</div>`;

    pagination.innerHTML = html;
}

// 5. 切換頁面函式
function changeSearchPage(page) {
    const totalPages = Math.ceil(currentSearchResults.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;

    searchCurrentPage = page;
    renderPagedResults();
    if (window.NavigationState) window.NavigationState.saveSearchState(currentSearchKeyword, searchCurrentPage);

    // 切換頁面後滾動到搜尋段落，提升體驗
    const section = document.getElementById('section-search');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// [v172 補回/修正] 處理點擊工作計畫後的 Modal 開啟邏輯
function openUnifiedDetail(id) {
    const planData = allDataPageA.find(r => r['計畫編號'] === id);
    const reviewData = allDataPageB.find(r => r['計畫編號'] === id);
    if (!planData && !reviewData) { alert("資料讀取錯誤：找不到該計畫 (請檢查計畫編號是否正確)"); return; }
    const baseData = planData || reviewData;

    // 1. 設定 Header 資訊
    document.querySelector(".js-u-title").innerText = baseData['計畫名稱'];
    document.querySelector(".js-u-dept").innerText = baseData['主管機關'];
    document.querySelector(".js-u-amount").innerText = formatCurrency(parseMoney(baseData['預算金額']));

    // 2. 判斷軍事邏輯
    const isMilitary = (id.length === 13);
    const cleanId = String(id).trim();
    const isMndSpecial = (cleanId === '0902100000' || cleanId === '0902120000');

    // 3. 處理「工作計畫內容」分頁 (Tab 1)
    if (planData) {
        document.querySelector(".js-u-desc").innerText = planData['工作內容'] || '無';
        document.querySelector(".js-u-desc-container").classList.remove('expanded');
        document.querySelector(".js-toggle-desc-btn").innerText = '展開閱讀全文';

        renderDetailChartsA(planData);

        const normalView = document.querySelector(".js-analysis-normal");
        const militaryView = document.querySelector(".js-analysis-military");

        if (isMilitary || isMndSpecial) {
            // --- 軍事模式 ---
            normalView.style.display = 'none';
            militaryView.style.display = 'grid';

            const projectBudget = parseMoney(planData['預算金額']);
            const projectUsage = parseUsageString(planData['用途比例']);
            const agencyName = planData['主管機關'];

            let targetPrefix = '0902';
            let mndForceValue = 559611869000;
            let mndLabel = "所屬機關佔比（國防部所屬）";

            if (cleanId.startsWith('0901')) {
                targetPrefix = '0901';
                mndForceValue = 1750857000;
                mndLabel = "所屬機關佔比（國防部）";
            }

            const mndProjects = allDataPageA.filter(p => String(p['計畫編號']).trim().startsWith(targetPrefix));
            let mndTotalBudget = mndProjects.reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);
            let mndUsageTotal = { '人事費': 0, '業務費': 0, '設備及投資': 0, '獎補助費': 0, '債務費': 0, '預備金': 0 };
            mndProjects.forEach(p => {
                const breakdown = parseUsageString(p['用途比例']);
                for (let k in mndUsageTotal) mndUsageTotal[k] += breakdown[k];
            });

            if (mndTotalBudget < mndForceValue) mndTotalBudget = mndForceValue;

            let unitTotalBudget = 0;
            let unitUsageTotal = { '人事費': 0, '業務費': 0, '設備及投資': 0, '獎補助費': 0, '債務費': 0, '預備金': 0 };
            let unitLabel = `所屬機關佔比（${agencyName}）`;

            if (isMndSpecial) {
                unitTotalBudget = mndTotalBudget;
                unitUsageTotal = mndUsageTotal;
                unitLabel = "所屬機關佔比（全機關）";
            } else {
                const suffix = id.slice(-2);
                const unitProjects = allDataPageA.filter(p => p['計畫編號'].length === 13 && p['計畫編號'].slice(-2) === suffix);
                unitTotalBudget = unitProjects.reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);
                unitProjects.forEach(p => {
                    const breakdown = parseUsageString(p['用途比例']);
                    for (let k in unitUsageTotal) unitUsageTotal[k] += breakdown[k];
                });
            }

            document.querySelector(".js-title-mil-unit-ratio").innerText = unitLabel;

            // Render Military Charts
            if (chartMilMndRatio) chartMilMndRatio.destroy();
            const ctx1 = document.querySelector(".js-chartMilMndRatio").getContext('2d');
            const mndRatio = (mndTotalBudget > 0) ? (projectBudget / mndTotalBudget * 100).toFixed(2) : 0;
            const box1 = document.querySelector(".js-chartMilMndRatio").parentElement.parentElement;
            box1.querySelector('h4').innerText = mndLabel;
            document.querySelector(".js-caption-mil-mnd-ratio").innerText = `本計畫金額占${mndLabel.replace('所屬機關佔比（', '').replace('）', '')}預算 ${mndRatio}%`;

            chartMilMndRatio = new Chart(ctx1, {
                type: 'bar', data: { labels: ['金額'], datasets: [{ label: '本計畫', data: [projectBudget], backgroundColor: CHART_COLORS.cut, stack: 'S0' }, { label: '機關其他', data: [mndTotalBudget - projectBudget], backgroundColor: CHART_COLORS.neutralLight, stack: 'S0' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { display: false, stacked: true } }, plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback } }
            });

            if (chartMilUnitRatio) chartMilUnitRatio.destroy();
            const ctx2 = document.querySelector(".js-chartMilUnitRatio").getContext('2d');
            const unitRatio = (unitTotalBudget > 0) ? (projectBudget / unitTotalBudget * 100).toFixed(2) : 0;
            document.querySelector(".js-caption-mil-unit-ratio").innerText = `本計畫金額占${unitLabel.replace('所屬機關佔比（', '').replace('）', '')}預算 ${unitRatio}%`;
            chartMilUnitRatio = new Chart(ctx2, {
                type: 'bar', data: { labels: ['金額'], datasets: [{ label: '本計畫', data: [projectBudget], backgroundColor: CHART_COLORS.cut, stack: 'S0' }, { label: '單位其他', data: [unitTotalBudget - projectBudget], backgroundColor: CHART_COLORS.neutralLight, stack: 'S0' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { display: false, stacked: true } }, plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback } }
            });

            if (chartMilMndCat) chartMilMndCat.destroy();
            const ctx3 = document.querySelector(".js-chartMilMndCat").getContext('2d');
            const catLabels = ['人事費', '業務費', '設備及投資', '獎補助費', '債務費', '預備金'];
            const pCatData = catLabels.map(k => projectUsage[k]);
            const mndCatRest = catLabels.map(k => (mndUsageTotal[k] || 0) - (projectUsage[k] || 0));
            chartMilMndCat = new Chart(ctx3, {
                type: 'bar', data: { labels: catLabels, datasets: [{ label: '本計畫', data: pCatData, backgroundColor: CHART_COLORS.cut, stack: 'S0' }, { label: '國防部其他', data: mndCatRest, backgroundColor: CHART_COLORS.neutralLight, stack: 'S0' }] },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', axis: 'y', intersect: false }, scales: { x: { stacked: true, ticks: { callback: function (value) { return formatCurrency(value); } } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback },
                    onHover: function (e, activeEls) { if (!activeEls.length) return; const idx = activeEls[0].index; const label = this.data.labels[idx]; const pVal = pCatData[idx]; const tVal = mndUsageTotal[label]; const pct = (tVal > 0) ? (pVal / tVal * 100).toFixed(2) : 0; document.querySelector(".js-caption-mil-mnd-cat").innerHTML = `本計畫<b>${label}</b>占<b>國防部${label}</b>預算 <b>${pct}%</b>`; }
                }
            });
            document.querySelector(".js-caption-mil-mnd-cat").innerText = "請滑鼠移至(或點擊)該類別的整行區域即可查看";

            if (chartMilUnitCat) chartMilUnitCat.destroy();
            const ctx4 = document.querySelector(".js-chartMilUnitCat").getContext('2d');
            const unitCatRest = catLabels.map(k => (unitUsageTotal[k] || 0) - (projectUsage[k] || 0));
            chartMilUnitCat = new Chart(ctx4, {
                type: 'bar', data: { labels: catLabels, datasets: [{ label: '本計畫', data: pCatData, backgroundColor: CHART_COLORS.cut, stack: 'S0' }, { label: '單位其他', data: unitCatRest, backgroundColor: CHART_COLORS.neutralLight, stack: 'S0' }] },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', axis: 'y', intersect: false }, scales: { x: { stacked: true, ticks: { callback: function (value) { return formatCurrency(value); } } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback },
                    onHover: function (e, activeEls) { if (!activeEls.length) return; const idx = activeEls[0].index; const label = this.data.labels[idx]; const pVal = pCatData[idx]; const tVal = unitUsageTotal[label]; const pct = (tVal > 0) ? (pVal / tVal * 100).toFixed(2) : 0; document.querySelector(".js-caption-mil-unit-cat").innerHTML = `本計畫<b>${label}</b>占<b>該單位${label}</b>預算 <b>${pct}%</b>`; }
                }
            });
            document.querySelector(".js-caption-mil-unit-cat").innerText = "請滑鼠移至(或點擊)該類別的整行區域即可查看";

        } else {
            // --- 一般模式 ---
            normalView.style.display = 'grid';
            militaryView.style.display = 'none';

            const agencyName = planData['主管機關'];
            let agencyStats = calculateAgencyStats(agencyName);
            const projectBudget = parseMoney(planData['預算金額']);
            const projectUsage = parseUsageString(planData['用途比例']);

            if (String(id).trim().startsWith('0902')) {
                agencyStats.totalBudget = 559611869000;
            }

            if (chartModalPlanRatio) chartModalPlanRatio.destroy();
            const ctxRatio = document.querySelector(".js-chartModalPlanRatio").getContext('2d');
            const totalRatio = (agencyStats.totalBudget > 0) ? (projectBudget / agencyStats.totalBudget * 100).toFixed(2) : 0;
            document.querySelector(".js-caption-plan-ratio").innerText = `本計畫金額占${agencyName}預算 ${totalRatio}%`;

            chartModalPlanRatio = new Chart(ctxRatio, {
                type: 'bar',
                data: {
                    labels: ['金額'],
                    datasets: [
                        { label: '本計畫', data: [projectBudget], backgroundColor: CHART_COLORS.cut, stack: 'Stack 0' },
                        { label: '機關其他', data: [agencyStats.totalBudget - projectBudget], backgroundColor: CHART_COLORS.neutralLight, stack: 'Stack 0' }
                    ]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { display: false, stacked: true } }, plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback } }
            });

            if (chartModalCatRatio) chartModalCatRatio.destroy();
            const ctxCat = document.querySelector(".js-chartModalCatRatio").getContext('2d');
            const catLabels = ['人事費', '業務費', '設備及投資', '獎補助費', '債務費', '預備金'];
            const projectCatData = catLabels.map(k => projectUsage[k]);
            const restCatData = catLabels.map(k => (agencyStats.usageBreakdown[k] || 0) - (projectUsage[k] || 0));
            const captionEl = document.querySelector(".js-caption-cat-ratio");
            captionEl.innerText = "請滑鼠移至(或點擊)該類別的整行區域即可查看";

            chartModalCatRatio = new Chart(ctxCat, {
                type: 'bar',
                data: {
                    labels: catLabels,
                    datasets: [
                        { label: '本計畫', data: projectCatData, backgroundColor: CHART_COLORS.cut, stack: 'Stack 0' },
                        { label: '機關其他', data: restCatData, backgroundColor: CHART_COLORS.neutralLight, stack: 'Stack 0' }
                    ]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', axis: 'y', intersect: false },
                    scales: { x: { stacked: true, ticks: { callback: function (value) { return formatCurrency(value); } } }, y: { stacked: true } },
                    plugins: { legend: { position: 'bottom' }, tooltip: tooltipCurrencyCallback },
                    onHover: function (e, activeEls) {
                        if (!activeEls || activeEls.length === 0) return;
                        const idx = activeEls[0].index;
                        const label = this.data.labels[idx];
                        const pVal = projectCatData[idx];
                        const totalVal = agencyStats.usageBreakdown[label];
                        const pct = (totalVal > 0) ? (pVal / totalVal * 100).toFixed(2) : 0;
                        captionEl.innerHTML = `本計畫<b>${label}</b>占<b>${agencyName}${label}</b>預算 <b>${pct}%</b>`;
                    }
                }
            });
        }
    } else { document.querySelector(".js-u-desc").innerText = '此計畫無詳細編列內容資料。'; }

    // 4. 處理「審查刪減結果」分頁 (Tab 2)
    const reviewContainer = document.querySelector(".js-review-data-container");
    const reviewNoData = document.querySelector(".js-review-no-data");
    if (reviewData) {
        reviewContainer.style.display = 'block';
        reviewNoData.style.display = 'none';

        renderDetailChartsB(reviewData);
        renderProposalTable(reviewData);

        // [修正] 移除舊的「機關整體」圖表渲染，避免 innerHTML null 錯誤
    } else {
        reviewContainer.style.display = 'none';
        reviewNoData.style.display = 'block';
    }

    switchTab('plan');
    if (window.ModalRenderers && typeof window.ModalRenderers.showModal === 'function') {
        window.ModalRenderers.showModal('unifiedModal');
    } else {
        document.querySelector(".js-unifiedModal").style.display = 'flex';
    }
    setTimeout(() => {
        if (window.ModalRenderers && typeof window.ModalRenderers.resetModalScroll === 'function') {
            window.ModalRenderers.resetModalScroll('#unifiedModal .modal-body-area');
        } else {
            const modalBody = document.querySelector('#unifiedModal .modal-body-area');
            if (modalBody) modalBody.scrollTop = 0;
        }
    }, 0);
}

// [v156] Fixed Military Logic
// [v172 修正] 移除 Modal 內機關整體審查結果的相關邏輯，修復 innerHTML null 錯誤
// [v173] 更新圖表與連動選單 (支援全部、部會、機關三層級)
function updateBudgetPageReview() {
    const ministrySelect = document.querySelector(".js-bp-filter-ministry");
    const unitSelect = document.querySelector(".js-bp-filter-unit");
    const selectedMinistry = ministrySelect.value;

    // 連動邏輯：選部會 -> 更新機關選單
    if (selectedMinistry) {
        const agencies = [...new Set(allDataPageA
            .filter(d => d['所屬部會'] === selectedMinistry)
            .map(d => d['主管機關']))]
            .filter(a => a).sort();

        const lastMinistry = unitSelect.getAttribute('data-last-ministry');
        if (lastMinistry !== selectedMinistry) {
            let html = '<option value="">請選擇主管機關 (全部)</option>'; // [修改] 預設為全部
            agencies.forEach(a => { html += `<option value="${a}">${a}</option>`; });
            unitSelect.innerHTML = html;
            unitSelect.value = "";
            unitSelect.setAttribute('data-last-ministry', selectedMinistry);
        }
    } else {
        unitSelect.innerHTML = '<option value="">請選擇主管機關</option>';
        unitSelect.value = "";
    }

    const selectedAgency = unitSelect.value;
    const captionEl = document.querySelector(".js-bp-review-caption");

    // --- 計算邏輯開始 ---
    let totalBudget = 0;
    let totalCut = 0;
    let totalFreeze = 0;
    let titleText = "";

    if (selectedAgency) {
        // [情境 3] 已選擇特定機關 -> 使用 calculateAgencyStats 取得該機關數據 (含國防部特殊校正)
        const stats = calculateAgencyStats(selectedAgency);
        totalBudget = stats.totalBudget;
        totalCut = stats.totalCut;
        totalFreeze = stats.totalFreeze;
        titleText = selectedAgency;
    } else if (selectedMinistry) {
        // [情境 2] 只選部會，沒選機關 -> 加總該部會下所有資料
        titleText = selectedMinistry + " (全體)";

        // 找出該部會所有計畫
        const ministryProjects = allDataPageA.filter(d => d['所屬部會'] === selectedMinistry);

        // 針對國防部做特殊處理 (加總時需注意 0901/0902 是否需要強制校正)
        // 為了簡化與保持一致性，這裡我們直接累加該部會所有計畫的金額
        // 如果是國防部，手動檢查是否包含 0902 開頭的，若有則視為機密預算加總
        if (selectedMinistry === '國防部') {
            // 國防部特殊邏輯：加總 0901 (本部) + 0902 (所屬)
            const statsMND = calculateAgencyStats('國防部');
            const statsSub = calculateAgencyStats('國防部所屬');
            totalBudget = statsMND.totalBudget + statsSub.totalBudget;
            totalCut = statsMND.totalCut + statsSub.totalCut;
            totalFreeze = statsMND.totalFreeze + statsSub.totalFreeze;
        } else {
            // 一般部會：直接遍歷 A 表與 B 表
            ministryProjects.forEach(p => {
                totalBudget += parseMoney(p['預算金額']);
            });

            // 找出該部會的審查結果 (B表)
            const ministryReviews = allDataPageB.filter(r => r['所屬部會'] === selectedMinistry || ministryProjects.some(p => p['主管機關'] === r['主管機關']));
            // 注意：B表可能沒有所屬部會欄位，需透過主管機關比對，或直接比對計畫編號
            // 更安全的做法：遍歷 B 表，若其主管機關屬於該部會則加總

            // 建立該部會的機關清單
            const agenciesInMinistry = [...new Set(ministryProjects.map(p => p['主管機關']))];

            allDataPageB.forEach(r => {
                if (agenciesInMinistry.includes(r['主管機關'])) {
                    totalCut += parseMoney(r['刪減金額']);
                    totalFreeze += parseMoney(r['凍結金額']);
                }
            });
        }

    } else {
        // [情境 1] 兩個都沒選 -> 加總資料庫所有資料 (中央政府總預算)
        titleText = "中央政府總預算案 (全體)";

        // 預算總額 (A表)
        // 注意：這裡直接加總 A 表可能會漏掉國防部強制校正的差額，建議手動校正國防部
        // 但為了效能，我們先直接加總，若有國防部再補差額
        let rawTotalA = 0;
        allDataPageA.forEach(p => rawTotalA += parseMoney(p['預算金額']));

        // 國防部校正：(17.5億 + 5596億) - (資料庫中實際的國防加總)
        // 這樣做比較複雜，簡單做法：直接加總 A 表，假設國防部資料已在 A 表完整 (若不完整則會少算)
        // 根據先前邏輯，0902 只有兩筆，所以這裡必須手動加上「看不見的機密預算」

        // 計算目前資料庫中 0901 和 0902 的總額
        const mndExisting = allDataPageA.filter(p => {
            const id = String(p['計畫編號']).trim();
            return id.startsWith('0901') || id.startsWith('0902');
        }).reduce((sum, p) => sum + parseMoney(p['預算金額']), 0);

        const mndTarget = 1750857000 + 559611869000; // 國防部正確總額
        const diff = mndTarget - mndExisting;

        totalBudget = rawTotalA + (diff > 0 ? diff : 0); // 補上差額

        // 刪減凍結總額 (B表)
        allDataPageB.forEach(r => {
            totalCut += parseMoney(r['刪減金額']);
            totalFreeze += parseMoney(r['凍結金額']);
        });
    }

    // --- 繪圖數據準備 ---
    const totalPass = totalBudget - totalCut - totalFreeze;
    const pctPass = (totalBudget > 0) ? (totalPass / totalBudget * 100).toFixed(1) : 0;
    const pctCut = (totalBudget > 0) ? (totalCut / totalBudget * 100).toFixed(1) : 0;
    const pctFreeze = (totalBudget > 0) ? (totalFreeze / totalBudget * 100).toFixed(1) : 0;

    // 更新文字說明
    captionEl.innerHTML = `
                <span style="color:#1c1c1e; font-weight:bold;">${titleText}</span> 總預算：${formatCurrency(totalBudget)}<br>
                通過：<b>${pctPass}%</b> | 
                <span style="color:${CHART_COLORS.cut}">刪減：<b>${pctCut}%</b> (${formatCurrency(totalCut)})</span> |
                <span style="color:${CHART_COLORS.freeze}">凍結：<b>${pctFreeze}%</b> (${formatCurrency(totalFreeze)})</span>
            `;

    // 繪製圖表
    const ctx = document.querySelector(".js-chartBudgetPageReview").getContext('2d');
    if (chartBudgetPageReview) chartBudgetPageReview.destroy();

    chartBudgetPageReview = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['審查結果'],
            datasets: [
                { label: '通過', data: [totalPass], backgroundColor: CHART_COLORS.pass, barThickness: 50 },
                { label: '凍結', data: [totalFreeze], backgroundColor: CHART_COLORS.freeze, barThickness: 50 },
                { label: '刪減', data: [totalCut], backgroundColor: CHART_COLORS.cut, barThickness: 50 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, display: false, max: totalBudget },
                y: { stacked: true, display: false }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: tooltipCurrencyCallback
            }
        }
    });
}

// [v117] Date Format Helper
function formatGoogleDate(raw) {
    // Local JSON snapshot uses epoch milliseconds
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            const y = d.getFullYear() - 1911;
            const m = d.getMonth() + 1;
            const day = d.getDate();
            return `${y}/${m < 10 ? '0' + m : m}/${day < 10 ? '0' + day : day}`;
        }
    }

    // Sometimes epoch comes as a numeric string
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (/^\d{12,14}$/.test(s)) {
            const n = parseInt(s, 10);
            if (!Number.isNaN(n)) return formatGoogleDate(n);
        }
    }

    if (typeof raw === 'string' && raw.startsWith('Date(')) {
        const parts = raw.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (parts && parts.length === 4) {
            let y = parseInt(parts[1]); let m = parseInt(parts[2]) + 1; let d = parseInt(parts[3]);
            if (y > 1911) y -= 1911;
            return `${y}/${m < 10 ? '0' + m : m}/${d < 10 ? '0' + d : d}`;
        }
    }
    return raw;
}

// [v144] Special Timeline Rendering
function renderTimeline(data) {
    const container = document.querySelector(".js-budget-timeline");
    if (!container) return;

    const sourceData = (data && data.length > 0) ? data : MOCK_DATA_D;

    const toSortKey = (raw) => {
        if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
        if (typeof raw === 'string') {
            const s = raw.trim();
            if (/^\d{12,14}$/.test(s)) {
                const n = parseInt(s, 10);
                if (!Number.isNaN(n)) return n;
            }
            const m = s.match(/Date\((\d+),(\d+),(\d+)\)/);
            if (m) {
                const y = parseInt(m[1], 10);
                const mo = parseInt(m[2], 10);
                const d = parseInt(m[3], 10);
                const dt = new Date(y, mo, d);
                if (!Number.isNaN(dt.getTime())) return dt.getTime();
            }
            const roc = s.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
            if (roc) {
                const yRaw = parseInt(roc[1], 10);
                const y = yRaw < 1911 ? (yRaw + 1911) : yRaw;
                const mo = parseInt(roc[2], 10) - 1;
                const d = parseInt(roc[3], 10);
                const dt = new Date(y, mo, d);
                if (!Number.isNaN(dt.getTime())) return dt.getTime();
            }
        }
        return 0;
    };

    const grouped = new Map();
    sourceData.forEach((item) => {
        const dateKey = formatGoogleDate(item['日期']);
        if (!grouped.has(dateKey)) grouped.set(dateKey, { dateKey, sortKey: toSortKey(item['日期']), events: [] });
        grouped.get(dateKey).events.push(item);
    });

    // 將日期依時間新到舊排序（未來日期在前）
    const days = Array.from(grouped.values()).sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

    let html = '<div class="timeline-v2" role="list">';
    days.forEach((day) => {
        const events = day.events || [];
        const deadlineEvent = events.find((e) => e['事項'] && String(e['事項']).startsWith('[LINE]'));

        if (deadlineEvent) {
            const text = String(deadlineEvent['事項']).replace('[LINE]', '').trim();
            html += `
                <div class="timeline-v2__deadline" role="listitem" aria-label="${day.dateKey} ${text}">
                    <div class="timeline-v2__dot" aria-hidden="true"></div>
                    <div class="timeline-v2__deadline-inner">
                        <span class="timeline-v2__deadline-pill">${day.dateKey}</span>
                        <span class="timeline-v2__deadline-text">${text}</span>
                    </div>
                </div>
            `;
            return;
        }

        let eventsHtml = '';
        events.forEach((ev) => {
            const title = (ev && ev['事項']) ? String(ev['事項']) : '';
            const link = (ev && ev['連結']) ? String(ev['連結']) : '';
            const linkBtn = link
                ? `<a href="${link}" target="_blank" rel="noreferrer" class="timeline-v2__link">📄 相關公報</a>`
                : '';

            eventsHtml += `
                <div class="timeline-v2__event" role="listitem">
                    <div class="timeline-v2__dot" aria-hidden="true"></div>
                    <div class="timeline-v2__card">
                        <div class="timeline-v2__header">
                            <div class="timeline-v2__info">
                                <span class="timeline-v2__date">${day.dateKey}</span>
                                <span class="timeline-v2__title-text">${title}</span>
                            </div>
                            ${linkBtn}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `<div class="timeline-v2__day">${eventsHtml}</div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// --- 10. Event Listeners ---
// --- 11. Data Loading ---
function parseQueryResponse(jsonData) {
    const table = jsonData.table;
    const cols = table.cols; // Keep original column objects
    const rows = table.rows;
    return rows.map(row => {
        let obj = {};
        row.c.forEach((cell, i) => {
            const col = cols[i];
            if (col && col.label) {
                let val = '';
                if (cell && cell.v !== null && cell.v !== undefined) {
                    val = String(cell.v);
                }
                obj[col.label] = val;
            }
        });
        return obj;
    });
}

async function fetchData(pageId, silent = false) {
    const loader = document.querySelector(".js-loader");
    const errorDisplay = document.querySelector(".js-error-display");

    let targetUrl = dataSources[pageId];
    if (pageId === 'page-budget') return [];
    if (pageId === 'page-legislator') targetUrl = dataSources['page-c'];

    if (!silent && loader) loader.style.display = 'flex';

    try {
        console.log(`[${pageId}] Fetching from: ${targetUrl}`);
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const cleanData = await response.json();
        console.log(`[${pageId}] Loaded data length:`, cleanData.length);
        if (window.DataLoaderModule && typeof window.DataLoaderModule.applyDataContract === 'function') {
            window.DataLoaderModule.applyDataContract(pageId, cleanData);
        }

        if (pageId === 'page-a') {
            allDataPageA = cleanData;
            console.log("allDataPageA updated, sample:", allDataPageA[0]);
        }
        else if (pageId === 'page-b') {
            allDataPageB = cleanData;
            processPageBData(allDataPageB);
            renderHomeCutFreezeCards();
        }
        else if (pageId === 'page-c') { allDataPageC = cleanData; filterLegislators('all'); }
        else if (pageId === 'page-d') { allDataPageD = cleanData; renderTimeline(allDataPageD); }

        if (!silent && loader) loader.style.display = 'none';
        return cleanData;

    } catch (error) {
        console.warn(`[${pageId}] Fetch failed, using Mock Data.`, error);
        isDemoMode = true;
        console.log(`[${pageId}] Entering Demo Mode`);
        let mockData = [];
        if (pageId === 'page-a') {
            mockData = MOCK_DATA_A;
            allDataPageA = mockData;
            console.log("allDataPageA set to MOCK_DATA_A, length:", allDataPageA.length);
        }
        else if (pageId === 'page-b') {
            mockData = MOCK_DATA_B;
            allDataPageB = mockData;
            processPageBData(mockData);
            renderHomeCutFreezeCards();
        }
        else if (pageId === 'page-c') { mockData = MOCK_DATA_C; allDataPageC = mockData; filterLegislators('all'); }
        else if (pageId === 'page-d') { mockData = MOCK_DATA_D; allDataPageD = mockData; renderTimeline(mockData); }
        if (window.DataLoaderModule && typeof window.DataLoaderModule.applyDataContract === 'function') {
            window.DataLoaderModule.applyDataContract(pageId, mockData);
        }

        if (!silent) {
            loader.style.display = 'none';
            if (errorDisplay && pageId === 'page-a') {
                errorDisplay.style.display = 'flex';
                if (error.message.includes("Login Page")) {
                    errorDisplay.innerHTML = `<div class="error-message"><h3>⚠️ 權限錯誤</h3><p>Google 試算表要求登入。</p></div>`;
                } else {
                    errorDisplay.innerHTML = `<div class="error-message"><h3>⚠️ 連線失敗</h3><p>無法連線至資料庫。</p></div>`;
                }
            }
            document.querySelectorAll('.demo-mode-badge').forEach(el => el.style.display = 'block');
        }
        return mockData;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initFloatBackTop();
    initFloatNavCollapseMenu();
    initScrollToTriggers();
    initRankSwitches();
    initScrollReveal();
    initTour();

    // Handle hash-based scroll (from cross-page links like index.html#section-review-progress)
    if (window.location.hash) {
        const hashId = window.location.hash.slice(1);
        setTimeout(() => {
            const el = document.getElementById(hashId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }

    if (currentPage === 'overview') {
        renderMainCharts();
        Promise.all([
            fetchData('page-a', true),
            fetchData('page-b', true),
            fetchData('page-d', true)
        ]).then(() => {
            if (allDataPageA && allDataPageA.length > 0) {
                initMinistrySection();
            }
            renderHomeStatusChart();
            renderHomeCutFreezeCards();
            // Apply timeline data (page-d) on overview
            if (allDataPageD && allDataPageD.length > 0 && typeof renderTimeline === 'function') {
                renderTimeline(allDataPageD);
            }

            if (isDemoMode) {
                document.querySelectorAll('.demo-mode-badge').forEach(el => el.style.display = 'block');
            }
        });
    }

    if (currentPage === 'budget') {
        Promise.all([
            fetchData('page-a', true),
            fetchData('page-b', true)
        ]).then(() => {
            if (allDataPageA && allDataPageA.length > 0) {
                initBudgetPageFilters();
            }

            if (isDemoMode) {
                document.querySelectorAll('.demo-mode-badge').forEach(el => el.style.display = 'block');
            }

            // Handle ?q= and ?plan= URL parameters
            const params = new URLSearchParams(window.location.search);
            const q = params.get('q');
            const plan = params.get('plan');

            if (q) {
                const budgetInput = document.querySelector('.js-search-budget-input');
                if (budgetInput) budgetInput.value = q;
                handleSearchBudget(q);
            } else if (window.NavigationState) {
                const state = window.NavigationState.restoreState();
                if (state && state.searchKeyword) {
                    currentSearchKeyword = state.searchKeyword;
                    handleSearchBudget(state.searchKeyword);
                    if (state.searchPage && state.searchPage > 1) {
                        changeSearchPage(state.searchPage);
                    }
                }
            }

            if (plan) {
                openUnifiedDetail(plan);
                switchTab('review');
            }
        });
    }

    if (currentPage === 'legislators') {
        fetchData('page-c', false).then(() => {
            if (isDemoMode) {
                document.querySelectorAll('.demo-mode-badge').forEach(el => el.style.display = 'block');
            }

            // Handle ?name= URL parameter (auto-open legislator modal)
            const params = new URLSearchParams(window.location.search);
            const name = params.get('name');
            if (name && allDataPageC.length > 0) {
                const target = allDataPageC.find(r => String(r['委員姓名']).trim() === name);
                if (target) {
                    const str = encodeURIComponent(JSON.stringify(target));
                    openDetailC(str);
                }
            }
        });
    }

    // page-other: no data to load
});

window.addEventListener('resize', () => {
    const arrowLine = document.querySelector(".js-dynamic-arrow");
    if (arrowLine) arrowLine.style.opacity = '0';
});
