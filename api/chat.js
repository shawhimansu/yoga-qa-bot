// Vercel Serverless Function: /api/chat
// Uses the Claude API (Claude Sonnet 5) + local keyword retrieval over the
// Q&A archive, so only the relevant excerpts are sent per question —
// keeping costs low despite using a paid, higher-quality model.

const { search, loadExchanges } = require('./retrieval');

const SYSTEM_INSTRUCTIONS = `You are a Q&A assistant for a yoga philosophy teaching archive. You must answer ONLY using the retrieved archive excerpts provided below for this specific question — these are real Q&A exchanges between yoga teachers and students.

STRICT RULES:
- Do not use any outside knowledge, general training knowledge, or anything beyond the excerpts below.
- If the excerpts don't actually answer the question, say clearly: "This isn't covered in the archive." Do not guess or fill gaps with generic yoga knowledge.
- Mention which source file the answer is drawn from when possible.
- Stay grounded in the actual wording/teaching from the excerpts rather than inventing generic explanations.

ANSWER STYLE:
- Give a full, thorough answer, not a one-line summary. Explain the reasoning and context the teacher gave, not just the conclusion.
- If multiple excerpts touch on the question from different angles, weave them together into one coherent, well-developed answer rather than picking only the shortest relevant line.
- It's fine to be as long as the material supports — err on the side of completeness rather than brevity.`;

const CLAUDE_MODEL = 'claude-sonnet-5';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, messages } = req.body || {};

  if (!process.env.ACCESS_PASSWORD || password !== process.env.ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUserMessage ? lastUserMessage.content : '';

  const allExchanges = loadExchanges();
  if (!allExchanges || allExchanges.length === 0) {
    return res.status(500).json({
      error: 'The knowledge base could not be loaded on the server (0 exchanges found). ' +
             'This usually means the /knowledge folder wasn\'t deployed with the function — ' +
             'check that vercel.json includes "includeFiles": "knowledge/**" and redeploy.',
    });
  }

  // Retrieve more excerpts and allow more total context (still cheap with Claude Sonnet 5)
  const retrieved = search(query, 10, 20000);
  const context = retrieved.length
    ? retrieved.map((r, i) => `[Excerpt ${i + 1} — source: ${r.source}]\n${r.text}`).join('\n\n---\n\n')
    : '(No matching excerpts were found in the archive for this question.)';

  const systemPrompt = `${SYSTEM_INSTRUCTIONS}\n\nRETRIEVED ARCHIVE EXCERPTS:\n\n${context}`;

  const trimmedMessages = messages.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: trimmedMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      const status = response.status === 429 ? 429 : response.status;
      const msg = status === 429
        ? 'The service is briefly at capacity — please wait a few seconds and try again.'
        : (data.error?.message || 'API error');
      return res.status(status).json({ error: msg });
    }

    const textBlock = data.content?.find(b => b.type === 'text');
    const reply = textBlock?.text || '(no response)';
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error, please try again.' });
  }
};
