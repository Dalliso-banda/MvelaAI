#!/usr/bin/env bash
# Greetings, thanks and unknown questions before verification now get proper, varied replies
# instead of the same "verify first" line. Run from the repo root.
set -euo pipefail
F=apps/api/src/agent.js
[ -f "$F" ] || { echo "Run this from your repo root (can't find $F)"; exit 1; }
node - "$F" <<'NODE'
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('GREETINGS')) { console.log('Already patched.'); process.exit(0); }
const start = s.indexOf("        if (accountish) patch(conv.id, { pending_message: safe, topic: TOPIC_BY_INTENT[intent] });");
const endMarker = 'kind: \'flow\' };';
const end = start < 0 ? -1 : s.indexOf(endMarker, s.indexOf('reply = { text: accountish', start));
if (start < 0 || end < 0) { console.error("Couldn't find the block to replace in agent.js. Send me that part of the file and I'll give you the exact edit."); process.exit(1); }
const stop = end + endMarker.length;
const replacement = `        if (accountish) {
          patch(conv.id, { pending_message: safe, topic: TOPIC_BY_INTENT[intent], state: 'awaiting_phone' });
          reply = { text: "I can help with that. First I need to verify it's you. What mobile number is registered on your account? (e.g. 0976 000 001)", kind: 'flow' };
        } else if (intent === 'greeting' || intent === 'thanks') {
          const GREETINGS = [
            'Hello! I can check your balance, recent transactions and failed or pending transfers, or answer general questions. What would you like help with?',
            "Hi there. What can I help you with today? Try something like 'what is my balance' or 'my transfer failed'.",
            "Hello again. Just tell me what you need, and if it's about your account I'll verify you first.",
          ];
          const n = db.prepare("SELECT COUNT(*) c FROM messages WHERE conversation_id=? AND role='customer'").get(conv.id).c;
          reply = { text: intent === 'thanks' ? "You're welcome! Is there anything else I can help with?" : GREETINGS[(n - 1) % GREETINGS.length], kind: 'flow' };
        } else {
          reply = { text: "I couldn't find that in our general information. If it's about your account, tell me the mobile number registered on it and I'll verify you first. Or say 'speak to a human' and I'll pass you to an agent.", kind: 'flow' };
        }`;
s = s.slice(0, start) + replacement + s.slice(stop);
fs.writeFileSync(f, s);
console.log('Patched ' + f);
NODE
echo "Done. Restart 'npm run dev' and say hello again."
