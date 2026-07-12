// Vercel Serverless Function: /api/chat
// Uses Groq's free-tier API (Llama 3.3 70B) + local keyword retrieval over the
// Q&A archive, so only the relevant few exchanges are sent per question —
// keeping every request well within Groq's free-tier token limits.

const { search } = require('./retrieval');

const SYSTEM_INSTRUCTIONS = `You are a Q&A assistant for a yoga philosophy teaching archive. You must answer ONLY using the retrieved archive excerpts provided below for this specific question — these are real Q&A exchanges between yoga teachers and students.

STRICT RULES:
- Do not use any outside knowledge, general training knowledge, or anything beyond the excerpts below.
- If the excerpts don't actually answer the question, say clearly: "This isn't covered in the archive." Do not guess or fill gaps with generic yoga knowledge.
- Mention which source file the answer is drawn from when possible.
- Stay grounded in the actual wording/teaching from the excerpts rather than inventing generic explanations.`;

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

  // Retrieve only the relevant exchanges for this question (keeps token usage tiny)
  const retrieved = search(query, 5, 9000);
  const context = retrieved.length
    ? retrieved.map((r, i) => `[Excerpt ${i + 1} — source: ${r.source}]\n${r.text}`).join('\n\n---\n\n')
    : '(No matching excerpts were found in the archive for this question.)';

  const systemPrompt = `${SYSTEM_INSTRUCTIONS}\n\nRETRIEVED ARCHIVE EXCERPTS:\n\n${context}`;

  // Only keep the last 4 turns of conversation (2 exchanges) — free tier is token-limited
  const trimmedMessages = messages.slice(-4);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmedMessages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API error:', data);
      const status = response.status === 429 ? 429 : response.status;
      const msg = status === 429
        ? 'The free tier is briefly at capacity — please wait a few seconds and try again.'
        : (data.error?.message || 'API error');
      return res.status(status).json({ error: msg });
    }

    const reply = data.choices?.[0]?.message?.content || '(no response)';
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error, please try again.' });
  }
};
