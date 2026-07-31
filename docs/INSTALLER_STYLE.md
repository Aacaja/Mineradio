# A Windows 安装器维护说明

> 本文已按当前产品名称 A 整理。NSIS 函数、环境变量、IPC 名称和历史安装包中的 `Mineradio` 字样属于源码兼容标识，涉及安装器迁移时必须按实际代码保留，不能只做文字替换。

## 2026-06-25 P0 Installer Safety Notes

- Full setup adoption rule: the installer may adopt an existing registered install only when the registered path itself is a dedicated `...\A` directory and contains A files or `.mineradio-install-root`; mixed parent folders and drive roots must stay blocked/quarantined.
- Quick patch rule: installer/uninstaller safety bugs cannot be fixed by a quick patch JSON alone, because the Windows uninstaller and install registry must be replaced by the full NSIS setup.

## 2026-06-26 Fixed Installer Packaging Baseline

- Future Windows releases must keep the repaired `v1.1.1` installer shape: custom NSIS pages and safety logic from `build/installer.nsh`, full setup `.exe`, `.blockmap`, `latest.yml`, and `SHA256SUMS`.
- Baseline release asset: `Mineradio-1.1.1-Setup.exe`, SHA256 `1d35750c5b9c5099bd608baa4cc8564d5a08a183dccb2aa7ab85ef613fd536f7`, size `115090051` bytes.
- Do not publish installer/uninstaller safety fixes as quick patch JSON only. They must be delivered by a full setup package so the Windows uninstaller and registry are replaced.
- Never remove `customRemoveFiles` or restore electron-builder's default recursive `$INSTDIR` deletion path. Keep deletion limited to known A/Electron top-level files and non-recursive empty-directory cleanup.
- Keep safe overwrite behavior: existing dedicated `...\A` folders containing A files can be overwritten; mixed folders, parent folders, drive roots, and user data folders must stay blocked or quarantined.

## A 安装器样式

2026-06-22 用户确认保留当前安装包格式。以后发布安装包，默认沿用这套样式和流程，除非用户明确要求重做。

## 视觉方向

- 中文极简安装器。
- 主色：白底 `#FFFFFF`，主文字 `#111217`，弱文字 `#4B5263` / `#6B7280`，蓝色点缀 `#3257F7`。
- 不要再使用旧品牌字样、深色大卡片、复杂装饰、英文大段说明或黑底黑字。
- 顶部横幅和侧边图保持黑白蓝极简：`build/installerHeader.bmp`、`build/installerSidebar.bmp`。

## 页面结构

- 欢迎页只保留：
  - `A`
  - `A 安装`
  - 简短中文说明
  - `默认位置：D:\A`
- 安装目录页只保留：
  - `选择安装位置`
  - 简短中文说明
  - `安装目录` 输入框
  - `浏览...` 按钮
  - `默认推荐：D:\A；选盘符会自动建文件夹。`

## 技术边界

- 使用 `build/installer.nsh` 的自定义欢迎页和自定义安装目录页。
- `package.json` 中 `build.nsis.allowToChangeInstallationDirectory` 保持 `false`，避免 electron-builder 原生目录页读取旧安装注册表后回填到旧的程序目录。
- 自定义目录页必须保留可编辑输入框和 `浏览...` 按钮。
- 默认路径通过 `MineradioUsePreferredInstallDir` 设置为 `D:\A`；命令行 `/D=` 参数仍可覆盖。
- 用户选择盘符根目录时，通过 `MineradioNormalizeInstallDir` 自动补成 `盘符:\A`。

## 发布前验证

发布前必须本地打开新生成的 `dist\A-版本-Setup.exe` 验证：

- 欢迎页显示中文极简样式，默认位置为 `D:\A`。
- 安装目录页输入框显示 `D:\A`。
- `浏览...` 按钮能弹出中文文件夹选择窗口。
- 验证时不要点 `安装`，确认后取消退出。

## 2026-06-25 安装安全补充

- 默认安装路径从 `D:\A` 开始按 D-Z 顺序选择第一个存在的盘；只有电脑不存在任何 D-Z 盘时，才允许默认落到 `C:\A`。
- 用户手动选择目录时，安装器必须强制落到独立 `A` 子文件夹；若 D-Z 盘存在，手动选择 C 盘也要阻止。
- 非空且无法识别为 A 的目录必须阻止安装，避免卸载阶段删除用户其它文件。
- 新安装器写入 `.mineradio-install-root` 标记；新卸载器必须先验证路径和标记/主程序/卸载器，再进入卸载。
- 新卸载器禁止使用 `RMDir /r $INSTDIR` 删除整个安装根目录，也禁止递归删除 `resources`、`locales` 等应用子目录；只能删除 A/Electron 顶层已知文件，最后用非递归 `RMDir "$INSTDIR"` 尝试移除空目录。
- 安装新版本时，若检测到旧版本没有 `.mineradio-install-root` 安全标记，必须跳过旧卸载器，只删除旧目录中的 `Uninstall Mineradio.exe` 单文件并清理卸载注册表，避免触发历史安装包的整目录递归删除逻辑。
