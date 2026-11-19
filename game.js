'use strict';

/* ============================================================
   函数域 / FUNCTION DOMAIN
   Plot the curve through the light points.
   ============================================================ */

(() => {

  /* ---------------- 基础工具 ---------------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const fix = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
  const sgn = (v) => {
    if (Math.abs(v) < 0.005) return '+ 0.00';
    return v > 0 ? `+ ${fix(v)}` : `\u2212 ${fix(-v)}`;
  };
  const pt = (c) => String.fromCharCode(65 + c);

  const COLORS = ['#7bf1c4', '#7cc6ff', '#ffc06a', '#ff9db0'];
  /* 参数增长固定为每秒 ±1，不再分档 */

  /* ---------------- 函数族 ---------------- */

  const KINDS = {
    linear: {
      name: '一次函数', short: 'LINEAR', unlock: 0,
      form: 'y = A x + B',
      params: ['A', 'B'], defaults: [1, 0],
      f: (x, p) => p[0] * x + p[1],
      expr: (p) => `y = ${fix(p[0])}x ${sgn(p[1])}`,
    },
    quadratic: {
      name: '二次函数', short: 'QUAD', unlock: 4,
      form: 'y = A x² + B x + C',
      params: ['A', 'B', 'C'], defaults: [1, 0, 0],
      f: (x, p) => p[0] * x * x + p[1] * x + p[2],
      expr: (p) => `y = ${fix(p[0])}x\u00b2 ${sgn(p[1])}x ${sgn(p[2])}`,
    },
    reciprocal: {
      name: '反比例函数', short: 'RECIP', unlock: 9,
      form: 'y = A / x + B',
      params: ['A', 'B'], defaults: [1, 0],
      f: (x, p) => (Math.abs(x) < 1e-6 ? NaN : p[0] / x + p[1]),
      expr: (p) => `y = ${fix(p[0])} / x ${sgn(p[1])}`,
    },
    sine: {
      name: '正弦函数', short: 'SINE', unlock: 14,
      form: 'y = A sin(B x) + C',
      params: ['A', 'B', 'C'], defaults: [1, 1, 0],
      f: (x, p) => p[0] * Math.sin(p[1] * x) + p[2],
      expr: (p) => `y = ${fix(p[0])}\u00b7sin(${fix(p[1])}x) ${sgn(p[2])}`,
    },
    abs: {
      name: '绝对值函数', short: 'ABS', unlock: 0,
      form: 'y = A |x − B| + C',
      params: ['A', 'B', 'C'], defaults: [1, 1, 0],
      f: (x, p) => p[0] * Math.abs(x - p[1]) + p[2],
      expr: (p) => {
        const b = p[1];
        const inner = Math.abs(b) < 0.005 ? 'x' : b > 0 ? `x \u2212 ${fix(b)}` : `x + ${fix(-b)}`;
        return `y = ${fix(p[0])}\u00b7|${inner}| ${sgn(p[2])}`;
      },
    },
    exponential: {
      name: '指数函数', short: 'EXP', unlock: 19,
      form: 'y = A · 2^(B x) + C',
      params: ['A', 'B', 'C'], defaults: [1, 1, 0],
      f: (x, p) => p[0] * Math.pow(2, p[1] * x) + p[2],
      expr: (p) => `y = ${fix(p[0])}\u00b7 2^(${fix(p[1])}x) ${sgn(p[2])}`,
    },
    sqrt: {
      name: '根式函数', short: 'RADICAL', unlock: 23,
      form: 'y = A √(x − B) + C',
      params: ['A', 'B', 'C'], defaults: [1, 0, 1],
      /* 定义域起点向左留一小段，避免起点正好落在采样网格缝隙里被判丢 */
      f: (x, p) => {
        const d = x - p[1];
        if (d < -0.3) return NaN;
        return p[0] * Math.sqrt(Math.max(0, d)) + p[2];
      },
      expr: (p) => {
        const b = p[1];
        const inner = Math.abs(b) < 0.005 ? 'x' : b > 0 ? `x \u2212 ${fix(b)}` : `x + ${fix(-b)}`;
        return `y = ${fix(p[0])}\u00b7\u221a(${inner}) ${sgn(p[2])}`;
      },
    },
    sinAbs: {
      name: '整流正弦', short: 'RECT', unlock: 24,
      form: 'y = A |sin(B x)| + C',
      params: ['A', 'B', 'C'], defaults: [1, 1, 0],
      f: (x, p) => p[0] * Math.abs(Math.sin(p[1] * x)) + p[2],
      expr: (p) => `y = ${fix(p[0])}\u00b7|sin(${fix(p[1])}x)| ${sgn(p[2])}`,
    },
    cubic: {
      name: '三次函数', short: 'CUBIC', unlock: 25,
      form: 'y = A x³ + B x² + C x + D',
      params: ['A', 'B', 'C', 'D'], defaults: [1, 0, 0, 0],
      f: (x, p) => p[0] * x * x * x + p[1] * x * x + p[2] * x + p[3],
      expr: (p) => `y = ${fix(p[0])}x\u00b3 ${sgn(p[1])}x\u00b2 ${sgn(p[2])}x ${sgn(p[3])}`,
    },
    recipSq: {
      name: '平方反比', short: 'INV\u00b7SQ', unlock: 26,
      form: 'y = A / x² + B',
      params: ['A', 'B'], defaults: [1, 0],
      f: (x, p) => (Math.abs(x) < 1e-4 ? NaN : p[0] / (x * x) + p[1]),
      expr: (p) => `y = ${fix(p[0])} / x\u00b2 ${sgn(p[1])}`,
    },
  };

  const ALL_KINDS = Object.keys(KINDS);

  /* ---------------- 教学卡片 ----------------
     sample  示例参数，用来说明这条曲线长什么样
     points  三句以内的特性要点
  -------------------------------------------- */

  const LESSONS = {
    linear: {
      sample: [1.6, 1],
      points: [
        'a 是斜率，|a| 越大直线越陡',
        'b 是曲线与 y 轴的交点',
        'a 为负时直线从左向右下降',
      ],
    },
    abs: {
      sample: [1.6, -1, 0],
      points: [
        '曲线在顶点处折成 V 形，顶点坐标 (b, c)',
        'a 的正负决定开口朝上还是朝下',
        '|a| 越大，两臂张开得越陡',
      ],
    },
    quadratic: {
      sample: [0.8, 0, -1],
      points: [
        'a 决定开口方向，|a| 越大开口越窄',
        '对称轴在 x = −b / 2a，顶点落在对称轴上',
        'c 是曲线与 y 轴的交点',
      ],
    },
    reciprocal: {
      sample: [2, 1],
      points: [
        '在 x = 0 处断开，分成互不相连的两支',
        'a 的符号决定曲线落在哪两个象限',
        'b 是水平渐近线，曲线远端会贴住它',
      ],
    },
    sine: {
      sample: [2, 1.4, 0],
      points: [
        'a 是振幅，即波峰到中线的距离',
        'b 决定周期，周期 = 2π / b',
        'c 把整条波上下平移',
      ],
    },
    exponential: {
      sample: [1, 0.9, -1],
      points: [
        'a 为正时曲线始终在 y = c 之上',
        'b 越大，曲线抬升越急',
        '左侧趋于水平渐近线 y = c',
      ],
    },
    sqrt: {
      sample: [2, -1, 0],
      points: [
        '只有 x ≥ b 的部分有图像，其余是空白',
        '起点坐标 (b, c)，之后增长越来越慢',
        'a 为负时曲线从起点向右下方延伸',
      ],
    },
    sinAbs: {
      sample: [2, 1, 0.5],
      points: [
        '绝对值把正弦的下半波翻到中线上方',
        '波谷全部压平在同一条 y = c 上',
        '相邻两个波峰之间相距 π / b',
      ],
    },
    cubic: {
      sample: [0.25, 0, -1.2, 0],
      points: [
        '两端朝相反方向发散，一高一低',
        'a 的符号决定右端上升还是下降',
        'b、c 控制两个拐点的位置与弯曲程度',
      ],
    },
    recipSq: {
      sample: [3, 0.5],
      points: [
        '关于 y 轴对称，是偶函数',
        'x = 0 处断开，a 为正时两侧都向上张开',
        '曲线最终贴近水平渐近线 y = b',
      ],
    },
  };

  ALL_KINDS.forEach((k) => { KINDS[k].lesson = LESSONS[k]; });

  /* ---------------- 语言 ---------------- */

  const LANG_KEY = 'function-domain.lang';

  const KIND_EN = {
    linear: 'Linear', quadratic: 'Quadratic', reciprocal: 'Reciprocal', sine: 'Sine',
    abs: 'Absolute value', exponential: 'Exponential', sqrt: 'Radical',
    sinAbs: 'Rectified sine', cubic: 'Cubic', recipSq: 'Inverse square',
  };

  const LESSON_EN = {
    linear: [
      'A is the slope; larger |A| means steeper.',
      'B is where the line crosses the y-axis.',
      'Negative A makes the line fall from left to right.',
    ],
    abs: [
      'Folds into a V with vertex (B, C).',
      'The sign of A decides whether it opens up or down.',
      'Larger |A| makes both arms steeper.',
    ],
    quadratic: [
      'A sets the opening; larger |A| narrows it.',
      'The axis of symmetry is x = \u2212B / 2A.',
      'C is the y-intercept.',
    ],
    reciprocal: [
      'Breaks at x = 0 into two separate branches.',
      'The sign of A decides which quadrants hold the branches.',
      'B is the horizontal asymptote.',
    ],
    sine: [
      'A is the amplitude from the midline.',
      'B sets the period: 2\u03c0 / B.',
      'C shifts the whole wave up or down.',
    ],
    exponential: [
      'With positive A the curve stays above y = C.',
      'Larger B climbs faster.',
      'The left side flattens toward y = C.',
    ],
    sqrt: [
      'Only exists for x \u2265 B.',
      'Starts at (B, C) and grows ever slower.',
      'Negative A sends it down to the right.',
    ],
    sinAbs: [
      'Absolute value flips the lower half of the sine upward.',
      'Every trough sits on y = C.',
      'Neighbouring crests are \u03c0 / B apart.',
    ],
    cubic: [
      'The two ends run in opposite directions.',
      'A decides whether the right end rises or falls.',
      'B and C shape the two bends.',
    ],
    recipSq: [
      'Symmetric about the y-axis (even function).',
      'Breaks at x = 0; with A > 0 both sides open upward.',
      'Approaches the horizontal asymptote y = B.',
    ],
  };

  const LEVEL_EN = [
    { name: 'First Stroke', hint: 'Let the line pass through A. A sets the slope, B the y-intercept.' },
    { name: 'Between Two Points', hint: 'One line must hold both points: the slope has to be exact.' },
    { name: 'First Fold', hint: 'The absolute value folds into a V; A opens it, B places the corner.' },
    { name: 'Inverted V', hint: 'Negative A flips the V; C lifts the vertex off the x-axis.' },
    { name: 'Curvature', hint: 'Three non-collinear points: switch to a parabola.' },
    { name: 'Four on One Arc', hint: 'Four points on one parabola \u2014 tune A, B and C together.' },
    { name: 'Raised Arc', hint: 'C lifts the whole parabola. Watch the no-go zone at the top right.' },
    { name: 'Detour', hint: 'Two corner zones squeeze the parabola into a corridor.' },
    { name: 'Arc Maze', hint: 'Five points and two zones: opening and position both matter.' },
    { name: 'Hyperbola', hint: 'A reciprocal splits into two branches across the origin.' },
    { name: 'Far Branch', hint: 'A larger A pushes both branches away from the origin.' },
    { name: 'Shifted Branch', hint: 'B shifts the hyperbola; a zone blocks the top right.' },
    { name: 'Corridor', hint: 'Two zones pinch the path into a narrow corridor.' },
    { name: 'Triple Gate', hint: 'Five points, three zones \u2014 each branch handles different points.' },
    { name: 'Wave', hint: 'A sets the amplitude, B the period, C lifts the wave.' },
    { name: 'Steep Wave', hint: 'Three points spanning most of a period: find the crest first.' },
    { name: 'Dense Wave', hint: 'Larger B packs the waves; keep crests out of the top-right zone.' },
    { name: 'Long Wave', hint: 'Five points spread across one full period.' },
    { name: 'Wave No-Go', hint: 'Three zones cage the wave; mind the gaps at left and top right.' },
    { name: 'Climb', hint: 'Exponential curves shoot up fast; small changes in B move everything.' },
    { name: 'Steep Climb', hint: 'Larger B climbs harder; use A and C to line up three points.' },
    { name: 'Climb No-Go', hint: 'Four stair-step points climbing, with a big zone on the left.' },
    { name: 'Plateau', hint: 'Four points rising in steps, zones at top left and top right.' },
    { name: 'Radical Gate', hint: 'A radical only exists for x \u2265 B; its left end is the start.' },
    { name: 'Rectified', hint: 'Absolute value on a sine flattens every trough onto one line.' },
    { name: 'Cubic Turn', hint: 'The cubic S-curve must satisfy two bends; four parameters at once.' },
    { name: 'Inverse Square', hint: 'Inverse square is symmetric about the y-axis, opening upward on both sides.' },
    { name: 'Composite Pair', hint: 'Radical at right, line at left; a zone sits at the top left.' },
    { name: 'Triple Weave', hint: 'Cubic and rectified sine interleave, one zone guarding each corner.' },
    { name: 'Convergence', hint: 'Final level: cubic, rectified sine and inverse square \u2014 six points, three zones.' },
  ];

  const UI_TEXT = {
    zh: {
      'start.tagline': '把曲线，引向光点。',
      'start.taglineSub': '拖动参数，让公式在坐标系中成立。',
      'start.begin': '开始观测',
      'start.levels': '关卡序列',
      'start.progress': '已通关',
      'start.foot1': '交互式曲线图册',
      'start.foot2': '拖动或键入参数 · 曲线实时响应',
      'levels.title': '关卡序列',
      'levels.desc': '每一关解锁一种新的函数形态。完成当前关卡，下一关才会开启。',
      'levels.back': '返回',
      'levels.cleared': 'CLEARED',
      'state.locked': '锁定',
      'state.cleared': '已通过',
      'state.pending': '待观测',
      'game.targets': '目标',
      'game.forms': '公式',
      'game.hint': '提示',
      'game.pause': '暂停',
      'game.resume': '继续',
      'panel.forms': '公式区',
      'panel.palette': '公式选择区',
      'panel.settings': '设置区',
      'panel.stopAll': '全部停止',
      'panel.basics': '基础运算 · BASICS',
      'panel.advanced': '进阶函数 · ADVANCED',
      'switch.grid': '显示网格',
      'switch.ticks': '坐标刻度',
      'switch.guides': '参考虚线',
      'switch.target': '目标图像',
      'form.tip': '▲▼ 每秒 ±1 平滑增减，再点暂停；输入框可粘贴整条公式。',
      'op.note': '箭头启动匀速增减（每秒 ±1），再点暂停；「停止」键定格；输入框可粘贴整条公式。',
      'btn.reset': '重置本关',
      'btn.home': '返回主页 · 选择关卡',
      'btn.remember': '记住了',
      'btn.apply': '套用',
      'sol.title': '官方解法 / SOLUTIONS',
      'sol.standard': '标准解法',
      'sol.split': '分线解法',
      'zone.title': '禁区 / FORBIDDEN',
      'zone.rect': '矩形禁区',
      'zone.circle': '圆形禁区',
      'zone.quadrant': '第 {q} 象限整块禁止',
      'win.title': '光点已连接',
      'win.sub': '第 {n} 关 · {name}，曲线穿过全部 {k} 个光点。',
      'win.next': '下一关 →',
      'win.replay': '重玩',
      'win.home': '主页',
      'lesson.new': 'NEW FUNCTION · 新函数解锁',
      'lesson.brief': 'FUNCTION BRIEF · 函数简介',
      'toast.unlock': '新公式解锁：{name}',
      'toast.unlockMore': '同时解锁：{name}',
      'toast.locked': '{name} 将在第 {n} 关解锁',
      'toast.limit': '本关公式数量已达上限',
      'toast.hitStop': '曲线经过目标点，已自动停止',
      'toast.matchStop': '与目标图像重合，已自动停止',
      'toast.zone': '曲线进入了禁止区，先绕开红色区域',
      'toast.pasteOk': '已粘贴：{expr}',
      'toast.pasteBad': '无法识别该公式，{form} 这样写才行',
      'toast.applySol': '已套用官方解法：{name}',
      'toast.reset': '本关已重置',
      'toast.stopped': '所有参数已停止',
      'toast.full': '所有参数已锁定在边界',
    },
    en: {
      'start.tagline': 'Guide the curve to the light points.',
      'start.taglineSub': 'Drag the parameters until the formula holds.',
      'start.begin': 'Begin',
      'start.levels': 'Level Index',
      'start.progress': 'cleared',
      'start.foot1': 'Interactive atlas of curves',
      'start.foot2': 'Drag or type parameters · the curve reacts live',
      'levels.title': 'LEVEL INDEX',
      'levels.desc': 'Every level unlocks a new function shape. Clear the current one to open the next.',
      'levels.back': 'Back',
      'levels.cleared': 'CLEARED',
      'state.locked': 'Locked',
      'state.cleared': 'Cleared',
      'state.pending': 'Open',
      'game.targets': 'Targets',
      'game.forms': 'Forms',
      'game.hint': 'Hint',
      'game.pause': 'Pause',
      'game.resume': 'Resume',
      'panel.forms': 'Formulas',
      'panel.palette': 'Formula Library',
      'panel.settings': 'Settings',
      'panel.stopAll': 'Stop All',
      'panel.basics': 'BASICS',
      'panel.advanced': 'ADVANCED',
      'switch.grid': 'Grid',
      'switch.ticks': 'Ticks',
      'switch.guides': 'Guides',
      'switch.target': 'Target curve',
      'form.tip': '▲▼ ±1 per second, click again to pause; paste a whole formula into any field.',
      'op.note': 'Arrows start a constant ±1/s change, click again to pause. “Stop” freezes the value.',
      'btn.reset': 'Reset Level',
      'btn.home': 'Home · Levels',
      'btn.remember': 'Got it',
      'btn.apply': 'Apply',
      'sol.title': 'SOLUTIONS',
      'sol.standard': 'Standard solution',
      'sol.split': 'Split solution',
      'zone.title': 'FORBIDDEN',
      'zone.rect': 'Rect zone',
      'zone.circle': 'Circle zone',
      'zone.quadrant': 'Quadrant {q} blocked',
      'win.title': 'All Points Aligned',
      'win.sub': 'Level {n} · {name} — the curve passes all {k} light points.',
      'win.next': 'Next →',
      'win.replay': 'Replay',
      'win.home': 'Home',
      'lesson.new': 'NEW FUNCTION · unlocked',
      'lesson.brief': 'FUNCTION BRIEF',
      'toast.unlock': 'New formula unlocked: {name}',
      'toast.unlockMore': 'Also unlocked: {name}',
      'toast.locked': '{name} unlocks at level {n}',
      'toast.limit': 'Formula limit reached for this level',
      'toast.hitStop': 'Curve reached a light point — auto stopped',
      'toast.matchStop': 'Curve matches the target image — auto stopped',
      'toast.zone': 'The curve entered a forbidden zone',
      'toast.pasteOk': 'Pasted: {expr}',
      'toast.pasteBad': 'Cannot parse that formula, try something like {form}',
      'toast.applySol': 'Applied official solution: {name}',
      'toast.reset': 'Level reset',
      'toast.stopped': 'All parameters stopped',
      'toast.full': 'All parameters clamped at their limits',
    },
  };

  function t(key, vars) {
    const dict = UI_TEXT[state.lang] || UI_TEXT.zh;
    let text = dict[key] ?? UI_TEXT.zh[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, String(v));
    }
    return text;
  }

  function kindName(kind) {
    return state.lang === 'en' ? (KIND_EN[kind] || kind) : KINDS[kind].name;
  }

  function levelName(lv, i) {
    return state.lang === 'en' ? (LEVEL_EN[i]?.name || lv.name) : lv.name;
  }

  function levelHint(lv, i) {
    return state.lang === 'en' ? (LEVEL_EN[i]?.hint || lv.hint) : lv.hint;
  }

  function lessonPoints(kind) {
    return state.lang === 'en' ? (LESSON_EN[kind] || []) : (LESSONS[kind]?.points || []);
  }

  function levelTitle(lv, i) {
    return state.lang === 'en'
      ? `LV ${String(i + 1).padStart(2, '0')} \u00b7 ${levelName(lv, i)}`
      : `${ROMAN[i] || ''} \u00b7 ${levelName(lv, i)}`;
  }

  function loadLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v === 'en' || v === 'zh') state.lang = v;
    } catch (e) { /* 存储不可用时用默认语言 */ }
  }

  function saveLang() {
    try { localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* 忽略 */ }
  }

  /* 静态文案：HTML 上标了 data-i18n 的节点 */
  function applyI18n() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    if (dom.langSwitch) {
      dom.langSwitch.textContent = state.lang === 'en' ? '\u4e2d\u6587' : 'EN';
      dom.langSwitch.setAttribute('aria-label', state.lang === 'en' ? '\u5207\u6362\u4e2d\u6587' : 'Switch to English');
    }
  }

  function refreshWinText() {
    if (!state.level) return;
    const idx = state.levelIndex;
    dom.winSub.textContent = t('win.sub', {
      n: String(idx + 1).padStart(2, '0'),
      name: levelName(state.level, idx),
      k: state.targets.length,
    });
    dom.btnNext.textContent = idx + 1 < LEVELS.length ? t('win.next') : t('win.home');
  }

  function setLang(next) {
    if (next === state.lang) return;
    state.lang = next;
    saveLang();
    applyI18n();
    renderStartProgress();
    if (state.screen === 'levels') renderLevels();
    if (state.screen === 'game' && state.level) {
      const idx = state.levelIndex;
      dom.lvName.textContent = levelTitle(state.level, idx);
      dom.lvHint.textContent = levelHint(state.level, idx);
      dom.btnPause.textContent = state.paused ? t('game.resume') : t('game.pause');
      renderPalette();
      renderTargetList();
      renderZoneList();
      renderSolutions();
      renderHud();
      updateStats();
      if (!dom.lesson.hidden && state.lessonKind) fillLesson(state.lessonKind, state.lessonIsNew);
      if (dom.winOverlay.classList.contains('is-open')) refreshWinText();
    }
  }

  /* 公式选择区按通关进度解锁：基础组一开始就有，进阶组逐关开放 */
  const BASIC_KINDS = ['linear', 'abs'];
  const ADVANCED_KINDS = ['quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'];
  const OPS = [
    { mark: '+', tip: '常数项相加：y = a x + b' },
    { mark: '\u2212', tip: '常数项相减：b 取负值即可' },
    { mark: '\u00d7', tip: '系数相乘：a 与 b 叠加缩放' },
    { mark: '\u00f7', tip: '反比例取商：a / x' },
    { mark: '| |', tip: '绝对值折角：把曲线折成 V 形' },
    { mark: '\u00b2', tip: '平方：二次项 x\u00b2' },
  ];

  /* ---------------- 关卡 ----------------
     视图半径 R = round((|x| + |y|) * 2) 的最大值，即坐标轴只覆盖到
     目标点绝对值之和的两倍，界面之外的值一律不参与计算。
  ---------------------------------------- */

      const LEVELS = [
    {
      name: '初次绘制',
      hint: '让直线穿过 A 点。a 控制倾斜，b 控制它与 y 轴的交点。',
      seed: 'linear', maxForms: 1, tol: 0.36,
      points: [{ x: 3, y: 2 }],
    },
    {
      name: '两点之间',
      hint: '一条直线要同时压住两个光点，斜率必须刚好。',
      seed: 'linear', maxForms: 1, tol: 0.30,
      points: [{ x: 2, y: 3 }, { x: 5, y: 1 }],
    },
    {
      name: '折角初现',
      hint: '绝对值函数在顶点折成 V 形，a 决定张口大小，b 决定折点位置。',
      seed: 'abs', maxForms: 1, tol: 0.29,
      points: [{ x: 0, y: 2 }, { x: 1, y: 0 }, { x: 2, y: 2 }],
    },
    {
      name: '倒悬之 V',
      hint: 'a 取负值时 V 形倒过来，c 把顶点抬离 x 轴。',
      seed: 'abs', maxForms: 1, tol: 0.29,
      points: [{ x: -1, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 0 }],
    },
    {
      name: '弯曲',
      hint: '三个不共线的点无法被一条直线同时穿过，换抛物线。',
      seed: 'quadratic', maxForms: 1, tol: 0.29,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 2 }],
    },
    {
      name: '四点共弧',
      hint: '四个点落在同一条抛物线上，a、b、c 要一起配合。',
      seed: 'quadratic', maxForms: 1, tol: 0.27,
      points: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 4 }],
    },
    {
      name: '抬高之弧',
      hint: 'c 把整条抛物线抬高，顶点离开原点。注意右上角的禁区。',
      seed: 'quadratic', maxForms: 1, tol: 0.27,
      points: [{ x: -2, y: 5 }, { x: 0, y: 1 }, { x: 2, y: 5 }],
      zones: [
        { type: 'rect', x1: 5, y1: 2, x2: 9, y2: 10 },
      ],
    },
    {
      name: '双向绕行',
      hint: '两处禁区卡在角落，抛物线要从中穿过。',
      seed: 'quadratic', maxForms: 1, tol: 0.26,
      points: [{ x: -1, y: 0 }, { x: 0, y: -3 }, { x: 1, y: -4 }, { x: 3, y: 0 }],
      zones: [
        { type: 'rect', x1: -9, y1: -9, x2: -5, y2: -3 },
        { type: 'circle', x: 6, y: -6, r: 2 },
      ],
    },
    {
      name: '弧线迷阵',
      hint: '五个点与两处禁区，抛物线的开口与位置都要算准。',
      seed: 'quadratic', maxForms: 1, tol: 0.26,
      points: [{ x: 0, y: 3 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 3, y: 0 }, { x: 4, y: 3 }],
      zones: [
        { type: 'rect', x1: -10, y1: 6, x2: -6, y2: 12 },
        { type: 'circle', x: 7, y: 7, r: 1.8 },
      ],
    },
    {
      name: '双曲',
      hint: '反比例函数在原点两侧分成两支，中间是断裂的。',
      seed: 'reciprocal', maxForms: 1, tol: 0.26,
      points: [{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: -1, y: -1 }, { x: -2, y: 0 }],
    },
    {
      name: '远端双曲',
      hint: 'a 越大，曲线离原点越远，两支都向外推。',
      seed: 'reciprocal', maxForms: 1, tol: 0.26,
      points: [{ x: 1, y: 4 }, { x: 2, y: 2 }, { x: 4, y: 1 }, { x: -2, y: -2 }],
    },
    {
      name: '偏移双曲',
      hint: 'b 把整条双曲线上下平移，禁区挡在右上。',
      seed: 'reciprocal', maxForms: 1, tol: 0.24,
      points: [{ x: 1, y: 4 }, { x: 3, y: 2 }, { x: -1, y: -2 }, { x: -3, y: 0 }],
      zones: [
        { type: 'rect', x1: 5, y1: 4, x2: 9, y2: 9 },
      ],
    },
    {
      name: '双曲回廊',
      hint: '两条禁区把可走的空间压成一条窄廊。',
      seed: 'reciprocal', maxForms: 1, tol: 0.24,
      points: [{ x: 1, y: 4 }, { x: 2, y: 3 }, { x: -1, y: 0 }, { x: -2, y: 1 }],
      zones: [
        { type: 'circle', x: -6, y: 7, r: 1.6 },
        { type: 'rect', x1: 4, y1: -6, x2: 9, y2: -2 },
      ],
    },
    {
      name: '双曲三重门',
      hint: '五个点、三处禁区，双曲线的两支要分别照顾不同的光点。',
      seed: 'reciprocal', maxForms: 1, tol: 0.24,
      points: [{ x: 1, y: 5 }, { x: 3, y: 3 }, { x: -1, y: -1 }, { x: -3, y: 1 }, { x: -0.5, y: -4 }],
      zones: [
        { type: 'rect', x1: -11, y1: 6, x2: -6, y2: 11 },
        { type: 'circle', x: 9, y: -3, r: 1.5 },
        { type: 'circle', x: -7, y: 8, r: 1.5 },
      ],
    },
    {
      name: '波动',
      hint: '振幅 a 拉开波峰，频率 b 决定周期，偏移 c 把整条波抬高。',
      seed: 'sine', maxForms: 1, tol: 0.27,
      points: [{ x: 0, y: 1 }, { x: 1.5, y: 3 }, { x: 3.1, y: 1.08 }],
    },
    {
      name: '陡波',
      hint: '正弦的三点跨越大半个周期，先找到波峰再定 a。',
      seed: 'sine', maxForms: 1, tol: 0.26,
      points: [{ x: -1.57, y: -3 }, { x: 0, y: 0 }, { x: 1.57, y: 3 }],
    },
    {
      name: '密波',
      hint: 'b 越大波越密，禁区卡在右上，别让波峰扫进去。',
      seed: 'sine', maxForms: 1, tol: 0.24,
      points: [{ x: 0, y: 1 }, { x: 0.79, y: 3 }, { x: 1.57, y: 1 }],
      zones: [
        { type: 'rect', x1: 4, y1: 4, x2: 7, y2: 7 },
      ],
    },
    {
      name: '长波',
      hint: '五个点散布在一个完整周期里，b 决定周期长度。',
      seed: 'sine', maxForms: 1, tol: 0.24,
      points: [{ x: 0, y: 0 }, { x: 1.57, y: 2 }, { x: 3.14, y: 0 }, { x: 4.71, y: -2 }, { x: 6.28, y: 0 }],
      zones: [
        { type: 'rect', x1: -12, y1: 3, x2: -8, y2: 10 },
        { type: 'circle', x: -6, y: -5, r: 1.5 },
      ],
    },
    {
      name: '波域禁区',
      hint: '三处禁区把波形夹在中间，注意左侧和右上的空隙。',
      seed: 'sine', maxForms: 1, tol: 0.24,
      points: [{ x: -3.14, y: 1 }, { x: -1.57, y: -1 }, { x: 0, y: 1 }, { x: 1.57, y: 3 }],
      zones: [
        { type: 'rect', x1: 5, y1: 4, x2: 9, y2: 9 },
        { type: 'circle', x: -6, y: 6, r: 1.5 },
        { type: 'rect', x1: -9, y1: -9, x2: -5, y2: -4 },
      ],
    },
    {
      name: '攀升',
      hint: '指数曲线增长极快，b 的一点点变化会让整条曲线剧烈偏移。',
      seed: 'exponential', maxForms: 1, tol: 0.29,
      points: [{ x: -1, y: 1.5 }, { x: 0, y: 2 }, { x: 1, y: 3 }],
    },
    {
      name: '陡升',
      hint: 'b 变大后曲线抬升更急，靠 a 与 c 把三点对齐。',
      seed: 'exponential', maxForms: 1, tol: 0.27,
      points: [{ x: -1, y: 0.25 }, { x: 0, y: 1 }, { x: 1, y: 4 }],
    },
    {
      name: '攀升禁区',
      hint: '四点阶梯状上升，左侧有一大片禁区。',
      seed: 'exponential', maxForms: 2, tol: 0.26,
      points: [{ x: -1, y: 2.5 }, { x: 0, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 6 }],
      zones: [
        { type: 'rect', x1: -10, y1: 6, x2: -5, y2: 10 },
      ],
    },
    {
      name: '高台',
      hint: '四点顺着指数曲线阶梯上升，右下与右上各有一处禁区。',
      seed: 'exponential', maxForms: 1, tol: 0.26,
      points: [{ x: -0.5, y: 1.5 }, { x: 0, y: 2 }, { x: 0.5, y: 3 }, { x: 1, y: 5 }],
      zones: [
        { type: 'circle', x: -8, y: 7, r: 1.6 },
        { type: 'rect', x1: 6, y1: 5, x2: 10, y2: 10 },
      ],
    },
    {
      name: '根号之门',
      hint: '根式只在 x ≥ b 的地方有图像，左端是曲线的起点。',
      seed: 'sqrt', maxForms: 1, tol: 0.27,
      points: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 4, y: 4 }],
    },
    {
      name: '整流',
      hint: '绝对值套在正弦上，波谷被压平在一条水平线上。',
      seed: 'sinAbs', maxForms: 1, tol: 0.26,
      points: [{ x: 0, y: 1 }, { x: 1.57, y: 3 }, { x: 3.14, y: 1 }],
    },
    {
      name: '三次回旋',
      hint: '三次函数的 S 形要同时照顾两个拐点，四个参数一起调。',
      seed: 'cubic', maxForms: 2, tol: 0.26,
      points: [{ x: -2, y: -2 }, { x: -1, y: 2 }, { x: 1, y: -2 }, { x: 2, y: 2 }],
    },
    {
      name: '平方反比',
      hint: '平方反比对 x 轴对称，两侧都向上张开。',
      seed: 'recipSq', maxForms: 2, tol: 0.26,
      points: [{ x: 1, y: 5 }, { x: 2, y: 2 }, { x: -1, y: 5 }, { x: -2, y: 2 }],
    },
    {
      name: '双线复合',
      hint: '根式负责右侧，直线负责左侧，右上还有一处禁区。',
      seed: 'sqrt', maxForms: 3, tol: 0.26,
      points: [{ x: 1, y: 2 }, { x: 4, y: 3 }, { x: -2, y: 0 }, { x: 2, y: 2 }],
      zones: [
        { type: 'rect', x1: -12, y1: 6, x2: -7, y2: 12 },
      ],
    },
    {
      name: '三线交错',
      hint: '三次曲线与整流正弦交错，两个禁区各守一角。',
      seed: 'cubic', maxForms: 3, tol: 0.26,
      points: [{ x: -1, y: 2 }, { x: 1, y: -2 }, { x: 0, y: 1 }, { x: 1.57, y: 3 }],
      zones: [
        { type: 'rect', x1: -9, y1: 4, x2: -5, y2: 9 },
        { type: 'circle', x: 5, y: 7, r: 1.5 },
      ],
    },
    {
      name: '收敛',
      hint: '最后一关。三次、整流正弦与平方反比三条曲线，六点三禁区。',
      seed: 'cubic', maxForms: 4, tol: 0.29,
      points: [{ x: -2, y: -2 }, { x: 2, y: 2 }, { x: 0, y: 1 }, { x: 3.14, y: 1 }, { x: 1, y: 5 }, { x: -1, y: 5 }],
      zones: [
        { type: 'rect', x1: -11, y1: 7, x2: -6, y2: 12 },
        { type: 'circle', x: 6, y: 10, r: 1.5 },
        { type: 'circle', x: -6, y: -9, r: 1.5 },
      ],
    },
  ];

  /* ---------------- 官方解法 ----------------
     label  给玩家看的解法名
     forms  逐条公式；参数与 KINDS 的 params 顺序一致
     第一组同时被当作“目标图像”，重合时自动停机并可用于对照
  --------------------------------------------- */

      const SOLUTIONS = [
    [{ label: '标准解法', forms: [{ kind: 'linear', params: [1, -1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'linear', params: [-0.67, 4.33] }] }],
    [{ label: '标准解法', forms: [{ kind: 'abs', params: [2, 1, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'abs', params: [-1, 1, 2] }] }],
    [{ label: '标准解法', forms: [{ kind: 'quadratic', params: [1, -1, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'quadratic', params: [1, -2, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'quadratic', params: [1, 0, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'quadratic', params: [1, -2, -3] }] }],
    [{ label: '标准解法', forms: [{ kind: 'quadratic', params: [1, -4, 3] }] }],
    [{ label: '标准解法', forms: [{ kind: 'reciprocal', params: [2, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'reciprocal', params: [4, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'reciprocal', params: [3, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'reciprocal', params: [2, 2] }] }],
    [{ label: '标准解法', forms: [{ kind: 'reciprocal', params: [3, 2] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sine', params: [2, 1, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sine', params: [3, 1, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sine', params: [2, 2, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sine', params: [2, 1, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sine', params: [2, 1, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'exponential', params: [1, 1, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'exponential', params: [1, 2, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'exponential', params: [1, 1, 2] }] }],
    [{ label: '标准解法', forms: [{ kind: 'exponential', params: [1, 2, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sqrt', params: [2, 0, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'sinAbs', params: [2, 1, 1] }] }],
    [{ label: '标准解法', forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }] }],
    [{ label: '标准解法', forms: [{ kind: 'recipSq', params: [4, 1] }] }],
    [{ label: '分线解法', forms: [{ kind: 'sqrt', params: [1, 0, 1] }, { kind: 'linear', params: [0.5, 1] }] }],
    [{ label: '分线解法', forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }, { kind: 'sinAbs', params: [2, 1, 1] }] }],
    [{ label: '分线解法', forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }, { kind: 'sinAbs', params: [2, 1, 1] }, { kind: 'recipSq', params: [4, 1] }] }],
  ];

  LEVELS.forEach((lv, i) => { lv.solutions = SOLUTIONS[i] || []; });

  /* 30 关的中文序号 */
  const ROMAN = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾',
    '拾壹', '拾贰', '拾叁', '拾肆', '拾伍', '拾陆', '拾柒', '拾捌', '拾玖', '贰拾',
    '贰拾壹', '贰拾贰', '贰拾叁', '贰拾肆', '贰拾伍', '贰拾陆', '贰拾柒', '贰拾捌', '贰拾玖', '叁拾'];

  /* ---------------- DOM ---------------- */

  const dom = {
    bg: $('#bg-canvas'),
    plot: $('#plot-canvas'),
    plotWrap: $('#plot-wrap'),
    scan: $('#scan'),
    hintPop: $('#hint-pop'),
    lvNumber: $('#lv-number'),
    lvName: $('#lv-name'),
    lvHint: $('#lv-hint'),
    statTarget: $('#stat-target'),
    statForm: $('#stat-form'),
    formCount: $('#form-count'),
    formList: $('#form-list'),
    paletteTag: $('#palette-tag'),
    paletteOps: $('#palette-ops'),
    paletteListBasic: $('#palette-list-basic'),
    paletteListAdvanced: $('#palette-list-advanced'),
    targetList: $('#target-list'),
    hudTargets: $('#hud-targets'),
    hudForms: $('#hud-forms'),
    hudRange: $('#hud-range'),
    hudZone: $('#hud-zone'),
    zoneBlock: $('#zone-block'),
    zoneTitle: $('#zone-title'),
    zoneList: $('#zone-list'),
    startTrack: $('#start-track'),
    startProgress: $('#start-progress'),
    levelsGrid: $('#levels-grid'),
    levelsCount: $('#levels-count'),
    toast: $('#toast'),
    winOverlay: $('#win-overlay'),
    winSub: $('#win-sub'),
    winStats: $('#win-stats'),
    btnNext: $('#btn-next'),
    btnPause: $('#btn-pause'),
    optGrid: $('#opt-grid'),
    optTicks: $('#opt-ticks'),
    optGuides: $('#opt-guides'),
    optTarget: $('#opt-target'),
    solutionsBlock: $('#solutions-block'),
    solutionList: $('#solution-list'),
    langSwitch: $('#lang-switch'),
    lesson: $('#lesson'),
    lessonEyebrow: $('#lesson-eyebrow'),
    lessonTitle: $('#lesson-title'),
    lessonForm: $('#lesson-form'),
    lessonCanvas: $('#lesson-canvas'),
    lessonPoints: $('#lesson-points'),
    lessonClose: $('#lesson-close'),
  };

  /* ---------------- 状态 ---------------- */

  const SAVE_KEY = 'function-domain.save.v1';
  let save = { unlocked: 1, cleared: [], seen: 0, lessons: [] };

  const state = {
    screen: 'start',
    levelIndex: -1,
    level: null,
    forms: [],
    targets: [],
    segments: [],
    viewR: 8,
    won: false,
    paused: false,
    hold: 0,
    hitSig: '',
    opts: { grid: true, ticks: true, guides: true, target: false },
    solutionMatch: null,
    lang: 'zh',
  };

  let view = null;
  let uid = 0;
  let hintTimer = 0;
  let toastTimer = 0;

  const plotCtx = dom.plot.getContext('2d');
  const bgCtx = dom.bg.getContext('2d');
  const bgSize = { w: 0, h: 0, dpr: 1 };

  /* ---------------- 存档 ---------------- */

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        save.unlocked = clamp(parseInt(raw.unlocked, 10) || 1, 1, LEVELS.length);
        save.cleared = Array.isArray(raw.cleared) ? raw.cleared.map(Boolean) : [];
        save.seen = clamp(parseInt(raw.seen, 10) || 0, 0, LEVELS.length);
        save.lessons = Array.isArray(raw.lessons) ? raw.lessons.filter((k) => KINDS[k]) : [];
      }
    } catch (e) {
      save = { unlocked: 1, cleared: [], seen: 0, lessons: [] };
    }
    while (save.cleared.length < LEVELS.length) save.cleared.push(false);
    /* 进度一致性：可进入的关卡永远不超过“已通关数 + 1” */
    save.unlocked = Math.min(save.unlocked, clamp(clearedCount() + 1, 1, LEVELS.length));
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlocked: save.unlocked,
        cleared: save.cleared.slice(0, LEVELS.length),
        seen: save.seen,
        lessons: save.lessons,
      }));
    } catch (e) { /* 存储不可用时静默 */ }
  }

  /* ---------------- 公式解锁 ---------------- */

  function clearedCount() {
    return save.cleared.filter(Boolean).length;
  }

  function unlockLevelOf(kind) {
    return KINDS[kind].unlock || 0;
  }

  function isKindUnlocked(kind) {
    return clearedCount() >= unlockLevelOf(kind);
  }

  /* 本次进入关卡时刚好跨过解锁线的公式，用于播放一次高亮提示 */
  function freshUnlocks() {
    const cleared = clearedCount();
    const seen = clamp(parseInt(save.seen, 10) || 0, 0, LEVELS.length);
    return ALL_KINDS.filter((k) => {
      const at = unlockLevelOf(k);
      return at > 0 && at <= cleared && at > seen;
    });
  }

  /* ---------------- 视图计算 ---------------- */

  function viewRadius(level) {
    /* 视窗只由目标点决定，禁区坐标在关卡设计时已保证落在视窗内 */
    let m = 0;
    for (const p of level.points) m = Math.max(m, Math.abs(p.x) + Math.abs(p.y));
    return Math.max(6, Math.ceil(m * 2));
  }

  /* ---------------- 禁止区 ---------------- */

  function zoneLabel(z) {
    if (z.type === 'quadrant') return t('zone.quadrant', { q: 'ⅠⅡⅢⅣ'[z.q - 1] });
    if (z.type === 'circle') return `${t('zone.circle')} (${fix(z.x)}, ${fix(z.y)}) r ${fix(z.r)}`;
    return `${t('zone.rect')} (${fix(z.x1)}, ${fix(z.y1)}) — (${fix(z.x2)}, ${fix(z.y2)})`;
  }

  /* eps 让曲线贴着坐标轴走时不会因为浮点抖动被误判 */
  function inZone(x, y, z, eps = 0.14) {
    if (z.type === 'rect') {
      return x > z.x1 && x < z.x2 && y > z.y1 && y < z.y2;
    }
    if (z.type === 'circle') {
      const dx = x - z.x;
      const dy = y - z.y;
      return dx * dx + dy * dy < z.r * z.r;
    }
    const right = z.q === 1 || z.q === 4;
    const up = z.q === 1 || z.q === 2;
    return (right ? x > eps : x < -eps) && (up ? y > eps : y < -eps);
  }

  /* 返回被曲线侵入的禁区下标集合 */
  function breachedZones() {
    const hit = new Set();
    if (!state.zones.length) return hit;
    const scale = view.scale;
    const total = state.zones.length;
    for (const curve of state.segments) {
      for (const seg of curve.segs) {
        for (let i = 0; i < seg.length; i += 2) {
          const wx = (seg[i] - view.cx) / scale;
          const wy = (view.cy - seg[i + 1]) / scale;
          for (let zi = 0; zi < total; zi++) {
            if (hit.has(zi)) continue;
            if (inZone(wx, wy, state.zones[zi])) hit.add(zi);
          }
          if (hit.size === total) return hit;
        }
      }
    }
    return hit;
  }

  function computeView() {
    if (!state.level) return;
    const rect = dom.plotWrap.getBoundingClientRect();
    const W = Math.max(160, Math.floor(rect.width));
    const H = Math.max(160, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dom.plot.width = Math.floor(W * dpr);
    dom.plot.height = Math.floor(H * dpr);
    dom.plot.style.width = W + 'px';
    dom.plot.style.height = H + 'px';

    const pad = Math.max(8, Math.min(26, Math.min(W, H) * 0.055));
    const size = Math.max(140, Math.min(W - pad * 2, H - pad * 2, 820));

    view = {
      W, H, dpr, size,
      cx: W / 2,
      cy: H / 2,
      left: W / 2 - size / 2,
      right: W / 2 + size / 2,
      top: H / 2 - size / 2,
      bottom: H / 2 + size / 2,
      scale: size / (2 * state.viewR),
    };

    /* 两侧仪表盘贴着坐标系留白边缘，而不是贴容器边缘 */
    const hudX = Math.max(18, Math.round((W - size) / 2 - 240));
    dom.plotWrap.style.setProperty('--hud-x', hudX + 'px');
  }

  const sx = (x) => view.cx + x * view.scale;
  const sy = (y) => view.cy - y * view.scale;

  /* ---------------- 屏幕切换 ---------------- */

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('is-active', el.id === `screen-${name}`);
    });
    state.screen = name;
    dom.bg.style.opacity = name === 'game' ? '0' : '1';
    if (name === 'game') {
      computeView();
      triggerScan();
    }
  }

  function triggerScan() {
    dom.scan.classList.remove('is-run');
    void dom.scan.offsetWidth;
    dom.scan.classList.add('is-run');
  }

  function toast(msg, ok = false) {
    dom.toast.textContent = msg;
    dom.toast.classList.toggle('is-ok', ok);
    dom.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('is-on'), 2200);
  }

  /* ---------------- 关卡流程 ---------------- */

  function startLevel(index) {
    const level = LEVELS[index];
    if (!level) return;

    hideWin();
    state.levelIndex = index;
    state.level = level;
    state.forms = [];
    state.won = false;
    state.paused = false;
    state.hold = 0;
    state.hitSig = '';
    state.segments = [];
    state.viewR = viewRadius(level);
    state.zones = (level.zones || []).slice();
    state.violation = false;
    state.zoneSig = '';
    state.breached = new Set();
    dom.zoneBlock.open = false;
    state.solutionMatch = null;
    state.targets = level.points.map((p, i) => ({
      x: p.x, y: p.y, hit: false, near: false, label: pt(i),
    }));

    dom.formList.innerHTML = '';
    dom.lvNumber.textContent = String(index + 1).padStart(2, '0');
    dom.lvName.textContent = levelTitle(level, index);
    dom.lvHint.textContent = levelHint(level, index);
    dom.btnPause.textContent = t('game.pause');
    dom.btnPause.classList.remove('is-on');

    const fresh = freshUnlocks();
    state.fresh = fresh;
    if (fresh.length) {
      save.seen = clearedCount();
      persist();
    }

    renderPalette();
    renderTargetList();
    renderZoneList();
    renderSolutions();
    updateStats();

    showScreen('game');
    /* 单公式关卡直接给出本关主题形态，多公式关卡从最基础的直线起步 */
    const seed = level.seed || 'linear';
    addForm(isKindUnlocked(seed) ? seed : 'linear');
    computeView();
    renderTargetList();

    /* 第一次遇到某种函数时，先用教学卡片把形态与参数讲清楚 */
    const unseen = !save.lessons.includes(seed);
    if (unseen) {
      setTimeout(() => {
        /* 玩家可能在 0.4 秒内退回主页或换关，这里再确认一次 */
        if (state.screen !== 'game' || !state.level) return;
        if ((state.level.seed || 'linear') !== seed) return;
        if (save.lessons.includes(seed)) return;
        save.lessons.push(seed);
        persist();
        openLesson(seed, fresh.includes(seed));
      }, 420);
    } else if (fresh.length) {
      setTimeout(() => openLesson(fresh[0], true), 420);
      if (fresh.length > 1) {
        setTimeout(() => {
          toast(t('toast.unlockMore', { name: fresh.slice(1).map(kindName).join(state.lang === 'en' ? ', ' : '\u3001') }), true);
        }, 1500);
      }
    }
  }

  function resetLevel() {
    if (state.levelIndex < 0) return;
    startLevel(state.levelIndex);
    toast(t('toast.reset'));
  }

  /* ---------------- 公式 ---------------- */

  function addForm(kind, preset) {
    const level = state.level;
    if (!level) return;
    if (!isKindUnlocked(kind)) {
      toast(t('toast.locked', { name: kindName(kind), n: unlockLevelOf(kind) + 1 }));
      return;
    }
    if (state.forms.length >= level.maxForms) {
      toast(t('toast.limit'));
      return;
    }

    const def = KINDS[kind];
    const form = {
      uid: ++uid,
      kind,
      color: COLORS[state.forms.length % COLORS.length],
      params: def.params.map((label, i) => ({
        label,
        value: preset && Number.isFinite(preset[i]) ? preset[i] : def.defaults[i],
        dir: 0,
        mode: 0,
        shown: null,
        el: null,
      })),
      el: null,
      lastExpr: '',
    };

    state.forms.push(form);
    state.forms.forEach((f, i) => {
      f.color = COLORS[i % COLORS.length];
      if (f.el) f.el.card.style.setProperty('--accent', f.color);
    });

    buildCard(form);
    refreshPaletteState();
    updateStats();
    renderHud();
  }

  function removeForm(form) {
    const i = state.forms.indexOf(form);
    if (i < 0) return;
    state.forms.splice(i, 1);
    if (form.el) form.el.card.remove();
    state.forms.forEach((f, idx) => {
      f.color = COLORS[idx % COLORS.length];
      if (f.el) f.el.card.style.setProperty('--accent', f.color);
    });
    refreshPaletteState();
    updateStats();
    renderHud();
  }

  function buildCard(form) {
    const def = KINDS[form.kind];

    const card = document.createElement('article');
    card.className = 'form-card';
    card.style.setProperty('--accent', form.color);

    const head = document.createElement('div');
    head.className = 'fc-head';

    const kindTag = document.createElement('span');
    kindTag.className = 'fc-kind mono';
    kindTag.textContent = def.short;

    const name = document.createElement('span');
    name.className = 'fc-name';
    name.textContent = kindName(form.kind);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'fc-del';
    del.title = '删除公式';
    del.setAttribute('aria-label', '删除公式');
    del.textContent = '\u2715';
    del.addEventListener('click', () => removeForm(form));

    head.append(kindTag, name, del);

    const expr = document.createElement('div');
    expr.className = 'fc-expr mono';
    /* 公式区只保留参数模板，具体数值交给下方输入框 */
    expr.textContent = def.form;

    const params = document.createElement('div');
    params.className = 'fc-params';
    form.params.forEach((p) => params.appendChild(buildParam(form, p)));

    card.append(head, expr, params);
    form.el = { card, expr };
    dom.formList.appendChild(card);
  }

  /* ---------------- 粘贴公式 ----------------
     只认带 x 的表达式，纯数字仍按普通粘贴处理
  -------------------------------------------- */

  function normalizeFormula(text) {
    return String(text)
      .replace(/\s+/g, '')
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/\uff08/g, '(')
      .replace(/\uff09/g, ')')
      .replace(/[\u00b7*]/g, '')
      .replace(/\u00b2/g, '^2')
      .replace(/\u00b3/g, '^3')
      .replace(/\u221a/g, 'sqrt')
      .replace(/^y=/i, '')
      .replace(/^f\(x\)=/i, '');
  }

  const coeff = (s, fallback = 1) => {
    if (s === '' || s === '+') return fallback;
    if (s === '-') return -fallback;
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : fallback;
  };

  /* 解析 bx + c 形式的尾巴，返回 [b, c] */
  function parseLinearTail(rest) {
    if (!rest) return [0, 0];
    let m = rest.match(/^([+-]\d*\.?\d*)x([+-]\d*\.?\d*)?$/);
    if (m) return [coeff(m[1]), m[2] ? parseFloat(m[2]) : 0];
    m = rest.match(/^([+-]\d+\.?\d*)$/);
    if (m) return [0, parseFloat(m[1])];
    return null;
  }

  function parseFormula(text, kind) {
    if (!/[x]|sin|sqrt/i.test(text)) return null;
    const s = normalizeFormula(text);
    let m;

    if (kind === 'linear') {
      m = s.match(/^([+-]?\d*\.?\d*)x([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), m[2] ? parseFloat(m[2]) : 0] : null;
    }

    if (kind === 'quadratic') {
      m = s.match(/^([+-]?\d*\.?\d*)x\^2(.*)$/);
      if (!m) return null;
      const tail = parseLinearTail(m[2]);
      return tail ? [coeff(m[1]), tail[0], tail[1]] : null;
    }

    if (kind === 'cubic') {
      m = s.match(/^([+-]?\d*\.?\d*)x\^3(.*)$/);
      if (!m) return null;
      let rest = m[2];
      let b = 0;
      const m2 = rest.match(/^([+-]\d*\.?\d*)x\^2(.*)$/);
      if (m2) {
        b = coeff(m2[1]);
        rest = m2[2];
      }
      const tail = parseLinearTail(rest);
      return tail ? [coeff(m[1]), b, tail[0], tail[1]] : null;
    }

    if (kind === 'abs') {
      m = s.match(/^([+-]?\d*\.?\d*)\|x([+-]\d*\.?\d*)?\|([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), m[2] ? -parseFloat(m[2]) : 0, m[3] ? parseFloat(m[3]) : 0] : null;
    }

    if (kind === 'reciprocal') {
      m = s.match(/^([+-]?\d*\.?\d*)\/x([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), m[2] ? parseFloat(m[2]) : 0] : null;
    }

    if (kind === 'recipSq') {
      m = s.match(/^([+-]?\d*\.?\d*)\/x\^2([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), m[2] ? parseFloat(m[2]) : 0] : null;
    }

    if (kind === 'sine') {
      m = s.match(/^([+-]?\d*\.?\d*)sin\(([+-]?\d*\.?\d*)x\)([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), coeff(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
    }

    if (kind === 'sinAbs') {
      m = s.match(/^([+-]?\d*\.?\d*)\|sin\(([+-]?\d*\.?\d*)x\)\|([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), coeff(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
    }

    if (kind === 'exponential') {
      m = s.match(/^([+-]?\d*\.?\d*)2\^\(([+-]?\d*\.?\d*)x\)([+-]\d*\.?\d*)?$/)
        || s.match(/^([+-]?\d*\.?\d*)2\^([+-]?\d*\.?\d*)x([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), coeff(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
    }

    if (kind === 'sqrt') {
      m = s.match(/^([+-]?\d*\.?\d*)sqrt\(x([+-]\d*\.?\d*)?\)([+-]\d*\.?\d*)?$/);
      return m ? [coeff(m[1]), m[2] ? -parseFloat(m[2]) : 0, m[3] ? parseFloat(m[3]) : 0] : null;
    }

    return null;
  }

  function applyParsedFormula(form, values) {
    if (!values || values.length !== form.params.length) return false;
    stopAll();
    const limit = state.viewR * 4;
    form.params.forEach((p, i) => {
      const v = clamp(values[i], -limit, limit);
      p.value = v;
      p.dir = 0;
      p.mode = 0;
      p.shown = null;
      if (p.el) p.el.input.value = fix(v);
      syncParam(form, p);
    });
    toast(t('toast.pasteOk', { expr: KINDS[form.kind].expr(form.params.map((p) => p.value)) }), true);
    return true;
  }

  function buildParam(form, param) {
    const row = document.createElement('div');
    row.className = 'param';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'param-label';

    const label = document.createElement('span');
    label.className = 'pname';
    label.textContent = param.label;

    const input = document.createElement('input');
    input.className = 'num';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.spellcheck = false;
    input.value = fix(param.value);
    input.setAttribute('aria-label', `参数 ${param.label}`);

    /* 粘贴整条公式时直接解析成参数，纯数字仍交给浏览器默认粘贴 */
    input.addEventListener('paste', (e) => {
      const clip = e.clipboardData || window.clipboardData;
      const text = clip ? clip.getData('text') : '';
      if (!text || !/x/i.test(text)) return;
      const values = parseFormula(text, form.kind);
      e.preventDefault();
      if (!values) {
        toast(t('toast.pasteBad', { form: KINDS[form.kind].form }));
        return;
      }
      applyParsedFormula(form, values);
    });

    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const raw = input.value.replace(/\u2212/g, '-').trim();
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      const limit = state.viewR * 4;
      const next = clamp(v, -limit, limit);
      param.value = next;
      param.dir = 0;
      param.mode = 0;
      syncParam(form, param);
      /* 超出视窗可计算范围的值直接写回，避免输入框与曲线不一致 */
      if (next !== v) {
        input.value = fix(next);
        param.shown = input.value;
      }
    });
    input.addEventListener('blur', () => {
      input.value = fix(param.value);
      param.shown = input.value;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'ArrowUp') { e.preventDefault(); nudge(param, 0.1); input.value = fix(param.value); }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudge(param, -0.1); input.value = fix(param.value); }
    });

    labelWrap.append(label, input);

    const up = buildStep(form, param, 1);
    const down = buildStep(form, param, -1);

    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'stop';
    stop.textContent = '停止';
    stop.disabled = true;
    stop.addEventListener('click', () => {
      param.dir = 0;
      param.mode = 0;
      syncParam(form, param);
    });

    row.append(labelWrap, up, down, stop);
    param.el = { row, input, up, down, stop };
    return row;
  }

  function nudge(param, delta) {
    param.value = clamp(param.value + delta, -state.viewR * 4, state.viewR * 4);
    param.dir = 0;
    param.mode = 0;
  }

  function buildStep(form, param, dir) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step ' + (dir > 0 ? 'up' : 'down');
    btn.dataset.dir = String(dir);
    btn.dataset.active = 'false';
    btn.setAttribute('aria-label', `${param.label} ${dir > 0 ? '增加' : '减少'}`);

    const arrow = document.createElement('i');
    arrow.textContent = dir > 0 ? '\u25b2' : '\u25bc';

    btn.append(arrow);

    /* 恒定 1/s 匀速；再次点击同一方向即暂停 */
    btn.addEventListener('click', () => {
      param.dir = param.dir === dir ? 0 : dir;
      param.mode = 0;
      syncParam(form, param);
    });

    return btn;
  }

  function syncParam(form, param) {
    if (!param.el) return;
    const { up, down, stop } = param.el;
    const pairs = [[up, 1], [down, -1]];
    for (const [btn, dir] of pairs) {
      const active = param.dir === dir;
      btn.dataset.active = active ? 'true' : 'false';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    stop.disabled = param.dir === 0;
  }

  function stopAll() {
    for (const form of state.forms) {
      for (const p of form.params) {
        p.dir = 0;
        p.mode = 0;
        syncParam(form, p);
      }
    }
  }

  function hasRunning() {
    return state.forms.some((form) => form.params.some((p) => p.dir !== 0));
  }

  function stepParam(form, param, dt) {
    const lim = state.viewR * 4;
    const dir = param.dir;
    if (!dir) return;

    param.value += dir * dt;

    if (Math.abs(param.value) >= lim) {
      param.value = (param.value >= 0 ? 1 : -1) * lim;
      param.dir = 0;
      param.mode = 0;
      syncParam(form, param);
    }
  }

  function updateParams(dt) {
    for (const form of state.forms) {
      for (const p of form.params) {
        if (p.dir !== 0) stepParam(form, p, dt);
        const txt = fix(p.value);
        if (p.shown !== txt) {
          p.shown = txt;
          if (document.activeElement !== p.el.input) p.el.input.value = txt;
        }
      }
    }
  }

  /* ---------------- 侧栏渲染 ---------------- */

  function renderPalette() {
    if (!state.level) return;
    const cleared = clearedCount();
    const fresh = state.fresh || [];
    const openCount = ALL_KINDS.filter((k) => cleared >= unlockLevelOf(k)).length;

    dom.paletteTag.textContent = `${openCount} / ${ALL_KINDS.length}`;
    dom.paletteOps.innerHTML = OPS
      .map((o) => `<span class="op-chip" title="${o.tip}">${o.mark}</span>`)
      .join('');

    fillPaletteGroup(dom.paletteListBasic, BASIC_KINDS, cleared, fresh);
    fillPaletteGroup(dom.paletteListAdvanced, ADVANCED_KINDS, cleared, fresh);
    refreshPaletteState();
  }

  function fillPaletteGroup(host, kinds, cleared, fresh) {
    host.innerHTML = '';
    kinds.forEach((kind) => {
      const def = KINDS[kind];
      const at = unlockLevelOf(kind);
      const unlocked = cleared >= at;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.kind = kind;
      btn.className = 'palette-item'
        + (unlocked ? '' : ' is-locked')
        + (fresh.includes(kind) ? ' is-new' : '');
      btn.disabled = !unlocked;
      btn.title = unlocked ? `${kindName(kind)} ${def.form}` : t('toast.locked', { name: kindName(kind), n: at + 1 });
      btn.innerHTML = unlocked
        ? `<span class="pi-top"><span class="pi-name">${kindName(kind)}</span>`
          + `<span class="pi-short">${def.short}<b class="pi-plus">+</b></span></span>`
          + `<span class="pi-expr">${def.form}</span>`
          + `<span class="pi-info" title="\u67e5\u770b\u793a\u4f8b\u4e0e\u7279\u6027">?</span>`
        : `<span class="pi-top"><span class="pi-name">${kindName(kind)}</span>`
          + `<span class="pi-lock">LV ${String(at + 1).padStart(2, '0')}</span></span>`;
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.pi-info')) {
          openLesson(kind, false);
          return;
        }
        addForm(kind);
      });
      host.appendChild(btn);
    });
  }

  function refreshPaletteState() {
    const full = !state.level || state.forms.length >= state.level.maxForms;
    [dom.paletteListBasic, dom.paletteListAdvanced].forEach((list) => {
      list.querySelectorAll('.palette-item').forEach((b) => {
        /* 满额时只做弱化，仍可点击，由 addForm 给出“已达上限”的提示 */
        b.classList.toggle('is-full', full && !b.classList.contains('is-locked'));
      });
    });
  }

  function updateStats() {
    if (!state.level) return;
    const hits = state.targets.filter((t) => t.hit).length;
    dom.statTarget.textContent = `${hits} / ${state.targets.length}`;
    dom.formCount.textContent = `${state.forms.length} / ${state.level.maxForms}`;
    dom.statForm.textContent = `${state.forms.length} / ${state.level.maxForms}`;
  }

  function renderTargetList() {
    if (!state.level) return;
    const frag = document.createDocumentFragment();
    state.targets.forEach((t) => {
      const li = document.createElement('li');
      li.className = t.hit ? 'is-hit' : '';
      li.innerHTML =
        `<span class="tl-id">${t.label}</span>` +
        `<span>(${fix(t.x)}, ${fix(t.y)})</span>` +
        `<span>${t.hit ? 'ALIGNED' : '\u2014'}</span>`;
      frag.appendChild(li);
    });
    dom.targetList.innerHTML = '';
    dom.targetList.appendChild(frag);
    renderHud();
  }

  function renderZoneList() {
    if (!state.level) return;
    const has = state.zones.length > 0;
    dom.zoneBlock.hidden = !has;
    if (!has) return;
    const breached = state.breached || new Set();
    dom.zoneTitle.textContent = `${t('zone.title')} ×${state.zones.length}`;
    dom.zoneBlock.classList.toggle('is-hot', breached.size > 0);
    dom.zoneList.innerHTML = state.zones
      .map((z, i) => {
        const hot = breached.has(i);
        return `<li class="${hot ? 'is-hot' : ''}">`
          + `<span class="zl-mark">${hot ? '\u00d7' : '\u00b7'}</span>`
          + `<span>${zoneLabel(z)}</span></li>`;
      })
      .join('');
    if (breached.size > 0) dom.zoneBlock.open = true;
  }

  /* ---------------- 官方解法 ---------------- */

  const SOLVE_EPS = 0.08;

  function paramsNear(form, spec) {
    if (form.params.length !== spec.length) return false;
    for (let i = 0; i < spec.length; i++) {
      if (Math.abs(form.params[i].value - spec[i]) > SOLVE_EPS) return false;
    }
    return true;
  }

  /* 当前公式集合是否与某个官方解法完全重合（忽略顺序） */
  function matchedSolution() {
    const sols = (state.level && state.level.solutions) || [];
    if (!sols.length || !state.forms.length) return null;
    for (const sol of sols) {
      if (sol.forms.length !== state.forms.length) continue;
      const used = new Array(sol.forms.length).fill(false);
      let ok = true;
      for (const form of state.forms) {
        let found = -1;
        for (let i = 0; i < sol.forms.length; i++) {
          if (used[i] || sol.forms[i].kind !== form.kind) continue;
          if (paramsNear(form, sol.forms[i].params)) { found = i; break; }
        }
        if (found < 0) { ok = false; break; }
        used[found] = true;
      }
      if (ok) return sol;
    }
    return null;
  }

  function solLabel(sol) {
    return t(sol.forms.length > 1 ? 'sol.split' : 'sol.standard');
  }

  function solutionExpr(sol) {
    return sol.forms.map((s) => KINDS[s.kind].expr(s.params)).join('    ');
  }

  function applySolution(sol) {
    if (!sol) return;
    stopAll();
    [...state.forms].forEach((form) => removeForm(form));
    sol.forms.forEach((spec) => addForm(spec.kind, spec.params));
    toast(t('toast.applySol', { name: solLabel(sol) }), true);
  }

  function renderSolutions() {
    if (!state.level) return;
    const sols = state.level.solutions || [];
    dom.solutionsBlock.hidden = !sols.length;
    if (!sols.length) return;
    dom.solutionList.innerHTML = '';
    sols.forEach((sol, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="sol-main"><span class="sol-tag mono">${String.fromCharCode(65 + i)}</span>`
        + `<span class="sol-label">${solLabel(sol)}</span></span>`
        + `<code class="sol-expr">${solutionExpr(sol)}</code>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sol-apply';
      btn.textContent = t('btn.apply');
      btn.addEventListener('click', () => applySolution(sol));
      li.appendChild(btn);
      dom.solutionList.appendChild(li);
    });
    renderSolutionMatch();
  }

  /* 与某条官方解法重合时高亮对应条目 */
  function renderSolutionMatch() {
    const sols = (state.level && state.level.solutions) || [];
    const items = dom.solutionList.children;
    const matched = sols.indexOf(state.solutionMatch);
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-matched', i === matched);
    }
  }

  /* ---------------- 函数教学 ---------------- */

  let lessonWasPaused = false;

  function fillLesson(kind, isNew) {
    const def = KINDS[kind];
    dom.lessonEyebrow.textContent = t(isNew ? 'lesson.new' : 'lesson.brief');
    dom.lessonTitle.textContent = state.lang === 'en'
      ? `${KIND_EN[kind] || def.name}  ${def.short}`
      : `${def.name}  ${def.short}`;
    dom.lessonForm.textContent = def.form;
    dom.lessonPoints.innerHTML = lessonPoints(kind)
      .map((text) => `<li><span>${text}</span></li>`)
      .join('');
  }

  function openLesson(kind, isNew) {
    const def = KINDS[kind];
    if (!def || !def.lesson || !dom.lesson.hidden) return;
    if (state.screen !== 'game' || !state.level) return;

    state.lessonKind = kind;
    state.lessonIsNew = isNew;
    fillLesson(kind, isNew);
    dom.lesson.hidden = false;

    /* 教学打开时暂停，避免参数在遮罩后面继续跑 */
    lessonWasPaused = state.paused;
    state.paused = true;

    requestAnimationFrame(() => drawLessonSample(kind, def.lesson.sample));
  }

  function closeLesson() {
    if (dom.lesson.hidden) return;
    dom.lesson.hidden = true;
    state.paused = lessonWasPaused;
  }

  function drawLessonSample(kind, params) {
    const canvas = dom.lessonCanvas;
    const wrap = canvas.parentElement;
    const cssW = Math.max(240, Math.round(wrap.clientWidth || 360));
    const cssH = Math.round(Math.min(210, Math.max(150, cssW * 0.52)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const R = 6;
    const size = Math.min(cssW, cssH) - 22;
    const cx = cssW / 2;
    const cy = cssH / 2;
    const scale = size / (2 * R);
    const left = cx - size / 2;
    const top = cy - size / 2;
    const right = left + size;
    const bottom = top + size;

    ctx.strokeStyle = 'rgba(123, 241, 196, .1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -R; i <= R; i++) {
      const gx = Math.round(cx + i * scale) + 0.5;
      const gy = Math.round(cy - i * scale) + 0.5;
      ctx.moveTo(gx, top);
      ctx.lineTo(gx, bottom);
      ctx.moveTo(left, gy);
      ctx.lineTo(right, gy);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(228, 248, 242, .55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left, Math.round(cy) + 0.5);
    ctx.lineTo(right, Math.round(cy) + 0.5);
    ctx.moveTo(Math.round(cx) + 0.5, top);
    ctx.lineTo(Math.round(cx) + 0.5, bottom);
    ctx.stroke();

    const fn = KINDS[kind].f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, size, size);
    ctx.clip();
    ctx.strokeStyle = '#7bf1c4';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(123, 241, 196, .65)';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    let started = false;
    for (let px = left; px <= right + 0.5; px += 1) {
      const x = (px - cx) / scale;
      const y = fn(x, params);
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      const py = cy - y * scale;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderHud() {
    if (!state.level) return;
    dom.hudRange.textContent = `VIEW \u00b1${state.viewR}`;
    if (dom.hudZone) {
      dom.hudZone.textContent = state.zones.length
        ? `ZONE ${state.zones.length} \u00b7 ${state.violation ? 'BREACH' : 'CLEAR'}`
        : '';
      dom.hudZone.classList.toggle('is-hot', !!state.violation);
    }
    dom.hudTargets.innerHTML = state.targets
      .map((t) =>
        `<li class="${t.hit ? 'is-hit' : ''}">` +
        `<span class="ht-id">${t.label}</span>` +
        `<span class="ht-coord">${fix(t.x)}, ${fix(t.y)}</span>` +
        `<span class="ht-state">${t.hit ? '\u25cf' : '\u25cb'}</span></li>`)
      .join('');
    dom.hudForms.innerHTML = state.forms
      .map((f) =>
        `<li><i style="background:${f.color};box-shadow:0 0 9px ${f.color}"></i>` +
        `<span>${kindName(f.kind)}</span></li>`)
      .join('');
  }

  /* ---------------- 曲线采样 ---------------- */

  function sampleCurve(form) {
    const p = form.params.map((q) => q.value);
    const fn = KINDS[form.kind].f;
    const segs = [];
    let cur = null;
    const step = 2;
    const R = state.viewR;

    for (let px = view.left; px <= view.right + 0.5; px += step) {
      const x = clamp((px - view.cx) / view.scale, -R, R);
      let y;
      try {
        y = fn(x, p);
      } catch (e) {
        y = NaN;
      }
      if (!Number.isFinite(y)) { cur = null; continue; }

      const py = view.cy - y * view.scale;
      if (py < view.top - view.size || py > view.bottom + view.size) { cur = null; continue; }

      if (!cur) { cur = []; segs.push(cur); }
      cur.push(px, py);
    }
    return segs;
  }

  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function minDist(segs, px, py) {
    let best = Infinity;
    for (let s = 0; s < segs.length; s++) {
      const arr = segs[s];
      if (arr.length === 2) {
        best = Math.min(best, Math.hypot(px - arr[0], py - arr[1]));
        continue;
      }
      for (let i = 0; i < arr.length - 2; i += 2) {
        const d = segDist(px, py, arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  /* ---------------- 绘图 ---------------- */

  function renderPlot(time) {
    if (!view) return;
    const ctx = plotCtx;
    const { W, H, dpr, left, top, size, cx, cy, scale } = view;
    const R = state.viewR;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* 视窗内的底色 */
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, size, size);
    ctx.clip();

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.72);
    glow.addColorStop(0, 'rgba(32, 96, 82, 0.26)');
    glow.addColorStop(1, 'rgba(4, 10, 11, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(left, top, size, size);

    drawGrid(ctx);
    drawZones(ctx);
    drawAxes(ctx, R);
    drawTargetCurves(ctx);
    drawCurves(ctx);
    drawAxesOverlay(ctx);
    drawTargets(ctx, time);
    drawQuadrants(ctx, size);

    ctx.restore();

    /* 视窗边框 */
    ctx.strokeStyle = 'rgba(123, 241, 196, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(left) + 0.5, Math.round(top) + 0.5, Math.round(size) - 1, Math.round(size) - 1);
  }

  function drawGrid(ctx) {
    if (!state.opts.grid) return;
    const { top, left, size, cx, cy, scale } = view;
    const R = state.viewR;
    const right = left + size;
    const bottom = top + size;

    for (let i = -R; i <= R; i++) {
      if (i === 0) continue;
      const major = i % 5 === 0;
      const x = Math.round(cx + i * scale) + 0.5;
      const y = Math.round(cy - i * scale) + 0.5;

      ctx.lineWidth = 1;
      ctx.strokeStyle = major ? 'rgba(123, 241, 196, 0.18)' : 'rgba(123, 241, 196, 0.075)';

      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  }

  /* ---------------- 禁区绘制 ---------------- */

  function zonePath(ctx, z) {
    const { cx, cy, scale, left, right, top, bottom } = view;
    ctx.beginPath();
    if (z.type === 'rect') {
      ctx.rect(cx + z.x1 * scale, cy - z.y2 * scale, (z.x2 - z.x1) * scale, (z.y2 - z.y1) * scale);
    } else if (z.type === 'circle') {
      ctx.arc(cx + z.x * scale, cy - z.y * scale, Math.max(3, z.r * scale), 0, Math.PI * 2);
    } else {
      const w = z.q === 1 || z.q === 4 ? right - cx : cx - left;
      const h = z.q === 1 || z.q === 2 ? cy - top : bottom - cy;
      ctx.rect(z.q === 1 || z.q === 4 ? cx : cx - w, z.q === 1 || z.q === 2 ? cy - h : cy, w, h);
    }
    ctx.closePath();
  }

  function drawZones(ctx) {
    if (!state.zones.length) return;
    const { left, top, size } = view;
    const span = size * 2;
    const hot = state.violation;

    for (const z of state.zones) {
      ctx.save();
      zonePath(ctx, z);
      ctx.fillStyle = hot ? 'rgba(255, 104, 124, .16)' : 'rgba(255, 104, 124, .07)';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 104, 124, .13)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d = -span; d < span; d += 13) {
        ctx.moveTo(left + d, top);
        ctx.lineTo(left + d + span, top + span);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      zonePath(ctx, z);
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = hot ? 'rgba(255, 118, 136, .9)' : 'rgba(255, 118, 136, .38)';
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAxes(ctx, R) {
    const { left, right, top, bottom, cx, cy, scale } = view;

    ctx.strokeStyle = 'rgba(228, 248, 242, 0.72)';
    ctx.fillStyle = 'rgba(228, 248, 242, 0.72)';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(left + 6, cy);
    ctx.lineTo(right - 8, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right - 2, cy);
    ctx.lineTo(right - 10, cy - 4);
    ctx.lineTo(right - 10, cy + 4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, bottom - 6);
    ctx.lineTo(cx, top + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, top + 2);
    ctx.lineTo(cx - 4, top + 10);
    ctx.lineTo(cx + 4, top + 10);
    ctx.closePath();
    ctx.fill();

    if (!state.opts.ticks) return;

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(123, 241, 196, 0.42)';
    ctx.strokeStyle = 'rgba(123, 241, 196, 0.3)';
    ctx.lineWidth = 1;

    const stepLabel = R > 9 ? 2 : 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = -R; i <= R; i += stepLabel) {
      if (i === 0) continue;
      const x = Math.round(cx + i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, cy - 3);
      ctx.lineTo(x, cy + 3);
      ctx.stroke();
      if ((i % (stepLabel * 2) === 0 || R <= 6) && Math.abs(i) < R) {
        ctx.fillText(String(i), x, cy + 7);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = -R; i <= R; i += stepLabel) {
      if (i === 0) continue;
      const y = Math.round(cy - i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y);
      ctx.lineTo(cx + 3, y);
      ctx.stroke();
      if ((i % (stepLabel * 2) === 0 || R <= 6) && Math.abs(i) < R) {
        ctx.fillText(String(i), cx - 7, y);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(123, 241, 196, 0.5)';
    ctx.fillText('O', cx - 6, cy + 5);
  }

  /* 曲线画完后再压一层细轴，保证在曲线贴着坐标轴时仍能看清象限划分 */
  function drawAxesOverlay(ctx) {
    const { left, right, top, bottom, cx, cy } = view;
    ctx.save();
    ctx.strokeStyle = 'rgba(233, 248, 242, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 6, Math.round(cy) + 0.5);
    ctx.lineTo(right - 8, Math.round(cy) + 0.5);
    ctx.moveTo(Math.round(cx) + 0.5, bottom - 6);
    ctx.lineTo(Math.round(cx) + 0.5, top + 8);
    ctx.stroke();
    ctx.restore();
  }

  /* 目标图像：官方解法的曲线，用淡色虚线垫在玩家曲线下方 */
  function drawTargetCurves(ctx) {
    if (!state.opts.target || !state.level) return;
    const sol = (state.level.solutions || [])[0];
    if (!sol) return;

    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 228, 170, .38)';
    ctx.shadowColor = 'rgba(255, 228, 170, .3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (const spec of sol.forms) {
      const segs = sampleCurve({ kind: spec.kind, params: spec.params.map((v) => ({ value: v })) });
      for (const arr of segs) {
        ctx.moveTo(arr[0], arr[1]);
        for (let i = 2; i < arr.length; i += 2) ctx.lineTo(arr[i], arr[i + 1]);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCurves(ctx) {
    state.segments = [];

    for (const form of state.forms) {
      const segs = sampleCurve(form);
      state.segments.push({ color: form.color, segs });

      if (!segs.length) continue;

      /* 触碰禁区时整条曲线转成警示红，恢复后回到公式配色 */
      const tone = state.violation ? '#ff6b81' : form.color;

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = tone;
      ctx.shadowColor = tone;

      /* 外层光晕 */
      ctx.globalAlpha = 0.35;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (const arr of segs) {
        ctx.moveTo(arr[0], arr[1]);
        for (let i = 2; i < arr.length; i += 2) ctx.lineTo(arr[i], arr[i + 1]);
      }
      ctx.stroke();

      /* 主线 */
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      for (const arr of segs) {
        ctx.moveTo(arr[0], arr[1]);
        for (let i = 2; i < arr.length; i += 2) ctx.lineTo(arr[i], arr[i + 1]);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawTargets(ctx, time) {
    if (!view) return;

    for (let i = 0; i < state.targets.length; i++) {
      const t = state.targets[i];
      const px = sx(t.x);
      const py = sy(t.y);
      const color = t.hit ? '#ffe1a3' : '#ffc06a';

      if (state.opts.guides) {
        ctx.save();
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = t.hit ? 'rgba(255, 225, 163, 0.3)' : 'rgba(255, 192, 106, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, view.cy);
        ctx.moveTo(px, py);
        ctx.lineTo(view.cx, py);
        ctx.stroke();
        ctx.restore();
      }

      /* 旋转虚环 */
      ctx.save();
      ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = -time * 16;
      ctx.strokeStyle = t.hit ? 'rgba(255, 225, 163, 0.85)' : 'rgba(255, 192, 106, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      /* 脉冲 */
      const ph = (time * 0.65 + i * 0.24) % 1;
      ctx.strokeStyle = `rgba(255, 192, 106, ${0.34 * (1 - ph)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 6 + ph * 24, 0, Math.PI * 2);
      ctx.stroke();

      /* 中心点 */
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = t.hit ? 22 : 14;
      ctx.beginPath();
      ctx.arc(px, py, t.hit ? 4.6 : 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* 标签 */
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = t.hit ? 'rgba(255, 235, 190, 0.95)' : 'rgba(255, 214, 160, 0.72)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t.label, px + 15, py - 13);
    }
  }

  function drawQuadrants(ctx, size) {
    const { cx, cy } = view;
    const d = size * 0.285;
    const f = Math.max(11, size * 0.036);

    ctx.font = `${f}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = 'rgba(123, 241, 196, 0.16)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText('\u2160', cx + d, cy - d);
    ctx.fillText('\u2161', cx - d, cy - d);
    ctx.fillText('\u2162', cx - d, cy + d);
    ctx.fillText('\u2163', cx + d, cy + d);
  }

  /* ---------------- 命中判定 ---------------- */

  function checkWin(dt) {
    if (!view || state.won || state.paused) return;

    const tolPx = Math.max(5, state.level.tol * view.scale);
    /* 停机阈值比命中阈值更严，停下来的位置更贴近光点中心 */
    const stopTol = tolPx * 0.65;
    const running = hasRunning();
    let all = true;
    let sig = '';
    let autoStop = '';

    for (const t of state.targets) {
      const px = sx(t.x);
      const py = sy(t.y);
      let best = Infinity;
      for (const c of state.segments) {
        if (!c.segs.length) continue;
        best = Math.min(best, minDist(c.segs, px, py));
        if (best <= tolPx) break;
      }
      const wasNear = t.near;
      t.hit = best <= tolPx;
      /* 自动增减时曲线扫到光点就立刻停住，避免惯性冲过头 */
      const near = best <= stopTol;
      if (near && !wasNear && running) autoStop = t('toast.hitStop');
      t.near = near;
      sig += t.hit ? '1' : '0';
      if (!t.hit) all = false;
    }

    const sol = matchedSolution();
    if (sol && sol !== state.solutionMatch && running) autoStop = t('toast.matchStop');
    if (sol !== state.solutionMatch) {
      state.solutionMatch = sol;
      renderSolutionMatch();
    }

    if (autoStop) {
      stopAll();
      toast(autoStop, true);
    }

    if (sig !== state.hitSig) {
      state.hitSig = sig;
      updateStats();
      renderTargetList();
    }

    /* 禁区：曲线任何一段进入禁区都算失败，即使所有光点已经命中 */
    const hit = breachedZones();
    const breach = hit.size > 0;
    const zoneSig = `${[...hit].join(',')}|${sig}`;
    if (zoneSig !== state.zoneSig) {
      state.zoneSig = zoneSig;
      state.violation = breach;
      state.breached = hit;
      renderZoneList();
      renderHud();
      if (breach && all) toast(t('toast.zone'), false);
    }

    if (all && !breach) {
      state.hold += dt;
      if (state.hold > 0.26) triggerWin();
    } else {
      state.hold = 0;
    }
  }

  function triggerWin() {
    state.won = true;
    state.hold = 0;
    stopAll();

    const idx = state.levelIndex;
    save.cleared[idx] = true;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, idx + 2));
    persist();
    renderStartProgress();

    const lv = state.level;
    refreshWinText();
    dom.winStats.innerHTML =
      `<div><span>LEVEL</span><b>${String(idx + 1).padStart(2, '0')}</b></div>` +
      `<div><span>POINTS</span><b>${state.targets.length}</b></div>` +
      `<div><span>FORMS</span><b>${state.forms.length}</b></div>` +
      `<div><span>ZONES</span><b>${state.zones.length}</b></div>` +
      `<div><span>TOLERANCE</span><b>${lv.tol.toFixed(2)}</b></div>`;

    const hasNext = idx + 1 < LEVELS.length;

    dom.winOverlay.classList.add('is-open');
  }

  function hideWin() {
    dom.winOverlay.classList.remove('is-open');
  }

  /* ---------------- 提示 ---------------- */

  function showHint() {
    if (!state.level) return;
    dom.hintPop.textContent = levelHint(state.level, state.levelIndex);
    dom.hintPop.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => dom.hintPop.classList.remove('is-on'), 4200);
  }

  /* ---------------- 背景动画 ---------------- */

  const stars = [];

  function resizeBg() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bgSize.w = window.innerWidth;
    bgSize.h = window.innerHeight;
    bgSize.dpr = dpr;
    dom.bg.width = Math.floor(bgSize.w * dpr);
    dom.bg.height = Math.floor(bgSize.h * dpr);
    dom.bg.style.width = bgSize.w + 'px';
    dom.bg.style.height = bgSize.h + 'px';

    if (!stars.length) {
      for (let i = 0; i < 70; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: Math.random() * 1.4 + 0.3,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function drawBg(time) {
    const { w, h, dpr } = bgSize;
    if (!w || !h) return;
    const ctx = bgCtx;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#05090a');
    base.addColorStop(0.55, '#06100f');
    base.addColorStop(1, '#04080a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const halo = ctx.createRadialGradient(w * 0.72, h * 0.32, 0, w * 0.72, h * 0.32, Math.max(w, h) * 0.62);
    halo.addColorStop(0, 'rgba(43, 146, 118, 0.2)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.1 + s.ph));
      ctx.fillStyle = `rgba(200, 255, 235, ${0.16 * tw})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const amp = 26 + k * 30;
      const y0 = h * (0.22 + k * 0.15);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = y0
          + Math.sin(x * 0.0042 + time * (0.24 + k * 0.06) + k * 1.7) * amp
          + Math.sin(x * 0.0014 - time * 0.12 + k * 0.9) * amp * 0.62;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = k % 2 ? 'rgba(255, 192, 106, 0.05)' : 'rgba(123, 241, 196, 0.065)';
      ctx.stroke();
    }
  }

  /* ---------------- 开始与关卡列表 ---------------- */

  function nextPlayable() {
    for (let i = 0; i < LEVELS.length; i++) {
      if (i < save.unlocked && !save.cleared[i]) return i;
    }
    return clamp(save.unlocked - 1, 0, LEVELS.length - 1);
  }

  function renderStartProgress() {
    const cleared = save.cleared.filter(Boolean).length;
    dom.startProgress.textContent = `${String(cleared).padStart(2, '0')} / ${LEVELS.length} ${t('start.progress')}`;
    dom.startTrack.innerHTML = LEVELS
      .map((_, i) => `<i class="${save.cleared[i] ? 'on' : ''}"></i>`)
      .join('');
  }

  function renderLevels() {
    const cleared = save.cleared.filter(Boolean).length;
    dom.levelsCount.textContent = `${String(cleared).padStart(2, '0')} / ${LEVELS.length} CLEARED`;
    dom.levelsGrid.innerHTML = '';

    LEVELS.forEach((lv, i) => {
      const locked = i >= save.unlocked;
      const done = !!save.cleared[i];
      const card = document.createElement('button');
      card.type = 'button';
      card.disabled = locked;
      card.className = 'level-card' + (locked ? ' is-locked' : '') + (done ? ' is-cleared' : '');
      card.style.animationDelay = `${Math.min(i * 0.018, 0.4)}s`;
      const badge = lv.maxForms > 1 ? 'MIX' : (KINDS[lv.seed] || KINDS.linear).short;
      const zc = (lv.zones || []).length;
      card.innerHTML =
        `<span class="lc-index">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="lc-name">${levelName(lv, i)}</span>` +
        `<span class="lc-kinds"><i class="lc-kind">${badge}</i><i class="lc-kind">\u00d7${lv.maxForms}</i>`
        + `<i class="lc-kind">${lv.points.length}P</i>`
        + (zc ? `<i class="lc-kind is-warn">${zc}Z</i>` : '')
        + `</span>` +
        `<span class="lc-state">${locked ? t('state.locked') : done ? t('state.cleared') : t('state.pending')}</span>`;
      card.addEventListener('click', () => {
        if (!locked) startLevel(i);
      });
      dom.levelsGrid.appendChild(card);
    });
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindUI() {
    $('#btn-start').addEventListener('click', () => startLevel(nextPlayable()));
    $('#btn-open-levels').addEventListener('click', () => {
      renderLevels();
      showScreen('levels');
    });
    $('#btn-levels-back').addEventListener('click', () => {
      renderStartProgress();
      showScreen('start');
    });

    $('#btn-hint').addEventListener('click', showHint);
    $('#btn-stop-all').addEventListener('click', () => {
      stopAll();
      toast(t('toast.stopped'));
    });

    dom.btnPause.addEventListener('click', () => {
      if (state.won) return;
      state.paused = !state.paused;
      dom.btnPause.textContent = state.paused ? t('game.resume') : t('game.pause');
      dom.btnPause.classList.toggle('is-on', state.paused);
    });

    $('#btn-reset').addEventListener('click', resetLevel);
    $('#btn-home').addEventListener('click', () => {
      hideWin();
      renderStartProgress();
      showScreen('start');
    });

    dom.btnNext.addEventListener('click', () => {
      const next = state.levelIndex + 1;
      hideWin();
      if (next < LEVELS.length) startLevel(next);
      else {
        renderStartProgress();
        showScreen('start');
      }
    });
    $('#btn-replay').addEventListener('click', () => {
      hideWin();
      startLevel(state.levelIndex);
    });
    $('#btn-win-home').addEventListener('click', () => {
      hideWin();
      renderStartProgress();
      showScreen('start');
    });

    if (dom.langSwitch) {
      dom.langSwitch.addEventListener('click', () => setLang(state.lang === 'zh' ? 'en' : 'zh'));
    }

    dom.lessonClose.addEventListener('click', closeLesson);
    dom.lesson.addEventListener('click', (e) => {
      if (e.target === dom.lesson) closeLesson();
    });

    dom.optGrid.addEventListener('change', () => { state.opts.grid = dom.optGrid.checked; });
    dom.optTicks.addEventListener('change', () => { state.opts.ticks = dom.optTicks.checked; });
    dom.optGuides.addEventListener('change', () => { state.opts.guides = dom.optGuides.checked; });
    dom.optTarget.addEventListener('change', () => { state.opts.target = dom.optTarget.checked; });

    window.addEventListener('resize', () => {
      resizeBg();
      if (state.screen === 'game') computeView();
    });

    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (state.screen === 'game') computeView();
      }).observe(dom.plotWrap);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!dom.lesson.hidden) { closeLesson(); return; }
        if (dom.winOverlay.classList.contains('is-open')) return;
        if (state.screen === 'game') {
          renderStartProgress();
          showScreen('start');
        } else if (state.screen === 'levels') {
          showScreen('start');
        }
        return;
      }
      if (e.key === 'Enter' && state.screen === 'start' && document.activeElement === document.body) {
        startLevel(nextPlayable());
      }
    });
  }

  /* ---------------- 主循环 ---------------- */

  let lastTs = performance.now();

  function frame(ts) {
    const dt = clamp((ts - lastTs) / 1000, 0, 0.06);
    lastTs = ts;
    const time = ts / 1000;

    if (state.screen === 'game') {
      if (!state.paused && !state.won) updateParams(dt);
      renderPlot(time);
      checkWin(dt);
    } else {
      drawBg(time);
    }

    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    loadSave();
    loadLang();
    applyI18n();
    bindUI();
    resizeBg();
    renderStartProgress();
    requestAnimationFrame(frame);
  }

  init();

})();
