// Shared primitives for hybrid (keyword + vector) retrieval, used by both
// codeIndex.js (project source) and docIndex.js (personal documents).

const RRF_K = 60; // reciprocal rank fusion constant
const EMBED_BATCH_SIZE = 16;

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'are', 'was', 'were', 'has',
    'have', 'not', 'you', 'your', 'function', 'return', 'const', 'let', 'var', 'import', 'export',
    'class', 'public', 'private', 'protected', 'static', 'void', 'null', 'undefined', 'true', 'false',
    'async', 'await', 'new', 'self', 'def', 'else', 'if', 'while',
]);

function tokenize(text) {
    const raw = text
        .replace(/[_-]/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9一-鿿]+/);
    const tokens = new Set();
    for (const t of raw) {
        const lower = t.toLowerCase();
        if (lower.length < 2 || lower.length > 30) continue;
        if (STOPWORDS.has(lower)) continue;
        if (/^\d+$/.test(lower)) continue;
        tokens.add(lower);
        // Also index individual CJK characters/bigrams since CJK text has no
        // word boundaries — this lets Chinese queries match Chinese chunks.
        if (/[一-鿿]/.test(lower) && lower.length > 1) {
            for (let i = 0; i < lower.length - 1; i++) {
                tokens.add(lower.slice(i, i + 2));
            }
        }
    }
    return tokens;
}

function buildInvertedIndex(chunks) {
    const inverted = {}; // token -> [chunkIndex]
    const tokenSets = [];
    for (let i = 0; i < chunks.length; i++) {
        const tokens = tokenize(chunks[i].tokenSource);
        tokenSets.push(tokens);
        for (const t of tokens) {
            if (!inverted[t]) inverted[t] = [];
            inverted[t].push(i);
        }
    }
    const N = chunks.length;
    const idf = {};
    for (const t in inverted) {
        idf[t] = Math.log(1 + N / (1 + inverted[t].length));
    }
    return { inverted, idf, tokenSets };
}

async function embedBatch(texts, embedConfig) {
    const res = await fetch(`${embedConfig.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${embedConfig.apiKey}`,
        },
        body: JSON.stringify({ model: embedConfig.model, input: texts }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Embeddings API ${res.status}: ${errText.substring(0, 200)}`);
    }
    const json = await res.json();
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map(d => d.embedding);
}

async function embedAll(textsForEmbedding, embedConfig, onProgress) {
    const vectors = new Array(textsForEmbedding.length);
    for (let i = 0; i < textsForEmbedding.length; i += EMBED_BATCH_SIZE) {
        const batch = textsForEmbedding.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await embedBatch(batch, embedConfig);
        for (let j = 0; j < embeddings.length; j++) {
            vectors[i + j] = embeddings[j];
        }
        if (onProgress) onProgress(Math.min(i + EMBED_BATCH_SIZE, textsForEmbedding.length), textsForEmbedding.length);
    }
    return vectors;
}

function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function keywordRanking(query, index) {
    const queryTokens = tokenize(query);
    const scores = new Map(); // chunkIdx -> score
    for (const t of queryTokens) {
        const ids = index.inverted[t];
        if (!ids) continue;
        const weight = index.idf[t] || 0;
        for (const id of ids) {
            scores.set(id, (scores.get(id) || 0) + weight);
        }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function vectorRanking(query, index, embedConfig) {
    if (!index.hasVectors || !index.vectors || !embedConfig || !embedConfig.apiKey) return null;
    try {
        const [queryVec] = await embedBatch([query], embedConfig);
        const sims = index.vectors.map((v, i) => [i, cosineSim(queryVec, v)]);
        sims.sort((a, b) => b[1] - a[1]);
        return sims.map(([id]) => id);
    } catch (error) {
        console.error('[Retrieval] Query embedding failed, using keyword-only ranking:', error.message);
        return null;
    }
}

function reciprocalRankFusion(rankingLists) {
    const scores = new Map();
    for (const ranking of rankingLists) {
        if (!ranking) continue;
        ranking.forEach((chunkId, rank) => {
            scores.set(chunkId, (scores.get(chunkId) || 0) + 1 / (RRF_K + rank + 1));
        });
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// Ranks all chunks in `index` (which must have .inverted/.idf and optionally
// .hasVectors/.vectors, as produced by buildInvertedIndex + embedAll) against
// `query`, combining keyword and vector signal via reciprocal rank fusion.
async function hybridRank(query, index, embedConfig) {
    const kwRanking = keywordRanking(query, index);
    const vecRanking = await vectorRanking(query, index, embedConfig);
    return reciprocalRankFusion([kwRanking, vecRanking]);
}

module.exports = {
    tokenize,
    buildInvertedIndex,
    embedBatch,
    embedAll,
    cosineSim,
    keywordRanking,
    vectorRanking,
    reciprocalRankFusion,
    hybridRank,
};
