# Business Radar 本地原型

基于 DeepPoint 开发。当前原型新增 `/zh/evidence` 需求证据库，支持手动录入原文、原帖链接和评论 ID，并记录核实、联系状态。新版抖音采集到的评论会在 AI 聚类前写入证据库；模型离线时仍可查看已保存的证据。

## 本地运行

依照上游 README 安装 Node.js、Python 与采集依赖，执行 `npm ci` 后运行 `npm run dev`，打开 `http://localhost:3000/zh/evidence`。手动录入证据不需要 Python、浏览器或模型。数据默认保存在 `.business-radar/evidence.json`，可用 `BUSINESS_RADAR_DATA_DIR` 指定独立数据目录；该目录已加入 `.gitignore`。

## 当前边界

- 保存的是原帖链接与评论 ID；尚未验证抖音是否提供稳定的评论直达链接，因此界面只显示“打开原帖”。
- 开发模式未配置凭据时仅供本机使用；生产模式要求登录。公网部署前还需 HTTPS、访问控制和数据备份。
- 生产模式现在要求配置 `BUSINESS_RADAR_USERNAME` 与 `BUSINESS_RADAR_PASSWORD`，否则返回 503；浏览器使用 HTTP Basic 登录。务必在 HTTPS 反向代理后访问，且不要把密码提交到 Git。
- 现有分析流程仍在服务器进程内运行，模型不可用时分析任务可能失败，但已保存的证据保留。后续需拆出可重试的离线任务队列。
- `lib/crawlers/douyin_new/` 仍受 MediaCrawler 的非商业学习许可证约束。商业使用需取得授权或完整替换该部分。
