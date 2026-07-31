# A 安全策略

## 支持范围

当前只维护仓库最新的 A 个人开发版和由 GitHub Actions 生成的最新 Windows 构建产物。旧的安装包、旧的打包目录和来源不明的二进制文件不属于当前支持范围。

## 安装包与构建安全

- Windows 安装包应优先从当前仓库的 GitHub Actions Artifact 或明确对应的 GitHub Release 获取。
- 下载后应核对文件来源、文件名和发布记录；不要把 `.blockmap`、`latest.yml` 或 `win-unpacked` 目录当作安装包本体。
- 未签名的个人开发版可能触发 Windows Defender 或 SmartScreen 提示。来源无法确认、被杀毒软件明确判定为高危或已经被隔离的文件不要强行运行。
- 构建前后都不要把 Navidrome 凭据、本地音乐、Cookie、Token、日志或缓存放入仓库和构建 Artifact。

## 报告安全问题

如果发现安全问题，请通过 GitHub Issues 或仓库维护者提供的私下联系方式报告。公开反馈前请先移除敏感信息。

请不要在公开 Issue 中直接贴出：

- Navidrome 地址、用户名、密码、Token 或 API Key。
- Cookie、二维码登录状态或私密播放链接。
- 本地音乐路径、账号截图和包含隐私内容的调试日志。

## 凭据处理

A 不应主动收集或上传用户凭据。Navidrome 密码、Token 和 API Key 由 Electron `safeStorage` 加密后保存在本机用户数据目录；如果系统没有可用的安全存储，应用应拒绝保存敏感凭据。
