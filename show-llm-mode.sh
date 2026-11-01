#!/usr/bin/env bash
# Makes it obvious which AI answered: logs the real provider, shows it in /api/health,
# the startup message and the dashboard's audit log. Run from the repo root.
set -euo pipefail
for f in apps/api/src/agent.js apps/api/src/routes.js apps/api/src/index.js apps/web/src/pages/dashboard/Conversations.jsx; do
  [ -f "$f" ] || { echo "Run this from your repo root (can't find $f)"; exit 1; }
done
node - <<'NODE'
const fs = require('fs');
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8'), n = 0;
  for (const [from, to] of pairs) {
    if (s.includes(to)) { continue; }                       // already applied
    if (!s.includes(from)) { console.log('SKIPPED (line not found, edit by hand): ' + file + '\n   looking for: ' + from.slice(0, 80)); continue; }
    s = s.replace(from, to); n++;
  }
  fs.writeFileSync(file, s);
  console.log((n ? 'Patched ' : 'Nothing to change in ') + file);
}
patch('apps/api/src/agent.js', [
  ["import { llmEnabled, runLLM } from './llm.js';", "import { llmEnabled, llmProvider, runLLM } from './llm.js';"],
  ["{ mode: 'gemini', tools: ctx.used }", "{ mode: llmProvider(), tools: ctx.used }"],
  ["{ error: String(e.message).slice(0, 200) });", "{ error: String(e.message).slice(0, 200) });\n      console.warn('[llm] FELL BACK to the rules agent:', e.message);"],
]);
patch('apps/api/src/routes.js', [
  ["import { llmEnabled } from './llm.js';", "import { llmEnabled, llmProvider } from './llm.js';"],
  ["agent: llmEnabled() ? 'gemini' : 'rules'", "agent: llmProvider() || 'rules'"],
]);
patch('apps/api/src/index.js', [
  ["import { llmEnabled } from './llm.js';", "import { llmEnabled, llmLabel } from './llm.js';"],
  ["${llmEnabled() ? 'Gemini (' + (process.env.GEMINI_MODEL || 'gemini-2.5-flash') + ')' : 'rules (set GEMINI_API_KEY for the LLM)'}", "${llmLabel()}"],
]);
patch('apps/web/src/pages/dashboard/Conversations.jsx', [
  ["{a.action}{a.detail?.tools?.length", "{a.action}{a.detail?.mode ? ` (${a.detail.mode})` : ''}{a.detail?.tools?.length"],
]);
NODE
echo
echo "Done. Restart 'npm run dev'. The startup line should now say: agent: Meta Muse (muse-spark-1.1)"
