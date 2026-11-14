# Business Radar 本地原型

采集任务列表显示最近 100 条已保存记录，包括超过 24 小时的任务。网页进程只预载最近 100 条任务；较旧的待分析任务可在需要时从磁盘读取并继续分析。历史列表缓存摘要 30 秒，正在运行的任务状态仍实时更新。内存中的任务保留上限不会删除磁盘上的任务文件、原始评论或证据；旧任务仍可通过详情链接打开。

基于 DeepPoint 开发。当前原型新增 `/zh/evidence` 需求证据库，支持手动录入原文、原帖链接和评论 ID，并记录核实、联系状态。新版抖音采集到的评论会在 AI 聚类前写入证据库；模型离线时仍可查看已保存的证据。`/zh/capture` 提供“只采集、稍后分析”的任务入口，模型启动后可手动分析已采集数据。服务重启后，已保存采集数据的中断任务会回到待分析状态。

证据库默认展示近 90 天待核实的优先线索；可切换已核实、已联系，以及待补评论直达链接的线索。按原文、备注、状态搜索筛选，并用本地关键词规则标出“重复劳动”“明确求工具”等需求信号。规则只提供浏览提示，不代表需求已验证；未命中的评论仍会保留。人工核实或联系后更改状态，系统会记录首次核实、首次联系及最后修改时间；已有证据不自动改状态。筛选结果导出的 CSV 包含这些时间，旧数据的空时间字段表示尚未记录。

“人工校准”每次展示最多 30 条近 90 天未判读评论，先包含规则提示，再从未提示评论中按固定 ID 顺序取样。可标记疑似需求、非需求或不确定；该判读不等于核实原帖，也不会自动改变联系状态。页面显示规则未提示但人工认为有需求的数量，便于发现漏检。采集新数据后未判读队列可能变化，已判读结果会保存在证据文件并随 CSV 导出。

判读为“疑似需求”的近期评论会进入优先线索，即使规则没有命中；判读为“非需求”的评论会退出优先线索。规则提示数本身仍按原规则统计，便于比较人工判读与规则的差异。

`/zh/opportunities` 可人工创建需求主题，并把多条评论关联为同一主题的证据。主题备注可以记录共同场景和待验证假设；从主题移除评论不会删除原始证据。主题保存在 `.business-radar/opportunities.json`，备份命令会一并复制该文件。

## 本地运行

依照上游 README 安装 Node.js、Python 与采集依赖，执行 `npm ci` 后运行 `npm run dev`，打开 `http://localhost:3000/zh/evidence`。采集功能建议先在项目目录运行 `python -m venv .venv`，然后在 Windows 上执行 `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`；应用会优先使用该项目虚拟环境。手动录入证据不需要 Python、浏览器或模型。数据默认保存在 `.business-radar/evidence.json`，可用 `BUSINESS_RADAR_DATA_DIR` 指定独立数据目录；该目录已加入 `.gitignore`。

运行 `npm run backup:data` 可将证据文件和任务 JSON 保存到 `.business-radar-backups/` 下的独立时间戳目录；备份目录不进入 Git。可用 `BUSINESS_RADAR_BACKUP_DIR` 指定其他备份位置。恢复时先停止网页服务，再将备份文件复制回原数据目录。公网部署前应把备份目录放在应用目录之外，并安排定期备份。

## LM Studio 按需分析

分析任务现在可以逐次选择 LM Studio、Ollama、云端 GLM 或 OpenAI 兼容 API。聊天与 embedding 使用同一个所选来源；本地 LM Studio 也是 HTTP API 服务。云端模式要分别配置 API 密钥、聊天模型和 embedding 模型，密钥只保存在 `.env.local` 或服务器环境文件中。未配置密钥的来源不能启动分析。采集任务仍可在模型离线时运行并保存原始数据，之后选择任一已就绪来源分析。

云端 GLM 使用 `GLM_API_KEY`、`GLM_BASE_URL`、`GLM_MODEL_NAME` 和 `GLM_EMBEDDING_MODEL`。其他提供 OpenAI 兼容聊天与 embedding 接口的服务使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 和 `OPENAI_EMBEDDING_MODEL`。每次启动分析前在页面选择来源；网页不会接收或返回 API 密钥。云端分析会向服务商发送待分析的评论原文，使用前应确认你接受该数据流向与费用。

将来若服务器通过安全隧道访问家中 LM Studio，把服务器上的 `LM_STUDIO_BASE_URL` 改为隧道内地址，配置 `LM_STUDIO_API_KEY` 并启用 LM Studio 认证即可；现阶段不修改 FRP。服务器只运行网页时保持 `BUSINESS_RADAR_WEB_ONLY=true`；如已导入本地任务并安装分析依赖，可额外设置 `BUSINESS_RADAR_ALLOW_AI_ANALYSIS=true` 允许服务器分析已采集数据，采集仍只在本地电脑运行。

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
