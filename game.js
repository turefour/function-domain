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

  /* 版本号单一来源：页面展示、单文件命名、发布说明都读这里 */
  const VERSION = '1.1.1';

  const COLORS = ['#7bf1c4', '#7cc6ff', '#ffc06a', '#ff9db0'];

  /* 判定与手感相关的固定数值，集中在这里方便统一调整 */
  const MIN_TOL_PX = 5;        // 命中判定允许的最小像素容差
  /* 自动停机与命中判定共用同一个阈值，避免冲过容差圈 */
  const ZONE_EPS = 0.14;       // 禁区判定容差（世界单位）
  const SQRT_MARGIN = 0.3;     // 根式定义域向左留白，避免起点落进采样缝隙
  const WIN_HOLD = 0.26;       // 全部命中后需要保持的秒数
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
        if (d < -SQRT_MARGIN) return NaN;
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
    quartic: {
      name: '四次函数', short: 'QUART', unlock: 30,
      form: 'y = A x⁴ + B x³ + C x² + D x + E',
      params: ['A', 'B', 'C', 'D', 'E'], defaults: [1, 0, 0, 0, 0],
      f: (x, p) => p[0] * x * x * x * x + p[1] * x * x * x + p[2] * x * x + p[3] * x + p[4],
      expr: (p) => `y = ${fix(p[0])}x\u2074 ${sgn(p[1])}x\u00b3 ${sgn(p[2])}x\u00b2 ${sgn(p[3])}x ${sgn(p[4])}`,
    },
    log: {
      name: '对数函数', short: 'LOG', unlock: 33,
      form: 'y = A ln(x \u2212 B) + C',
      params: ['A', 'B', 'C'], defaults: [1, 0, 0],
      /* 定义域 x > B，边界留一点余量避免采样缝隙 */
      f: (x, p) => (x - p[1] < 0.005 ? NaN : p[0] * Math.log(x - p[1]) + p[2]),
      expr: (p) => {
        const b = p[1];
        const inner = Math.abs(b) < 0.005 ? 'x' : b > 0 ? `x \u2212 ${fix(b)}` : `x + ${fix(-b)}`;
        return `y = ${fix(p[0])} ln(${inner}) ${sgn(p[2])}`;
      },
    },
    tan: {
      name: '正切函数', short: 'TAN', unlock: 35,
      form: 'y = A tan(B x) + C',
      params: ['A', 'B', 'C'], defaults: [1, 1, 0],
      f: (x, p) => p[0] * Math.tan(p[1] * x) + p[2],
      expr: (p) => `y = ${fix(p[0])}\u00b7tan(${fix(p[1])}x) ${sgn(p[2])}`,
    },
    gauss: {
      name: '高斯函数', short: 'GAUSS', unlock: 37,
      form: 'y = A e^(\u2212(x\u2212B)\u00b2/C\u00b2) + D',
      params: ['A', 'B', 'C', 'D'], defaults: [1, 0, 1, 0],
      f: (x, p) => {
        const c = Math.abs(p[2]) < 1e-4 ? 1e-4 : p[2];
        const t = (x - p[1]) / c;
        return p[0] * Math.exp(-t * t) + p[3];
      },
      expr: (p) => {
        const b = p[1];
        const inner = Math.abs(b) < 0.005 ? 'x' : b > 0 ? `x \u2212 ${fix(b)}` : `x + ${fix(-b)}`;
        return `y = ${fix(p[0])}e^(\u2212(${inner})\u00b2/${fix(p[2])}\u00b2) ${sgn(p[3])}`;
      },
    },
    logistic: {
      name: '逻辑斯蒂', short: 'SIGMOID', unlock: 39,
      form: 'y = A / (1 + e^(\u2212B(x\u2212C))) + D',
      params: ['A', 'B', 'C', 'D'], defaults: [1, 1, 0, 0],
      f: (x, p) => p[0] / (1 + Math.exp(-p[1] * (x - p[2]))) + p[3],
      expr: (p) => {
        const c = p[2];
        const inner = Math.abs(c) < 0.005 ? 'x' : c > 0 ? `x \u2212 ${fix(c)}` : `x + ${fix(-c)}`;
        return `y = ${fix(p[0])}/(1+e^(\u2212${fix(p[1])}(${inner}))) ${sgn(p[3])}`;
      },
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
      concept: '一次函数刻画的是一定速度的匀速变化：x 每增加 1，y 就改变 A。',
      steps: ['A 是斜率，等于任意两点之间的平均变化率 (Δy / Δx)。', '令 x = 0，得到与 y 轴的交点 (0, B)，这就是截距。'],
      pitfalls: ['把 B 当成斜率——B 是截距，决定直线的高低位置。', 'A 为负时直线下降，不要误以为只是"变平"。'],
      points: [
        'a 是斜率，|a| 越大直线越陡',
        'b 是曲线与 y 轴的交点',
        'a 为负时直线从左向右下降',
      ],
    },
    abs: {
      sample: [1.6, -1, 0],
      concept: '绝对值把负数翻成正数，所以图像在折点处折成 V 形。',
      steps: ['先看 B：折点（顶点）落在 x = B。', '再看 A：|A| 决定两臂张开的角度，符号决定朝上还是朝下。'],
      pitfalls: ['折点在 x = B 处，不是原点。', '|A| 越大张口越窄，与二次函数的"越陡"直觉相反。'],
      points: [
        '曲线在顶点处折成 V 形，顶点坐标 (b, c)',
        'a 的正负决定开口朝上还是朝下',
        '|a| 越大，两臂张开得越陡',
      ],
    },
    quadratic: {
      sample: [0.8, 0, -1],
      concept: '二次函数描述均匀加速的变化，图像是抛物线。',
      steps: ['对称轴位置由 x = −B / 2A 决定，顶点就落在这条线上。', '令 x = 0 得 (0, C)，这是与 y 轴的交点。'],
      pitfalls: ['对称轴写成 B / 2A，漏掉负号。', 'A 的符号决定开口方向，不是"开口大小"。'],
      points: [
        'a 决定开口方向，|a| 越大开口越窄',
        '对称轴在 x = −b / 2a，顶点落在对称轴上',
        'c 是曲线与 y 轴的交点',
      ],
    },
    reciprocal: {
      sample: [2, 1],
      concept: '反比例描述乘积恒定（x·y = A）的关系，图像是两支双曲线。',
      steps: ['x = 0 是断点，左右各有一支，永不与 y 轴相交。', 'B 是水平渐近线：x 趋于无穷时曲线贴近 y = B。'],
      pitfalls: ['以为曲线会穿过 x = 0。', '忽略 B 造成的整体上下平移。'],
      points: [
        '在 x = 0 处断开，分成互不相连的两支',
        'a 的符号决定曲线落在哪两个象限',
        'b 是水平渐近线，曲线远端会贴住它',
      ],
    },
    sine: {
      sample: [2, 1.4, 0],
      concept: '正弦描述匀速圆周运动的投影，随时间周期性地上下往复。',
      steps: ['A 是振幅，即波峰到中线 y = C 的距离。', 'B 决定周期：每 2π / |B| 重复一次。'],
      pitfalls: ['周期写成 2π·B，实际是 2π / B。', '把 C 当成相位移动——C 只是上下平移。'],
      points: [
        'a 是振幅，即波峰到中线的距离',
        'b 决定周期，周期 = 2π / b',
        'c 把整条波上下平移',
      ],
    },
    exponential: {
      sample: [1, 0.9, -1],
      concept: '指数函数描述"按固定倍率增长"的过程，速度越来越快。',
      steps: ['底数固定为 2，B 控制每单位 x 增长多少倍。', 'C 是水平渐近线：x 趋于 −∞ 时曲线贴近 y = C。'],
      pitfalls: ['以为曲线会碰到 y = C，其实永远只靠近。', 'B 为负时是衰减，不是增长。'],
      points: [
        'a 为正时曲线始终在 y = c 之上',
        'b 越大，曲线抬升越急',
        '左侧趋于水平渐近线 y = c',
      ],
    },
    sqrt: {
      sample: [2, -1, 0],
      concept: '根式是平方运算的逆运算，只取非负的那一支。',
      steps: ['定义域从 x = B 开始，左侧完全没有图像。', '起点是 (B, C)，之后增长越来越慢。'],
      pitfalls: ['在 x < B 的区域找图像，那里是空白。', '以为根式会加速增长，实际上越来越平。'],
      points: [
        '只有 x ≥ b 的部分有图像，其余是空白',
        '起点坐标 (b, c)，之后增长越来越慢',
        'a 为负时曲线从起点向右下方延伸',
      ],
    },
    sinAbs: {
      sample: [2, 1, 0.5],
      concept: '整流正弦把正弦的下半波翻到中线上方，得到脉动的波形。',
      steps: ['所有波谷都压在 y = C 这条线上。', '相邻波峰之间的距离是 π / |B|，是正弦周期的一半。'],
      pitfalls: ['把峰间距当成 2π / |B|。', '忽略 C 对整体高度的抬升。'],
      points: [
        '绝对值把正弦的下半波翻到中线上方',
        '波谷全部压平在同一条 y = c 上',
        '相邻两个波峰之间相距 π / b',
      ],
    },
    cubic: {
      sample: [0.25, 0, -1.2, 0],
      concept: '三次函数两端朝相反方向发散，是典型的 S 形曲线。',
      steps: ['A 决定右端的走向：A > 0 向上，A < 0 向下。', 'B、C 一起决定两个拐点的位置与弯曲程度。'],
      pitfalls: ['以为两端同向发散，那是四次函数。', '只调 A 而忽略 B、C 对拐点的影响。'],
      points: [
        '两端朝相反方向发散，一高一低',
        'a 的符号决定右端上升还是下降',
        'b、c 控制两个拐点的位置与弯曲程度',
      ],
    },
    recipSq: {
      sample: [3, 0.5],
      concept: '平方反比描述"距离越远衰减越快"的关系，如引力与光照。',
      steps: ['图像关于 y 轴对称，是偶函数。', 'x = 0 处断开；A > 0 时两侧都向上张开。'],
      pitfalls: ['说成关于 x 轴对称——那是反比例函数的错觉。', '以为曲线会穿过原点。'],
      points: [
        '关于 y 轴对称，是偶函数',
        'x = 0 处断开，a 为正时两侧都向上张开',
        '曲线最终贴近水平渐近线 y = b',
      ],
    },
    quartic: {
      sample: [0.25, 0, -1.5, 0, 1],
      concept: '四次函数两端朝同一方向发散，可以有两个谷或两个峰。',
      steps: ['首项 A 决定两端同向上或同向下。', '五个参数恰好能确定任意五个点，所以五点解通常唯一。'],
      pitfalls: ['与二次函数混淆，忘了可能有两个谷。', '忽略 B、D 带来的左右不对称。'],
      points: [
        '最高次项让两端朝同一方向发散',
        'B、D 打破左右对称，C 控制中间的起伏',
        '五个参数可以精确穿过任意五个点',
      ],
    },
    log: {
      sample: [2, 0, 0],
      concept: '对数函数是指数函数的反函数，描述"增长越来越慢"的过程。',
      steps: ['定义域从 x = B 开始，左侧没有图像，x = B 是垂直渐近线。', 'A 是纵向拉伸：|A| 越大，曲线越陡。', 'C 把整条曲线上下平移。'],
      pitfalls: ['在 x ≤ B 的地方找图像，那里是空白。', '把 B 当成水平渐近线——它是垂直渐近线。'],
      points: ['只有 x > B 的部分有图像，其余是空白', '起点附近上升极快，越往右越平缓', 'A 为负时曲线从渐近线向右下方延伸'],
    },
    tan: {
      sample: [1.2, 1, 0],
      concept: '正切等于"斜率本身"，在每个周期内从 −∞ 冲到 +∞。',
      steps: ['周期是 π / |B|，比正弦短一半。', '渐近线出现在 Bx = π/2 + kπ 处，曲线在这些位置断开。'],
      pitfalls: ['以为曲线是连续的，其实每个周期之间断开。', '只看一个周期，忽略旁边还有无数支。'],
      points: ['每个周期内单调递增，两端冲向无穷', '周期为 π / |B|，比正弦短一半', 'C 把整条曲线上下平移'],
    },
    gauss: {
      sample: [4, 0, 1.2, 0],
      concept: '高斯函数是钟形曲线，描述"集中在均值附近"的分布。',
      steps: ['峰值 A 出现在 x = B，也就是钟形的中心。', 'C 是宽度：C 越小越尖锐，越大越平缓。', 'D 把整座钟形上下平移。'],
      pitfalls: ['把 C 当成峰值高度，实际峰值是 A + D。', '以为两端会在有限处相交，其实只在无穷远趋近 D。'],
      points: ['关于 x = B 完全对称', 'C 控制宽度，越小越尖', '两端都趋于水平渐近线 y = D'],
    },
    logistic: {
      sample: [4, 1.2, 0, 0],
      concept: '逻辑斯蒂描述"先慢、后快、再慢"的 S 形增长，常用于人口与神经网络。',
      steps: ['上渐近线是 A + D，下渐近线是 D。', '拐点在 x = C，那里斜率最大。', 'B 控制上升的陡峭程度。'],
      pitfalls: ['以为曲线会超过上渐近线，其实只是无限接近。', '把 B 当成左右平移——B 只改陡峭程度。'],
      points: ['从下渐近线平滑爬到上渐近线', '拐点 x = C 处最陡', 'B 越大，中间那段越陡'],
    },
  };

  ALL_KINDS.forEach((k) => { KINDS[k].lesson = LESSONS[k]; });

  /* ---------------- 语言 ---------------- */

  const LANG_KEY = 'function-domain.lang';
  const REPO_URL = 'https://github.com/turefour/function-domain';
  const FB_KEY = 'function-domain.fbAt';
  const FB_MAX = 500;

  const KIND_EN = {
    linear: 'Linear', quadratic: 'Quadratic', reciprocal: 'Reciprocal', sine: 'Sine',
    abs: 'Absolute value', exponential: 'Exponential', sqrt: 'Radical',
    sinAbs: 'Rectified sine', cubic: 'Cubic', recipSq: 'Inverse square',
    quartic: 'Quartic',
    log: 'Logarithm', tan: 'Tangent', gauss: 'Gaussian', logistic: 'Logistic',
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
    quartic: [
      'The leading term sends both ends the same way.',
      'B and D break the left-right symmetry; C shapes the middle.',
      'Five parameters fit exactly five points.',
    ],
    log: [
      'Only exists for x > B; the left edge is a vertical asymptote.',
      'Rises fast near the start, then flattens out.',
      'Negative A sends the curve down to the right.',
    ],
    tan: [
      'Monotonic inside each period, exploding at both ends.',
      'Period is π / |B|, half of the sine period.',
      'C shifts the whole curve up or down.',
    ],
    gauss: [
      'Perfectly symmetric about x = B.',
      'C is the width: smaller means sharper.',
      'Both tails approach the horizontal asymptote y = D.',
    ],
    logistic: [
      'Climbs smoothly from the lower to the upper asymptote.',
      'Steepest at the inflection point x = C.',
      'Larger B makes the middle section steeper.',
    ],
  };

  /* 英文的详细教学：概念 / 步骤 / 常见错误 */
  const LESSON_EN_EXT = {
    linear: {
      concept: 'A linear function describes a constant rate: y changes by A for every unit of x.',
      steps: ['A is the slope — the average rate Δy / Δx between any two points.', 'Setting x = 0 gives the y-intercept (0, B).'],
      pitfalls: ['Mistaking B for the slope.', 'A negative A makes the line fall, not just flatten.'],
    },
    abs: {
      concept: 'Absolute value flips negatives to positives, so the graph folds into a V.',
      steps: ['B places the vertex at x = B.', '|A| controls how wide the V opens; the sign flips it.'],
      pitfalls: ['The vertex is at x = B, not at the origin.', 'Larger |A| makes the V narrower.'],
    },
    quadratic: {
      concept: 'A quadratic models uniformly accelerating change; its graph is a parabola.',
      steps: ['The axis of symmetry is x = −B / 2A, and the vertex sits on it.', 'x = 0 gives the intercept (0, C).'],
      pitfalls: ['Writing the axis as B / 2A and losing the minus sign.', 'A sets the opening direction, not the width alone.'],
    },
    reciprocal: {
      concept: 'A reciprocal keeps the product x·y = A constant; the graph is two branches.',
      steps: ['x = 0 is a break: two branches, never touching the y-axis.', 'B is the horizontal asymptote as x → ∞.'],
      pitfalls: ['Expecting the curve to pass through x = 0.', 'Ignoring the vertical shift caused by B.'],
    },
    sine: {
      concept: 'A sine wave is the projection of uniform circular motion — periodic up and down.',
      steps: ['A is the amplitude above and below the midline y = C.', 'B sets the period: one cycle every 2π / |B|.'],
      pitfalls: ['Writing the period as 2π·B instead of 2π / B.', 'Treating C as a phase shift — it only moves the wave up or down.'],
    },
    exponential: {
      concept: 'An exponential grows by a fixed factor, so it speeds up as it goes.',
      steps: ['The base is fixed at 2; B sets how many times it multiplies per unit x.', 'C is the horizontal asymptote as x → −∞.'],
      pitfalls: ['Expecting the curve to touch y = C; it only approaches it.', 'Negative B means decay, not growth.'],
    },
    sqrt: {
      concept: 'A radical is the inverse of squaring, keeping only the non-negative branch.',
      steps: ['The domain starts at x = B; nothing exists to the left.', 'It starts at (B, C) and grows ever more slowly.'],
      pitfalls: ['Looking for the graph left of x = B.', 'Assuming the growth accelerates — it actually flattens.'],
    },
    sinAbs: {
      concept: 'Rectifying a sine flips its lower half upward, producing a pulsing wave.',
      steps: ['Every trough sits on the line y = C.', 'Adjacent crests are π / |B| apart — half the sine period.'],
      pitfalls: ['Using 2π / |B| for the crest spacing.', 'Forgetting that C lifts the whole wave.'],
    },
    cubic: {
      concept: 'A cubic sends its two ends in opposite directions — the classic S-shape.',
      steps: ['A decides the right end: up for A > 0, down for A < 0.', 'B and C together shape the two bends.'],
      pitfalls: ['Assuming both ends leave in the same direction (that is a quartic).', 'Tuning only A and ignoring B and C.'],
    },
    recipSq: {
      concept: 'Inverse square describes decay that accelerates with distance — gravity, light.',
      steps: ['Symmetric about the y-axis: an even function.', 'Breaks at x = 0; with A > 0 both sides open upward.'],
      pitfalls: ['Calling it symmetric about the x-axis.', 'Expecting the curve to pass through the origin.'],
    },
    quartic: {
      concept: 'A quartic sends both ends the same way and can have two valleys or two peaks.',
      steps: ['The leading term A decides whether both ends rise or fall.', 'Five parameters pin down exactly five points.'],
      pitfalls: ['Confusing it with a quadratic that has only one valley.', 'Ignoring the left-right asymmetry from B and D.'],
    },
    log: {
      concept: 'A logarithm is the inverse of an exponential: it grows ever more slowly.',
      steps: ['The domain starts at x = B; x = B is a vertical asymptote.', 'A stretches vertically, C shifts the whole curve.'],
      pitfalls: ['Looking for the graph at x ≤ B.', 'Treating B as a horizontal asymptote — it is vertical.'],
    },
    tan: {
      concept: 'Tangent is the slope itself: inside each period it runs from −∞ to +∞.',
      steps: ['The period is π / |B|, half of a sine period.', 'Asymptotes appear where Bx = π/2 + kπ.'],
      pitfalls: ['Assuming the curve is continuous across periods.', 'Watching one branch and forgetting the others.'],
    },
    gauss: {
      concept: 'A Gaussian is the bell curve: values cluster around a mean.',
      steps: ['The peak A sits at x = B, the centre of the bell.', 'C is the width: smaller is sharper.'],
      pitfalls: ['Taking C as the height; the height is A + D.', 'Expecting the tails to meet at a finite point.'],
    },
    logistic: {
      concept: 'A logistic curve grows slowly, then fast, then slowly again — an S-shape.',
      steps: ['The upper asymptote is A + D, the lower one is D.', 'The inflection point is x = C, where it is steepest.'],
      pitfalls: ['Expecting the curve to exceed the upper asymptote.', 'Treating B as a horizontal shift — it only changes steepness.'],
    },
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
    { name: 'Steep Wave', hint: 'Four points on two rows (y = 3 and y = -3); the outermost one pins the period.' },
    { name: 'Dense Wave', hint: 'Six points alternate between y = 3 and y = -1; B sets how tightly the waves pack.' },
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
    {
      name: 'Convergence',
      hint: 'Final level: cubic, rectified sine and inverse square \u2014 six points, three zones.',
      brief: {
        plan: 'Six points, three groups: cubic on the diagonal, rectified sine for the two flat tops, inverse square for the rest.',
        steps: ['(−2,−2) and (2,2) are symmetric: a cubic with A=1, C=−3 sends the two ends apart.', '(−1,5) and (1,5) share a height — the rectified sine crests with A=2, B=1, C=1.', '(0,1) and (3.14,1) are covered by the inverse square A=4, B=1.'],
        pitfalls: ['All three curves must avoid the three zones, including their extensions.'],
      },
    },
    { name: 'Quartic Undulation', hint: 'Both ends of a quartic leave in the same direction. Five points pin down its five parameters.' },
    { name: 'Twin Valleys', hint: 'A, C and D place the two troughs; a circle zone blocks the lazy straight line.' },
    { name: 'Multi Peak', hint: 'Five points and two zones \u2014 the quartic has to thread between them.' },
    { name: 'Logarithm Gate', hint: 'A logarithm only lives for x > B, and it rises ever more slowly.' },
    { name: 'Log Corridor', hint: 'B shifts the whole curve right; the left edge is a vertical asymptote.' },
    { name: 'Tangent Wall', hint: 'Tangent shoots to infinity at both ends of each period; only the middle is usable.' },
    { name: 'Tangent Cycle', hint: 'C lifts the whole branch. Stay on one period, ignore the neighbouring cliff.' },
    { name: 'Bell Curve', hint: 'A Gaussian is symmetric; C is its width, the smaller the sharper.' },
    { name: 'Shifted Peak', hint: 'B moves the summit away from the origin, D lifts the whole hill.' },
    { name: 'Sigmoid Rise', hint: 'A sigmoid climbs from one asymptote to the other; the middle is steepest.' },
    { name: 'Gentle Rise', hint: 'B sets how steep the climb is, D shifts the whole S-curve.' },
    {
      name: 'Log and Line',
      hint: 'Two curves share the work: the log climbs slowly on the right, the line descends on the left.',
      brief: {
        plan: 'Two collinear points on the left, three on a logarithm on the right.',
        steps: ['(−3,4.4) and (−1,2.8) have slope −0.8: line A=−0.8, B=2.', 'The log points all sit at x>0: A=1.5, B=0, rising slowly.', 'The lower-right zone sits below y=−2 — watch the line extension.'],
        pitfalls: ['One curve cannot pass all five points at this degree.'],
      },
    },
    {
      name: 'Sine and Log',
      hint: 'Sine on the left, logarithm on the right, two zones pinching the middle.',
      brief: {
        plan: 'Sine takes the left three points, logarithm takes the right three.',
        steps: ['Sine A=2, B=1.5: period about 4.2, covering −1 to 1.', 'Log A=1, B=2: domain starts at x=2, heights from 1 to 2.85 across x=3,5,7.', 'Both zones sit clear of the two curves.'],
        pitfalls: ['Setting the log B to 1 pulls the domain left and adds an unwanted branch.'],
      },
    },
    {
      name: 'Bell and Line',
      hint: 'A Gaussian summit paired with a descending line; mind the lower-left block.',
      brief: {
        plan: 'Gaussian owns the three summit points, the line covers the descent.',
        steps: ['Gaussian A=5, B=0, C=1.2: peak at the origin, about 2.5 tall at x=±1.', '(3,−3) and (5,−5) lie on y=−x: line A=−1, B=0.', 'The lower-left block stays clear.'],
        pitfalls: ['A smaller C sharpens the peak and breaks the height at x=±1.'],
      },
    },
    {
      name: 'S-curve and Arc',
      hint: 'The sigmoid starts slow on the left, the parabola takes over the climb.',
      brief: {
        plan: 'The sigmoid covers the slow start on the left; the parabola takes the climb.',
        steps: ['Logistic A=3, B=1.2, C=−1: the inflection moves to x=−1.', 'Parabola A=0.25, C=−1: starts at (2,0) and accelerates upward.', 'Both zones sit below and do not block the path.'],
        pitfalls: ['The asymptotes are 0 and 3 — points beyond that cannot be reached.'],
      },
    },
    {
      name: 'Three Layers',
      hint: 'Log, Gaussian and a line each own a stretch of the path.',
      brief: {
        plan: 'Six points split across three curves: log two, Gaussian two, line two.',
        steps: ['Log A=1, B=0: passes (0.5,−0.69) and (1,0).', 'Gaussian A=3, B=2.5, C=0.8: peak at (2.5,3), (3.5,0.65) on the slope.', 'Line A=0.5, B=−2: covers (−4,−4) and (−2,−3).'],
        pitfalls: ['Gaussian and log overlap near x≈2 — decide which owns that side first.'],
      },
    },
    {
      name: 'Mixed Curves',
      hint: 'Tangent in the middle, sigmoid on the right, parabola filling the left.',
      brief: {
        plan: 'Tangent in the middle, sigmoid on the right, parabola on the left.',
        steps: ['Tangent A=1, B=1: climbs from (−1,−1.56) to (1,1.56).', 'Logistic A=2, B=2, C=3, D=1: from (2,1.24) up to (4,2.76).', 'Parabola A=−0.4, C=−1: catches (−2.5,−3.5) and (−2,−2.6).'],
        pitfalls: ['Tangent has many branches — lock onto the middle one first.'],
      },
    },
    {
      name: 'Zone Maze',
      hint: 'Four zones carve the plane into corridors; thread the curve through the gaps.',
      brief: {
        plan: 'Four zones cut the plane into corridors; three curves take the middle, right and left.',
        steps: ['Gaussian A=4, B=0, C=1.5: peak at the origin, covering −2, 0, 2.', 'Log A=1.5, B=2.5: only for x>2.5, covering the two right points.', 'Line A=0.5, B=−2: covers the lower-middle pair.'],
        pitfalls: ['The log tail dives to −∞ and easily hits the lower-left circle.'],
      },
    },
    {
      name: 'Finale',
      hint: 'Final level: four curves, four zones \u2014 everything you have learned.',
      brief: {
        plan: 'Four curves, four zones: sine in the middle, sigmoid on the right, Gaussian top-left, line linking.',
        steps: ['Sine A=2, B=1.2: covers (−2,−1.86), (0,0), (2,1.86).', 'Logistic A=3, B=1.5, C=4: right side points near its upper asymptote.', 'Gaussian A=3, B=−4, C=1: summit at (−4,3) and (−5,1.1).', 'Line A=0.2: links (−2.5,−0.5) and (2.5,0.5).'],
        pitfalls: ['Four zones guard the four corners — no extension may touch them.'],
      },
    },

  ];

  const CHALLENGE_EN = [
    { name: 'Sigmoid × Quadratic', hint: '2 curves share the work: 5 points, 1 zones.' },
    { name: 'Linear × Rectified', hint: '2 curves share the work: 5 points, 1 zones.' },
    { name: 'Cubic × Sigmoid', hint: '2 curves share the work: 5 points, 1 zones.' },
    { name: 'Cubic × Gaussian', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Quartic × Quadratic', hint: '2 curves share the work: 5 points, 1 zones.' },
    { name: 'Cubic × Sine', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Exponential × Sine', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Radical × Gaussian', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Rectified × Sine', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Quartic × Log', hint: '2 curves share the work: 6 points, 1 zones.' },
    { name: 'Sigmoid × Log', hint: '2 curves share the work: 5 points, 2 zones.' },
    { name: 'Sigmoid × Rectified', hint: '2 curves share the work: 6 points, 2 zones.' },
    { name: 'Sigmoid × Reciprocal', hint: '2 curves share the work: 5 points, 2 zones.' },
    { name: 'Quartic × Exponential', hint: '2 curves share the work: 6 points, 2 zones.' },
    { name: 'Rectified × Cubic', hint: '2 curves share the work: 5 points, 2 zones.' },
    { name: 'Exponential × Gaussian', hint: '2 curves share the work: 6 points, 2 zones.' },
    { name: 'Sine × Linear', hint: '2 curves share the work: 6 points, 2 zones.' },
    { name: 'Cubic × Log', hint: '2 curves share the work: 6 points, 2 zones.' },
    { name: 'Quartic × Sine', hint: '2 curves share the work: 7 points, 2 zones.' },
    { name: 'Sine × Log', hint: '2 curves share the work: 5 points, 2 zones.' },
    { name: 'Sigmoid × Quadratic × Absolute', hint: '3 curves share the work: 7 points, 2 zones.' },
    { name: 'Sine × Sigmoid × Cubic', hint: '3 curves share the work: 10 points, 2 zones.' },
    { name: 'Inverse sq × Reciprocal × Gaussian', hint: '3 curves share the work: 7 points, 2 zones.' },
    { name: 'Linear × Sigmoid × Sine', hint: '3 curves share the work: 8 points, 2 zones.' },
    { name: 'Quartic × Cubic × Radical', hint: '3 curves share the work: 8 points, 2 zones.' },
    { name: 'Exponential × Inverse sq × Sine', hint: '3 curves share the work: 9 points, 2 zones.' },
    { name: 'Log × Linear × Gaussian', hint: '3 curves share the work: 8 points, 2 zones.' },
    { name: 'Linear × Sine × Cubic', hint: '3 curves share the work: 7 points, 2 zones.' },
    { name: 'Cubic × Quartic × Log', hint: '3 curves share the work: 8 points, 2 zones.' },
    { name: 'Cubic × Quartic × Rectified', hint: '3 curves share the work: 9 points, 2 zones.' },
    { name: 'Rectified × Sigmoid × Log', hint: '3 curves share the work: 8 points, 3 zones.' },
    { name: 'Gaussian × Cubic × Sine', hint: '3 curves share the work: 9 points, 3 zones.' },
    { name: 'Rectified × Quartic × Linear', hint: '3 curves share the work: 8 points, 3 zones.' },
    { name: 'Log × Quartic × Linear', hint: '3 curves share the work: 8 points, 3 zones.' },
    { name: 'Linear × Quadratic × Quartic', hint: '3 curves share the work: 7 points, 2 zones.' },
    { name: 'Sine × Log × Inverse sq', hint: '3 curves share the work: 8 points, 3 zones.' },
    { name: 'Linear × Quartic × Log', hint: '3 curves share the work: 8 points, 2 zones.' },
    { name: 'Log × Linear × Quartic', hint: '3 curves share the work: 7 points, 3 zones.' },
    { name: 'Radical × Linear × Quartic', hint: '3 curves share the work: 8 points, 3 zones.' },
    { name: 'Sigmoid × Linear × Quadratic × Gaussian', hint: '4 curves share the work: 10 points, 2 zones.' },
    { name: 'Sigmoid × Sine × Gaussian × Linear', hint: '4 curves share the work: 11 points, 3 zones.' },
    { name: 'Quadratic × Gaussian × Cubic × Radical', hint: '4 curves share the work: 11 points, 3 zones.' },
    { name: 'Log × Cubic × Sine × Sine', hint: '4 curves share the work: 11 points, 3 zones.' },
    { name: 'Sigmoid × Reciprocal × Quadratic × Sine', hint: '4 curves share the work: 11 points, 2 zones.' },
    { name: 'Absolute × Rectified × Sigmoid × Cubic', hint: '4 curves share the work: 10 points, 3 zones.' },
    { name: 'Cubic × Quartic × Sine × Linear', hint: '4 curves share the work: 12 points, 2 zones.' },
    { name: 'Cubic × Sine × Log × Quadratic', hint: '4 curves share the work: 11 points, 2 zones.' },
    { name: 'Cubic × Quadratic × Absolute × Exponential', hint: '4 curves share the work: 9 points, 2 zones.' },
    { name: 'Log × Sigmoid × Sigmoid × Reciprocal', hint: '4 curves share the work: 10 points, 3 zones.' },
  ];

  const SANDBOX_EN = [
  ];

  LEVEL_EN.push(...CHALLENGE_EN, ...SANDBOX_EN);

  const UI_TEXT = {
    zh: {
      'start.tagline': '把曲线，引向光点。',
      'start.taglineSub': '拖动参数，让公式在坐标系中成立。',
      'start.begin': '开始观测',
      'start.levels': '关卡序列',
      'start.progress': '已通关',
      'start.foot1': '交互式曲线图册',
      'start.foot2': '按住箭头持续变化 · 也可直接键入数值',
      'levels.title': '关卡序列',
      'levels.desc': '每一关解锁一种新的函数形态。完成当前关卡，下一关才会开启。',
      'levels.back': '返回',
      'levels.cleared': 'CLEARED',
      'levels.base': '基础关卡',
      'levels.challenge': '挑战关卡',
      'start.sandbox': '测试场',
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
      'tab.forms': '公式',
      'tab.palette': '选择',
      'tab.settings': '设置',
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
      'brief.title': '关卡讲解 / LEVEL BRIEF',
      'sol.title': '官方解法 / SOLUTIONS',
      'sol.standard': '标准解法',
      'sol.split': '分线解法',
      'zone.title': '禁区 / FORBIDDEN',
      'gh.title': 'GITHUB / 源码',
      'gh.account': '账号',
      'gh.repo': '项目',
      'gh.hint': '在 GitHub 搜索 turefour/function-domain 即可找到源码与单文件版本。',
      'gh.open': '打开仓库',
      'gh.copy': '复制地址',
      'gh.version': '版本',
      'fb.title': '反馈',
      'fb.eyebrow': 'FEEDBACK',
      'fb.open': '反馈',
      'fb.placeholder': '遇到问题或有建议？写在这里（最多 500 字）。',
      'fb.hint': '每分钟最多提交一次；请勿包含广告、脚本或攻击性内容。',
      'fb.send': '提交',
      'fb.sending': '提交中',
      'fb.ok': '反馈已记录，谢谢',
      'fb.review': '反馈已收到，我们会尽快查看',
      'fb.empty': '内容太短，至少写两个字',
      'fb.limit': '每分钟只能提交一次，{s} 秒后可再试',
      'fb.offline': '离线版无法提交，请通过服务器地址访问',
      'fb.fail': '提交失败，请稍后再试',
      'err.eyebrow': 'RUNTIME ERROR · 运行异常',
      'err.title': '程序出错了',
      'err.send': '回传报告',
      'err.sending': '上报中',
      'err.copy': '复制信息',
      'err.close': '关闭',
      'err.note': '报告只包含错误信息、版本与关卡，不含任何个人数据。',
      'err.sent': '错误报告已回传，谢谢',
      'err.limit': '上报太频繁，{s} 秒后可再试',
      'err.fail': '回传失败，可先复制信息',
      'err.offline': '离线版无法回传，已复制到剪贴板',
      'err.copied': '错误信息已复制',
      'err.copyFail': '复制失败，请手动选中文本',
      'err.noStack': '（没有可用的堆栈信息）',
      'err.freeze': '页面卡顿',
      'toast.copied': '仓库地址已复制',
      'param.stop': '停止',
      'aria.delete': '删除公式',
      'aria.param': '参数 {name}',
      'aria.increase': '{name} 增加',
      'aria.decrease': '{name} 减少',
      'op.add': '常数项相加：y = A x + B',
      'op.sub': '常数项相减：B 取负值即可',
      'op.mul': '系数相乘：A 与 B 叠加缩放',
      'op.div': '反比例取商：A / x',
      'op.abs': '绝对值折角：把曲线折成 V 形',
      'op.sq': '平方：二次项 x²',
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
      'toast.locked': '{name} 不在本关的可选函数中',
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
      'start.foot2': 'Hold the arrows to sweep · or type values directly',
      'levels.title': 'LEVEL INDEX',
      'levels.desc': 'Every level unlocks a new function shape. Clear the current one to open the next.',
      'levels.back': 'Back',
      'levels.cleared': 'CLEARED',
      'levels.base': 'Basics',
      'levels.challenge': 'Challenge',
      'start.sandbox': 'Sandbox',
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
      'tab.forms': 'Formula',
      'tab.palette': 'Library',
      'tab.settings': 'Settings',
      'panel.stopAll': 'Stop All',
      'panel.basics': 'BASICS',
      'panel.advanced': 'ADVANCED',
      'switch.grid': 'Grid',
      'switch.ticks': 'Ticks',
      'switch.guides': 'Guides',
      'switch.target': 'Target curve',
      'form.tip': '▲▼ ±1 per second, click again to pause; paste a whole formula into any field.',
      'op.note': 'Arrows start a constant ±1/s change, click again to pause. "Stop" freezes the value.',
      'btn.reset': 'Reset Level',
      'btn.home': 'Home · Levels',
      'btn.remember': 'Got it',
      'btn.apply': 'Apply',
      'brief.title': 'LEVEL BRIEF',
      'sol.title': 'SOLUTIONS',
      'sol.standard': 'Standard solution',
      'sol.split': 'Split solution',
      'zone.title': 'FORBIDDEN',
      'gh.title': 'GITHUB / SOURCE',
      'gh.account': 'Account',
      'gh.repo': 'Repo',
      'gh.hint': 'Search turefour/function-domain on GitHub for the source and the single-file build.',
      'gh.open': 'Open repo',
      'gh.copy': 'Copy URL',
      'gh.version': 'Version',
      'fb.title': 'Feedback',
      'fb.eyebrow': 'FEEDBACK',
      'fb.open': 'Feedback',
      'fb.placeholder': 'Found a bug or have an idea? Write it here (max 500 chars).',
      'fb.hint': 'One submission per minute; please avoid ads, scripts or abusive language.',
      'fb.send': 'Send',
      'fb.sending': 'Sending',
      'fb.ok': 'Feedback saved, thanks',
      'fb.review': 'Received — we will review it soon',
      'fb.empty': 'Too short — write at least two characters',
      'fb.limit': 'One per minute — try again in {s}s',
      'fb.offline': 'Offline build cannot submit; open it from the server',
      'fb.fail': 'Submit failed, try again later',
      'err.eyebrow': 'RUNTIME ERROR',
      'err.title': 'Something went wrong',
      'err.send': 'Send report',
      'err.sending': 'Sending',
      'err.copy': 'Copy details',
      'err.close': 'Close',
      'err.note': 'The report contains only the error, version and level — no personal data.',
      'err.sent': 'Error report sent, thanks',
      'err.limit': 'Too many reports — try again in {s}s',
      'err.fail': 'Send failed; copy the details instead',
      'err.offline': 'Offline build cannot send; details copied to clipboard',
      'err.copied': 'Error details copied',
      'err.copyFail': 'Copy failed — select the text manually',
      'err.noStack': '(no stack trace available)',
      'err.freeze': 'Page freeze',
      'toast.copied': 'Repository URL copied',
      'param.stop': 'Stop',
      'aria.delete': 'Delete formula',
      'aria.param': 'Parameter {name}',
      'aria.increase': 'Increase {name}',
      'aria.decrease': 'Decrease {name}',
      'op.add': 'Add a constant: y = A x + B',
      'op.sub': 'Subtract a constant: make B negative',
      'op.mul': 'Scale coefficients: A and B multiply',
      'op.div': 'Quotient: A / x',
      'op.abs': 'Absolute value folds the curve into a V',
      'op.sq': 'Square: the x^2 term',
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
      'toast.locked': '{name} is not available in this level',
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

  /* 教学数据：中文用 LESSONS，英文合并 LESSON_EN_EXT 与 LESSON_EN */
  function lessonData(kind) {
    const zh = LESSONS[kind] || {};
    if (state.lang !== 'en') return zh;
    const en = LESSON_EN_EXT[kind] || {};
    return {
      concept: en.concept || zh.concept || '',
      steps: en.steps || zh.steps || [],
      pitfalls: en.pitfalls || zh.pitfalls || [],
      points: LESSON_EN[kind] || zh.points || [],
    };
  }

  function levelIndexText(i) {
    const lv = LEVELS[i];
    if (!lv || lv.test) return '--';
    if (lv.challenge) return 'C' + String(i - BASE_COUNT + 1).padStart(2, '0');
    return String(i + 1).padStart(2, '0');
  }

  function levelTitle(lv, i) {
    if (lv.test) return state.lang === 'en' ? 'Sandbox' : '测试场';
    if (lv.challenge) {
      const cn = String(i - BASE_COUNT + 1).padStart(2, '0');
      return state.lang === 'en'
        ? `CH${cn} \u00b7 ${levelName(lv, i)}`
        : `挑战 ${cn} \u00b7 ${levelName(lv, i)}`;
    }
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
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    if (dom.langSwitch) {
      dom.langSwitch.textContent = state.lang === 'en' ? '\u4e2d\u6587' : 'EN';
      dom.langSwitch.setAttribute('aria-label', state.lang === 'en' ? '\u5207\u6362\u4e2d\u6587' : 'Switch to English');
    }
    /* 动态生成的控件没有 data-i18n，这里补一遍文本与无障碍标签 */
    document.querySelectorAll('.fc-del').forEach((b) => b.setAttribute('aria-label', t('aria.delete')));
    document.querySelectorAll('.form-card .num').forEach((inp) => {
      inp.setAttribute('aria-label', t('aria.param', { name: inp.dataset.label || '' }));
    });
    document.querySelectorAll('.form-card .step').forEach((b) => {
      const key = b.dataset.dir === '1' ? 'aria.increase' : 'aria.decrease';
      b.setAttribute('aria-label', t(key, { name: b.dataset.label || '' }));
    });
    document.querySelectorAll('.form-card .stop').forEach((b) => {
      b.textContent = t('param.stop');
    });
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
      renderBrief();
      renderSolutions();
      updateStats();
      if (!dom.lesson.hidden && state.lessonKind) fillLesson(state.lessonKind, state.lessonIsNew);
      if (dom.winOverlay.classList.contains('is-open')) refreshWinText();
    }
  }

  /* 公式选择区按通关进度解锁：基础组一开始就有，进阶组逐关开放 */
  const BASIC_KINDS = ['linear', 'abs'];
  const ADVANCED_KINDS = ['quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs',
    'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'];
  const OPS = [
    { mark: '+', tipKey: 'op.add' },
    { mark: '\u2212', tipKey: 'op.sub' },
    { mark: '\u00d7', tipKey: 'op.mul' },
    { mark: '\u00f7', tipKey: 'op.div' },
    { mark: '| |', tipKey: 'op.abs' },
    { mark: '\u00b2', tipKey: 'op.sq' },
  ];

  /* ---------------- 关卡 ----------------
     视图半径 R = round((|x| + |y|) * 2) 的最大值，即坐标轴只覆盖到
     目标点绝对值之和的两倍，界面之外的值一律不参与计算。
  ---------------------------------------- */

      const LEVELS = [
    {
      name: '初次绘制',
      pool: ['linear', 'abs'],
      hint: '让直线穿过 A 点。a 控制倾斜，b 控制它与 y 轴的交点。',
      seed: 'linear', maxForms: 1, tol: 0.31,
      points: [{ x: 3, y: 2 }],
    },
    {
      name: '两点之间',
      pool: ['linear', 'abs'],
      hint: '一条直线要同时压住两个光点，斜率必须刚好。',
      seed: 'linear', maxForms: 1, tol: 0.26,
      points: [{ x: 2, y: 3 }, { x: 5, y: 1 }],
    },
    {
      name: '折角初现',
      pool: ['linear', 'abs'],
      hint: '绝对值函数在顶点折成 V 形，a 决定张口大小，b 决定折点位置。',
      seed: 'abs', maxForms: 1, tol: 0.25,
      points: [{ x: 0, y: 2 }, { x: 1, y: 0 }, { x: 2, y: 2 }],
    },
    {
      name: '倒悬之 V',
      pool: ['linear', 'abs'],
      hint: 'a 取负值时 V 形倒过来，c 把顶点抬离 x 轴。',
      seed: 'abs', maxForms: 1, tol: 0.25,
      points: [{ x: -1, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 0 }],
    },
    {
      name: '弯曲',
      pool: ['linear', 'quadratic', 'abs'],
      hint: '三个不共线的点无法被一条直线同时穿过，换抛物线。',
      seed: 'quadratic', maxForms: 1, tol: 0.25,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 2 }],
    },
    {
      name: '四点共弧',
      pool: ['linear', 'quadratic', 'abs'],
      hint: '四个点落在同一条抛物线上，a、b、c 要一起配合。',
      seed: 'quadratic', maxForms: 1, tol: 0.23,
      points: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 4 }],
    },
    {
      name: '抬高之弧',
      pool: ['linear', 'quadratic', 'abs'],
      hint: 'c 把整条抛物线抬高，顶点离开原点。注意右上角的禁区。',
      seed: 'quadratic', maxForms: 1, tol: 0.23,
      points: [{ x: -2, y: 5 }, { x: 0, y: 1 }, { x: 2, y: 5 }],
      zones: [
        { type: 'rect', x1: 5, y1: 2, x2: 9, y2: 10 },
      ],
    },
    {
      name: '双向绕行',
      pool: ['linear', 'quadratic', 'abs'],
      hint: '两处禁区卡在角落，抛物线要从中穿过。',
      seed: 'quadratic', maxForms: 1, tol: 0.22,
      points: [{ x: -1, y: 0 }, { x: 0, y: -3 }, { x: 1, y: -4 }, { x: 3, y: 0 }],
      zones: [
        { type: 'rect', x1: -9, y1: -9, x2: -5, y2: -3 },
        { type: 'circle', x: 6, y: -6, r: 2 },
      ],
    },
    {
      name: '弧线迷阵',
      pool: ['linear', 'quadratic', 'abs'],
      hint: '五个点与两处禁区，抛物线的开口与位置都要算准。',
      seed: 'quadratic', maxForms: 1, tol: 0.22,
      points: [{ x: 0, y: 3 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 3, y: 0 }, { x: 4, y: 3 }],
      zones: [
        { type: 'rect', x1: -10, y1: 6, x2: -6, y2: 12 },
        { type: 'circle', x: 7, y: 7, r: 1.8 },
      ],
    },
    {
      name: '双曲',
      pool: ['linear', 'quadratic', 'reciprocal', 'abs'],
      hint: '反比例函数在原点两侧分成两支，中间是断裂的。',
      seed: 'reciprocal', maxForms: 1, tol: 0.22,
      points: [{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: -1, y: -1 }, { x: -2, y: 0 }],
    },
    {
      name: '远端双曲',
      pool: ['linear', 'quadratic', 'reciprocal', 'abs'],
      hint: 'a 越大，曲线离原点越远，两支都向外推。',
      seed: 'reciprocal', maxForms: 1, tol: 0.22,
      points: [{ x: 1, y: 4 }, { x: 2, y: 2 }, { x: 4, y: 1 }, { x: -2, y: -2 }],
    },
    {
      name: '偏移双曲',
      pool: ['linear', 'quadratic', 'reciprocal', 'abs'],
      hint: 'b 把整条双曲线上下平移，禁区挡在右上。',
      seed: 'reciprocal', maxForms: 1, tol: 0.20,
      points: [{ x: 1, y: 4 }, { x: 3, y: 2 }, { x: -1, y: -2 }, { x: -3, y: 0 }],
      zones: [
        { type: 'rect', x1: 5, y1: 4, x2: 9, y2: 9 },
      ],
    },
    {
      name: '双曲回廊',
      pool: ['linear', 'quadratic', 'reciprocal', 'abs'],
      hint: '两条禁区把可走的空间压成一条窄廊。',
      seed: 'reciprocal', maxForms: 1, tol: 0.20,
      points: [{ x: 1, y: 4 }, { x: 2, y: 3 }, { x: -1, y: 0 }, { x: -2, y: 1 }],
      zones: [
        { type: 'circle', x: -6, y: 7, r: 1.6 },
        { type: 'rect', x1: 4, y1: -6, x2: 9, y2: -2 },
      ],
    },
    {
      name: '双曲三重门',
      pool: ['linear', 'quadratic', 'reciprocal', 'abs'],
      hint: '五个点、三处禁区，双曲线的两支要分别照顾不同的光点。',
      seed: 'reciprocal', maxForms: 1, tol: 0.20,
      points: [{ x: 1, y: 5 }, { x: 3, y: 3 }, { x: -1, y: -1 }, { x: -3, y: 1 }, { x: -0.5, y: -4 }],
      zones: [
        { type: 'rect', x1: -11, y1: 6, x2: -6, y2: 11 },
        { type: 'circle', x: 9, y: -3, r: 1.5 },
        { type: 'circle', x: -7, y: 8, r: 1.5 },
      ],
    },
    {
      name: '波动',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs'],
      hint: '振幅 a 拉开波峰，频率 b 决定周期，偏移 c 把整条波抬高。',
      seed: 'sine', maxForms: 1, tol: 0.23,
      points: [{ x: 0, y: 1 }, { x: 1.5, y: 3 }, { x: 3.1, y: 1.08 }],
    },
    {
      name: '陡波',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs'],
      hint: '四点分两排：上排 y = 3、下排 y = −3，最外那点用来定 b。',
      seed: 'sine', maxForms: 1, tol: 0.22,
      points: [{ x: -4.2, y: 2.61 }, { x: -1.57, y: -3 }, { x: 1.57, y: 3 }, { x: 4.2, y: -2.61 }],
    },
    {
      name: '密波',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs'],
      hint: '六个点交替落在 y = 3 与 y = −1 两排上，b 决定波有多密。',
      seed: 'sine', maxForms: 1, tol: 0.20,
      points: [{ x: -3.93, y: -1 }, { x: -2.36, y: 3 }, { x: -0.79, y: -1 }, { x: 0.79, y: 3 }, { x: 2.36, y: -1 }, { x: 3.93, y: 3 }],
      zones: [
        { type: 'rect', x1: 4, y1: 4, x2: 7, y2: 7 },
      ],
    },
    {
      name: '长波',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs'],
      hint: '五个点散布在一个完整周期里，b 决定周期长度。',
      seed: 'sine', maxForms: 1, tol: 0.20,
      points: [{ x: 0, y: 0 }, { x: 1.57, y: 2 }, { x: 3.14, y: 0 }, { x: 4.71, y: -2 }, { x: 6.28, y: 0 }],
      zones: [
        { type: 'rect', x1: -12, y1: 3, x2: -8, y2: 10 },
        { type: 'circle', x: -6, y: -5, r: 1.5 },
      ],
    },
    {
      name: '波域禁区',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs'],
      hint: '三处禁区把波形夹在中间，注意左侧和右上的空隙。',
      seed: 'sine', maxForms: 1, tol: 0.20,
      points: [{ x: -3.14, y: 1 }, { x: -1.57, y: -1 }, { x: 0, y: 1 }, { x: 1.57, y: 3 }],
      zones: [
        { type: 'rect', x1: 5, y1: 4, x2: 9, y2: 9 },
        { type: 'circle', x: -6, y: 6, r: 1.5 },
        { type: 'rect', x1: -9, y1: -9, x2: -5, y2: -4 },
      ],
    },
    {
      name: '攀升',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential'],
      hint: '指数曲线增长极快，b 的一点点变化会让整条曲线剧烈偏移。',
      seed: 'exponential', maxForms: 1, tol: 0.25,
      points: [{ x: -1, y: 1.5 }, { x: 0, y: 2 }, { x: 1, y: 3 }],
    },
    {
      name: '陡升',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential'],
      hint: 'b 变大后曲线抬升更急，靠 a 与 c 把三点对齐。',
      seed: 'exponential', maxForms: 1, tol: 0.23,
      points: [{ x: -1, y: 0.25 }, { x: 0, y: 1 }, { x: 1, y: 4 }],
    },
    {
      name: '攀升禁区',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential'],
      hint: '四点阶梯状上升，左侧有一大片禁区。',
      seed: 'exponential', maxForms: 2, tol: 0.22,
      points: [{ x: -1, y: 2.5 }, { x: 0, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 6 }],
      zones: [
        { type: 'rect', x1: -10, y1: 6, x2: -5, y2: 10 },
      ],
    },
    {
      name: '高台',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential'],
      hint: '四点顺着指数曲线阶梯上升，右下与右上各有一处禁区。',
      seed: 'exponential', maxForms: 1, tol: 0.22,
      points: [{ x: -0.5, y: 1.5 }, { x: 0, y: 2 }, { x: 0.5, y: 3 }, { x: 1, y: 5 }],
      zones: [
        { type: 'circle', x: -8, y: 7, r: 1.6 },
        { type: 'rect', x1: 6, y1: 5, x2: 10, y2: 10 },
      ],
    },
    {
      name: '根号之门',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt'],
      hint: '根式只在 x ≥ b 的地方有图像，左端是曲线的起点。',
      seed: 'sqrt', maxForms: 1, tol: 0.23,
      points: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 4, y: 4 }],
    },
    {
      name: '整流',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs'],
      hint: '绝对值套在正弦上，波谷被压平在一条水平线上。',
      seed: 'sinAbs', maxForms: 1, tol: 0.22,
      points: [{ x: 0, y: 1 }, { x: 1.57, y: 3 }, { x: 3.14, y: 1 }],
    },
    {
      name: '三次回旋',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic'],
      hint: '三次函数的 S 形要同时照顾两个拐点，四个参数一起调。',
      seed: 'cubic', maxForms: 2, tol: 0.22,
      points: [{ x: -2, y: -2 }, { x: -1, y: 2 }, { x: 1, y: -2 }, { x: 2, y: 2 }],
    },
    {
      name: '平方反比',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '平方反比对 x 轴对称，两侧都向上张开。',
      seed: 'recipSq', maxForms: 2, tol: 0.22,
      points: [{ x: 1, y: 5 }, { x: 2, y: 2 }, { x: -1, y: 5 }, { x: -2, y: 2 }],
    },
    {
      name: '双线复合',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '根式负责右侧，直线负责左侧，右上还有一处禁区。',
      seed: 'sqrt', maxForms: 3, tol: 0.22,
      points: [{ x: 1, y: 2 }, { x: 4, y: 3 }, { x: -2, y: 0 }, { x: 2, y: 2 }],
      zones: [
        { type: 'rect', x1: -12, y1: 6, x2: -7, y2: 12 },
      ],
    },
    {
      name: '三线交错',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '三次曲线与整流正弦交错，两个禁区各守一角。',
      seed: 'cubic', maxForms: 3, tol: 0.22,
      points: [{ x: -1, y: 2 }, { x: 1, y: -2 }, { x: 0, y: 1 }, { x: 1.57, y: 3 }],
      zones: [
        { type: 'rect', x1: -9, y1: 4, x2: -5, y2: 9 },
        { type: 'circle', x: 5, y: 7, r: 1.5 },
      ],
    },
    {
      name: '收敛',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '最后一关。三次、整流正弦与平方反比三条曲线，六点三禁区。',
      brief: {
        plan: '六个点分三组：三次曲线管对角，整流正弦压住上下两条水平段，平方反比补剩下的点。',
        steps: ['(−2,−2) 与 (2,2) 关于原点对称，三次曲线 A=1、C=−3 能让两端反向发散。', '(−1,5) 与 (1,5) 在同一高度，交给整流正弦的波峰 A=2、B=1、C=1。', '(0,1) 与 (3.14,1) 由平方反比 A=4、B=1 收尾，注意它关于 y 轴对称。'],
        pitfalls: ['三条曲线都要绕开三处禁区，延长线也别撞进去。'],
      },
      seed: 'cubic', maxForms: 4, tol: 0.25,
      points: [{ x: -2, y: -2 }, { x: 2, y: 2 }, { x: 0, y: 1 }, { x: 3.14, y: 1 }, { x: 1, y: 5 }, { x: -1, y: 5 }],
      zones: [
        { type: 'rect', x1: -11, y1: 7, x2: -6, y2: 12 },
        { type: 'circle', x: 6, y: 10, r: 1.5 },
        { type: 'circle', x: -6, y: -9, r: 1.5 },
      ],
    },
    {
      name: '四次起伏',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '四次曲线两端同向发散。五个点恰好定死五个参数，先对好中间的低谷。',
      seed: 'quartic', maxForms: 1, tol: 0.32,
      points: [{ x: -2, y: 1.2 }, { x: -1, y: 0.2 }, { x: 0, y: 1 }, { x: 1, y: 1.2 }, { x: 2, y: 3.2 }],
    },
    {
      name: '双谷',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: 'A、C、D 决定两个低谷的位置与深度，左上那处禁区挡住了取巧的直线。',
      seed: 'quartic', maxForms: 1, tol: 0.31,
      points: [{ x: -2, y: 0.4 }, { x: -1, y: 0.25 }, { x: 0, y: 1 }, { x: 1, y: 0.85 }, { x: 2, y: 1.6 }],
      zones: [{ type: 'circle', x: -4.5, y: 4, r: 1.2 }],
    },
    {
      name: '多峰',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '最后一关。五个点、两处禁区，四次曲线的两端必须绕开左上与右下。',
      seed: 'quartic', maxForms: 1, tol: 0.31,
      points: [{ x: -2, y: 0.8 }, { x: -1, y: 0.7 }, { x: 0, y: 1.2 }, { x: 1, y: 1.1 }, { x: 2, y: 1.6 }],
      zones: [
        { type: 'rect', x1: -7, y1: 3, x2: -4, y2: 7 },
        { type: 'circle', x: 4, y: -3, r: 1.4 },
      ],
    },
    {
      name: '对数之门',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '对数只在 x > B 的地方有图像，越往右增长越慢。',
      seed: 'log', maxForms: 1, tol: 0.32,
      points: [{ x: 0.5, y: -1.39 }, { x: 1, y: 0 }, { x: 2, y: 1.39 }, { x: 4, y: 2.77 }],
    },
    {
      name: '对数走廊',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: 'B 把整条曲线右移，左端有一条看不见的垂直渐近线。',
      seed: 'log', maxForms: 1, tol: 0.31,
      points: [{ x: 2, y: 1 }, { x: 3, y: 1.69 }, { x: 5, y: 2.39 }, { x: 9, y: 3.08 }],
      zones: [
        { type: 'rect', x1: 6, y1: 4, x2: 11, y2: 9 },
      ],
    },
    {
      name: '正切之墙',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan'],
      hint: '正切在每个周期的两端冲向无穷，中间那段才是可用的。',
      seed: 'tan', maxForms: 1, tol: 0.31,
      points: [{ x: -0.6, y: -2.05 }, { x: -0.3, y: -0.93 }, { x: 0, y: 0 }, { x: 0.3, y: 0.93 }, { x: 0.6, y: 2.05 }],
    },
    {
      name: '正切周期',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan'],
      hint: 'C 抬高整段正切；一次只能盯住一个周期，别被旁边的陡坡带走。',
      seed: 'tan', maxForms: 1, tol: 0.31,
      points: [{ x: -1, y: -0.56 }, { x: -0.5, y: 0.45 }, { x: 0, y: 1 }, { x: 0.5, y: 1.55 }, { x: 1, y: 2.56 }],
    },
    {
      name: '钟形',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss'],
      hint: '高斯曲线左右对称，C 是宽度：越小越尖。',
      seed: 'gauss', maxForms: 1, tol: 0.32,
      points: [{ x: -2, y: 0.07 }, { x: -1, y: 1.47 }, { x: 0, y: 4 }, { x: 1, y: 1.47 }, { x: 2, y: 0.07 }],
    },
    {
      name: '偏峰',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss'],
      hint: 'B 把峰的顶点挪开原点，D 把整座山抬高。',
      seed: 'gauss', maxForms: 1, tol: 0.31,
      points: [{ x: -1, y: 0.55 }, { x: 0, y: 1.6 }, { x: 1, y: 3.5 }, { x: 2, y: 1.6 }, { x: 3, y: 0.55 }],
      zones: [
        { type: 'rect', x1: -8, y1: -6, x2: -4, y2: -2 },
      ],
    },
    {
      name: 'S 形',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '逻辑斯蒂从下渐近线爬到上渐近线，中间那一段最陡。',
      seed: 'logistic', maxForms: 1, tol: 0.32,
      points: [{ x: -2, y: 0.07 }, { x: -1, y: 0.48 }, { x: 0, y: 2 }, { x: 1, y: 3.52 }, { x: 2, y: 3.93 }],
    },
    {
      name: '缓升',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: 'B 控制上升的陡峭程度，D 把整条 S 形上下平移。',
      seed: 'logistic', maxForms: 1, tol: 0.31,
      points: [{ x: -1, y: -0.64 }, { x: 0, y: -0.19 }, { x: 1, y: 0.5 }, { x: 2, y: 1.19 }, { x: 3, y: 1.64 }],
      zones: [
        { type: 'circle', x: 6, y: -5, r: 1.3 },
      ],
    },
    {
      name: '对数与弦',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '两条曲线分工：对数负责右侧缓慢上升，直线负责左侧下行。',
      brief: {
        plan: '左边两点共线，右边三点在同一条对数曲线上，两条曲线各管一段。',
        steps: ['(−3,4.4) 与 (−1,2.8) 的斜率是 −0.8，用直线 A=−0.8、B=2 拿下。', '对数三点都在 x>0：A=1.5、B=0，从原点右侧缓慢上升。', '右下禁区在 y<−2 一带，直线延长后会经过，注意别越界。'],
        pitfalls: ['想用一条曲线穿完五点，五次以下基本做不到。'],
      },
      seed: 'log', maxForms: 2, tol: 0.31,
      points: [{ x: 0.5, y: -1.04 }, { x: 1, y: 0 }, { x: 2, y: 1.04 }, { x: -3, y: 4.4 }, { x: -1, y: 2.8 }],
      zones: [
        { type: 'rect', x1: 4, y1: 4, x2: 8, y2: 7 },
      ],
    },
    {
      name: '三角与对数',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '正弦在左，对数在右，两处禁区把中间的路挤窄了。',
      brief: {
        plan: '左边三点交给正弦，右边三点交给对数。',
        steps: ['正弦 A=2、B=1.5：周期约 4.2，正好覆盖 −1 到 1。', '对数 A=1、B=2：定义域从 x=2 开始，x=3、5、7 三点高度从 1 到 2.85。', '左上圆形与右下矩形禁区都落在两条曲线之外。'],
        pitfalls: ['对数的 B 调到 1 会让定义域提前，曲线往左多长出一段。'],
      },
      seed: 'sine', maxForms: 2, tol: 0.31,
      points: [{ x: -1, y: -1.99 }, { x: 0, y: 0 }, { x: 1, y: 1.99 }, { x: 3, y: 1 }, { x: 5, y: 2.1 }, { x: 7, y: 2.61 }],
      zones: [
        { type: 'circle', x: -5, y: 6, r: 1.4 },
        { type: 'rect', x1: 1, y1: 4, x2: 4, y2: 7 },
      ],
    },
    {
      name: '钟形与弦',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '高斯峰顶配合一条下降的直线，注意左下角的方块。',
      brief: {
        plan: '高斯负责峰顶三点，直线接管右侧的下降段。',
        steps: ['高斯 A=5、B=0、C=1.2：顶点在原点，x=±1 处高度约 2.5。', '(3,−3) 与 (5,−5) 落在 y=−x 上，用直线 A=−1、B=0。', '左下矩形禁区在两段曲线之外。'],
        pitfalls: ['高斯的 C 调小会让峰变尖，±1 处的高度就对不上了。'],
      },
      seed: 'gauss', maxForms: 2, tol: 0.31,
      points: [{ x: -1, y: 2.5 }, { x: 0, y: 5 }, { x: 1, y: 2.5 }, { x: 3, y: -3 }, { x: 5, y: -5 }],
      zones: [
        { type: 'rect', x1: -9, y1: -9, x2: -6, y2: -6 },
      ],
    },
    {
      name: 'S 形与弧',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: 'S 形在左侧缓慢起步，抛物线接管右侧上升。',
      brief: {
        plan: '左侧三点在 S 形的起步段，右侧三点交给抛物线。',
        steps: ['逻辑斯蒂 A=3、B=1.2、C=−1：拐点左移到 x=−1，起步更缓。', '抛物线 A=0.25、C=−1：从 (2,0) 开始向上加速。', '两处禁区都在下方，不挡主线。'],
        pitfalls: ['S 形的上下渐近线是 0 和 3，点位超出这个范围就调不到了。'],
      },
      seed: 'logistic', maxForms: 2, tol: 0.29,
      points: [{ x: -3, y: 0.25 }, { x: -1, y: 1.5 }, { x: 0, y: 2.31 }, { x: 2, y: 0 }, { x: 3, y: 1.25 }, { x: 4, y: 3 }],
      zones: [
        { type: 'circle', x: -6, y: -5, r: 1.4 },
        { type: 'rect', x1: -3, y1: -8, x2: 3, y2: -3 },
      ],
    },
    {
      name: '三层',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '对数、高斯、直线各管一段，三条曲线拼出完整路径。',
      brief: {
        plan: '六个点分给三条曲线：对数两点、高斯两点、直线两点。',
        steps: ['对数 A=1、B=0：经过 (0.5,−0.69) 与 (1,0)。', '高斯 A=3、B=2.5、C=0.8：峰顶在 (2.5,3)，(3.5,0.65) 在下降段。', '直线 A=0.5、B=−2：负责左下 (−4,−4) 与 (−2,−3)。', '三处禁区分别在右上、左上与下方。'],
        pitfalls: ['高斯与对数在 x≈2 附近会重叠，先想清楚谁负责哪一侧。'],
      },
      seed: 'log', maxForms: 3, tol: 0.29,
      points: [{ x: 0.5, y: -0.69 }, { x: 1, y: 0 }, { x: 2.5, y: 3 }, { x: 3.5, y: 0.63 }, { x: -4, y: -4 }, { x: -2, y: -3 }],
      zones: [
        { type: 'rect', x1: -10, y1: 7, x2: -6, y2: 11 },
        { type: 'circle', x: 5, y: -6, r: 1.3 },
        { type: 'rect', x1: -2, y1: -9, x2: 2, y2: -6 },
      ],
    },
    {
      name: '混合曲线',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '正切负责中段，逻辑斯蒂接管右侧，抛物线补齐左侧。',
      brief: {
        plan: '正切管中段，逻辑斯蒂管右侧，抛物线补左侧。',
        steps: ['正切 A=1、B=1：在 (−1,−1.56) 到 (1,1.56) 之间单调上升。', '逻辑斯蒂 A=2、B=2、C=3、D=1：从 (2,1.24) 爬到 (4,2.76)。', '抛物线 A=−0.4、C=−1：接住左侧 (−2.5,−3.5)、(−2,−2.6) 的下降段。'],
        pitfalls: ['正切分支极多，先对准中段那一条，别被旁边的陡坡带走。'],
      },
      seed: 'tan', maxForms: 3, tol: 0.29,
      points: [{ x: -1, y: -1.56 }, { x: 0, y: 0 }, { x: 1, y: 1.56 }, { x: 2, y: 1.24 }, { x: 3, y: 2 }, { x: 4, y: 2.76 }, { x: -2.5, y: -3.5 }, { x: -2, y: -2.6 }],
    },
    {
      name: '禁区迷阵',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '四块禁区把图面切成走廊，曲线必须从缝里穿过。',
      brief: {
        plan: '四块禁区把平面切成走廊，三条曲线分别走中、右、左。',
        steps: ['高斯 A=4、B=0、C=1.5：峰在原点，覆盖 −2、0、2 三点。', '对数 A=1.5、B=2.5：只在 x>2.5 有图像，负责右侧两点。', '直线 A=0.5、B=−2：负责左下到中部的两点。', '禁区在四个角落，曲线都不能延长进去。'],
        pitfalls: ['对数左端冲向 −∞，很容易撞到左下的圆形禁区。'],
      },
      seed: 'gauss', maxForms: 3, tol: 0.27,
      points: [{ x: -2, y: 0.68 }, { x: 0, y: 4 }, { x: 2, y: 0.68 }, { x: 3, y: -1.04 }, { x: 4.5, y: 1.04 }, { x: 2, y: -1 }, { x: 4, y: 0 }],
      zones: [
        { type: 'rect', x1: -10, y1: 6, x2: -6, y2: 10 },
        { type: 'rect', x1: 5, y1: 6, x2: 9, y2: 10 },
        { type: 'circle', x: -8, y: -8, r: 1.2 },
        { type: 'circle', x: 7, y: -6, r: 1.5 },
      ],
    },
    {
      name: '终章',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '最后一关：四条曲线、四处禁区，把学过的一切都用上。',
      brief: {
        plan: '四条曲线、四处禁区：正弦守中段，逻辑斯蒂走右侧，高斯占左上，直线串联。',
        steps: ['正弦 A=2、B=1.2：覆盖 (−2,−1.86)、(0,0)、(2,1.86)。', '逻辑斯蒂 A=3、B=1.5、C=4：右侧 (4,2.6)、(5,2.93) 已接近上渐近线。', '高斯 A=3、B=−4、C=1：左上峰顶 (−5,1.1)、(−4,3)。', '直线 A=0.2：串联 (−2.5,−0.5) 与 (2.5,0.5)。'],
        pitfalls: ['四块禁区守在四角，任何一条曲线的延长线都不能碰到。'],
      },
      seed: 'sine', maxForms: 4, tol: 0.27,
      points: [{ x: -2, y: -1.35 }, { x: 0, y: 0 }, { x: 2, y: 1.35 }, { x: 4, y: 1.5 }, { x: 5, y: 2.45 }, { x: -5, y: 1.1 }, { x: -4, y: 3 }, { x: -2.5, y: -0.5 }, { x: 2.5, y: 0.5 }],
      zones: [
        { type: 'rect', x1: -10, y1: 7, x2: -6, y2: 11 },
        { type: 'rect', x1: 6, y1: 7, x2: 10, y2: 11 },
        { type: 'circle', x: -8, y: -7, r: 1.5 },
        { type: 'circle', x: 8, y: -7, r: 1.5 },
      ],
    },
  ];

  /* ---------------- 官方解法 ----------------
     label  给玩家看的解法名
     forms  逐条公式；参数与 KINDS 的 params 顺序一致
     第一组同时被当作"目标图像"，重合时自动停机并可用于对照
  --------------------------------------------- */

      const SOLUTIONS = [
    [{ forms: [{ kind: 'linear', params: [1, -1] }] }],
    [{ forms: [{ kind: 'linear', params: [-0.67, 4.33] }] }],
    [{ forms: [{ kind: 'abs', params: [2, 1, 0] }] }],
    [{ forms: [{ kind: 'abs', params: [-1, 1, 2] }] }],
    [{ forms: [{ kind: 'quadratic', params: [1, -1, 0] }] }],
    [{ forms: [{ kind: 'quadratic', params: [1, -2, 1] }] }],
    [{ forms: [{ kind: 'quadratic', params: [1, 0, 1] }] }],
    [{ forms: [{ kind: 'quadratic', params: [1, -2, -3] }] }],
    [{ forms: [{ kind: 'quadratic', params: [1, -4, 3] }] }],
    [{ forms: [{ kind: 'reciprocal', params: [2, 1] }] }],
    [{ forms: [{ kind: 'reciprocal', params: [4, 0] }] }],
    [{ forms: [{ kind: 'reciprocal', params: [3, 1] }] }],
    [{ forms: [{ kind: 'reciprocal', params: [2, 2] }] }],
    [{ forms: [{ kind: 'reciprocal', params: [3, 2] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1, 1] }] }],
    [{ forms: [{ kind: 'sine', params: [3, 1, 0] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 2, 1] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1, 0] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1, 1] }] }],
    [{ forms: [{ kind: 'exponential', params: [1, 1, 1] }] }],
    [{ forms: [{ kind: 'exponential', params: [1, 2, 0] }] }],
    [{ forms: [{ kind: 'exponential', params: [1, 1, 2] }] }],
    [{ forms: [{ kind: 'exponential', params: [1, 2, 1] }] }],
    [{ forms: [{ kind: 'sqrt', params: [2, 0, 0] }] }],
    [{ forms: [{ kind: 'sinAbs', params: [2, 1, 1] }] }],
    [{ forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }] }],
    [{ forms: [{ kind: 'recipSq', params: [4, 1] }] }],
    [{ forms: [{ kind: 'sqrt', params: [1, 0, 1] }, { kind: 'linear', params: [0.5, 1] }] }],
    [{ forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }, { kind: 'sinAbs', params: [2, 1, 1] }] }],
    [{ forms: [{ kind: 'cubic', params: [1, 0, -3, 0] }, { kind: 'sinAbs', params: [2, 1, 1] }, { kind: 'recipSq', params: [4, 1] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.2, 0, -0.5, 0.5, 1] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.15, 0, -0.6, 0.3, 1] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.1, 0, -0.4, 0.2, 1.2] }] }],
    [{ forms: [{ kind: 'log', params: [2, 0, 0] }] }],
    [{ forms: [{ kind: 'log', params: [1, 1, 1] }] }],
    [{ forms: [{ kind: 'tan', params: [3, 1, 0] }] }],
    [{ forms: [{ kind: 'tan', params: [1, 1, 1] }] }],
    [{ forms: [{ kind: 'gauss', params: [4, 0, 1, 0] }] }],
    [{ forms: [{ kind: 'gauss', params: [3, 1, 1, 0.5] }] }],
    [{ forms: [{ kind: 'logistic', params: [4, 2, 0, 0] }] }],
    [{ forms: [{ kind: 'logistic', params: [3, 1, 1, -1] }] }],
    [{ forms: [{ kind: 'log', params: [1.5, 0, 0] }, { kind: 'linear', params: [-0.8, 2] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1.5, 0] }, { kind: 'log', params: [1, 2, 1] }] }],
    [{ forms: [{ kind: 'gauss', params: [5, 0, 1.2, 0] }, { kind: 'linear', params: [-1, 0] }] }],
    [{ forms: [{ kind: 'logistic', params: [3, 1.2, -1, 0] }, { kind: 'quadratic', params: [0.25, 0, -1] }] }],
    [{ forms: [{ kind: 'log', params: [1, 0, 0] }, { kind: 'gauss', params: [3, 2.5, 0.8, 0] }, { kind: 'linear', params: [0.5, -2] }] }],
    [{ forms: [{ kind: 'tan', params: [1, 1, 0] }, { kind: 'logistic', params: [2, 2, 3, 1] }, { kind: 'quadratic', params: [-0.4, 0, -1] }] }],
    [{ forms: [{ kind: 'gauss', params: [4, 0, 1.5, 0] }, { kind: 'log', params: [1.5, 2.5, 0] }, { kind: 'linear', params: [0.5, -2] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1.2, 0] }, { kind: 'logistic', params: [3, 1.5, 4, 0] }, { kind: 'gauss', params: [3, -4, 1, 0] }, { kind: 'linear', params: [0.2, 0] }] }],
  ];


  /* ---------------- 挑战关卡 ----------------
     第二页：复合函数、更多点位与禁区、更小容差 */
  const CHALLENGE_LEVELS = [
    {
      name: '逻辑斯蒂·二次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'logistic'],
      hint: '2 条曲线分工，共 5 点、1 处禁区。',
      seed: 'logistic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -1.8, y: 0.21 }, { x: 2.2, y: 2.16 }],
      zones: [
        { type: 'rect', x1: -8, y1: 4.05, x2: -3.6, y2: 8.55 },
      ],
    },
    {
      name: '一次·整流正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic'],
      hint: '2 条曲线分工，共 5 点、1 处禁区。',
      seed: 'linear', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }, { x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }],
      zones: [
        { type: 'rect', x1: -7, y1: 3.6, x2: -3.2, y2: 7.6 },
      ],
    },
    {
      name: '三次·逻辑斯蒂',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'logistic'],
      hint: '2 条曲线分工，共 5 点、1 处禁区。',
      seed: 'cubic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }],
      zones: [
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
      ],
    },
    {
      name: '三次·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'gauss'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'cubic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -3, y: -0.1 }, { x: -2, y: -1.4 }, { x: -0.8, y: 0.24 }],
      zones: [
        { type: 'circle', x: 4.34, y: -3.85, r: 1.12 },
      ],
    },
    {
      name: '四次·二次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'quartic'],
      hint: '2 条曲线分工，共 5 点、1 处禁区。',
      seed: 'quartic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -1.8, y: 0.21 }, { x: 2.2, y: 2.16 }],
      zones: [
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
      ],
    },
    {
      name: '三次·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'cubic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }],
      zones: [
        { type: 'circle', x: -6.2, y: -5.5, r: 1.6 },
      ],
    },
    {
      name: '指数·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'exponential', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -2, y: -1.32 }, { x: 0.8, y: -0.39 }, { x: 2.4, y: 1.19 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }],
      zones: [
        { type: 'rect', x1: -7, y1: 3.6, x2: -3.2, y2: 7.6 },
      ],
    },
    {
      name: '根式·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'gauss'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'sqrt', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -1.4, y: 0.8 }, { x: 0.6, y: 2.12 }, { x: 2.2, y: 2.86 }, { x: -3, y: -0.1 }, { x: -2, y: -1.4 }, { x: -0.8, y: 0.24 }],
      zones: [
        { type: 'rect', x1: -10, y1: 4.95, x2: -4.4, y2: 10.45 },
      ],
    },
    {
      name: '整流正弦·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'sinAbs', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }],
      zones: [
        { type: 'rect', x1: -6, y1: 3.15, x2: -2.8, y2: 6.65 },
      ],
    },
    {
      name: '四次·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'quartic', 'log'],
      hint: '2 条曲线分工，共 6 点、1 处禁区。',
      seed: 'quartic', maxForms: 2, tol: 0.26,
      challenge: true,
      points: [{ x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }],
      zones: [
        { type: 'circle', x: 8.68, y: -7.7, r: 2.24 },
      ],
    },
    {
      name: '逻辑斯蒂·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'log', 'logistic'],
      hint: '2 条曲线分工，共 5 点、2 处禁区。',
      seed: 'logistic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }],
      zones: [
        { type: 'rect', x1: -3.52, y1: -10.45, x2: 3.52, y2: -4.95 },
        { type: 'circle', x: -6.82, y: -6.05, r: 1.76 },
      ],
    },
    {
      name: '逻辑斯蒂·整流正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'logistic'],
      hint: '2 条曲线分工，共 6 点、2 处禁区。',
      seed: 'logistic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }],
      zones: [
        { type: 'circle', x: 5.58, y: -4.95, r: 1.44 },
        { type: 'circle', x: -5.58, y: -4.95, r: 1.44 },
      ],
    },
    {
      name: '逻辑斯蒂·反比例',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'logistic'],
      hint: '2 条曲线分工，共 5 点、2 处禁区。',
      seed: 'logistic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -2.8, y: -0.13 }, { x: 2.6, y: 1.8 }],
      zones: [
        { type: 'rect', x1: 3.6, y1: 4.05, x2: 8, y2: 8.55 },
        { type: 'circle', x: -5.58, y: -4.95, r: 1.44 },
      ],
    },
    {
      name: '四次·指数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '2 条曲线分工，共 6 点、2 处禁区。',
      seed: 'quartic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2, y: -1.32 }, { x: 0.8, y: -0.39 }, { x: 2.4, y: 1.19 }],
      zones: [
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '整流正弦·三次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '2 条曲线分工，共 5 点、2 处禁区。',
      seed: 'sinAbs', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }],
      zones: [
        { type: 'rect', x1: -3.2, y1: -9.5, x2: 3.2, y2: -4.5 },
        { type: 'circle', x: -6.2, y: -5.5, r: 1.6 },
      ],
    },
    {
      name: '指数·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'gauss'],
      hint: '2 条曲线分工，共 6 点、2 处禁区。',
      seed: 'exponential', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -2, y: -1.32 }, { x: 0.8, y: -0.39 }, { x: 2.4, y: 1.19 }, { x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }],
      zones: [
        { type: 'rect', x1: -2.56, y1: -7.6, x2: 2.56, y2: -3.6 },
        { type: 'circle', x: 4.96, y: -4.4, r: 1.28 },
      ],
    },
    {
      name: '正弦·一次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq'],
      hint: '2 条曲线分工，共 6 点、2 处禁区。',
      seed: 'sine', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }],
      zones: [
        { type: 'rect', x1: 3.2, y1: 3.6, x2: 7, y2: 7.6 },
        { type: 'rect', x1: -7, y1: 3.6, x2: -3.2, y2: 7.6 },
      ],
    },
    {
      name: '三次·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'log'],
      hint: '2 条曲线分工，共 6 点、2 处禁区。',
      seed: 'cubic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }],
      zones: [
        { type: 'circle', x: 8.68, y: -7.7, r: 2.24 },
        { type: 'rect', x1: -13, y1: 6.3, x2: -5.6, y2: 13.3 },
      ],
    },
    {
      name: '四次·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '2 条曲线分工，共 7 点、2 处禁区。',
      seed: 'quartic', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }],
      zones: [
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
        { type: 'rect', x1: 5.2, y1: 5.85, x2: 12, y2: 12.35 },
      ],
    },
    {
      name: '正弦·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'log'],
      hint: '2 条曲线分工，共 5 点、2 处禁区。',
      seed: 'sine', maxForms: 2, tol: 0.24,
      challenge: true,
      points: [{ x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }, { x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }],
      zones: [
        { type: 'circle', x: 6.82, y: -6.05, r: 1.76 },
        { type: 'rect', x1: -10, y1: 4.95, x2: -4.4, y2: 10.45 },
      ],
    },
    {
      name: '逻辑斯蒂·二次·绝对值',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'logistic'],
      hint: '3 条曲线分工，共 7 点、2 处禁区。',
      seed: 'logistic', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -2.5, y: 0.59 }, { x: 2.4, y: 0.42 }, { x: -2.6, y: 2.84 }, { x: 1.4, y: 3.96 }],
      zones: [
        { type: 'rect', x1: -3.52, y1: -10.45, x2: 3.52, y2: -4.95 },
        { type: 'circle', x: 6.82, y: -6.05, r: 1.76 },
      ],
    },
    {
      name: '正弦·逻辑斯蒂·三次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'logistic'],
      hint: '3 条曲线分工，共 10 点、2 处禁区。',
      seed: 'sine', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }],
      zones: [
        { type: 'circle', x: -5.58, y: -4.95, r: 1.44 },
        { type: 'circle', x: 5.58, y: -4.95, r: 1.44 },
      ],
    },
    {
      name: '平方反比·反比例·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'gauss'],
      hint: '3 条曲线分工，共 7 点、2 处禁区。',
      seed: 'recipSq', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -2.4, y: -0.04 }, { x: 2.4, y: -0.04 }, { x: -2.8, y: -0.13 }, { x: 2.6, y: 1.8 }, { x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }],
      zones: [
        { type: 'rect', x1: -8, y1: 4.05, x2: -3.6, y2: 8.55 },
        { type: 'rect', x1: 3.6, y1: 4.05, x2: 8, y2: 8.55 },
      ],
    },
    {
      name: '一次·逻辑斯蒂·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'logistic'],
      hint: '3 条曲线分工，共 8 点、2 处禁区。',
      seed: 'linear', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }, { x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }],
      zones: [
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
      ],
    },
    {
      name: '四次·三次·根式',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '3 条曲线分工，共 8 点、2 处禁区。',
      seed: 'quartic', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -1.4, y: 0.8 }, { x: 0.6, y: 2.12 }, { x: 2.2, y: 2.86 }],
      zones: [
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
      ],
    },
    {
      name: '指数·平方反比·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '3 条曲线分工，共 9 点、2 处禁区。',
      seed: 'exponential', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -2, y: -1.32 }, { x: 0.8, y: -0.39 }, { x: 2.4, y: 1.19 }, { x: -2.4, y: -0.04 }, { x: 2.4, y: -0.04 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }],
      zones: [
        { type: 'rect', x1: -2.56, y1: -7.6, x2: 2.56, y2: -3.6 },
        { type: 'rect', x1: -7, y1: 3.6, x2: -3.2, y2: 7.6 },
      ],
    },
    {
      name: '对数·一次·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'gauss'],
      hint: '3 条曲线分工，共 8 点、2 处禁区。',
      seed: 'log', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }, { x: -3.2, y: 4.38 }, { x: -1.4, y: 2.76 }, { x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }],
      zones: [
        { type: 'circle', x: -9.92, y: -8.8, r: 2.56 },
        { type: 'rect', x1: -5.12, y1: -15.2, x2: 5.12, y2: -7.2 },
      ],
    },
    {
      name: '一次·正弦·三次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '3 条曲线分工，共 7 点、2 处禁区。',
      seed: 'linear', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -3.2, y: 4.38 }, { x: -1.4, y: 2.76 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }],
      zones: [
        { type: 'rect', x1: 6.4, y1: 7.2, x2: 15, y2: 15.2 },
        { type: 'circle', x: -9.92, y: -8.8, r: 2.56 },
      ],
    },
    {
      name: '三次·四次·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、2 处禁区。',
      seed: 'cubic', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }],
      zones: [
        { type: 'rect', x1: 5.2, y1: 5.85, x2: 12, y2: 12.35 },
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '三次·四次·整流正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic'],
      hint: '3 条曲线分工，共 9 点、2 处禁区。',
      seed: 'cubic', maxForms: 3, tol: 0.22,
      challenge: true,
      points: [{ x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }],
      zones: [
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '整流正弦·逻辑斯蒂·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'logistic'],
      hint: '3 条曲线分工，共 8 点、3 处禁区。',
      seed: 'sinAbs', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }, { x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }, { x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }],
      zones: [
        { type: 'rect', x1: 5.2, y1: 5.85, x2: 12, y2: 12.35 },
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
      ],
    },
    {
      name: '高斯·三次·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'gauss'],
      hint: '3 条曲线分工，共 9 点、3 处禁区。',
      seed: 'gauss', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }],
      zones: [
        { type: 'circle', x: -6.2, y: -5.5, r: 1.6 },
        { type: 'rect', x1: 4, y1: 4.5, x2: 9, y2: 9.5 },
        { type: 'rect', x1: -3.2, y1: -9.5, x2: 3.2, y2: -4.5 },
      ],
    },
    {
      name: '整流正弦·四次·一次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、3 处禁区。',
      seed: 'sinAbs', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2, y: -0.3 }, { x: 2.6, y: 1.54 }],
      zones: [
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '对数·四次·一次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、3 处禁区。',
      seed: 'log', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2, y: -0.3 }, { x: 2.6, y: 1.54 }],
      zones: [
        { type: 'rect', x1: -13, y1: 6.3, x2: -5.6, y2: 13.3 },
        { type: 'circle', x: -8.68, y: -7.7, r: 2.24 },
        { type: 'circle', x: 8.68, y: -7.7, r: 2.24 },
      ],
    },
    {
      name: '一次·二次·四次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 7 点、2 处禁区。',
      seed: 'linear', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }, { x: -1.8, y: 0.21 }, { x: 2.2, y: 2.16 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }],
      zones: [
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
      ],
    },
    {
      name: '正弦·对数·平方反比',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、3 处禁区。',
      seed: 'sine', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }, { x: -2.4, y: -0.04 }, { x: 2.4, y: -0.04 }],
      zones: [
        { type: 'circle', x: -6.82, y: -6.05, r: 1.76 },
        { type: 'rect', x1: 4.4, y1: 4.95, x2: 10, y2: 10.45 },
        { type: 'rect', x1: -10, y1: 4.95, x2: -4.4, y2: 10.45 },
      ],
    },
    {
      name: '一次·四次·对数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、2 处禁区。',
      seed: 'linear', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }],
      zones: [
        { type: 'rect', x1: -13, y1: 6.3, x2: -5.6, y2: 13.3 },
        { type: 'circle', x: 8.68, y: -7.7, r: 2.24 },
      ],
    },
    {
      name: '对数·一次·四次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 7 点、3 处禁区。',
      seed: 'log', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }, { x: -3.2, y: 4.38 }, { x: -1.4, y: 2.76 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }],
      zones: [
        { type: 'rect', x1: 6.4, y1: 7.2, x2: 15, y2: 15.2 },
        { type: 'circle', x: -9.92, y: -8.8, r: 2.56 },
        { type: 'rect', x1: -5.12, y1: -15.2, x2: 5.12, y2: -7.2 },
      ],
    },
    {
      name: '根式·一次·四次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log'],
      hint: '3 条曲线分工，共 8 点、3 处禁区。',
      seed: 'sqrt', maxForms: 3, tol: 0.20,
      challenge: true,
      points: [{ x: -1.4, y: 0.8 }, { x: 0.6, y: 2.12 }, { x: 2.2, y: 2.86 }, { x: -3.2, y: 4.38 }, { x: -1.4, y: 2.76 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }],
      zones: [
        { type: 'rect', x1: 6.4, y1: 7.2, x2: 15, y2: 15.2 },
        { type: 'rect', x1: -5.12, y1: -15.2, x2: 5.12, y2: -7.2 },
        { type: 'circle', x: -9.92, y: -8.8, r: 2.56 },
      ],
    },
    {
      name: '逻辑斯蒂·一次·二次·高斯',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 10 点、2 处禁区。',
      seed: 'logistic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }, { x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }, { x: -1.8, y: 0.21 }, { x: 2.2, y: 2.16 }, { x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }],
      zones: [
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
      ],
    },
    {
      name: '逻辑斯蒂·正弦·高斯·一次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 11 点、3 处禁区。',
      seed: 'logistic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }, { x: -1, y: 0.81 }, { x: 0.6, y: 3.38 }, { x: 2, y: 0.81 }, { x: -3.2, y: 4.38 }, { x: -1.4, y: 2.76 }],
      zones: [
        { type: 'circle', x: -9.92, y: -8.8, r: 2.56 },
        { type: 'rect', x1: 6.4, y1: 7.2, x2: 15, y2: 15.2 },
        { type: 'rect', x1: -5.12, y1: -15.2, x2: 5.12, y2: -7.2 },
      ],
    },
    {
      name: '二次·高斯·三次·根式',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 11 点、3 处禁区。',
      seed: 'quadratic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -2.5, y: 0.59 }, { x: 2.4, y: 0.42 }, { x: -3, y: -0.1 }, { x: -2, y: -1.4 }, { x: -0.8, y: 0.24 }, { x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -1.4, y: 0.8 }, { x: 0.6, y: 2.12 }, { x: 2.2, y: 2.86 }],
      zones: [
        { type: 'circle', x: -6.82, y: -6.05, r: 1.76 },
        { type: 'circle', x: 6.82, y: -6.05, r: 1.76 },
        { type: 'rect', x1: -3.52, y1: -10.45, x2: 3.52, y2: -4.95 },
      ],
    },
    {
      name: '对数·三次·正弦·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 11 点、3 处禁区。',
      seed: 'log', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: -1.2, y: -1.38 }, { x: 0.4, y: 0.85 }, { x: 1.8, y: -1.01 }],
      zones: [
        { type: 'rect', x1: -3.52, y1: -10.45, x2: 3.52, y2: -4.95 },
        { type: 'rect', x1: 4.4, y1: 4.95, x2: 10, y2: 10.45 },
        { type: 'circle', x: -6.82, y: -6.05, r: 1.76 },
      ],
    },
    {
      name: '逻辑斯蒂·反比例·二次·正弦',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 11 点、2 处禁区。',
      seed: 'logistic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: -2.8, y: -0.13 }, { x: 2.6, y: 1.8 }, { x: -2.5, y: 0.59 }, { x: 2.4, y: 0.42 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }],
      zones: [
        { type: 'circle', x: 5.58, y: -4.95, r: 1.44 },
        { type: 'circle', x: -5.58, y: -4.95, r: 1.44 },
      ],
    },
    {
      name: '绝对值·整流正弦·逻辑斯蒂·三次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 10 点、3 处禁区。',
      seed: 'abs', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -2.6, y: 2.84 }, { x: 1.4, y: 3.96 }, { x: -2.2, y: -0.79 }, { x: 0, y: -1.4 }, { x: 2.2, y: -0.79 }, { x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }, { x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }],
      zones: [
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
        { type: 'rect', x1: -4.16, y1: -12.35, x2: 4.16, y2: -5.85 },
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '三次·四次·正弦·一次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 12 点、2 处禁区。',
      seed: 'cubic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -3, y: -0.42 }, { x: 1.2, y: -1.28 }, { x: 2.8, y: -0.13 }, { x: -3, y: -3.03 }, { x: 1.5, y: -0.92 }, { x: 3, y: -3.03 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: 1.5, y: -0.95 }, { x: 3.4, y: 0.38 }],
      zones: [
        { type: 'rect', x1: -12, y1: 5.85, x2: -5.2, y2: 12.35 },
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
      ],
    },
    {
      name: '三次·正弦·对数·二次',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 11 点、2 处禁区。',
      seed: 'cubic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -2.4, y: -0.56 }, { x: -0.6, y: -0.83 }, { x: 1.4, y: 2.4 }, { x: 2.8, y: 0.52 }, { x: -1.8, y: 0.44 }, { x: 0.6, y: 3.07 }, { x: 2.6, y: 4.13 }, { x: -2.5, y: 0.59 }, { x: 2.4, y: 0.42 }],
      zones: [
        { type: 'circle', x: 8.68, y: -7.7, r: 2.24 },
        { type: 'circle', x: -8.68, y: -7.7, r: 2.24 },
      ],
    },
    {
      name: '三次·二次·绝对值·指数',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 9 点、2 处禁区。',
      seed: 'cubic', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: -2.6, y: 0.6 }, { x: 2.4, y: 2.13 }, { x: -2.5, y: 0.59 }, { x: 2.4, y: 0.42 }, { x: -2.6, y: 2.84 }, { x: 1.4, y: 3.96 }, { x: -2, y: -1.32 }, { x: 0.8, y: -0.39 }, { x: 2.4, y: 1.19 }],
      zones: [
        { type: 'circle', x: -6.82, y: -6.05, r: 1.76 },
        { type: 'rect', x1: -3.52, y1: -10.45, x2: 3.52, y2: -4.95 },
      ],
    },
    {
      name: '对数·逻辑斯蒂·逻辑斯蒂·反比例',
      pool: ['linear', 'abs', 'quadratic', 'reciprocal', 'sine', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '4 条曲线分工，共 10 点、3 处禁区。',
      seed: 'log', maxForms: 4, tol: 0.18,
      challenge: true,
      points: [{ x: 2.6, y: 0.81 }, { x: 4.2, y: -0.99 }, { x: -1.6, y: -1.65 }, { x: 0.4, y: 0.71 }, { x: 2.2, y: 2.05 }, { x: 1.2, y: 0.65 }, { x: 2.8, y: -1.29 }, { x: 4.2, y: -2.27 }, { x: -2.8, y: -0.13 }, { x: 2.6, y: 1.8 }],
      zones: [
        { type: 'circle', x: 8.06, y: -7.15, r: 2.08 },
        { type: 'circle', x: -8.06, y: -7.15, r: 2.08 },
        { type: 'rect', x1: 5.2, y1: 5.85, x2: 12, y2: 12.35 },
      ],
    },
  ];

  const SANDBOX_LEVEL = {
      name: '测试场',
      pool: ['linear', 'quadratic', 'reciprocal', 'sine', 'abs', 'exponential', 'sqrt', 'sinAbs', 'cubic', 'recipSq', 'quartic', 'log', 'tan', 'gauss', 'logistic'],
      hint: '实验关卡：全部函数直接可用，最多 10 条公式，视窗放大到 ±20，没有禁区。',
      seed: 'linear', maxForms: 10, tol: 0.60, radius: 20,
      test: true, allKinds: true,
      points: [{ x: -8, y: -5 }, { x: 0, y: 6 }, { x: 8, y: -3 }],
  };

  /* 基础页在前、挑战页居中、测试场固定最后（不进列表，由主页按钮进入） */
  const BASE_COUNT = LEVELS.length;
  LEVELS.push(...CHALLENGE_LEVELS, SANDBOX_LEVEL);
  const CHALLENGE_COUNT = CHALLENGE_LEVELS.length;
  const SANDBOX_INDEX = LEVELS.length - 1;


  const CHALLENGE_SOLUTIONS = [
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'quadratic', params: [-0.28, 0.6, 2.2] }] }],
    [{ forms: [{ kind: 'linear', params: [0.7, -2] }, { kind: 'sinAbs', params: [2.2, 1.3, -1.4] }] }],
    [{ forms: [{ kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }] }],
    [{ forms: [{ kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'gauss', params: [-2.6, -2, 1.2, 1.2] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'quadratic', params: [-0.28, 0.6, 2.2] }] }],
    [{ forms: [{ kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'sine', params: [2, 1.1, 0.4] }] }],
    [{ forms: [{ kind: 'exponential', params: [0.8, 0.75, -1.6] }, { kind: 'sine', params: [1.6, 2, -0.3] }] }],
    [{ forms: [{ kind: 'sqrt', params: [1.8, -2.4, -1] }, { kind: 'gauss', params: [-2.6, -2, 1.2, 1.2] }] }],
    [{ forms: [{ kind: 'sinAbs', params: [2.2, 1.3, -1.4] }, { kind: 'sine', params: [1.6, 2, -0.3] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'log', params: [2.4, -3, 0] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'log', params: [-2, 1.5, 1] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'sinAbs', params: [2.2, 1.3, -1.4] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'reciprocal', params: [2.6, 0.8] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'exponential', params: [0.8, 0.75, -1.6] }] }],
    [{ forms: [{ kind: 'sinAbs', params: [2.2, 1.3, -1.4] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }] }],
    [{ forms: [{ kind: 'exponential', params: [0.8, 0.75, -1.6] }, { kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'linear', params: [0.7, -2] }] }],
    [{ forms: [{ kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'log', params: [2.4, -3, 0] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'sine', params: [2, 1.1, 0.4] }] }],
    [{ forms: [{ kind: 'sine', params: [1.6, 2, -0.3] }, { kind: 'log', params: [-2, 1.5, 1] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'quadratic', params: [0.35, 0, -1.6] }, { kind: 'abs', params: [1.4, -1, 0.6] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'cubic', params: [0.16, 0, -1.3, 0] }] }],
    [{ forms: [{ kind: 'recipSq', params: [3.2, -0.6] }, { kind: 'reciprocal', params: [2.6, 0.8] }, { kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }] }],
    [{ forms: [{ kind: 'linear', params: [0.7, -2] }, { kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }, { kind: 'sine', params: [1.6, 2, -0.3] }] }],
    [{ forms: [{ kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'sqrt', params: [1.8, -2.4, -1] }] }],
    [{ forms: [{ kind: 'exponential', params: [0.8, 0.75, -1.6] }, { kind: 'recipSq', params: [3.2, -0.6] }, { kind: 'sine', params: [2, 1.1, 0.4] }] }],
    [{ forms: [{ kind: 'log', params: [2.4, -3, 0] }, { kind: 'linear', params: [-0.9, 1.5] }, { kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }] }],
    [{ forms: [{ kind: 'linear', params: [-0.9, 1.5] }, { kind: 'sine', params: [1.6, 2, -0.3] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }] }],
    [{ forms: [{ kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'log', params: [-2, 1.5, 1] }] }],
    [{ forms: [{ kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'sinAbs', params: [2.2, 1.3, -1.4] }] }],
    [{ forms: [{ kind: 'sinAbs', params: [2.2, 1.3, -1.4] }, { kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }, { kind: 'log', params: [-2, 1.5, 1] }] }],
    [{ forms: [{ kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'sine', params: [2, 1.1, 0.4] }] }],
    [{ forms: [{ kind: 'sinAbs', params: [2.2, 1.3, -1.4] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'linear', params: [0.4, 0.5] }] }],
    [{ forms: [{ kind: 'log', params: [2.4, -3, 0] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'linear', params: [0.4, 0.5] }] }],
    [{ forms: [{ kind: 'linear', params: [0.7, -2] }, { kind: 'quadratic', params: [-0.28, 0.6, 2.2] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }] }],
    [{ forms: [{ kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'log', params: [-2, 1.5, 1] }, { kind: 'recipSq', params: [3.2, -0.6] }] }],
    [{ forms: [{ kind: 'linear', params: [0.7, -2] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'log', params: [2.4, -3, 0] }] }],
    [{ forms: [{ kind: 'log', params: [-2, 1.5, 1] }, { kind: 'linear', params: [-0.9, 1.5] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }] }],
    [{ forms: [{ kind: 'sqrt', params: [1.8, -2.4, -1] }, { kind: 'linear', params: [-0.9, 1.5] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }] }],
    [{ forms: [{ kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }, { kind: 'linear', params: [0.7, -2] }, { kind: 'quadratic', params: [-0.28, 0.6, 2.2] }, { kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'sine', params: [1.6, 2, -0.3] }, { kind: 'gauss', params: [3.8, 0.5, 1.4, -0.4] }, { kind: 'linear', params: [-0.9, 1.5] }] }],
    [{ forms: [{ kind: 'quadratic', params: [0.35, 0, -1.6] }, { kind: 'gauss', params: [-2.6, -2, 1.2, 1.2] }, { kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'sqrt', params: [1.8, -2.4, -1] }] }],
    [{ forms: [{ kind: 'log', params: [-2, 1.5, 1] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'sine', params: [1.6, 2, -0.3] }] }],
    [{ forms: [{ kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'reciprocal', params: [2.6, 0.8] }, { kind: 'quadratic', params: [0.35, 0, -1.6] }, { kind: 'sine', params: [2, 1.1, 0.4] }] }],
    [{ forms: [{ kind: 'abs', params: [1.4, -1, 0.6] }, { kind: 'sinAbs', params: [2.2, 1.3, -1.4] }, { kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }, { kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }] }],
    [{ forms: [{ kind: 'cubic', params: [0.16, 0, -1.3, 0] }, { kind: 'quartic', params: [0.07, 0, -1.1, 0, 1.2] }, { kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'linear', params: [0.7, -2] }] }],
    [{ forms: [{ kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'sine', params: [2, 1.1, 0.4] }, { kind: 'log', params: [2.4, -3, 0] }, { kind: 'quadratic', params: [0.35, 0, -1.6] }] }],
    [{ forms: [{ kind: 'cubic', params: [-0.12, 0.2, 1.1, 0] }, { kind: 'quadratic', params: [0.35, 0, -1.6] }, { kind: 'abs', params: [1.4, -1, 0.6] }, { kind: 'exponential', params: [0.8, 0.75, -1.6] }] }],
    [{ forms: [{ kind: 'log', params: [-2, 1.5, 1] }, { kind: 'logistic', params: [4.2, 1.5, 0, -2] }, { kind: 'logistic', params: [-3.4, 1.8, 2.4, 1] }, { kind: 'reciprocal', params: [2.6, 0.8] }] }],
  ];

  const SANDBOX_SOLUTIONS = [
    [{ forms: [{ kind: 'quadratic', params: [-0.15625, 0.125, 6] }] }],
  ];

  SOLUTIONS.push(...CHALLENGE_SOLUTIONS, ...SANDBOX_SOLUTIONS);

  LEVELS.forEach((lv, i) => { lv.solutions = SOLUTIONS[i] || []; });

  /* 30 关的中文序号 */
  const ROMAN = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾',
    '拾壹', '拾贰', '拾叁', '拾肆', '拾伍', '拾陆', '拾柒', '拾捌', '拾玖', '贰拾',
    '贰拾壹', '贰拾贰', '贰拾叁', '贰拾肆', '贰拾伍', '贰拾陆', '贰拾柒', '贰拾捌', '贰拾玖', '叁拾',
    '叁拾壹', '叁拾贰', '叁拾叁', '叁拾肆', '叁拾伍', '叁拾陆', '叁拾柒', '叁拾捌', '叁拾玖', '肆拾',
    '肆拾壹', '肆拾贰', '肆拾叁', '肆拾肆', '肆拾伍', '肆拾陆', '肆拾柒', '肆拾捌', '肆拾玖'];

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
    briefBlock: $('#brief-block'),
    briefPlan: $('#brief-plan'),
    briefSteps: $('#brief-steps'),
    briefPitfalls: $('#brief-pitfalls'),
    langSwitch: $('#lang-switch'),
    githubBlock: $('#github-block'),
    btnOpenRepo: $('#btn-open-repo'),
    btnCopyRepo: $('#btn-copy-repo'),
    fbText: $('#fb-text'),
    fbSend: $('#fb-send'),
    fbCount: $('#fb-count'),
    fbOverlay: $('#fb-overlay'),
    fbClose: $('#fb-close'),
    btnFeedback: $('#btn-feedback'),
    btnFeedbackHome: $('#btn-feedback-home'),
    startCurve: $('#start-curve'),
    errOverlay: $('#err-overlay'),
    errMsg: $('#err-msg'),
    errMeta: $('#err-meta'),
    errStack: $('#err-stack'),
    errSend: $('#err-send'),
    errCopy: $('#err-copy'),
    errClose: $('#err-close'),
    lesson: $('#lesson'),
    lessonEyebrow: $('#lesson-eyebrow'),
    lessonTitle: $('#lesson-title'),
    lessonForm: $('#lesson-form'),
    lessonConcept: $('#lesson-concept'),
    lessonCanvas: $('#lesson-canvas'),
    lessonSteps: $('#lesson-steps'),
    lessonPoints: $('#lesson-points'),
    lessonPitfalls: $('#lesson-pitfalls'),
    lessonClose: $('#lesson-close'),
    lessonCloseX: $('#lesson-close-x'),
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
    page: 'base',
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
    /* 进度一致性：可进入的关卡永远不超过"已通关数 + 1" */
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

  /* 函数池硬绑定在关卡上：每关的 pool 就是这一关能用的全部公式，
     与通关记录、与解锁阈值都无关，改关卡数据即可调整 */
  function levelPool() {
    return (state.level && state.level.pool) || [];
  }

  function isKindUnlocked(kind) {
    return levelPool().includes(kind);
  }

  /* 本次进入关卡时刚好跨过解锁线的公式，用于播放一次高亮提示。
     save.seen 记的是「上一次进入的关卡序号」，跳关时也能正确判定。 */
  function freshUnlocks() {
    const pool = levelPool();
    const seen = clamp(parseInt(save.seen, 10) || 0, 0, LEVELS.length - 1);
    const prev = new Set((LEVELS[seen] && LEVELS[seen].pool) || []);
    return pool.filter((k) => !prev.has(k) && k !== 'linear' && k !== 'abs');
  }

  /* ---------------- 视图计算 ---------------- */

  function viewRadius(level) {
    /* 测试场可以直接指定半径，普通关卡由目标点决定 */
    if (level.radius) return level.radius;
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
  function inZone(x, y, z, eps = ZONE_EPS) {
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
    const bw = Math.floor(W * dpr);
    const bh = Math.floor(H * dpr);

    /* 只有画布尺寸真的变了才重设，否则会把内容清空、看起来像闪了一下 */
    if (dom.plot.width !== bw || dom.plot.height !== bh) {
      dom.plot.width = bw;
      dom.plot.height = bh;
    }
    if (dom.plot.style.width !== `${W}px`) dom.plot.style.width = `${W}px`;
    if (dom.plot.style.height !== `${H}px`) dom.plot.style.height = `${H}px`;

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
    /* 切屏时把没来得及结束的点击涟漪清掉，避免隐藏屏里留下节点 */
    document.querySelectorAll('.ripple').forEach((el) => el.remove());
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
    state.paramSig = '';
    state.targets = level.points.map((p, i) => ({
      x: p.x, y: p.y, hit: false, near: false, label: pt(i),
    }));

    dom.formList.innerHTML = '';
    dom.lvNumber.textContent = levelIndexText(index);
    dom.lvName.textContent = levelTitle(level, index);
    dom.lvHint.textContent = levelHint(level, index);
    dom.btnPause.textContent = t('game.pause');
    dom.btnPause.classList.remove('is-on');

    const fresh = freshUnlocks();
    state.fresh = fresh;
    if (fresh.length) {
      save.seen = state.levelIndex;
      persist();
    }

    renderPalette();
    renderTargetList();
    renderZoneList();
    renderBrief();
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

  /* ---------------- 移动端分区切换 ---------------- */

  const TAB_QUERY = window.matchMedia('(max-width: 820px)');

  function setPanel(name) {
    document.querySelectorAll('.panel-tab').forEach((tab) => {
      const on = tab.dataset.panel === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.console .panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === name);
    });
  }

  /* 只在标签页布局下自动切换，桌面三栏保持原样 */
  function focusPanel(name) {
    if (TAB_QUERY.matches) setPanel(name);
  }

  function addForm(kind, preset) {
    const level = state.level;
    if (!level) return;
    if (!isKindUnlocked(kind)) {
      toast(t('toast.locked', { name: kindName(kind) }));
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
    /* 手机上添加公式后直接回到参数页，省一次手动切换 */
    focusPanel('forms');
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
    del.setAttribute('aria-label', t('aria.delete'));
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
    input.dataset.label = param.label;
    input.setAttribute('aria-label', t('aria.param', { name: param.label }));

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
    stop.textContent = t('param.stop');
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
    btn.dataset.label = param.label;
    btn.setAttribute('aria-label',
      t(dir > 0 ? 'aria.increase' : 'aria.decrease', { name: param.label }));

    const arrow = document.createElement('i');
    arrow.textContent = dir > 0 ? '\u25b2' : '\u25bc';

    btn.append(arrow);

    /* 按住持续增减，松开（或移出、失焦）立即停；恒定 1/s */
    const begin = () => {
      param.dir = dir;
      param.mode = 0;
      syncParam(form, param);
    };
    const end = () => {
      if (param.dir !== dir) return;
      param.dir = 0;
      syncParam(form, param);
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      /* 捕获指针，保证松手一定回到这个按钮上 */
      if (btn.setPointerCapture) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
      begin();
    });
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);

    /* 键盘：按住 Enter / 空格同样持续变化 */
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      begin();
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      end();
    });
    btn.addEventListener('blur', end);

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
    /* 自动增减时给数值加呼吸高亮 */
    param.el.input.classList.toggle('is-live', param.dir !== 0);
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
    const pool = levelPool();
    const fresh = state.fresh || [];
    const openCount = pool.length;

    dom.paletteTag.textContent = `${openCount} / ${ALL_KINDS.length}`;
    dom.paletteOps.innerHTML = OPS
      .map((o) => `<span class="op-chip" title="${t(o.tipKey)}">${o.mark}</span>`)
      .join('');

    fillPaletteGroup(dom.paletteListBasic, BASIC_KINDS, pool, fresh);
    fillPaletteGroup(dom.paletteListAdvanced, ADVANCED_KINDS, pool, fresh);
    refreshPaletteState();
  }

  function fillPaletteGroup(host, kinds, pool, fresh) {
    host.innerHTML = '';
    kinds.forEach((kind) => {
      const def = KINDS[kind];
      const at = unlockLevelOf(kind);
      const unlocked = pool.includes(kind);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.kind = kind;
      btn.className = 'palette-item'
        + (unlocked ? '' : ' is-locked')
        + (fresh.includes(kind) ? ' is-new' : '');
      btn.disabled = !unlocked;
      btn.title = unlocked ? `${kindName(kind)} ${def.form}` : t('toast.locked', { name: kindName(kind) });
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
        /* 满额时只做弱化，仍可点击，由 addForm 给出"已达上限"的提示 */
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

  /* 多公式关的分步讲解；没写 brief 的关卡整块隐藏 */
  function renderBrief() {
    if (!dom.briefBlock) return;
    const idx = state.levelIndex;
    const brief = state.level
      ? (state.lang === 'en' ? (LEVEL_EN[idx] && LEVEL_EN[idx].brief) : state.level.brief)
      : null;

    dom.briefBlock.hidden = !brief;
    if (!brief) return;

    dom.briefPlan.textContent = brief.plan || '';
    dom.briefSteps.innerHTML = (brief.steps || [])
      .map((text, i) => `<li><b>${i + 1}</b><span>${text}</span></li>`)
      .join('');
    dom.briefPitfalls.innerHTML = (brief.pitfalls || [])
      .map((text) => `<li><span>${text}</span></li>`)
      .join('');
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

    const data = lessonData(kind);
    dom.lessonConcept.textContent = data.concept || '';
    dom.lessonConcept.hidden = !data.concept;

    dom.lessonSteps.innerHTML = (data.steps || [])
      .map((text, i) => `<li><b>${i + 1}</b><span>${text}</span></li>`)
      .join('');
    dom.lessonSteps.hidden = !(data.steps || []).length;

    dom.lessonPoints.innerHTML = (data.points || [])
      .map((text) => `<li><span>${text}</span></li>`)
      .join('');

    dom.lessonPitfalls.innerHTML = (data.pitfalls || [])
      .map((text) => `<li><span>${text}</span></li>`)
      .join('');
    dom.lessonPitfalls.hidden = !(data.pitfalls || []).length;
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

  /* 45° 斜纹用 13px 的平铺图案，避免每帧手绘上百条线段 */
  let hatchTile = null;

  function hatchPattern(ctx) {
    if (!hatchTile) {
      hatchTile = document.createElement('canvas');
      hatchTile.width = 13;
      hatchTile.height = 13;
      const g = hatchTile.getContext('2d');
      g.strokeStyle = 'rgba(255, 104, 124, .24)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-2, 15);
      g.lineTo(15, -2);
      g.stroke();
    }
    return ctx.createPattern(hatchTile, 'repeat');
  }

  function drawZones(ctx) {
    if (!state.zones.length) return;
    const hot = state.violation;

    for (const z of state.zones) {
      ctx.save();
      zonePath(ctx, z);
      /* 底色更实，违规时进一步加深 */
      ctx.fillStyle = hot ? 'rgba(255, 92, 112, .3)' : 'rgba(255, 104, 124, .13)';
      ctx.fill();
      ctx.fillStyle = hatchPattern(ctx);
      ctx.fill();

      /* 明确的边界线，让禁区和普通背景一眼分开 */
      ctx.strokeStyle = hot ? 'rgba(255, 138, 152, .95)' : 'rgba(255, 104, 124, .55)';
      ctx.lineWidth = hot ? 2 : 1.4;
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

    /* 虚环就是命中边界：半径与 checkWin 的判定完全一致，看到进圈即算命中 */
    const ringR = Math.max(9, Math.max(MIN_TOL_PX, state.level.tol * view.scale));

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
      ctx.strokeStyle = t.hit ? 'rgba(255, 225, 163, 0.9)' : 'rgba(255, 192, 106, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      /* 脉冲 */
      const ph = (time * 0.65 + i * 0.24) % 1;
      ctx.strokeStyle = `rgba(255, 192, 106, ${0.34 * (1 - ph)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, ringR * 0.55 + ph * ringR * 1.15, 0, Math.PI * 2);
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

    const tolPx = Math.max(MIN_TOL_PX, state.level.tol * view.scale);
    const running = hasRunning();
    let all = true;
    let sig = '';
    let autoStop = '';

    /* 注意：循环变量不能叫 t，否则会遮蔽翻译函数 t() */
    const tr = t;
    for (const target of state.targets) {
      const px = sx(target.x);
      const py = sy(target.y);
      let best = Infinity;
      for (const c of state.segments) {
        if (!c.segs.length) continue;
        best = Math.min(best, minDist(c.segs, px, py));
        if (best <= tolPx) break;
      }
      const wasHit = target.hit;
      target.hit = best <= tolPx;
      /* 命中即停：阈值与过关判定一致，避免自动增减一口气冲过整个容差圈 */
      if (target.hit && !wasHit && running) autoStop = tr('toast.hitStop');
      sig += target.hit ? '1' : '0';
      if (!target.hit) all = false;
    }

    /* 参数签名没变且没有自动增减时，跳过解法匹配的整表遍历 */
    const paramSig = state.forms
      .map((f) => `${f.kind}:${f.params.map((p) => p.value.toFixed(2)).join(',')}`)
      .join('|');
    if (running || paramSig !== state.paramSig) {
      state.paramSig = paramSig;
      const sol = matchedSolution();
      if (sol && sol !== state.solutionMatch && running) autoStop = t('toast.matchStop');
      if (sol !== state.solutionMatch) {
        state.solutionMatch = sol;
        renderSolutionMatch();
      }
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
      /* 全部命中后立刻停表，否则最后一个点可能在 hold 累积期间被冲出去 */
      if (running) stopAll();
      state.hold += dt;
      if (state.hold > WIN_HOLD) triggerWin();
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

  /* ---------------- 主页装饰曲线 ----------------
     每 5 秒换一条随机函数曲线，切换时用 1.6s 交叉淡入淡出，
     期间首个参数做轻微「呼吸」，看起来一直在缓慢变化。
     ---------------------------------------------- */

  const START_SAMPLES = [
    { kind: 'sine', params: [2, 1.2, 0] },
    { kind: 'sine', params: [1.6, 2.1, 0] },
    { kind: 'sinAbs', params: [2.2, 1.4, -1.6] },
    { kind: 'quadratic', params: [0.42, 0, -2.4] },
    { kind: 'cubic', params: [0.1, 0, -1.1, 0] },
    { kind: 'quartic', params: [0.05, 0, -0.8, 0, 1.1] },
    { kind: 'gauss', params: [3.6, 0, 1.5, -0.6] },
    { kind: 'logistic', params: [4.6, 1.6, 0, -2.3] },
    { kind: 'log', params: [2.2, -3, 0] },
    { kind: 'recipSq', params: [2.6, 0.4] },
    { kind: 'exponential', params: [0.9, 0.85, -1.4] },
    { kind: 'tan', params: [1.4, 0.8, 0] },
  ];

  const START_SWAP_MS = 5000;
  const START_FADE = 1.6;

  const startState = { cur: null, prev: null, switchedAt: 0, nextAt: 0 };
  let startView = null;
  let startCtx = null;

  function resizeStartCurve() {
    const c = dom.startCurve;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    startView = { W: rect.width, H: rect.height, dpr, R: 6 };
  }

  function pickStartSample(exclude) {
    for (let i = 0; i < 8; i++) {
      const s = START_SAMPLES[Math.floor(Math.random() * START_SAMPLES.length)];
      if (!exclude || s.kind !== exclude.kind) return s;
    }
    return START_SAMPLES[0];
  }

  function drawStartCurve(time) {
    if (!startCtx || !startView) return;
    const { W, H, dpr, R } = startView;
    const ctx = startCtx;
    const now = time * 1000;

    if (!startState.cur) {
      startState.cur = pickStartSample(null);
      startState.prev = null;
      startState.switchedAt = now;
      startState.nextAt = now + START_SWAP_MS;
    }
    if (now >= startState.nextAt) {
      startState.prev = startState.cur;
      startState.cur = pickStartSample(startState.prev);
      startState.switchedAt = now;
      startState.nextAt = now + START_SWAP_MS;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pad = 4;
    const size = Math.min(W, H) - pad * 2;
    const ox = (W - size) / 2;
    const oy = (H - size) / 2;
    const scale = size / (2 * R);
    const wobble = 1 + Math.sin(time * 0.7) * 0.07;

    const strokeOne = (sample, alpha) => {
      if (!sample || alpha <= 0.02) return;
      const fn = KINDS[sample.kind].f;
      const params = sample.params.map((v, i) => (i === 0 ? v * wobble : v));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(123, 241, 196, .92)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(123, 241, 196, .55)';
      ctx.shadowBlur = 8;
      ctx.beginPath();

      let pen = false;
      for (let px = 0; px <= size; px += 2) {
        const x = (px - size / 2) / scale;
        let y;
        try {
          y = fn(x, params);
        } catch (e) {
          y = NaN;
        }
        if (!Number.isFinite(y) || Math.abs(y) > R * 1.35) {
          pen = false;
          continue;
        }
        const gx = ox + px;
        const gy = oy + size / 2 - y * scale;
        if (pen) ctx.lineTo(gx, gy);
        else { ctx.moveTo(gx, gy); pen = true; }
      }
      ctx.stroke();
      ctx.restore();
    };

    const t = clamp((now - startState.switchedAt) / (START_FADE * 1000), 0, 1);
    strokeOne(startState.prev, 1 - t);
    strokeOne(startState.cur, t);
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

  /* 全部关卡开放：续玩优先回到第一个未通关的关卡 */
  function nextPlayable() {
    for (let i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].test) continue;
      if (!save.cleared[i]) return i;
    }
    return 0;
  }

  function renderStartProgress() {
    /* 测试场不计入通关进度 */
    const total = BASE_COUNT + CHALLENGE_COUNT;
    const cleared = save.cleared.slice(0, total).filter(Boolean).length;
    dom.startProgress.textContent = `${String(cleared).padStart(2, '0')} / ${total} ${t('start.progress')}`;
    dom.startTrack.innerHTML = LEVELS
      .slice(0, total)
      .map((_, i) => `<i class="${save.cleared[i] ? 'on' : ''}"></i>`)
      .join('');
  }

  function renderLevels() {
    const page = state.page === 'challenge' ? 'challenge' : 'base';
    /* 测试场不列在分页里，只从主页按钮进入 */
    const list = [];
    LEVELS.forEach((lv, i) => {
      if (lv.test) return;
      if (page === 'challenge' ? !lv.challenge : lv.challenge) return;
      list.push({ lv, i });
    });

    const doneCount = list.filter(({ i }) => save.cleared[i]).length;
    dom.levelsCount.textContent = `${String(doneCount).padStart(2, '0')} / ${list.length} CLEARED`;

    document.querySelectorAll('.pager-tab').forEach((tab) => {
      const on = tab.dataset.page === page;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    dom.levelsGrid.innerHTML = '';
    list.forEach(({ lv, i }, pos) => {
      const done = !!save.cleared[i];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card'
        + (done ? ' is-cleared' : '')
        + (lv.challenge ? ' is-challenge' : '');
      card.style.animationDelay = `${Math.min(pos * 0.018, 0.4)}s`;
      const badge = lv.maxForms > 1 ? 'MIX' : (KINDS[lv.seed] || KINDS.linear).short;
      const zc = (lv.zones || []).length;
      const indexText = lv.challenge
        ? `C${String(pos + 1).padStart(2, '0')}`
        : String(pos + 1).padStart(2, '0');
      card.innerHTML =
        `<span class="lc-index">${indexText}</span>` +
        `<span class="lc-name">${levelName(lv, i)}</span>` +
        `<span class="lc-kinds"><i class="lc-kind">${badge}</i><i class="lc-kind">\u00d7${lv.maxForms}</i>`
        + `<i class="lc-kind">${lv.points.length}P</i>`
        + (zc ? `<i class="lc-kind is-warn">${zc}Z</i>` : '')
        + `</span>` +
        `<span class="lc-state">${done ? t('state.cleared') : t('state.pending')}</span>`;
      card.addEventListener('click', () => startLevel(i));
      dom.levelsGrid.appendChild(card);
    });
  }

  /* ---------------- 事件绑定 ---------------- */

  /* ---------------- 反馈 ----------------
     走同源 POST /api/feedback，服务端落 feedback.csv。
     file:// 打开时没有后端，直接提示无法提交。
     -------------------------------------- */

  function openFeedback() {
    if (!dom.fbOverlay) return;
    dom.fbOverlay.hidden = false;
    updateFbCount();
    if (dom.fbText) dom.fbText.focus();
  }

  function closeFeedback() {
    if (dom.fbOverlay) dom.fbOverlay.hidden = true;
  }

  function updateFbCount() {
    if (!dom.fbCount || !dom.fbText) return;
    const n = dom.fbText.value.length;
    dom.fbCount.textContent = `${n} / ${FB_MAX}`;
    dom.fbCount.dataset.max = n >= FB_MAX ? 'true' : 'false';
  }

  function fbCooldownLeft() {
    try {
      const last = Number(localStorage.getItem(FB_KEY) || 0);
      return Math.max(0, 60000 - (Date.now() - last));
    } catch (e) {
      return 0;
    }
  }

  async function submitFeedback() {
    if (!dom.fbText) return;
    const text = dom.fbText.value.trim();

    if (text.length < 2) {
      toast(t('fb.empty'));
      return;
    }
    if (location.protocol === 'file:') {
      toast(t('fb.offline'));
      return;
    }

    const wait = fbCooldownLeft();
    if (wait > 0) {
      toast(t('fb.limit', { s: Math.ceil(wait / 1000) }));
      return;
    }

    dom.fbSend.disabled = true;
    dom.fbSend.textContent = t('fb.sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          level: state.level ? state.levelIndex + 1 : 0,
          page: location.pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        dom.fbText.value = '';
        updateFbCount();
        try { localStorage.setItem(FB_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
        toast(t(data.quarantined ? 'fb.review' : 'fb.ok'), true);
        closeFeedback();
      } else if (res.status === 429) {
        toast(t('fb.limit', { s: data.retryAfter || 60 }));
      } else {
        toast(t('fb.fail'));
      }
    } catch (e) {
      /* 离线、跨域或服务未开 */
      toast(t('fb.offline'));
    } finally {
      dom.fbSend.disabled = false;
      dom.fbSend.textContent = t('fb.send');
    }
  }

  /* ---------------- 错误捕获与上报 ----------------
     未捕获异常、Promise 拒绝、主线程卡顿都会弹出错误卡片，
     可一键回传到 /api/error 落成 error-report.csv。
     ---------------------------------------------- */

  const ERR_SEEN = new Set();
  let errPayload = null;

  function errPlainText() {
    if (!errPayload) return '';
    return [
      `[${errPayload.kind}] ${errPayload.message}`,
      `version=V${VERSION} level=${state.level ? state.levelIndex + 1 : 0}`,
      `page=${location.href}`,
      `ua=${navigator.userAgent}`,
      '',
      errPayload.stack || '',
    ].join('\n');
  }

  function showErrorCard(kind, message, stack) {
    if (!dom.errOverlay) return;
    errPayload = { kind, message, stack: stack || '' };
    dom.errMsg.textContent = message;
    dom.errStack.textContent = stack || t('err.noStack');
    dom.errMeta.textContent =
      `V${VERSION} · ${state.level ? `LV ${state.levelIndex + 1}` : '—'} · ${kind}`;
    dom.errOverlay.hidden = false;
    if (dom.errSend) {
      dom.errSend.disabled = false;
      dom.errSend.textContent = t('err.send');
    }
  }

  function closeErrorCard() {
    if (dom.errOverlay) dom.errOverlay.hidden = true;
  }

  /* 同一错误只弹一次，避免每帧重复弹窗；捕获器本身不能抛错 */
  function captureError(kind, message, stack) {
    try {
      const msg = String(message || '').slice(0, 400);
      const sig = `${kind}|${msg}|${String(stack || '').slice(0, 160)}`;
      if (ERR_SEEN.has(sig)) return;
      if (ERR_SEEN.size > 40) ERR_SEEN.clear();
      ERR_SEEN.add(sig);

      if (dom.errOverlay && !dom.errOverlay.hidden) return; // 已在展示，不覆盖
      showErrorCard(kind, msg || t('err.title'), String(stack || '').slice(0, 4000));
    } catch (e) {
      /* 兜底：错误捕获本身失败时静默 */
    }
  }

  function copyErrorText(silent) {
    const text = errPlainText();
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        if (!silent) toast(t('err.copied'), true);
      } catch (e) {
        toast(t('err.copyFail'));
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => { if (!silent) toast(t('err.copied'), true); }).catch(fallback);
    } else {
      fallback();
    }
  }

  async function sendErrorReport() {
    if (!errPayload || !dom.errSend) return;

    if (location.protocol === 'file:') {
      copyErrorText(true);
      toast(t('err.offline'));
      return;
    }

    dom.errSend.disabled = true;
    dom.errSend.textContent = t('err.sending');

    try {
      const res = await fetch('/api/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: errPayload.kind,
          message: errPayload.message,
          stack: errPayload.stack,
          version: `V${VERSION}`,
          level: state.level ? state.levelIndex + 1 : 0,
          page: location.pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        toast(t('err.sent'), true);
        closeErrorCard();
      } else if (res.status === 429) {
        toast(t('err.limit', { s: data.retryAfter || 60 }));
        dom.errSend.disabled = false;
        dom.errSend.textContent = t('err.send');
      } else {
        toast(t('err.fail'));
        dom.errSend.disabled = false;
        dom.errSend.textContent = t('err.send');
      }
    } catch (e) {
      toast(t('err.fail'));
      dom.errSend.disabled = false;
      dom.errSend.textContent = t('err.send');
    }
  }

  function bindErrorHandlers() {
    window.addEventListener('error', (e) => {
      if (!e || !e.message) return;
      captureError('error', e.message, e.error && e.error.stack);
    });

    window.addEventListener('unhandledrejection', (e) => {
      const reason = (e && e.reason) || {};
      captureError('promise', reason.message || String(reason), reason.stack);
    });

    if (dom.errSend) dom.errSend.addEventListener('click', sendErrorReport);
    /* 包一层，避免把点击事件对象当成 silent 参数传进去 */
    if (dom.errCopy) dom.errCopy.addEventListener('click', () => copyErrorText(false));
    if (dom.errClose) dom.errClose.addEventListener('click', closeErrorCard);
  }

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

    /* 关卡分页：基础 / 挑战 */
    document.querySelectorAll('.pager-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        state.page = tab.dataset.page === 'challenge' ? 'challenge' : 'base';
        renderLevels();
      });
    });

    /* 测试场独立入口，不在关卡列表里 */
    const sandboxBtn = document.querySelector('#btn-sandbox');
    if (sandboxBtn) {
      sandboxBtn.addEventListener('click', () => startLevel(SANDBOX_INDEX));
    }

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

    /* 移动端分区标签页 */
    const tabButtons = [...document.querySelectorAll('.panel-tab')];
    tabButtons.forEach((tab) => {
      tab.addEventListener('click', () => setPanel(tab.dataset.panel));
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabButtons.indexOf(tab);
        const next = tabButtons[(i + (e.key === 'ArrowRight' ? 1 : tabButtons.length - 1)) % tabButtons.length];
        e.preventDefault();
        setPanel(next.dataset.panel);
        next.focus();
      });
    });

    if (dom.btnOpenRepo) {
      dom.btnOpenRepo.addEventListener('click', () => {
        window.open(REPO_URL, '_blank', 'noopener');
      });
    }
    if (dom.btnFeedback) dom.btnFeedback.addEventListener('click', openFeedback);
    if (dom.btnFeedbackHome) dom.btnFeedbackHome.addEventListener('click', openFeedback);
    if (dom.fbClose) dom.fbClose.addEventListener('click', closeFeedback);
    if (dom.fbOverlay) {
      dom.fbOverlay.addEventListener('click', (e) => {
        if (e.target === dom.fbOverlay) closeFeedback();
      });
    }

    if (dom.fbSend) dom.fbSend.addEventListener('click', submitFeedback);
    if (dom.fbText) {
      dom.fbText.addEventListener('input', updateFbCount);
      dom.fbText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitFeedback();
      });
      updateFbCount();
    }

    if (dom.btnCopyRepo) {
      dom.btnCopyRepo.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(REPO_URL);
          toast(t('toast.copied'), true);
        } catch (e) {
          /* file:// 或旧浏览器下剪贴板不可用，直接把地址显示出来 */
          toast(REPO_URL);
        }
      });
    }

    dom.lessonClose.addEventListener('click', closeLesson);
    if (dom.lessonCloseX) dom.lessonCloseX.addEventListener('click', closeLesson);
    dom.lesson.addEventListener('click', (e) => {
      if (e.target === dom.lesson) closeLesson();
    });

    /* 点击涟漪：每次只新增一个节点，动画结束立即回收，不驻留内存 */
    const RIPPLE_HOSTS = '.btn, .chip, .mini-btn, .step, .stop, .sol-apply, .fc-del,'
      + '.level-card, .palette-item, .lang-switch, .lesson-close-x';
    document.addEventListener('pointerdown', (e) => {
      const host = e.target.closest(RIPPLE_HOSTS);
      if (!host || host.disabled) return;
      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.9;
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - rect.left - size / 2}px`;
      dot.style.top = `${e.clientY - rect.top - size / 2}px`;
      host.appendChild(dot);
      let dropped = false;
      const drop = () => {
        if (dropped) return;
        dropped = true;
        dot.remove();
      };
      /* 切屏/关面板时元素会被隐藏，动画可能既不发 end 也不发 cancel，加一个兜底 */
      dot.addEventListener('animationend', drop, { once: true });
      dot.addEventListener('animationcancel', drop, { once: true });
      setTimeout(drop, 700);
    }, { passive: true });

    dom.optGrid.addEventListener('change', () => { state.opts.grid = dom.optGrid.checked; });
    dom.optTicks.addEventListener('change', () => { state.opts.ticks = dom.optTicks.checked; });
    dom.optGuides.addEventListener('change', () => { state.opts.guides = dom.optGuides.checked; });
    dom.optTarget.addEventListener('change', () => { state.opts.target = dom.optTarget.checked; });

    /* 背景画布跟着窗口走；图像区交给 ResizeObserver，避免一次缩放算两遍 */
    window.addEventListener('resize', () => {
      resizeBg();
      resizeStartCurve();
    });

    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (state.screen === 'game') computeView();
      }).observe(dom.plotWrap);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.errOverlay && !dom.errOverlay.hidden) { closeErrorCard(); return; }
        if (dom.fbOverlay && !dom.fbOverlay.hidden) { closeFeedback(); return; }
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

  let frameErrors = 0;

  function frame(ts) {
    /* 两帧间隔异常大 = 主线程被卡住过；切后台时 rAF 本来就停，不算 */
    const gap = lastTs ? ts - lastTs : 0;
    if (gap > 3000 && document.visibilityState === 'visible') {
      captureError('freeze', `${t('err.freeze')} · ${Math.round(gap)} ms`, 'requestAnimationFrame gap');
    }

    const dt = clamp((ts - lastTs) / 1000, 0, 0.06);
    lastTs = ts;
    const time = ts / 1000;

    try {
      if (state.screen === 'game') {
        if (!state.paused && !state.won) updateParams(dt);
        renderPlot(time);
        checkWin(dt);
      } else {
        drawBg(time);
        drawStartCurve(time);
      }
    } catch (e) {
      /* 单帧异常不应终止整个动画循环；只打印前几次，避免刷屏 */
      if (frameErrors < 5) {
        frameErrors += 1;
        console.error('[frame]', e && e.message ? e.message : e);
      }
      captureError('frame', e && e.message ? e.message : String(e), e && e.stack);
    }

    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    loadSave();
    loadLang();
    applyI18n();
    document.querySelectorAll('[data-version]').forEach((el) => {
      el.textContent = `V${VERSION}`;
    });
    bindUI();
    bindErrorHandlers();
    setPanel('forms');
    if (dom.startCurve) {
      startCtx = dom.startCurve.getContext('2d');
      resizeStartCurve();
    }
    resizeBg();
    renderStartProgress();
    requestAnimationFrame(frame);
  }

  init();

})();
