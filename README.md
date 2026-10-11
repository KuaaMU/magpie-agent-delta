# magpie-agent-delta

> Use any AI model in [Delta](https://delta.dev) (by Zed Industries) through [magpie](https://usemagpie.ai).
> 通过 magpie 在 Delta 编辑器中使用任意大模型。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![magpie-plugin](https://img.shields.io/badge/topic-magpie--plugin-orange.svg)](https://github.com/topics/magpie-plugin)

## 🌟 特性 / Features

- 🔄 **全模型支持 (Any Model)**: 在 magpie 的 Agents 界面一键将 Delta 切换至 Claude、GPT、DeepSeek、Gemini 或任何自定义模型及路由组。
- 🧠 **思考等级无缝透传 (Reasoning Efforts)**: 自动将模型的推理/思考深度（`minimal` / `low` / `medium` / `high`）同步至 Delta 的 `reasoning_effort`。
- 📏 **精准上下文窗口 (Context Window)**: 动态传递各模型的实际上下文窗口长度（`max_tokens`），避免截断。
- 🛡️ **无损注入与平滑恢复 (Zero-Risk Stash & Rollback)**: 仅在 Delta 的 `settings.json` 中注入 `magpie` 专属节点，断开时 100% 还原用户原始配置与注释。
- 📚 **MCP 与技能联动 (Library Support)**: 自动打通 magpie Library 的提示词与 Zed 格式 MCP 服务。

---

## 🚀 安装与使用 / Installation & Usage

### 方式 1：通过 Magpie 插件市场（推荐）/ Via Magpie GUI
1. 打开 Magpie，进入 **插件 (Plugins)** -> **发现 (Discover)**。
2. 搜索 **Delta** 或在 **Agent** / **非官方插件** 区域找到 `magpie-agent-delta`。
3. 点击 **安装 (Install)**。
4. 返回 **Agent** 页面，在 Delta 行即可直接选择任意大模型！

### 方式 2：CLI 本地挂载测试 / Via CLI
```bash
# 本地目录挂载测试
magpie plugin add F:/magpie-agent-delta

# 或从 npm 安装（发布后）
magpie plugin add @magpie-community/agent-delta
```

---

## ⚙️ 工作机制 / How It Works

本插件基于 Magpie 2026 最新发布的 **Agent Plugin 规范** 实现：
1. **自动识别**：检测系统中的 Delta 可执行文件及配置目录（Windows: `%APPDATA%\delta`；macOS/Linux: `~/.config/delta`）。
2. **端点配置**：在 `settings.json` 中写入 `language_models.openai_compatible.magpie` 指向 Magpie 本地网关（`http://127.0.0.1:3425/v1`）。
3. **模型绑定**：将 `agent.default_model` 设为 `{ "provider": "magpie", "model": "<selected-model>" }`。
4. **断开还原**：在 Magpie 中关闭 Delta 开关时，由 Magpie 自动清理注入配置并完整恢复用户的原有设置。

---

## 📄 License

MIT © [KuaaMU](https://github.com/KuaaMU)
