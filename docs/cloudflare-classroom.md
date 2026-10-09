# Cloudflare 课堂相册

现有部署是 Worker `mathrender`，由 `tymworld/mathrender` 的 GitHub 更新触发构建。此次在同一 Worker 增加 `/api/classroom/*`，其他路径继续走静态资源 `ASSETS`。手机打开网站内的 `labs/algebra/inequality-upload.html`，无需本地服务或相同网络。

## 已上线环境

- 电脑评价页：<https://mathrender.ymtanglab.com/labs/algebra/inequality-review.html>
- R2：`mathrender-classroom-photos`，Standard，已确认 `r2.dev` 公开访问关闭。
- D1：`mathrender-classroom`，APAC；已执行 `0001_classroom.sql` 和 `0002_classroom_credentials.sql`。资源名称和 ID 已固定在 `wrangler.jsonc`，后续发布复用现有数据。
- `CLASSROOM_SECRET` 和 `CLASSROOM_UNIFIED_PROOF` 使用 Worker Secrets。首次输入原来的 AI 使用密码后自动启用统一密码，之后在 AI 设置中修改。旧的随机相册密码不再使用。手机通过电脑二维码进入，无需填写教师密码。
- 后续维护需对当前 Cloudflare 账号登录授权。`wrangler login --device` 可在官方网页输入设备码完成授权，无需把 API Token 发到聊天中。

## 首次上线

1. 在 Cloudflare 账号中启用 R2。保持存储桶为私有，不启用公开访问。
2. 安装本项目开发依赖，执行 `npx wrangler login` 登录拥有 `mathrender` 的账号。根目录配置声明了 `CLASSROOM_PHOTOS`（R2）和 `CLASSROOM_DB`（D1）；首次部署时 Wrangler 可以自动创建资源并把具体名称、ID 写回配置。将写回后的配置提交到仓库，确保后续部署复用已有存储。如果资源由 GitHub 构建自动创建，需要从控制台把对应名称、ID补回配置。
3. 设置至少 32 字符的随机 `CLASSROOM_SECRET`，作为 Worker Secret，不能使用开发值。
4. 在保存原加密配置与 `.env.qwen` 的部署电脑执行 `node scripts/prepare-classroom-unified.mjs`，再执行 `npx wrangler secret bulk .wrangler/private/classroom-unified-secrets.json`。这只上传一次性迁移验证摘要，不上传明文 API Key。摘要对应的 API Key 必须与原加密文件一致。私有目录不进入 Git。
5. 执行 `npx wrangler d1 migrations apply CLASSROOM_DB --remote`。密码表独立于照片表，迁移保留照片。
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

安装 Playwright 并有 Chrome 后，还可运行 `scripts/test-classroom-browser.mjs`，它只允许访问 localhost/127.0.0.1。指定 `CLASSROOM_TEST_URL=http://127.0.0.1:8788`；测试密码默认 `classroom-local-check`，测试只在浏览器拦截页面替换为虚构的 AI 配置，不改动实际加密文件。`PLAYWRIGHT_MODULE` 可指向已有 Playwright 模块。浏览器测试在独立手机和电脑上下文中跑真实 Worker/D1/R2；AI 接口使用模拟响应，不产生 AI 费用。测试会清除自身上传的照片，并保存实际页面截图到 `docs/qa/classroom-*.png`。

## 保存与权限

- 相册是本网站的一份共享课堂相册，刷新、关闭页面、Worker 重启和静态更新不会清空。默认最多 1000 张、总计 1 GiB。
- 照片最长边缩放到 2560 像素，转为 JPEG；缩略图最长边 360 像素。原始拍摄文件不额外保留。
- 两个 R2 对象写入成功后，D1 才发布照片记录。上传 ID 在重试中保持不变，并验证内容摘要；并发重试不会产生多份可见照片。
- 电脑凭证与手机上传凭证分别签名。前者有效期 12 小时，后者 7 天。相册密码和签名密钥不会发给手机。凭证不存入浏览器持久存储，手机上传凭证位于链接 fragment，不出现在 HTTP URL 或 Referer 中。
- 手机链接允许查看相册和上传，不允许删除或标记评价。所有图片请求使用授权头；R2 没有公开图片地址。
- 删除先隐藏 D1 记录，再删除图片与缩略图；保留无图片的删除标记，防止迟到重试恢复照片。每小时清理最多 10 条尚未完成物理删除的记录。电脑本地评价历史独立保留。
- 密码配置在 D1 中保存加盐的 HMAC 校验值（签名密钥只在 Worker Secret 中）、凭证版本和 AES-GCM 加密的 AI 配置，不保存明文密码或 AI Key。PBKDF2 加解密在浏览器中完成。修改密码通过版本条件更新，避免并发修改相互覆盖；所有照片访问都核对最新凭证版本。
- 密码登录和上传有按来源计数的速率限制。图片大小、格式、备注长度、同源访问和总容量在后台检查。
- 在 R2 已写入而 D1 状态无法确认的极端故障下，后台优先保留对象，避免损坏可能已经提交的记录；可能产生少量不可见孤立对象，需运维核对清理。原图与元数据不跨服务强行宣称事务一致。

## 维护位置

| 内容 | 文件 |
| --- | --- |
| Worker 入口及小时清理 | `cloudflare/worker.mjs` |
| 鉴权、上传、列表、取图、删除、评价标记 | `cloudflare/classroom-api.mjs` |
| 数据库初始化 | `cloudflare/migrations/0001_classroom.sql`、`0002_classroom_credentials.sql` |
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
