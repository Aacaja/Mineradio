# agent.md — A 项目实现路径说明（给下一个 agent 看）

> 本文件是新对话开始时的第一手上下文。**新 agent 必须先读本文件和 `agent-progress.md`**，再动手改代码。
> 开发进度日志在根目录 `agent-progress.md`，每次完成一步都要追加一条记录（本文件底部有更新规范）。

## 1. 项目是什么

- 产品名：**A**（`package.json` 中 `name: "a"` / `productName: "A"`，版本基线 2.0.3）
- 由开源项目 **Mineradio**（Windows 沉浸式 Electron 音乐播放器：3D 歌词舞台、粒子视觉、3D 歌单架、桌面模式）改写而来，GPL-3.0-only
- 改造方向：把主要音乐来源收敛为「**个人 Navidrome 服务器 + 本地音乐库**」，不再依赖网易云/QQ/酷狗/汽水/Spotify 平台账号（这些平台的代码仍保留在仓库里，渲染层已被 stub）
- 定位：Windows 桌面端播放器

## 2. 开发路线（用户固定工作流，不要改变）

1. 在 **macOS（Mac mini）** 上开发：`npm ci` → `npm start`（Electron 直接跑）
2. 代码提交推送到 **GitHub**
3. 在 GitHub Actions 手动运行 **`Windows Build` 工作流**（`.github/workflows/windows-build.yml`）
4. 从 Artifact 下载 Windows 构建产物（`A-<version>-Setup.exe`），在 Windows 上安装使用
- macOS 本机**不能**直接出 NSIS 安装包，`npm run build:win` 只会在 CI 的 Windows runner 上跑
- 回归测试在 macOS 本机跑：`node tests/<name>.test.js`（如 `node tests/library-media-regressions.test.js`）

## 3. 代码结构总览

```
desktop/          Electron 主进程
  main.js         窗口/壁纸引擎/IPC 总入口（约 5900+ 行）
  preload.js      暴露 window.desktopWindow（mineradio-* IPC 桥）
  login-easter-egg-gate.js   登录彩蛋门（密码"世界和平"，状态文件 login-easter-egg.json）
  startup.html / 各 *-runtime.js   桌面模式、壁纸引擎等
server.js         本地 HTTP 网关（约 7200 行单体，Electron 主进程拉起，本地端口监听）
  - NeteaseCloudMusicApi + kugou-api.js / qishui-api.js / spotify-api.js / qq-vip-api.js
  - navidrome-api.js   Subsonic/OpenSubsonic 客户端（Navidrome 全部走它）
  - local-library.js   本地音乐扫描（music-metadata 读标签/内嵌封面/FLAC 内嵌歌词/.lrc）
  - dj-analyzer.js / cuefield/  播客 DJ 分析 / AI 混音（automix）
public/          渲染层（无框架，原生 JS + WebGL/canvas + GSAP）
  index.html / css/index.css
  js/index-loader.js   按严格顺序加载约 90 个模块（顺序不能乱，函数互相依赖）
  js/modules/00-state → 01-scene → 02-visual → 03-beat → 04-shelf → 05-playback
             → 06-lyrics → 07-fx → 08-account → 08-library → 09 → 10-shell → 11-main-loop
tests/           Node 回归测试（约 28 个），可单独 node 运行
scripts/         Windows/壁纸引擎诊断脚本（macOS 上多数跑不了，仅供 CI/Windows 排查）
```

## 4. 关键机制（改代码前必读）

### 4.1 账号体系 = 08-library 覆盖层（最重要）
- `public/js/modules/08-library/00-library-runtime.js` 是改写核心，**后加载并覆盖**旧平台账号模块（08-account）的函数：
  - `showLoginModal() / showUserModal()` → 打开「音乐库设置」弹窗
  - `logoutActiveAccount()` → 目前只是 `openLibrarySettings()`（**没有真正的登出动作，这是已知 bug**）
  - `hasPlatformLogin()` 只认 `navidrome` / `local`；网易云/QQ/酷狗/汽水/Spotify 一律 false
- 旧账号模块（`08-account/*`、`04-user-modal-logout.js`）仍会执行，改功能时注意**谁后加载谁生效**

### 4.2 Navidrome 账号存储（desktop/main.js）
- 文件：`userData/navidrome-profiles.json`（`NAVIDROME_PROFILES_FILE` 常量），结构 `{version, activeId, profiles[]}`
- 密码/Token/APIKey 用 Electron `safeStorage` 加密后存 `record.secret`（base64），主进程侧 `decryptNavidromeSecret` 解密
- 函数：`read/writeNavidromeProfilesState`、`saveNavidromeProfile`、`activateNavidromeProfile`、`deleteNavidromeProfile`、`testNavidromeProfile`(IPC 侧)
- IPC 通道：`mineradio-navidrome-profiles / save-profile / activate-profile / delete-profile / test-profile`
- 运行时配置通过 `process.env.MINERADIO_NAVIDROME_PROFILE_JSON` + `localServer.configureNavidrome()` 同步给 server.js 的 `navidromeClient`

### 4.3 设置弹窗（前端）
- `ensureLibrarySettingsModal()` 动态创建「音乐库设置」弹窗：Navidrome 账号列表（新增/编辑/切换/删除/测试连接）+ 本地音乐文件夹（选择/重新扫描）
- 所有操作依赖 `window.desktopWindow.*`（preload 桥）；**非 Electron 环境或桥异常时，账号列表加载不出、保存提示"当前环境不是 Electron 桌面版"**

### 4.4 登录彩蛋门
- `desktop/login-easter-egg-gate.js`：密码「世界和平」，未解锁时启动会清掉平台 cookie（`.cookie`、`.qq-cookie` 等），与 Navidrome 配置无关

### 4.5 模块加载机制（v2，2026-08-08 起）
- `public/js/index-loader.js` 用**异步顺序加载**（动态 `<script async=false>` 按序插入），不再用同步 XHR；页面 `load` 事件及时触发，主窗口导航不会超时（修复 MR-BOOT-WINDOW-LOAD）
- 单模块加载失败会重试一次，仍失败则记录到 `window.__mineradioModuleLoader.failed` 并继续加载后续模块
- 若模块下载晚于 DOMContentLoaded，loader 会补偿触发一次 DOMContentLoaded；**新增模块若监听 DOMContentLoaded 必须写成 readyState 防御式**（参照 08-library/00-library-runtime.js 末尾写法）

### 4.6 命名约束（README 明确警告）
- 源码里 `MINERADIO_*` 环境变量、API 路径、Electron IPC 名称**不能改名**，否则破坏已有配置和用户数据

## 5. 已知问题 / 当前任务

1. **无法退出账号**：`logoutActiveAccount()` 被 stub 成 `openLibrarySettings()`，没有任何清配置/登出动作
2. **旧 Navidrome 链接过期后无法切换**：疑似与 `window.desktopWindow` 桥不可用、状态卡死（`configured` 即算 loggedIn）、或设置弹窗交互缺陷有关，**待复现确认**
3. 根目录有疑似调试残留：`run_uris.txt.log`、`run_nodes_b64.txt.log`、`run_uris_b64.txt.log`、`run_nodes.yaml.log`（2026-08-08 生成），可考虑清理或确认用途
4. 未提交文件：`mineradio-architecture.html`（624KB 架构图）、`.codex/` 目录（agent 配置，可考虑加入 .gitignore）

## 6. 使用方式速查（用户视角）

- 连接 Navidrome：右上角 →「音乐库设置」→ 填地址/用户名/密码 → 测试连接 → 保存并切换（可存多个账号）
- 本地音乐：「音乐库设置」→ 选择文件夹 → 扫描
- 浏览：首页「音乐库」入口 → 专辑/歌单/本地音乐分栏

## 7. 不要提交到 Git 的东西

- 用户数据：`.cookie` 等平台凭据、`navidrome-profiles.json`（在 userData 目录，不在仓库）、本地音乐索引/封面缓存
- 用户实际 Navidrome 地址、账号密码

## 8. agent 协作规范（重要）

- **每次完成一个开发步骤**（无论大小），都要在根目录 `agent-progress.md` 顶部追加一条记录：
  ```
  ## YYYY-MM-DD HH:MM — 简短标题
  - 做了什么：…
  - 涉及文件：…
  - 验证方式：…
  - 下一步建议：…
  ```
- 涉及架构级变化（新增模块、改名、改存储格式）时，同步更新本文件的第 3/4 节
- 新对话开始：先读 `agent.md` + `agent-progress.md` 尾部若干条，再开始干活
