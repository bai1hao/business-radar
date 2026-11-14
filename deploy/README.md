# Debian 12 部署草案

**公网部署门槛：**先运行 `npm run security:audit` 和 `npm run check`，两项都通过后再向公网开放服务。

此配置用于独立域名和单机部署，不涉及现有 FRP 或远程桌面。先准备域名、HTTPS 证书和只读 GitHub 拉取凭据，再部署。`nginx.conf.example` 中的域名与证书路径需按实际值修改；不要直接复制覆盖服务器已有站点配置。

第一阶段服务器只运行网页、手动证据库和需求主题；采集与 AI 分析在 Windows 本地运行。服务器仅需 Node.js 及 npm，不需安装 Python、浏览器、LM Studio 或爬虫依赖。将仓库检出到 `/opt/business-radar/app`，运行 `npm ci`、`npm run build`。创建专用系统账户 `business-radar`，使 `/var/lib/business-radar` 仅对该账户可写；构建后创建 `/opt/business-radar/app/.next/cache` 并授予该账户写权限。`systemd` 示例将其他程序目录保持只读，并明确放行这两个路径。在 `/etc/business-radar.env` 配置：

```env
BUSINESS_RADAR_USERNAME=your-username
BUSINESS_RADAR_PASSWORD=replace-with-a-long-random-password
BUSINESS_RADAR_DATA_DIR=/var/lib/business-radar
DEEPPOINT_JOB_DATA_DIR=/var/lib/business-radar/jobs
BUSINESS_RADAR_WEB_ONLY=true
```

环境文件权限设为仅管理员与服务账户可读。服务进程只监听 `127.0.0.1:3000`，公网仅开放 HTTPS。安装前检查服务器当前 Nginx 站点和端口，避免影响其他服务。`BUSINESS_RADAR_WEB_ONLY=true` 时首页转到需求总览，服务器拒绝启动采集；默认也拒绝 AI 分析。若已配置云端模型 API、安装 Python 分析依赖并导入了本地采集任务，可另设 `BUSINESS_RADAR_ALLOW_AI_ANALYSIS=true`，让服务器分析已保存的任务。模型密钥只放在服务器环境文件，不经网页提交。

目前没有本地电脑到云端的自动同步。在本地执行 `npm run backup:data`，将生成的整个备份目录传到服务器。停止网页服务并备份 `/var/lib/business-radar` 后，在服务器设置与服务一致的 `BUSINESS_RADAR_DATA_DIR` 和 `DEEPPOINT_JOB_DATA_DIR`，以服务账户先执行 `npm run import:data -- <备份目录> --merge --dry-run` 预览新增数量和同 ID 差异，再执行 `npm run import:data -- <备份目录> --merge` 导入。首次导入空目录可不加 `--merge`。增量导入按 ID 追加新证据和主题；同 ID 的云端核实状态、判读、备注和主题内容保留，差异会输出 ID 与字段名供人工处理。已有任务文件也保留，不会覆盖本地后续分析结果。更新代码时先备份 `/var/lib/business-radar`，拉取指定提交，安装依赖并构建，重新确认 `.next/cache` 权限，再重启本服务。当前版本尚未做服务器资源实测，也没有家庭 GPU 任务自动同步。
