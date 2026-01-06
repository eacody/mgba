# mGBA — Copilot 使用说明

目的：为 AI 编码代理提供立即可用的、与本代码库相关的约定、构建/运行流程和关键位置引用，帮助快速定位更改点并提交可编译的补丁。

**大局（Big picture）**
- 核心模拟逻辑在 `src/core` 与 `include/mgba/core`，负责 CPU、内存、渲染、输入等模拟层。
- 硬件子系统按平台/硬件分散：`src/gba`、`src/gb`（按模块子目录，如 `bg/`, `obj/`, `irq/`）。
- 平台/前端在 `src/platform/*`（例如 `qt`, `sdl`, `headless`, `libretro`, `switch`），这些文件把核心与 OS/GUI/音频/输入集成。
- 公用工具和跨平台类位于 `src/util` 与头文件树 `include/mgba-util`（例如 `vfs`, `image`, `threading`）。

**关键文件举例（定位示例）**
- 项目配置与预设：[CMakePresets.json](CMakePresets.json#L1)
- Headless/测试入口：[src/platform/headless-main.c](src/platform/headless-main.c#L1)
- SDL 前端入口：[src/platform/sdl/main.c](src/platform/sdl/main.c#L1)
- Qt 前端入口：[src/platform/qt/main.cpp](src/platform/qt/main.cpp#L1)
- 核心头：`include/mgba/core/core.h` → [include/mgba/core/core.h](include/mgba/core/core.h#L1)

**构建 / 本地运行（可复制命令）**
- 使用 CMake + Ninja（仓库包含预设）：

```
mkdir -p build && cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j$(nproc)
```

- 若想使用 presets（调整为 clang/gcc debug presets）：

```
cmake --preset clang
ninja -C build
```

- 运行 headless（自动化/测试用途）：

```
./build/platform/headless-main [options]
```

（可在 `src/platform/*` 中找到具体入口和命令行选项。）

**项目约定与常见模式**
- 函数、全局和头文件常以 `mgba` 或 `mgba-` 前缀命名；内部库使用 `mgba-util` 命名空间头（见 `include/mgba-util`）。
- 硬件功能按子目录拆分（例如 `src/gba/bg/` 处理背景渲染），新功能通常应在相应子目录添加源/头并在上层 CMakeLists 中注册。
- 低级宏与便捷函数集中在 `include/mgba-util/macros.h`、`include/mgba-util/common.h`，避免重复实现。
- 资源与运行时数据放在 `res/`（shader、desktop 文件、license、scripts），二进制打包与安装由 `src/platform/*/CMakeLists.txt` 控制。

**集成点 / 外部依赖**
- 第三方源码直接位于 `src/third-party`（如 libpng、zlib、sqlite），修改这些文件须遵守其许可证目录 `res/licenses/`。
- 平台适配通过 `src/platform/*` 实现：添加平台时需实现与核心交互的适配层（`core/interface.h` 为参考）。
- Python 绑定/测试位于 `src/platform/python`，可用于快速集成测试与脚本化操作。

**修改指导（如何添加功能或修复）**
- 若改动影响模拟（CPU/内存/渲染），优先修改 `src/core` 或对应硬件子目录，再更新 `include/mgba/core` 的头文件。
- 修改后在本地用上面的 CMake 构建命令验证能编译；若改动影响前端（Qt/SDL），也在相应 `src/platform/*` 构建并手动运行。示例入口在上方“关键文件举例”。

**调试提示**
- 使用 `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`（已在 presets 中启用），便于使用 clangd/Language Server 做静态分析。
- 对于平台相关的问题，在对应 `src/platform/<name>/` 下查找同步线程与事件处理（SDL/Qt 主循环实现）。

请审阅此草稿：指出需要补充的特定工作流（例如打包、CI、平台交叉编译命令或常见调试场景），我会据此迭代更新文件。
