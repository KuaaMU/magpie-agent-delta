// Delta (delta.dev by Zed Industries) as a magpie coding agent.
// Settings are stored in settings.json:
// - Windows: %APPDATA%/delta/settings.json
// - macOS / Linux: ~/.config/delta/settings.json
//
// Dual-mode compatibility:
// 1. Delta native custom provider: native.custom_providers
// 2. Zed-compatible engine: language_models.openai_compatible.magpie
// Model selection: agent.default_model { provider: "magpie", model: "<id>" }

export const agent = {
  id: "delta",
  name: "Delta",
  bin: "delta",
  config: "$APPDATA/delta/settings.json",
  format: "json",
  model: "agent.default_model.model",
  ua: ["delta", "zed"],
  notice: "Restart Delta if the model picker does not update immediately.",
  icon: "https://delta.dev/favicon.svg",
  library: {
    instructions: "$APPDATA/delta/AGENTS.md",
    mcp: "$APPDATA/delta/mcp.json",
    mcpFormat: "zed",
    skills: "$APPDATA/delta/skills",
  },
};

/**
 * Configure Delta to connect to magpie's local gateway.
 * @param {Object} context
 * @param {Object} context.gateway - { url, v1, key }
 * @param {Object} context.model - { id, name, context, output, efforts }
 * @param {Array} context.models - list of all active models in magpie
 */
export function connect({ gateway, model, models }) {
  const zedModels = (models || []).map((m) => {
    let effort = null;
    if (Array.isArray(m.efforts) && m.efforts.length > 0) {
      effort = m.efforts[m.efforts.length - 1];
    }

    const item = {
      name: m.id,
      display_name: m.name || m.id,
      max_tokens: m.context || 128000,
    };

    if (effort) {
      item.reasoning_effort = effort;
    }

    return item;
  });

  const deltaModels = (models || []).map((m) => {
    return {
      id: m.id,
      context_window: m.context || 128000,
      max_output_tokens: m.output || 16384,
      reasoning_efforts: Array.isArray(m.efforts) ? m.efforts : [],
      parallel_tool_calls: true,
      interleaved_reasoning: false,
    };
  });

  return {
    "language_models.openai_compatible.magpie": {
      api_url: gateway.v1,
      available_models: zedModels,
    },
    "native.custom_providers": [
      {
        name: "Magpie",
        base_url: gateway.v1,
        api_mode: "open_ai_chat_completions",
        headers: [
          {
            name: "Authorization",
            value: `Bearer ${gateway.key}`,
          },
        ],
        models: deltaModels,
      },
    ],
    "agent.default_model.provider": "magpie",
  };
}
