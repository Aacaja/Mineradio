# A Windows 构建与发布说明

## 当前发布状态

A 当前是基于原开源项目的个人魔改开发版，尚未建立独立的正式 Release 版本号。`package.json` 中的 `2.0.3` 是现有构建基线，不应被当作本次 A 改版的发布说明。

当前已完成的个人改动包括：

- Navidrome 连接、播放、专辑浏览、歌单浏览和封面读取。
- 长歌单分页续载，以及专辑/歌单详情中的播放全部。
- 本地音乐文件夹扫描、标签/封面读取和自动歌单。
- FLAC 内嵌歌词读取，并兼容同目录 `.lrc` 歌词。
- 保留每日推荐、最近播放、继续听和原有视觉舞台。

## Windows 构建方式

当前开发环境是 macOS，不能在本机直接构建 Windows NSIS 安装包。Windows 构建统一交给 GitHub Actions：

1. 将最新代码推送到 GitHub。
2. 打开 `Actions` → `Windows Build` → `Run workflow`。
3. 选择目标分支并启动工作流。
4. 等待依赖安装、媒体回归测试和 Windows 安装包构建完成。
5. 从该次运行的 `Artifacts` 下载并解压构建产物。

工作流也会在推送 `v*` 标签时运行，但不会自动创建 GitHub Release。正式发布前应先更新版本号、变更记录和发布正文，再单独确认是否公开发布。

## 构建检查

Windows runner 上应至少执行：

```bash
npm ci
node tests/library-media-regressions.test.js
npm run build:win -- --publish never
```

构建完成后检查：

- 安装包可以安装、启动、退出和重新启动。
- Navidrome 专辑、歌单、封面和播放链路正常。
- 本地 MP3/FLAC 扫描和播放正常。
- FLAC 内嵌歌词及同目录 `.lrc` 能进入歌词舞台。
- 构建产物中没有 Cookie、Token、Navidrome 凭据、本地音乐、缓存或调试日志。

## 当前内部产物命名

本次只修改 Markdown 文档，尚未修改 `package.json`、electron-builder 配置和工作流中的兼容标识。因此 GitHub Actions 当前仍会生成类似下面的内部文件名：

```text
Mineradio-Windows-<branch>-<run>.zip
Mineradio-<version>-Setup.exe
```

这些文件名属于构建兼容标识；文档和产品名称使用 A。若以后需要连同安装包、快捷方式、App ID、更新地址和 IPC 名称一起完成代码级改名，应单独进行一次完整的迁移并重新验证用户数据和安装器安全逻辑。

## 发布边界

- 不在仓库中提交 Navidrome 地址、用户名、密码、Token 或 API Key。
- 不在 Release 或 Artifact 中上传用户本地音乐和本地媒体索引。
- 不把 `.blockmap`、`latest.yml` 或解压目录误当作安装包本体。
- A 不是 Navidrome 或其他音乐平台的官方客户端，发布时应保留许可证、第三方声明和隐私说明。
