// Doc-slug → Smart Replay flow-key registry.
//
// Single source of truth read by:
//   - the get-doc skill (to decide if a doc can be fetched via Smart Replay
//     instead of LLM exploration)
//   - the MCP server (to validate the `replay` tool's `site` argument; see
//     run-flow.ts FLOWS for the matching flow modules)
//
// Add a new entry here when you ship a new flow module under flows/<domain>.ts.
// Slug must match the document filename under Collector/documents/<slug>.md.

export const DOC_TO_FLOW: Record<string, string> = {
  "form-106": "ita",
  "bituach-leumi-payments": "btl",
};

export function flowKeyForDoc(slug: string): string | undefined {
  return DOC_TO_FLOW[slug];
}
