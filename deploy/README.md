# Debian 12 部署草案

此配置用于独立域名和单机部署，不涉及现有 FRP 或远程桌面。先准备域名、HTTPS 证书和只读 GitHub 拉取凭据，再部署。`nginx.conf.example` 中的域名与证书路径需按实际值修改；不要直接复制覆盖服务器已有站点配置。

服务器安装 Node.js、npm、Python 与所需浏览器依赖后，将仓库检出到 `/opt/business-radar/app`，运行 `npm ci`、`npm run build`。创建专用系统账户 `business-radar`，使 `/var/lib/business-radar` 仅对该账户可写，并在 `/etc/business-radar.env` 配置：

```env
BUSINESS_RADAR_USERNAME=your-username
BUSINESS_RADAR_PASSWORD=replace-with-a-long-random-password
BUSINESS_RADAR_DATA_DIR=/var/lib/business-radar
DEEPPOINT_JOB_DATA_DIR=/var/lib/business-radar/jobs
```

环境文件权限设为仅管理员与服务账户可读。服务进程只监听 `127.0.0.1:3000`，公网仅开放 HTTPS。安装前检查服务器当前 Nginx 站点和端口，避免影响其他服务。更新时先备份 `/var/lib/business-radar`，拉取指定提交，安装依赖并构建，再重启本服务。当前版本尚未做服务器资源实测，也没有家庭 GPU 任务同步，先只部署网页和手动证据库。
