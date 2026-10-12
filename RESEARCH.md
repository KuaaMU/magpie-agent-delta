# Magpie, Agent Plugins 与 Delta (Zed) 架构深度调研报告

**调研时间**: 2026-10-12  
**调研人**: KuaaMU  
**代码基线与主数据源 (Primary Sources)**:
- Magpie 核心源码: `F:\magpie` (`internal/agentplug`, `internal/agent`, `internal/library`, `internal/gateway`)
- Magpie 社区插件: `F:\magpie-community-plugins` (`packages/delta`, `packages/aider`, `packages/zed`)
- 本地 Magpie 配置中枢: `C:\Users\Administrator\.config\magpie`
- Delta 运行二进制: `C:\Users\Administrator\AppData\Local\Programs\Delta\delta.exe` (v0.19.2) 与 `bin\delta.exe`
- Delta 本地存储与凭据系统: Windows Credential Manager, `%LOCALAPPDATA%\delta`, `%APPDATA%\delta`

---

## 一、Magpie 插件体系架构 (`agentplug` 与 `internal/agent`)

### 1. 插件注册与生命周期 (`internal/agentplug/agentplug.go`)
Magpie 的 Agent 插件是轻量级 ECMAScript 模块，运行在内置的 `moejs` 运行时中（位于 Magpie 主进程内，非独立的 Node.js 子进程）。
- 插件由 `~/.config/magpie/plugins.json` 激活，并通过 `~/.config/magpie/plugins/package.json` 中的 `magpie.agent` 字段进行声明。
- 模块必须导出两个核心对象：
  1. `export const agent`: 声明 Agent 的元数据，包括：
     - `id`: Agent 唯一标识（如 `"delta"`）。
     - `name`: 显示名称。
     - `bin`: 可执行文件名称（如 `"delta"`）。
     - `config`: Magpie 接管并编辑的配置文件绝对或相对路径（支持 `~` 与 `$VAR` 环境变量展开）。
     - `format`: 格式解析器（`json`、`yaml`、`env`）。
     - `model`: 模型键路径（如 `portable.profiles.worker.model`）。
     - `prefix`: 模型前缀。
     - `ua`: 识别请求的 User-Agent 前缀数组（如 `["delta", "zed"]`）。
     - `library`: 技能与指令目录映射（对接 `internal/library`）。
  2. `export function connect({ gateway, model, models, agent })`:
     - 接收当前网关地址（`gateway.url`、`gateway.v1`、`gateway.key`）、当前选中模型（`model`）及可用模型集合（`models`）。
     - 返回由键值对组成的 JSON 对象（扁平化路径映射，如 `{"native.custom_providers": [...]}`）。

### 2. 接管与还原机制 (`internal/agent/plugged.go`)
- **Stash 保存**: 在 Magpie 写入 `agent.config` 前，`plugged.go` 会调用 `f.raw(kv.Path)` 读取用户原有的值，并在 `~/.config/magpie/stash.json` 中保存 `Had[key]`。
- **动态写入**: Magpie 将 `connect()` 返回的键值对与目标 `d.Model` 一并原子写入配置文件。
- **自动还原 (Unwire/Restore)**: 当用户在 Magpie 中取消勾选或切换为原生模型时，Magpie 自动从 `stash.json` 取出用户原有配置回写，并删除 Magpie 临时写入的键（`Had[k] == "\x00"` 则 del）。

---

## 二、Magpie Library 系统 (`internal/library`) 与 Delta 规则库联动

### 1. 中枢存储: `~/.config/magpie/library`
Magpie 将用户的全局指令集、Skills 插件与 MCP 服务器集中维护在 `~/.config/magpie/library`：
- `library/skills/`: 存放所有下载/启用的技能文件夹（每个包含 `SKILL.md`）。
- `library.json`: 记录所有已安装技能、MCP 服务的元数据，以及它们被应用到了哪些 Agent（`applied[agent_id]`）。

### 2. 技能链接机制 (`internal/library/skills.go` 与 `dirlink_windows.go`)
- Magpie 在将技能赋予 Agent 时，**绝不冗余拷贝**，而是采用目录联接（Junction / Symlink）：
  - Windows 环境下使用 `dirLink(skillDir(name), targetPath)` 创建从 `~/.config/magpie/library/skills/<name>` 到各 Agent 技能目录的符号链接。
  - 本地实测取证证据：在 `%APPDATA%\delta\skills` 下，已实际存在：
    `brainstorming -> C:\Users\Administrator\.config\magpie\library\skills\brainstorming`
    `writing-plans -> C:\Users\Administrator\.config\magpie\library\skills\writing-plans`

### 3. Agent 插件对 Library 的承载 (`internal/library/targets.go:pluginTarget`)
当一个 Agent 插件在其元数据中配置了 `library` 时：
```javascript
library: {
  instructions: "~/.agents/AGENTS.md",
  mcp: "~/.agents/mcp.json",
  mcpFormat: "zed",
  skills: "~/.agents/skills",
}
```
Magpie 的 `pluginTarget(a)` 会自动将其解析并注册到 Library 监控目标中。每当用户在 Magpie 中启用/更新一个 Skill 或 MCP 服务时，Magpie 都会自动维护这些目录。

---

## 三、Delta 核心配置与存储架构逆向研究 (`delta.exe`)

通过对 `delta.exe`（v0.19.2，基于 Zed 引擎定制的自主 Agent IDE）的实机取证分析，其架构特征如下：

### 1. 双重配置存储分层
1. **云端加密缓存层（Cloud E2EE Cache）**：
   - 目录: `%LOCALAPPDATA%\delta\user_<id>\settings.json`。
   - 格式: `{"boot": {...}, "secure": "<base64 ciphertext>"}`。
   - 凭据密钥: Windows Credential Manager 中键为 `zed:url=https://delta.dev/settings/user_<id>`，用户为 `settings-key-v1`，内容为 32 字节主加密密钥。
   - 通信协议: WebSocket 实时连接 `wss://delta.zed.dev/user-settings/subscribe?expected_user_id=<id>`。
   - **核心事实**: 在用户已登录 Delta 账号状态下，Delta 完全不读取 `%APPDATA%\delta\settings.json`，此前插件写入该文件导致无法生效。
2. **工作区级覆盖层（Workspace Project Settings）**：
   - 路径: `<project_root>/.zed/settings.json`。
   - 特性: 继承自 Zed 原生架构，属于纯本地、纯明文、非云端同步配置。
   - 作用: 可以明文定义 `language_models.openai_compatible` 和 `agent.default_model`。

### 2. Delta 自定义 Provider 的结构规范 (`StoredSettings`)
在 Delta 内存数据结构与 Serde 定义中，Custom Provider 具有精确定义：
```rust
struct CustomProviderSettings {
    name: String,
    base_url: String,
    api_mode: CustomProviderApiMode, // "open_ai_chat_completions", "open_ai_responses", "anthropic"
    headers: Vec<CustomProviderHeader>,
    models: Vec<CustomModelSettings>,
}
```
并且，Delta 在调用自定义 Provider 时，从 Windows 凭据管理器检索 API Key：
- Target: `zed:url=<provider_base_url>`（例如 `zed:url=http://127.0.0.1:3425/v1`）
- User: `Bearer`
- Secret: `<api_key>`

### 3. Delta 的子 Agent 角色架构 (`agent_profiles`)
Delta 区别于普通 Zed 的核心是多 Agent 协作体系：
- `worker`: 负责日常主要代码编写和主控执行。
- `scout`: 负责长代码库探测与信息检索。
- `reviewer`: 负责对改动进行审阅与质量把关。
各角色在 `portable.profiles.{worker, scout, reviewer}.model` 中独立索引模型 ID。

### 4. Delta 的规则与技能加载路径
在 `delta.exe` 二进制交叉引用中证实，Delta 原生扫描以下路径：
- `~/.agents/AGENTS.md`
- `~/.agents/skills` 与 `.agents/skills`
- `.delta/skills` 与 `%APPDATA%\delta\skills`
- `~/.agents/mcp.json`

---

## 四、Magpie 与 Delta 适配打通的破局结论

1. **为什么必须解决 240+ 模型洪水**：
   Delta 遇到自定义 Provider 会自发请求 `GET /v1/models`。如果 Magpie 不裁剪响应，Delta 前端无法分页渲染 242 个模型，导致 UI 瘫痪。
   **解决方案**: 利用 Magpie 的客户端感知机制或 `ListsModels`，让网关针对 Delta 的 Token/UA 仅返回激活的目标模型。

2. **为什么凭据必须自动注入**：
   用户严禁手动输入 URL 和 Key。Magpie 必须在适配时直接调用底层 `CredWriteW` 将 `zed:url=http://127.0.0.1:3425/v1` 注入凭据管理器。

3. **配置写入的最优路径**：
   - 保持 `delta.agent.js` 的纯社区插件体系。
   - 将 Library 挂载到 `~/.agents` 与 `%APPDATA%\delta`，使技能系统天然打通。
   - 在工作区级注入 `.zed/settings.json` 作为稳固的无感运行保障，同时兼容全局 Profile 映射。
