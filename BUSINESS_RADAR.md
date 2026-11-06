# Business Radar 本地原型

基于 DeepPoint 开发。当前原型新增 `/zh/evidence` 需求证据库，支持手动录入原文、原帖链接和评论 ID，并记录核实、联系状态。新版抖音采集到的评论会在 AI 聚类前写入证据库；模型离线时仍可查看已保存的证据。`/zh/capture` 提供“只采集、稍后分析”的任务入口，模型启动后可手动分析已采集数据。服务重启后，已保存采集数据的中断任务会回到待分析状态。

证据库可按原文、备注、状态搜索筛选，并用本地关键词规则标出“重复劳动”“明确求工具”等需求信号。规则只提供浏览提示，不代表需求已验证；未命中的评论仍会保留。

## 本地运行

依照上游 README 安装 Node.js、Python 与采集依赖，执行 `npm ci` 后运行 `npm run dev`，打开 `http://localhost:3000/zh/evidence`。采集功能建议先在项目目录运行 `python -m venv .venv`，然后在 Windows 上执行 `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`；应用会优先使用该项目虚拟环境。手动录入证据不需要 Python、浏览器或模型。数据默认保存在 `.business-radar/evidence.json`，可用 `BUSINESS_RADAR_DATA_DIR` 指定独立数据目录；该目录已加入 `.gitignore`。

## LM Studio 按需分析

在 LM Studio 中加载一个聊天模型和一个 embedding 模型，启动本地 API 服务。打开 `http://localhost:1234/v1/models` 查看服务实际返回的模型 ID。然后在项目根目录新建 `.env.local`（不要提交到 Git）：

```env
AI_PROVIDER=lmstudio
EMBEDDING_PROVIDER=lmstudio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=这里填聊天模型ID
LM_STUDIO_EMBEDDING_MODEL=这里填embedding模型ID
```

重启网页开发服务，再到 `/zh/capture` 查看 AI 状态。只有服务可连接且两个配置的模型 ID 都出现在模型列表中时，页面才允许启动分析。此检查不保证模型实际能完成请求；分析失败时已采集数据仍会保留。

## 当前边界

- 保存的是原帖链接与评论 ID；尚未验证抖音是否提供稳定的评论直达链接，因此界面只显示“打开原帖”。
- 开发模式未配置凭据时仅供本机使用；生产模式要求登录。公网部署前还需 HTTPS、访问控制和数据备份。
- 生产模式现在要求配置 `BUSINESS_RADAR_USERNAME` 与 `BUSINESS_RADAR_PASSWORD`，否则返回 503；浏览器使用 HTTP Basic 登录。务必在 HTTPS 反向代理后访问，且不要把密码提交到 Git。
- 采集与分析可以分步运行，待分析任务和证据均保存在本机；执行任务的队列仍在网页进程内。此版本尚未实现腾讯云与家用电脑之间的任务同步，也没有自动检测家中模型上线。
- `lib/crawlers/douyin_new/` 仍受 MediaCrawler 的非商业学习许可证约束。商业使用需取得授权或完整替换该部分。
