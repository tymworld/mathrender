# MathRender · 高中数学教学实验室

面向课堂投屏与学生探究的网站。20 个课堂活动按四个主题组织，无运行时构建依赖、无外部字体或图表 CDN，可直接打开 `index.html`。

## 不等式 AI 评价卡

入口：**首页 → 不等式与推理 → 不等式 AI 评价卡**。也可以搜索“评价”“手写”或“千问”。标准文件路径为 `labs/algebra/inequality-review.html`，与其他活动的命名和分类方式一致。

1. 打开评价卡直接进入上传界面，不自动打开 AI 设置。默认使用千问北京地域与 `qwen3.5-plus`。网站已配置密钥文件时，首次生成只需输入使用密码；也可在“AI 设置”中临时填写 API Key。
2. 上传手写作品照片，点击“上传并生成评价卡”。请拍全不等式、推导证明、等号成立条件及理由。
3. 查看科学性、严谨性、创新性三个维度的 A/B/C/D 等级、评价依据、亮点及改进建议。
4. 点击“上传下一份”可连续评价；点击“返回目录”回到 MathRender。

页面通过 HTTPS 直接调用千问北京接口，默认模型为 `qwen3.5-plus`，无需评价后台服务，需要联网，按百炼实际用量计费。明文 API Key 只保留在页面内存中，不写入 HTML、浏览器存储或 Cookie；刷新、关闭或离开页面后清除。有网站密钥文件时重新输入密码即可使用。右上角“AI 设置”和评价卡底部“AI 设置”均可打开设置页。粘贴时自动清理空白、零宽字符及常见包装，由千问接口判断密钥是否有效。

页面已内嵌样式、脚本、量表和两张插画，单独复制 `labs/algebra/inequality-review.html` 也可使用（返回目录链接需要网站目录）。根目录旧中文文件名保留为轻量跳转页，原有收藏仍能打开新位置。

评价量表沿用《活动2记录单与评价量表》：A（优秀）、B（良好）、C（合格）、D（须努力）。不显示数字评分或总分。科学性关注结论是否成立，严谨性关注论证是否完整，创新性关注改写、变式及推广；AI 补写的证明不计入学生提交的证明。结论与取等条件正确但未展示推导，按严谨性 C 的“推导有明显缺漏”解释；无效论证、把数值检验当一般证明、取等条件错误或完全缺失按 D。图片不清或缺少决定性条件时不给出虚构等级，显示需要补充的材料。

每次生成分两次调用：先以独立识别规则转写图片中的主不等式、原文条件和实际展示的推导，再将转写原文交给所选评价 Prompt。第一步不含量表或校准例，不纠错、不补写、不压缩原式；第二步仅接收转写文字。页面“上传的不等式”由程序固定为第一步的原文，保留必要换行，评价无法覆盖它；数学纠正只出现在评价与建议中。无法辨认关键符号时停止评价，指出需要拍清楚的位置。

默认评价 Prompt 分别核验主结论、取等条件和反例，再按原始量表给等级。反例必须给全自由变量，分别计算绝对值各项与两边，再确认是否真的反驳原命题。2026-10-02 更新加入错误反例校准：`a=1.5` 时 `|a−1|+|a−2|=1`、`|2a−3|=0`，与 `(a−1)(a−2)<0` 不取等一致。不能混算绝对值，也不能将符合取等条件的数值结果误称为反例。校准例只指导判断，不作为学生作品。评价卡侧边短句保持概括，不再仅凭 C 等级声称取等情形遗漏。

上传页保留浅蓝背景、校服人物与建平苹果雕塑。评价卡采用蓝色背景、淡彩分区，统一中文黑体，减少标题粗重感，等级使用衬线字母。桌面正文目标 22–24px、下限 18px；手机目标 18px、下限 16px。根据文字量先收起装饰再适配字号，长内容在可读下限仍放不下时允许滚动。

### AI 设置

设置页内嵌在同一个 HTML 中，关闭时保留已上传的照片和评价结果。可设置：

- 模型下拉选择、完整 HTTPS `/chat/completions` 地址及 API Key。
- Prompt 版本下拉选择：V2 数学核验加强版（推荐）、V1 量表基础版（修订）。两个版本均内含完整的 12 条量表标准，并使用同一套判级口径；V2 额外提供取等集合、反例计算和适用范围的核验说明及校准例。切换时同步显示说明及完整正文；正文只读，不能直接编辑。
- 更多生成设置：随机性（0–2）与输出上限（512–8192 tokens）。

模型选项于 2026-10-02 根据千问官方[视觉理解模型](https://help.aliyun.com/zh/model-studio/vision-model)、[视觉推理接口](https://help.aliyun.com/zh/model-studio/visual-reasoning)和[北京地域模型列表](https://help.aliyun.com/zh/model-studio/model-pricing)核对，收录支持图片输入、JSON 输出和非思考模式的 10 个稳定模型 ID：Qwen 3.8 Max/Flash、3.7 Plus/Flash、3.6 Plus/Flash、3.5 Plus/Flash、3-VL Plus/Flash。默认仍为 `qwen3.5-plus`；不提供自由输入，也不列出仅文本、仅 OCR、仅思考和预览模型。选项来自公开文档，并非当前账号的授权清单；实际调用还取决于账号权限、额度以及服务是否允许浏览器跨域调用。原先保存的模型不在列表中时恢复默认模型，保留其他有效设置。

“查看识别与输出规则”只读展开项显示独立识别规则和评价卡格式要求。识别请求包含固定识别规则及作品图片；评价请求包含选中版本的 Prompt、自动附加的格式要求和转写原文。请求始终按版本目录取正文，不读取预览文本框的值。所选模型用于两个阶段；随机性与输出上限设置用于评价阶段，识别阶段使用随机性 0、输出上限 4096 tokens。

点击“保存并返回”后，模型、地址、Prompt 版本 ID 与生成参数保存在当前浏览器，供下次打开使用；解锁后的明文 API Key 始终只保留在当前页面内存中。关闭设置不会保存未提交的版本切换。更换 API 服务域名时需填写新服务的密钥，不会直接转发旧密钥。浏览器禁用本地存储时，本次页面仍可使用设置。

首次迁移旧设置时，原内置 Prompt（包括归档原文）选择当前推荐版本；用户曾经手动修改的内容保留为本浏览器的“历史自定义（只读）”选项，仍可选择，但不能编辑。迁移后按用户保存的版本 ID 恢复，不随推荐版本变化自动切换。已不可用的版本回退到推荐版并提示，模型、地址及生成参数保留。

2026-10-02 应教师要求修订两个内置版本：去掉外部文件名称依赖及重复看图指令；统一“正确结论及取等条件但缺推导”的 C 级口径；按实际范围比较取等条件，区分抽样验证与有限情形穷举；取消将全部代数式代换限定为 C 的附加门槛。原有 12 条量表标准逐字保留。版本 ID 保持不变，刷新后所选内置版本即使用修订正文；旧正文只归档用于迁移和回归核对，不作为内置下拉选项继续发送。

本次另用 `qwen3.5-plus` 实测正确/错误取等条件、受限定义域、有限集穷举、不能取等及三项推广。实测促成了反例范围、绝对值计算及“先评语后等级”的补充；同时明确三维结果必须是嵌套对象，避免模型另造等级字段。最终针对“正确条件但无推导”和“已证明不能取等”在两个版本各复测一次，主结论及严谨性均符合预期（4/4）。这不代表全部作品都能稳定判级；实测仍观察到创新性 B/C 的差异，保留教师复核。

### 密码解锁（双击 HTML 或网站访问均可）

构建时从同目录的 `inequality-ai-key.json` 读取加密配置，并把加密副本内嵌到 `labs/algebra/inequality-review.html` 中。直接双击 HTML 和网站访问都能自动读取，无需后台、上传文件或重新填写 Key。优先使用内嵌副本；未内嵌配置的旧版网站页面仍可读取同目录文件。打开页面不弹窗；首次点击生成时弹出简洁的密码框，解锁成功后继续本次评价。刷新后需要重新解锁，密码不保存。模型、Prompt 等设置仍可单独选择。

在项目根目录运行以下脚本可创建文件或更换密码（Node.js 22+）：

```sh
node scripts/configure-inequality-key.mjs
```

脚本读取已有 `.env.qwen` 中的百炼 Key；没有 Key 时在终端提示输入。随后输入并确认密码，输入均不回显。脚本保存加密文件后自动重新生成 HTML；更换密码或 Key 后，请重新分发生成的 HTML。文件仅包含加密密钥及调用地址等元数据；文件由 PBKDF2-SHA256（600,000 次）派生密码密钥，使用 AES-256-GCM 加密，地址也经过认证。参考 [Web Crypto 密钥派生](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) 与 [AES-GCM 参数](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)。

部署或分发时复制生成后的 HTML 即可，加密副本已包含其中。单独的 JSON 文件已加入 Git 忽略列表；在其他机器重新构建时需提供它，否则生成不带内嵌密钥的页面。不要部署 `.env.qwen`。支持 HTTPS 网站、localhost 和现代浏览器的本地 `file://` 页面，仍需联网调用千问。

密码保护的是文件中的密钥。纯前端页面解锁后需要使用明文 Key 调用千问，因此持有密码的人仍能在浏览器中查看它；若需要对使用者完全隐藏 Key，需改用后台转发。

### 维护与验证

- 页面结构源文件：`assets/html/inequality-review-template.html`。
- 样式与交互：`assets/css/labs/inequality-review*.css`、`assets/js/labs/inequality-review*.js`。
- Prompt 版本目录：`assets/js/labs/inequality-review-prompts.mjs`。各版本由共同量表、判级口径和相应核验规则组装，预览及请求发送完整正文。以后新增版本，在 `PROMPT_VERSIONS` 中增加唯一的 `id`、`title`、`date`、`description`、`prompt`，按需更新 `DEFAULT_PROMPT_VERSION` 后重新构建。修改现有版本须归档旧正文并记录修订日期；较大规则变化优先新增版本 ID。
- 返回值校验及默认 Prompt 导出：`assets/js/labs/inequality-review-protocol.mjs`，浏览器与可选后端共用。旧 Prompt 快照另存于 `inequality-review-prompt-history.json`，用于量表回归测试。
- 模型选项与说明：`assets/js/labs/inequality-review-models.mjs`，构建时同时生成下拉列表和调用校验规则。
- 插画：`assets/images/inequality-review/`，生成记录见 `docs/inequality-jianping-art.md`。

修改源文件后重新生成站点页面（不要手工修改生成后的 HTML）：

```sh
node scripts/build-inequality-standalone.mjs
node scripts/test-inequality-standalone.mjs
node --test scripts/test-inequality-review.mjs
```

构建过程读取界面、插画和经验证的加密配置，不读取 `.env.qwen`、明文 Key 或密码。测试使用模拟响应，不调用付费 API，覆盖密钥清理、加密文件认证、自动读取、解锁取消与重试、请求内容、异常返回、上传到评价卡流程及布局适配。

## 本地预览

双击 `启动评价卡.command`，或在项目根目录运行（Node.js 22 或更新版本，无需安装 npm 包）：

```sh
node server/inequality-review.mjs
```

浏览器打开 `http://127.0.0.1:8767/index.html`。服务仅绑定本机，用于网站预览。评价卡读取网站加密密钥文件（或临时填写 Key），仍在浏览器内直接调用千问，不依赖该服务的评价接口。

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
