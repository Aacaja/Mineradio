# A NOTICE

A 使用了以下第三方项目或服务。各项目版权归其原作者所有。

本仓库是基于原开源项目的个人魔改版本。文档和产品名称使用 A；原项目名称、原始代码、第三方贡献和许可证不会因为本次改名而消失或转移。

## Third-party Libraries

- Electron
- Three.js
- GSAP
- music-tempo
- NeteaseCloudMusicApi
- mpg123-decoder

## Community Contributions

- Cuefield AutoMix planner/runtime: adapted for experimental local testing from [SLYysl/cuefield-mineradio](https://github.com/SLYysl/cuefield-mineradio) (GPL-3.0). The optional remote-feedback component from that repository is not included; A stores Cuefield ratings locally in the current user's data directory.
- Wallpaper Engine local-library detection and import UX: independently adapted from the approach used by [ww085213/Mineradio-LX-Music](https://github.com/ww085213/Mineradio-LX-Music) at commit `a5ef80a219709080700be5b1d00f1ea71a5a2576` (GPL-3.0). A only indexes local `project.json` metadata; it does not execute imported Web/Application projects or replace the user's existing background-media settings.
- Full-desktop main-window mode and home-dashboard information hierarchy: initially adapted from [ww085213/Mineradio-LX-Music](https://github.com/ww085213/Mineradio-LX-Music) at commit `82826df814c32853d99697c0ee60f749a2fcad79`, with the homepage refreshed against `812e2dc2e18bbc263e61dbd0206cb765e003d6e9` (GPL-3.0). A keeps its own provider, queue, playlist, listening-history, WorkerW validation, DPI, lifecycle, and cleanup implementations; see `docs/THIRD_PARTY_PORTS.md` in the corresponding source distribution.

## Third-party Services

A 的当前默认入口面向 Navidrome 和本地音乐库；仓库中仍保留部分旧平台兼容代码。若用户主动启用相关兼容功能，A 可能与网易云音乐、QQ 音乐等第三方音乐服务进行用户自有账号相关的本地客户端交互。

A 不是 Navidrome、网易云音乐、QQ 音乐或腾讯音乐娱乐集团的官方客户端，也不隶属于这些平台。请用户自行遵守对应平台的服务协议、版权规则和会员权益规则。

## Original Design

A 名称以及本仓库新增或修改的界面、启动动画方向、粒子视觉体验和电影镜头表达属于当前版本的个人开发内容；原项目的名称、Logo 和原始设计仍按原项目声明处理。

emily 作为早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此致谢。

感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。
