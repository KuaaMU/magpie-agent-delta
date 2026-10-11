// Delta (delta.dev by Zed Industries) as a magpie coding agent.
// Settings are stored in settings.json:
// - Windows: %APPDATA%/delta/settings.json
// - macOS / Linux: ~/.config/delta/settings.json
//
// Models are exposed through language_models.openai_compatible.magpie,
// and chosen in agent.default_model { provider: "magpie", model: "<id>" }.

export const agent = {
  id: "delta",
  name: "Delta",
  bin: "delta",
  config: "$APPDATA/delta/settings.json",
  format: "json",
  model: "agent.default_model.model",
  ua: ["delta", "zed"],
  notice: "Restart Delta if the model picker does not update immediately.",
  icon: "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%233b82f6\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 2L2 22h20L12 2z\"/><path d=\"M12 8l5 10H7l5-10z\" fill=\"%233b82f6\" fill-opacity=\"0.2\"/></svg>",
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
  const available_models = (models || []).map((m) => {
    // Map reasoning effort: Zed/Delta supports minimal, low, medium, high
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

  return {
    "language_models.openai_compatible.magpie": {
      api_url: gateway.v1,
      available_models: available_models,
    },
    "agent.default_model.provider": "magpie",
  };
}
