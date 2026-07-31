# Mineradio

![Mineradio 暗场启动页](./docs/assets/readme/cinema-beat-smoke.png)

Mineradio 是一款 Windows 桌面沉浸式音乐播放器，把 Navidrome / 本地媒体库、歌词舞台、粒子视觉、3D 歌单架和完整桌面模式组合成一个更接近现场感的私人音乐空间。

## 立即下载 Windows 安装包

> 安装包可从夸克盘、百度云、蓝奏云或 GitHub Release 手动下载；软件内更新入口仍只打开网盘线路，不读取 Release 附件。

| 下载入口 | 推荐人群 | 链接 |
| --- | --- | --- |
| 夸克盘 | 夸克用户 | [下载 Mineradio 2.0.3](https://pan.quark.cn/s/f40289e1c5d3) |
| 百度云 | 百度网盘用户（提取码 `sjhp`） | [下载 Mineradio 2.0.3](https://pan.baidu.com/s/14fgTABgbfseOg9QuX0Um7Q?pwd=sjhp) |
| 蓝奏云 | 直接下载 | [下载 Mineradio 2.0.3](https://xxhuber.lanzout.com/mineradio2) |
| GitHub Release | GitHub 用户、版本说明与源码 | [下载 Mineradio 2.0.3](https://github.com/XxHuberrr/Mineradio/releases/tag/v2.0.3) |

安装时只需要下载并运行 `Mineradio-2.0.3-Setup.exe`。不要把 `.blockmap`、`latest.yml` 或 `win-unpacked` 当成正式安装包。

## 下载或安装被拦截怎么办

小众 Electron 桌面软件、未签名安装包有时会被浏览器、Windows Defender 或 SmartScreen 提示风险。请先确认安装包来自上面的网盘入口或官方 GitHub Release，文件名是 `Mineradio-2.0.3-Setup.exe`。

1. 浏览器下载栏提示风险时，打开下载列表，点这条下载右侧的 `...` 三个点，选择 `保留` / `仍要保留` / `显示更多` 后继续保留。
2. Windows SmartScreen 弹出蓝色拦截窗口时，点 `更多信息`，再点 `仍要运行`。
3. 如果杀毒软件明确显示木马、高危或已经隔离，不要强行运行；删除该文件后重新从上面的网盘入口下载，仍然异常请带截图反馈给作者。

## 作者支持

如果 Mineradio 陪你多听了一首歌，也欢迎请作者一杯咖啡。

[查看完整支持页](./docs/SUPPORT.md)

![Mineradio 作者支持渠道](./docs/assets/support/mineradio-author-support-poster.png)

Mineradio 2.0 重新整理了视觉层次、桌面模式、主页与搜索体验，并收紧了连续播放、启动和后台性能表现。

## 当前版本

当前版本：`2.0.3`

状态：Mineradio 2.0.3 正式版。

> 安全提示：`v1.0.10` 及更早旧安装包不再建议继续安装或传播。请使用本页提供的 `Mineradio-2.0.3-Setup.exe`。

## 核心特性

- 首页包含每日推荐、平台推荐、继续听、听歌画像和我的歌单入口
- 完整桌面模式保留播放器、主页、歌单和桌面交互
- 支持本地 MP4 与 Wallpaper Engine 视觉内容
- 播放后切换到 Emily / 默认播放态视觉，歌词舞台与粒子舞台同步工作
- 基于节奏的电影镜头视觉系统
- 歌词舞台、自定义歌词、歌词位置与视觉控制
- 自定义专辑封面上传与裁剪
- 右键唤起 3D 歌单架，支持歌单队列浏览
- Navidrome（Subsonic/OpenSubsonic）搜索、歌单、收藏、歌词和播放
- Navidrome 多账号切换；密码由 Electron `safeStorage` 加密保存
- 本地单曲/文件夹导入；桌面版可递归扫描标签、封面、LRC 并自动生成歌单
- GitHub Releases 更新检测与下载入口
- 首次启动内置「默认测试」视觉用户存档，软件内默认视觉参数与该存档一致

## 使用说明

Windows 用户可以从本页列出的夸克盘、百度云、蓝奏云或 GitHub Release 下载安装包。

首次打开后点击右上角“音乐库设置”：填写 Navidrome 的 HTTPS 地址、用户名和密码，测试连接后保存即可。地址填写站点根地址即可，例如 `https://music.example.com`，不需要手动追加 `/rest`。也可以只选择本地音乐文件夹；应用会递归扫描 MP3、FLAC、M4A、OGG、WAV 等格式，并按目录和专辑生成只读歌单。密码不会写入前端或普通配置文件。

正式分发以 `Mineradio-2.0.3-Setup.exe` 为准，不建议直接使用 `win-unpacked` 目录。安装包会创建桌面快捷方式。

已经安装过旧版本的用户可直接运行 `Mineradio-2.0.3-Setup.exe` 完成更新。软件内更新入口只会打开浏览器下载页，不会在客户端内下载或应用补丁。

## 开发运行

```bash
npm install
npm start
npm run build:win
```

桌面版入口由 Electron 主进程加载本地服务。`npm run build:win` 会生成 Windows NSIS 安装包，产物位于 `dist/`。

### 在 GitHub 上编译 Windows 安装包

仓库内置了 `.github/workflows/windows-build.yml`。它不会在每次普通提交时自动运行，只会在 Actions 页面手动运行，或推送 `v*` 标签时运行。

手动编译：打开仓库的 `Actions` → `Windows Build` → `Run workflow`，选择包含最新代码的分支并确认。任务完成后打开该次运行，在 `Artifacts` 下载 `Mineradio-Windows-...`，解压后运行其中的 `Mineradio-*-Setup.exe`。Artifact 默认保留 14 天。

正式发布时，先把 `package.json` 和 `package-lock.json` 的版本号更新为目标版本，再提交并推送版本标签来触发构建。例如当前版本要发布为 `2.0.4` 时：

```bash
npm version 2.0.4 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release 2.0.4"
git tag v2.0.4
git push origin v2.0.4
```

工作流只上传构建产物，不会自动创建 GitHub Release，也不会上传 Navidrome 地址、账号、密码或本地音乐文件。

## 更新机制

Mineradio 会请求 GitHub Releases latest 检测新版本。远端版本高于本地版本时，应用内更新入口会展示 Release 内容，并通过系统浏览器打开可选网盘线路；即使 Release 附带完整安装包，`2.0.3+` 客户端也不会读取、下载、缓存或应用该附件与补丁。

本地验证更新链路时，可以通过 `MINERADIO_UPDATE_MANIFEST` 指向一个本地 manifest JSON 或 HTTP 地址来模拟线上 Release。

## 历史平台兼容代码说明

当前发行版默认使用个人 Navidrome / 本地媒体库，不要求网易云音乐、QQ 音乐等账号，也不会在界面展示这些登录入口或播客入口。

仓库中保留的旧平台后端仅用于迁移兼容；只有显式设置 `MINERADIO_LIBRARY_ONLY=0` 时才会重新开放旧路由。项目不会提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。

## 用户数据与隐私

Navidrome 账号配置、加密凭据、本地媒体库索引、登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存等数据只应保存在本机用户数据目录或浏览器本地存储中，不应提交到仓库。播放请求由本地服务代理到你配置的 HTTPS Navidrome 地址。

更多说明见 [PRIVACY.md](./PRIVACY.md)。

## 致谢

Mineradio 由 XxHuberrr 主要设计与打造。emily 作为早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此感谢。

同时感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。

## 版权与授权

Copyright (C) 2026 XxHuberrr.

本项目采用 GPL-3.0 授权。详见 [LICENSE](./LICENSE)。

MR Logo、Mineradio 名称、界面视觉设计与原创视觉表达归作者所有；第三方依赖和第三方服务分别遵循其各自授权与服务条款。
