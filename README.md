# Yogic Life — Teacher Q&A Archive Bot (Free Version)

A password-gated chatbot that answers questions **only** from your teacher
discussion archive (the 6 curated `.md` files in `/knowledge`). This version
runs entirely on free tiers — no Anthropic API billing required.

## How it stays free

Instead of sending your whole ~168K-token archive to an LLM on every message
(which would cost money and also blow past most free-tier limits), this
version does a **local search step first**:

1. `api/retrieval.js` splits the archive into individual Q&A exchanges and
   does a simple, fast keyword search (no external calls, no cost) to find
   the 5 exchanges most relevant to the current question.
2. Only those few exchanges (a few thousand tokens, not 168K) get sent to
   **Groq's free API** (running Llama 3.3 70B) to phrase into a natural,
   conversational answer — strictly grounded in what was retrieved.

This is both free and, if anything, a stricter guarantee that answers come
only from your archive, since the model never even sees content beyond the
handful of retrieved excerpts.

**Honesty about "free":** Groq's free tier requires no credit card and has
no expiration, but it is rate-limited (roughly 30 requests/minute, 6,000
tokens/minute per model, ~1,000–14,400 requests/day depending on model —
Groq updates these occasionally). For a small group of students/teachers
asking occasional questions, you won't come close to these limits. If Groq
ever changes their free tier terms, you'd need to either accept new limits
or switch providers (Google's Gemini API free tier is a solid alternative
with a very similar setup).

---

## 1. Get a free Groq API key

1. Go to https://console.groq.com and sign up (email or Google account,
   no credit card needed).
2. Go to **API Keys** → **Create API Key**. Copy it somewhere safe.

## 2. Put this project on GitHub

1. Create a new repository on https://github.com (e.g. `yoga-qa-bot`).
   Private is fine — it doesn't affect who can use the deployed app.
2. Upload all files in this folder to that repo.

## 3. Deploy on Vercel (free)

1. Go to https://vercel.com and sign up using your GitHub account.
2. **Add New → Project** → select `yoga-qa-bot` → **Import**. Leave
   default settings.
3. Under **Environment Variables**, add:
   - `GROQ_API_KEY` → the key from step 1
   - `ACCESS_PASSWORD` → any password you choose, e.g. `yogiclife2026`
4. Click **Deploy**. You'll get a live URL like `yoga-qa-bot.vercel.app` —
   share that link + the password with your group.

## 4. Updating the knowledge base later

1. Clean a new WhatsApp export into a `.md` file the same way this archive
   was built (ask Claude to help).
2. Drop it into `/knowledge`.
3. Push to GitHub — Vercel redeploys automatically, and the new file is
   automatically included in the search step (no code changes needed).

## 5. Notes & limits

- **Access control**: one shared password for the whole group, checked
  server-side. Fine for a small trusted group; change the password if it
  leaks.
- **Search quality**: retrieval is keyword-based, not full AI semantic
  search — it works well for direct questions ("what did teacher say about
  X") but may miss very indirectly-phrased questions. If you notice this,
  let me know — it can be upgraded to embedding-based search later
  (still free, just a bit more setup) without changing anything else.
- **Rate limits**: if your group is unusually active at the exact same
  moment, some requests may briefly get a "please wait" message rather than
  an answer — this is Groq's free tier protecting itself, not a bug. It
  clears within seconds.
- **Strictness**: the model only ever sees the retrieved excerpts, so it
  has no ability to answer from outside knowledge for a question the
  archive addresses — though for genuinely unrelated questions, always
  double check it says "not covered" rather than improvising.
