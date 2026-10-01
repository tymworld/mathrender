# MathRender · 高中数学教学实验室

面向课堂投屏与学生探究的网站。20 个课堂活动按四个主题组织，无运行时构建依赖、无外部字体或图表 CDN，可直接打开 `index.html`。

## 不等式 AI 评价卡

入口：**首页 → 不等式与推理 → 不等式 AI 评价卡**。也可以搜索“评价”“手写”或“千问”。标准文件路径为 `labs/algebra/inequality-review.html`，与其他活动的命名和分类方式一致。

1. 打开评价卡，填写华北2（北京）的百炼 API Key，点击“开始使用”。
2. 上传手写作品照片，点击“上传并生成评价卡”。请拍全不等式、推导证明、等号成立条件及理由。
3. 查看科学性、严谨性、创新性三个维度的 A/B/C/D 等级、评价依据、亮点及改进建议。
4. 点击“上传下一份”可连续评价；点击“返回目录”回到 MathRender。

页面通过 HTTPS 直接调用千问北京接口，模型为 `qwen3.5-plus`，无需评价后台服务，需要联网，按百炼实际用量计费。API Key 只保留在页面内存中，不写入 HTML、浏览器存储或 Cookie；刷新、关闭或离开页面后重新填写。右上角可更换或清除密钥。粘贴时自动清理空白、零宽字符及常见包装，由千问接口判断密钥是否有效。

页面已内嵌样式、脚本、量表和两张插画，单独复制 `labs/algebra/inequality-review.html` 也可使用（返回目录链接需要网站目录）。根目录旧中文文件名保留为轻量跳转页，原有收藏仍能打开新位置。

评价量表沿用《活动2记录单与评价量表》：A（优秀）、B（良好）、C（合格）、D（须努力）。不显示数字评分或总分。科学性关注结论是否成立，严谨性关注论证是否完整，创新性关注改写、变式及推广；缺少有效推导或取等条件时不由 AI 补写证明后提升等级。图片不清或缺少决定性条件时不给出虚构等级，显示需要补充的材料。

上传页保留浅蓝背景、校服人物与建平苹果雕塑。评价卡采用蓝色背景、淡彩分区，统一中文黑体，减少标题粗重感，等级使用衬线字母。桌面正文目标 22–24px、下限 18px；手机目标 18px、下限 16px。根据文字量先收起装饰再适配字号，长内容在可读下限仍放不下时允许滚动。

### 维护与验证

- 页面结构源文件：`assets/html/inequality-review-template.html`。
- 样式与交互：`assets/css/labs/inequality-review*.css`、`assets/js/labs/inequality-review*.js`。
- 完整量表与返回值校验：`assets/js/labs/inequality-review-protocol.mjs`，浏览器与可选后端共用。
- 插画：`assets/images/inequality-review/`，生成记录见 `docs/inequality-jianping-art.md`。

修改源文件后重新生成站点页面（不要手工修改生成后的 HTML）：

```sh
node scripts/build-inequality-standalone.mjs
node scripts/test-inequality-standalone.mjs
node --test scripts/test-inequality-review.mjs
```

构建过程只读取公开界面与插画资源，不读取 `.env.qwen`。测试使用模拟响应，不调用付费 API，覆盖密钥清理、请求内容、异常返回、上传到评价卡流程及布局适配。

## 本地预览

双击 `启动评价卡.command`，或在项目根目录运行（Node.js 22 或更新版本，无需安装 npm 包）：

```sh
node server/inequality-review.mjs
```

浏览器打开 `http://127.0.0.1:8767/index.html`。服务仅绑定本机，用于网站预览。评价卡仍在浏览器内填写 Key、直接调用千问，不依赖该服务的评价接口。

`server/inequality-review.mjs` 另保留可选后端 `/api/status`、`/api/evaluate`，兼容已有开发调用；后端配置可参考 `.env.qwen.example`。当前站点页面默认不走这两个接口。配置文件只保存在本地，不要提交或上传到静态站点；专用预览服务不公开 `.env.qwen` 和后端源码。

官方参考：[API Key](https://help.aliyun.com/zh/model-studio/get-api-key)、[调用地址](https://help.aliyun.com/zh/model-studio/base-url)。

## 目录结构

```text
index.html                     首页与实验分类目录
labs/
  sequences/                   数列、极限、迭代与递归（7）
  probability/                 概率、组合与抽样（5）
  statistics/                  统计、直方图与分布（6）
  algebra/                     不等式与代数推理（2）
assets/
  css/
    home.css                   首页样式
    classroom.css              课堂界面、主题、字号与响应式规则
    labs/                      各实验特有样式
  js/
    catalog.js                 实验名称、分类、路径、教学描述及公共工具
    home.js                    首页筛选、搜索和展示工具
    classroom.js               实验导航、目录、大字、聚焦与全屏
    labs/                      各实验的计算、绘图及交互逻辑
scripts/
  check-site.mjs               文件引用、目录覆盖、重复 ID 与语法检查
  test-math.mjs                数学与统计逻辑回归检查
docs/
  site-review.md               审查、修复及验证记录
  qa/                         浏览器检查结果与截图
archive/
  before-redesign-2026-09-30.zip  本次重构前的完整活动文件快照
  2026-07-26/                  原有历史备份
  legacy-pages/                被合并的四份旧实验及旧公共样式/脚本
  macos-metadata/              原根目录的 macOS 元数据文件
*.html（旧名称）                24 个兼容跳转入口，不再包含实验业务代码
```

活动实验文件统一使用英文小写和连字符。例如 `labs/sequences/geometric-limits.html` 对应 `assets/css/labs/geometric-limits.css` 与 `assets/js/labs/geometric-limits.js`。根目录旧地址用于保持已有课件和收藏链接有效，修改实验时请编辑 `labs/` 和 `assets/` 中的文件。

## 课堂使用

- 首页按主题筛选，也可搜索实验名称或知识点。
- 默认实验正文与控件为 20 px；「大字」切换为 24 px，主题与字号在页面间保持。
- 「聚焦」突出图像，并通过底部工具栏保留演示操作。按 `Esc` 或点击「退出聚焦」返回。
- 「全屏」调用浏览器全屏；桌面浏览器也可使用自身的全屏快捷键。
- 单步观察、参数比较与教师揭示适用于“观察—操作—猜想—证明”的课堂过程。
- 统计模拟注明生成模型；改变分组只重绘同一批数据，重新运行才重新生成样本。

## 检查与维护

安装了 Node.js 时运行：

```sh
node scripts/check-site.mjs
node scripts/test-math.mjs
```

修改公共界面主要编辑 `classroom.css` 与 `classroom.js`。修改实验目录时更新 `catalog.js` 和首页静态卡片；`check-site.mjs` 会检查首页是否覆盖全部目录条目。

部署时上传 `index.html`、`labs/`、`assets/`，以及需要保留的根目录旧地址跳转文件。`archive/`、`docs/`、`scripts/` 是维护资料，不参与网站运行。
