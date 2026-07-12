// retrieval.js — lightweight keyword-based search over the Q&A archive.
// No embeddings, no external API calls: pure JS, runs instantly, costs nothing.

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','to','of','in',
  'on','for','and','or','but','with','as','at','by','from','that','this',
  'it','its','if','then','than','so','do','does','did','can','could','would',
  'should','will','shall','my','your','our','their','his','her','i','you',
  'he','she','we','they','what','why','how','when','where','who','which',
  'about','into','not','no','yes','please','namaskar','mahodaya','ji',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

// Load and split each knowledge file into individual exchanges
let EXCHANGES = null;

function loadExchanges() {
  if (EXCHANGES) return EXCHANGES;
  EXCHANGES = [];
  let files = [];
  try {
    files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
  } catch (e) {
    console.error('Could not read knowledge dir:', e);
    return EXCHANGES;
  }

  for (const file of files) {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
    const blocks = content.split(/\n## --- exchange --- ?\n/).slice(1); // drop header before first marker
    for (const block of blocks) {
      const text = block.trim();
      if (text.length < 40) continue;
      EXCHANGES.push({
        source: file,
        text,
        tokens: tokenize(text),
      });
    }
  }

  // Precompute document frequency for a crude IDF weighting
  const df = new Map();
  for (const ex of EXCHANGES) {
    const seen = new Set(ex.tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  EXCHANGES._df = df;
  EXCHANGES._n = EXCHANGES.length;
  return EXCHANGES;
}

// Rank exchanges by overlap with the query, weighted by rarity (crude TF-IDF)
function search(query, topK = 5, maxTotalChars = 9000) {
  const exchanges = loadExchanges();
  const df = exchanges._df || new Map();
  const n = exchanges._n || 1;
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const qSet = new Set(qTokens);
  const scored = exchanges.map(ex => {
    let score = 0;
    const exSet = new Set(ex.tokens);
    for (const t of qSet) {
      if (exSet.has(t)) {
        const docFreq = df.get(t) || 1;
        const idf = Math.log((n + 1) / docFreq);
        score += idf;
      }
    }
    return { ex, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const results = [];
  let totalChars = 0;
  for (const { ex, score } of scored) {
    if (score <= 0) break;
    if (results.length >= topK) break;
    if (totalChars + ex.text.length > maxTotalChars && results.length > 0) continue;
    results.push(ex);
    totalChars += ex.text.length;
  }
  return results;
}

module.exports = { search, loadExchanges };
