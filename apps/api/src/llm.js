// Gemini function-calling loop (plain fetch, no SDK). Tools are executed server-side
// with the verified customer's context, so the model cannot widen its own access.
import { TOOL_DECLARATIONS, runTool } from './tools.js';
import { scrubOutput } from './guardrails.js';

export const llmEnabled = () => Boolean(process.env.GEMINI_API_KEY);

function systemPrompt({ business, name, language }) {
  return `You are Mvela, the AI customer care assistant for ${business} in Zambia. Today is ${new Date().toDateString()}.
You are speaking with ${name}, whose identity has ALREADY been verified by one-time code.

Rules you must always follow:
- Reply in the language the customer writes in (English, Bemba or Nyanja). Last detected language: ${language}. Keep replies short, warm and clear, suitable for a phone screen. Amounts are in Zambian kwacha (K).
- Never state an account fact (balance, transaction, card status, fee, limit) unless it came from a tool result in this conversation. Never guess or invent.
- You are READ-ONLY. You cannot move money, block cards, change PINs or edit any record. For those, call escalate_to_human.
- Call escalate_to_human for fraud or suspected fraud (priority high), complaints, card blocking or replacement, any request you cannot fulfil, or when you are unsure.
- Never ask for, repeat or store PINs, passwords, one-time codes or full card numbers. If the customer shares one, tell them not to.
- When explaining a failed or pending transaction, give the reference, the reason and the next step from the tool result.
- If the tool says nothing was found, say so plainly rather than speculating.`;
}

export async function runLLM({ history, ctx, name, language, business }) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Gemini wants alternating roles; merge consecutive same-role turns.
  const contents = [];
  for (const m of history) {
    const role = m.role === 'customer' ? 'user' : 'model';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  if (!contents.length || contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(conversation started)' }] });

  for (let round = 0; round < 5; round++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    let data;
    try {
      const res = await fetch(url, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt({ business, name, language }) }] },
          contents,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      data = await res.json();
    } finally { clearTimeout(timer); }

    const content = data.candidates?.[0]?.content;
    const parts = content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts.map((p) => p.text || '').join('').trim();
      if (!text) throw new Error('Gemini returned no text');
      return scrubOutput(text);
    }
    contents.push(content); // keep model turn exactly as returned
    contents.push({
      role: 'user',
      parts: calls.map((c) => ({ functionResponse: { name: c.functionCall.name, response: { result: runTool(c.functionCall.name, c.functionCall.args, ctx) } } })),
    });
  }
  throw new Error('Too many tool rounds');
}
