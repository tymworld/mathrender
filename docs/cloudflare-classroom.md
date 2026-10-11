# Cloudflare 课堂相册与评价历史

现有部署是 Worker `mathrender`，由 `tymworld/mathrender` 的 GitHub 更新触发构建。此次在同一 Worker 增加 `/api/classroom/*`，其他路径继续走静态资源 `ASSETS`。手机打开网站内的 `labs/algebra/inequality-upload.html`，无需本地服务或相同网络。

## 已上线环境

- 电脑评价页：<https://mathrender.ymtanglab.com/labs/algebra/inequality-review.html>
- R2：`mathrender-classroom-photos`，Standard，已确认 `r2.dev` 公开访问关闭。
- D1：`mathrender-classroom`，APAC；迁移包含 `0001_classroom.sql`、`0002_classroom_credentials.sql`、`0003_review_history.sql`、`0004_photo_rotation.sql` 和 `0005_history_photo_groups.sql`。资源名称和 ID 已固定在 `wrangler.jsonc`，后续发布复用现有数据。
- `CLASSROOM_SECRET` 和 `CLASSROOM_UNIFIED_PROOF` 使用 Worker Secrets。首次输入原来的 AI 使用密码后自动启用统一密码，之后在 AI 设置中修改。旧的随机相册密码不再使用。手机通过电脑二维码进入，无需填写教师密码。
- 后续维护需对当前 Cloudflare 账号登录授权。`wrangler login --device` 可在官方网页输入设备码完成授权，无需把 API Token 发到聊天中。

## 首次上线

1. 在 Cloudflare 账号中启用 R2。保持存储桶为私有，不启用公开访问。
2. 安装本项目开发依赖，执行 `npx wrangler login` 登录拥有 `mathrender` 的账号。根目录配置声明了 `CLASSROOM_PHOTOS`（R2）和 `CLASSROOM_DB`（D1）；首次部署时 Wrangler 可以自动创建资源并把具体名称、ID 写回配置。将写回后的配置提交到仓库，确保后续部署复用已有存储。如果资源由 GitHub 构建自动创建，需要从控制台把对应名称、ID补回配置。
3. 设置至少 32 字符的随机 `CLASSROOM_SECRET`，作为 Worker Secret，不能使用开发值。
4. 在保存原加密配置与 `.env.qwen` 的部署电脑执行 `node scripts/prepare-classroom-unified.mjs`，再执行 `npx wrangler secret bulk .wrangler/private/classroom-unified-secrets.json`。这只上传一次性迁移验证摘要，不上传明文 API Key。摘要对应的 API Key 必须与原加密文件一致。私有目录不进入 Git。
5. 执行 `npx wrangler d1 migrations apply CLASSROOM_DB --remote`。密码表与评价历史表独立于照片表，迁移保留照片和密码。历史、转正、同图分组分别需要 `0003_review_history.sql`、`0004_photo_rotation.sql`、`0005_history_photo_groups.sql`，先应用迁移再发布 Worker。
6. 部署后首次输入原来的 AI 使用密码：浏览器解密旧配置、证明拥有密钥，后台原子创建统一密码配置。此步骤只能成功一次；之后即便持有旧迁移证明也不能重置密码。
7. 解锁后在“AI 设置 → 课堂密码 → 修改课堂密码”自行修改。新密码使用 8–128 个字符，需填写当前密码并重复新密码。照片保留、当前电脑继续解锁，旧电脑凭证与手机链接立即失效；手机重新扫码即可。


云端 GitHub 构建建议设置：

| 设置 | 值 |
| --- | --- |
| Build command | `node scripts/build-cloudflare.mjs` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler versions upload` |
| Root directory | 仓库根目录 |
| Production branch | `main` |

旧的部署命令带有 `--name mathrender --assets ./dist --compatibility-date 2026-10-01`，会与本配置使用相同的 Worker 和目录；建议简化为上表命令。不要把整个仓库当静态目录上传。云端构建使用已提交的 `inequality-review.html`，保留其中已有的加密配置；不应在缺少本地加密文件的 CI 环境重新构建独立 HTML。

如果手工创建资源，配置中应补充 `r2_buckets[0].bucket_name`、`d1_databases[0].database_name` 和 `d1_databases[0].database_id`。普通前端使用相同网站地址，无需填写后台 URL。只有确实需要跨域前端时，才设置 `CLASSROOM_ALLOWED_ORIGINS`，以逗号分隔允许的 HTTPS 来源，不能填通配符。

官方依据：[Worker 资源自动创建](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)、[R2 Worker 绑定](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)、[D1 数据库迁移](https://developers.cloudflare.com/d1/reference/migrations/)。

## 本地验证

Node.js 24 用于测试脚本中的 SQLite。网站前端没有运行时 npm 依赖；Wrangler 是开发工具。

```sh
pnpm install
node scripts/build-inequality-standalone.mjs
node scripts/build-cloudflare.mjs
node scripts/prepare-classroom-test.mjs
npx wrangler d1 migrations apply CLASSROOM_DB --local --config .wrangler/private/unified-test/wrangler.jsonc --persist-to .wrangler/state-unified-test
npx wrangler dev --config .wrangler/private/unified-test/wrangler.jsonc --persist-to .wrangler/state-unified-test --port 8788
```

`.dev.vars`、`.wrangler` 和 `dist` 都不进入 Git。Wrangler 本地模式使用本机模拟的 D1、R2，不会访问生产照片。

```sh
node --test scripts/test-classroom.mjs
node --test --test-concurrency=1 scripts/test-inequality-standalone.mjs scripts/test-inequality-review.mjs
node scripts/check-site.mjs
node scripts/test-math.mjs
```

安装 Playwright 并有 Chrome 后，还可运行 `scripts/test-classroom-browser.mjs`，它只允许访问 localhost/127.0.0.1。指定 `CLASSROOM_TEST_URL=http://127.0.0.1:8788`；测试密码默认 `classroom-local-check`，测试只在浏览器拦截页面替换为虚构的 AI 配置，不改动实际加密文件。`PLAYWRIGHT_MODULE` 可指向已有 Playwright 模块。浏览器测试在独立手机和电脑上下文中跑真实 Worker/D1/R2；AI 接口使用模拟响应，不产生 AI 费用。测试会清除自身上传的照片与评价，并保存实际页面截图到 `docs/qa/classroom-*.png` 和 `docs/qa/history-cloud-*.png`。

`node scripts/test-image-orientation.mjs` 用真实浏览器验证 8 种 EXIF 方向、重复解码不重复旋转及手动旋转还原。`node scripts/test-inequality-layout.mjs` 检查 9 种窗口尺寸的上传、选图、相册、普通和长评价卡布局，并检查标题没有被插画遮挡；两者均不调用 AI。

## 保存与权限

- 相册是本网站的一份共享课堂相册，刷新、关闭页面、Worker 重启和静态更新不会清空。相册最多 1000 张，云端评价最多 2000 条，合计容量 1 GiB。
- 照片最长边缩放到 2560 像素，转为 JPEG；缩略图最长边 360 像素。原始拍摄文件不额外保留。
- 两个 R2 对象写入成功后，D1 才发布照片记录。上传 ID 在重试中保持不变，并验证内容摘要；并发重试不会产生多份可见照片。
- 电脑凭证与手机上传凭证分别签名。前者有效期 12 小时，后者 7 天。相册密码和签名密钥不会发给手机。凭证不存入浏览器持久存储，手机上传凭证位于链接 fragment，不出现在 HTTP URL 或 Referer 中。
- 手机链接允许查看相册和上传，不允许读取评价历史、删除、修改方向或标记评价。所有图片请求使用授权头；R2 没有公开图片地址。
- 相册方向由 D1 `rotation` 保存，读取图片时通过 `X-Photo-Rotation` 响应头交给浏览器转正，R2 中的相册图片不反复重写。只有教师凭证可修改方向；请求包含预期旧值与目标值，并发冲突提示重新选图，同一请求重试保持幂等。历史独立保存已经转正的图像。
- 删除先隐藏 D1 记录，再删除图片与缩略图；保留无图片的删除标记，防止迟到重试恢复照片。每小时清理最多 10 条相册、100 条评价尚未完成的物理删除。评价内容清除后保留最小删除标记，阻止旧浏览器补同步时恢复已删记录。课堂相册、云端评价原图和本机备份独立保留。
- 密码配置在 D1 中保存加盐的 HMAC 校验值（签名密钥只在 Worker Secret 中）、凭证版本和 AES-GCM 加密的 AI 配置，不保存明文密码或 AI Key。PBKDF2 加解密在浏览器中完成。修改密码通过版本条件更新，避免并发修改相互覆盖；所有照片访问都核对最新凭证版本。
- 密码登录和上传有按来源计数的速率限制。图片大小、格式、备注长度、同源访问和总容量在后台检查。
- 在 R2 已写入而 D1 状态无法确认的极端故障下，后台优先保留对象，避免损坏可能已经提交的记录；可能产生少量不可见孤立对象，需运维核对清理。原图与元数据不跨服务强行宣称事务一致。

## 云端历史升级

`/api/classroom/history` 仅教师凭证可用，与相册、AI 共用课堂密码；二维码上传凭证不能读取评价或原图。D1 `classroom_reviews` 保存完整评价内容与元数据，R2 `reviews/` 下独立保存原图，列表按实际评价时间分页。后台只接收规定的评价字段，不接收凭证或 API Key。

新版历史使用 `?grouped=1`：每页 20 个图片组，包含该组所有评价，按组内最新时间排序，组内默认显示最近 3 次。`photo_key` 与不可变的评价 JSON、同步摘要分开保存；原图 SHA-256 用于识别相同照片，前端保留选图时的指纹，使之后手动或自动转正的评价仍归为一组。旧记录每次读取最多整理 12 张原图，页面显示进度并继续读取；缺失原图则以记录 ID 独立保留，不按公式猜测。原有逐条分页接口继续兼容，删除仍只作用于指定评价。

课堂相册列表按 `Asia/Shanghai` 日期筛选：默认今天，往日入口提供日期下拉框并保留“只看待评价”。刷新不改变选中的往日日期；跨午夜自动重新计算今天。切换日期会清除选图，不清除照片。

浏览器先写本机备份，再提交云端；失败时提示手动重试。旧版记录需在原设备、原浏览器和原网址点击“同步本机历史”。同步采用原记录 ID 和内容摘要保证幂等；原图缺失仍可同步文字卡。云端删除不会删除本机备份，本机备份的同步标记和服务器删除标记共同防止误恢复。清空采用打开确认前的记录序号，新生成记录不会被同时清空。

本机同步不会读取其他域名或浏览器的数据。`workers.dev` 与自定义域名连接同一 Worker，因此在旧域名同步后可在正式域名查看。普通本地预览和离线 HTML 仍使用本机历史。

## 维护位置

| 内容 | 文件 |
| --- | --- |
| Worker 入口及小时清理 | `cloudflare/worker.mjs` |
| 鉴权、上传、列表、取图、删除、评价标记 | `cloudflare/classroom-api.mjs` |
| 数据库迁移 | `cloudflare/migrations/0001_classroom.sql`、`0002_classroom_credentials.sql`、`0003_review_history.sql`、`0004_photo_rotation.sql`、`0005_history_photo_groups.sql` |
| EXIF 方向解码与图像旋转 | `assets/js/labs/inequality-images.js` |
| 云端与本机评价历史 | `assets/js/labs/inequality-review-history.js`、`inequality-review-records.mjs`、`inequality-history-groups.mjs` |
| 电脑相册结构与样式 | `assets/html/inequality-classroom-panel.html`、`assets/css/labs/inequality-classroom.css` |
| 电脑相册交互 | `assets/js/labs/inequality-classroom-gallery.js` |
| 手机上传页 | `labs/algebra/inequality-upload.html`、`assets/css/labs/inequality-upload.css`、`assets/js/labs/inequality-upload.js` |
| 双端网络调用 | `assets/js/labs/inequality-classroom-client.js` |
| 本地二维码库 | `assets/js/vendor/qrcodegen.js`（Project Nayuki，MIT，保留许可头） |

二维码由本地脚本生成，不调用第三方二维码服务。库来源：[Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library)。

## 本次验证

2026-10-08：63 项自动化测试、站点链接/脚本检查、数学功能检查及 `wrangler deploy --dry-run` 均通过。在两个独立浏览器会话中，使用真实本地 Worker、D1 和 R2 验证了手机上传、响应丢失后的重试去重、电脑自动收图、选图预览、模拟 AI 评价、已评价筛选、删除、刷新后保留、断网重试和不同屏幕宽度布局。真实页面截图在 `docs/qa/classroom-*.png`。尚未进行实体手机摄像头和生产环境跨网络验收。

2026-10-09 已部署到生产。公网验收使用网站已有的 1.87 MB 插画，验证了上传、同编号重试去重、另一教师会话读取目录、R2 原图字节一致、未授权读取被拒绝、手机不能删除/标记评价、教师可标记与删除。测试图片已清理，未调用千问 API。实体手机摄像头及具体校园网络下的访问仍需在实际课堂设备上确认。


统一密码验证：67 项自动化测试涵盖首次迁移、相册与 AI 共用解锁、确认密码不一致、加密配置更新、旧密码和两类旧凭证失效、照片保留及并发修改。浏览器回归使用独立本地 D1/R2 与测试密钥，避免修改教师的真实密码或产生 AI 费用。修改密码不会重新加密以前单独下载的离线 HTML；离线文件仍使用导出时的密码。主站使用云端最新配置。

GitHub 自动构建在上一版本出现失败，当前发布采用本机 Wrangler。自动构建日志的读取授权尚未具备，应在 Cloudflare 控制台核查构建命令与错误；不能以本机部署成功推断自动构建已经恢复。

2026-10-09 统一密码已在正式域名部署并完成首次启用（只查询初始化状态，不读取密码）；页面与访问控制已检查。相册选图栏新增直接的“删除作品”入口，保留原图预览、保留照片和确认删除步骤。

2026-10-11：72 项自动化检查通过，并用两个独立浏览器、不同本地站点地址验证云端评价及原图共享、旧记录同步去重、断网后补同步、删除不复活和手机布局。两个 AI 阶段均验证默认发送 `qwen3.8-max`；此次使用模拟 AI 响应，没有产生 AI 调用费用。

2026-10-11 云端历史已上线，版本 `a676788e-11b5-409b-a0b8-cf79d49758f0`。生产库已应用 `0003_review_history.sql`；正式域名与 workers.dev 的 HTML 均与本机产物一致，历史接口匿名访问返回 401。生产核查未读取或修改教师的历史记录。

2026-10-11 紧凑响应式布局已发布，版本 `e1f9aec9-a290-4272-9382-b039a38e5a6c`。顶部留白收紧；电脑端相册列表独立滚动，生成操作保持可见；评价卡默认一屏显示，可切换放大阅读。8 种窗口尺寸的浏览器布局检查及 56 项前端、评价回归通过；本次不修改后台数据结构。

2026-10-11 课堂投屏与照片方向更新已发布，版本 `68a4f1a8-76a0-40e8-a73c-c7fff939a744`。上传页标志和主要文字放大，删除发送提示；评价卡模型说明居中，标题与插画分别占位，“严谨性”统一显示为“完备性”。生产库已应用 `0004_photo_rotation.sql`，保留原有记录和密码。74 项自动化检查、9 种窗口布局检查、8 种 EXIF 方向检查及本地真实后台浏览器回归通过；验证了手动旋转、模拟 AI 转正、相册同步和删除相册后仍可跨浏览器查看已转正的历史原图。正式域名发布的 HTML 与通过测试的本机产物一致；没有调用真实 AI 或修改教师的作品与密码。

2026-10-11 历史同图分组与课堂照片按日期筛选已发布，版本 `03180258-6d4b-4742-9478-040925dc4f96`。生产库应用 `0005_history_photo_groups.sql`。78 项自动化检查、9 种窗口布局及两套本地浏览器回归通过；新增检查覆盖模型标签、展开较早评价、独立查看和删除、旧本机记录归组、不同照片不因公式相同而合并、缺失原图记录保留、完整图片组分页，以及北京时间午夜边界、往日日期筛选、只看待评价和切换日期后清除选图。运行 `CLASSROOM_TEST_URL=http://127.0.0.1:8788 node scripts/test-history-gallery-browser.mjs` 可复查新交互；截图为 `docs/qa/history-grouped-*.png`、`classroom-today-desktop.png`、`classroom-past-mobile.png`。测试不调用真实 AI。
