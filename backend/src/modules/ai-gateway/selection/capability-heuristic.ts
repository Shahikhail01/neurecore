/**
 * Phase 2.8 — capability heuristic for model discovery.
 *
 * Given a model id (e.g. "deepseek-chat"), infer which capabilities
 * the model is most likely suitable for. Conservative default;
 * admins can override per-model after.
 *
 * Order of checks matters (most-specific first).
 */
export function guessCapabilities(modelId: string): string[] {
  const m = modelId.toLowerCase();
  if (/(embed|embedding)/.test(m)) return ['embedding'];
  if (/(reason|r1|o1|o3|thinking)/.test(m)) {
    return ['reasoning', 'planning', 'evaluation'];
  }
  if (/(coder|code-|codex)/.test(m)) {
    return ['coding', 'tools'];
  }
  if (/(vision|vl|4v|multimodal)/.test(m)) {
    return ['conversation', 'planning', 'evaluation', 'tools'];
  }
  return ['conversation', 'planning', 'execution', 'evaluation', 'tools'];
}