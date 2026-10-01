/* 单一实验目录：供首页、实验导航和结构检查共同使用。 */
(() => {
  'use strict';
  const categories = [
    { id: 'sequences', name: '数列与极限', caption: '从有限走向无限', color: 'green', symbol: '∑' },
    { id: 'probability', name: '概率与组合', caption: '在随机中发现规律', color: 'blue', symbol: 'P' },
    { id: 'statistics', name: '统计与分布', caption: '让数据讲述规律', color: 'orange', symbol: 'μ' },
    { id: 'algebra', name: '不等式与推理', caption: '用图像理解代数', color: 'rose', symbol: '≤' }
  ];
  const labs = [
    ['geometric-limits','sequences','等比数列的极限','改变公比，比较数列项与前 n 项和的收敛、振荡和发散。','参数探索','等比数列 公比 前n项和 收敛 极限','geometric-limit-lab','curve'],
    ['area-halving','sequences','正方形不断取半','横竖交替切分单位正方形，观察面积和如何趋近 1。','分步动画','面积模型 等比数列 无穷级数','square-halving-animation','square'],
    ['segment-halving','sequences','线段不断取半','每次取剩余长度的一半，理解无限过程与有限的和。','分步动画','长度模型 等比数列 极限','stick-halving-animation','segment'],
    ['fibonacci-puzzle','sequences','斐波那契正方形拼图','拖动不同大小的正方形，拼出长方形，发现递推结构。','拖拽拼图','递推 斐波那契 Fibonacci 黄金比例','fibonacci-square-puzzle','fibonacci'],
    ['fibonacci-spiral','sequences','斐波那契螺旋生长','逐块添加正方形与圆弧，观察几何结构和相邻项比值。','分步动画','递推 Fibonacci 黄金比例 圆弧','fibonacci-spiral-animation','spiral'],
    ['iteration','sequences','迭代序列与蛛网图','从求 √2 的近似值出发，用轨迹和误差比较迭代方法。','参数探索','巴比伦法 牛顿法 迭代 收敛 sqrt','iteration-sequence-lab','web'],
    ['hanoi','sequences','汉诺塔与递归','动手移动圆盘，探索递归策略与最少步数 2ⁿ−1。','交互挑战','汉诺塔 Hanoi 递归 递推 最优策略','hanoi-tower','hanoi'],
    ['ball-draw','probability','抽球实验室','切换放回与不放回抽样，逐次记录结果并枚举可能情况。','随机实验','抽球 放回 抽样 枚举 计数原理','ball-lab','balls'],
    ['passing','probability','传球概率模型','从甲开始传球，比较手动路径、随机试验与理论概率。','随机实验','状态转移 递推概率 传球','pass-probability','passing'],
    ['pascal-triangle','probability','杨辉三角与二项式','逐行构建杨辉三角，连接组合数、递推关系与二项式展开。','规律探索','杨辉三角 Pascal 组合数 二项式定理','pascal-lab','pascal'],
    ['ball-distribution','probability','二项分布与超几何分布','在同一组参数下比较放回与不放回抽样的概率分布。','分布对比','二项分布 超几何分布 概率公式 有限总体','distribution-lab','bars'],
    ['sampling-comparison','probability','放回与不放回对照实验','并排演示两种抽样过程，将试验频率与理论概率对照。','随机实验','二项分布 超几何分布 频率 放回 不放回','distribution-comparison','bars'],
    ['normal-sampling','statistics','正态分布随机实验','从正态总体抽样，观察样本量、分组数与直方图的关系。','随机实验','正态分布 均值 方差 大数定律 频率密度','normal-distribution-lab','normal'],
    ['exam-scores','statistics','考试成绩与正态模型','模拟多个班的成绩，讨论样本波动与正态模型的适用范围。','情境模拟','考试 成绩 正态分布 标准差','exam-normal-lab','normal'],
    ['score-histogram','statistics','班级成绩直方图','固定成绩库，改变班级数、每班人数和组距，比较分布形态。','数据探索','班级 成绩 统计 直方图 样本 频率密度','class-score-histogram-lab','histogram'],
    ['measurement-errors','statistics','测量误差直方图','围绕零点观察误差，比较样本均值、理论中心与拟合曲线。','数据探索','测量误差 标准差 直方图 统计','measurement-error-histogram-lab','histogram'],
    ['galton-board','statistics','高尔顿板','看小球随机向左或向右，探索二项分布与钟形轮廓。','动态模拟','高尔顿板 Galton 二项分布 正态近似','galton-board-lab','galton'],
    ['normal-function','statistics','正态函数与参数','调节均值、标准差和振幅，比较曲线位置、宽度与面积。','参数探索','正态函数 密度函数 mu sigma 振幅','normal-function-lab','normal'],
    ['triangle-inequality','algebra','三角不等式探究','拖动两个实数，用数轴与符号分区探索不等式及取等条件。','数形结合','三角不等式 绝对值 分类讨论 取等条件','triangle-inequality-lab','inequality'],
    ['inequality-review','algebra','不等式 AI 评价卡','上传手写作品，获取科学性、严谨性、创新性等级与改进建议。','AI 辅助评价 · 需联网','李老师 开心课堂 手写 拍照 上传 评价 千问 ABCD 科学性 严谨性 创新性','李老师开心课堂-不等式评价卡-独立版','review']
  ].map(([id, category, title, description, type, keywords, legacy, graphic]) => ({
    id, category, title, description, type, keywords, legacy, graphic,
    path: `labs/${category}/${id}.html`
  }));
  const themeKey = 'mathrender-theme';
  const storage = {
    getItem(key) { try { return localStorage.getItem(/theme/i.test(key) ? themeKey : key); } catch (_) { return null; } },
    setItem(key, value) { try { localStorage.setItem(/theme/i.test(key) ? themeKey : key, value); } catch (_) {} }
  };
  function contrastText(hex) {
    const channels = hex.replace('#', '').match(/.{2}/g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    return luminance > .179 ? '#000' : '#fff';
  }
  window.MathRender = { categories, labs, storage, contrastText };
})();
