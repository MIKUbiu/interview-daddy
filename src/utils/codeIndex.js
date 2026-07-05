const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { IGNORE_DIRS, CODE_EXT } = require('./projectScanner');
const { buildInvertedIndex, embedAll, hybridRank } = require('./retrieval');

// ── Tuning knobs ──

const MAX_CHUNKS = 300; // caps embedding cost/time for huge repos
const CHUNK_LINES = 60;
const CHUNK_STRIDE = 45; // 15-line overlap between consecutive chunks
const MAX_FILE_BYTES = 60000; // skip unusually large source files
const MAX_CHUNK_CHARS = 1200;
const TOP_K = 6;
const SNIPPET_CHAR_BUDGET = 4500; // per-turn injected code budget

function getIndexPath() {
    return path.join(app.getPath('userData'), 'code-index.json');
}

// In-memory copy of whatever was last built/loaded, so retrieval doesn't hit disk every turn.
let activeIndex = null;

// ── File walking & chunking ──

function collectSourceFiles(root) {
    const files = [];
    function walk(dir, depth) {
        if (depth > 8) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name)) continue;
                walk(full, depth + 1);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (CODE_EXT.has(ext)) files.push(full);
            }
        }
    }
    walk(root, 0);
    return files;
}

function chunkFile(root, filePath) {
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch {
        return [];
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES || stat.size === 0) return [];

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch {
        return [];
    }

    const lines = content.split('\n');
    // Skip likely-minified/binary-ish files (extremely long lines)
    if (lines.some(l => l.length > 2000)) return [];

    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    const chunks = [];
    for (let start = 0; start < lines.length; start += CHUNK_STRIDE) {
        const end = Math.min(start + CHUNK_LINES, lines.length);
        const text = lines.slice(start, end).join('\n').slice(0, MAX_CHUNK_CHARS);
        if (text.trim().length > 20) {
            chunks.push({ file: rel, startLine: start + 1, endLine: end, text, tokenSource: `${rel} ${text}` });
        }
        if (end >= lines.length) break;
    }
    return chunks;
}

// ── Build & persist ──

async function buildIndex(root, embedConfig, onProgress) {
    const files = collectSourceFiles(root);
    let chunks = [];
    for (const file of files) {
        chunks.push(...chunkFile(root, file));
        if (chunks.length >= MAX_CHUNKS) break;
    }
    chunks = chunks.slice(0, MAX_CHUNKS);

    const { inverted, idf } = buildInvertedIndex(chunks);

    let vectors = null;
    let embeddingError = null;
    if (embedConfig && embedConfig.apiKey) {
        try {
            vectors = await embedAll(
                chunks.map(c => c.tokenSource),
                embedConfig,
                onProgress
            );
        } catch (error) {
            console.error('[CodeIndex] Embedding failed, falling back to keyword-only:', error.message);
            embeddingError = error.message;
            vectors = null;
        }
    }

    const index = {
        root,
        builtAt: Date.now(),
        chunkCount: chunks.length,
        fileCount: files.length,
        hasVectors: !!vectors,
        embeddingModel: vectors ? embedConfig.model : null,
        chunks,
        inverted,
        idf,
        vectors,
    };

    activeIndex = index;

    try {
        fs.writeFileSync(getIndexPath(), JSON.stringify(index));
    } catch (error) {
        console.error('[CodeIndex] Failed to persist index:', error.message);
    }

    return {
        chunkCount: chunks.length,
        fileCount: files.length,
        hasVectors: !!vectors,
        embeddingModel: index.embeddingModel,
        embeddingError,
    };
}

function loadIndex() {
    if (activeIndex) return activeIndex;
    try {
        const raw = fs.readFileSync(getIndexPath(), 'utf8');
        activeIndex = JSON.parse(raw);
        return activeIndex;
    } catch {
        return null;
    }
}

function clearIndex() {
    activeIndex = null;
    try {
        fs.unlinkSync(getIndexPath());
    } catch {}
}

// ── Retrieval (hybrid: keyword + vector, combined via reciprocal rank fusion) ──

async function retrieve(query, embedConfig) {
    const index = loadIndex();
    if (!index || !index.chunks.length || !query || !query.trim()) return null;

    const fused = await hybridRank(query, index, embedConfig);
    if (!fused.length) return null;

    // Cap at 2 chunks per file for a bit of diversity, respect char budget.
    const perFileCount = {};
    const picked = [];
    let charTotal = 0;

    for (const id of fused) {
        if (picked.length >= TOP_K) break;
        const chunk = index.chunks[id];
        if (!chunk) continue;
        perFileCount[chunk.file] = perFileCount[chunk.file] || 0;
        if (perFileCount[chunk.file] >= 2) continue;
        if (charTotal + chunk.text.length > SNIPPET_CHAR_BUDGET && picked.length > 0) break;
        picked.push(chunk);
        perFileCount[chunk.file]++;
        charTotal += chunk.text.length;
    }

    if (!picked.length) return null;

    const block = picked
        .map(c => `**${c.file}:${c.startLine}-${c.endLine}**\n\`\`\`\n${c.text}\n\`\`\``)
        .join('\n\n');

    return `[Relevant code from the project, retrieved for this question]\n\n${block}`;
}

function getStatus() {
    const index = loadIndex();
    if (!index) return null;
    return {
        root: index.root,
        chunkCount: index.chunkCount,
        fileCount: index.fileCount,
        hasVectors: index.hasVectors,
        embeddingModel: index.embeddingModel,
        builtAt: index.builtAt,
    };
}

module.exports = { buildIndex, retrieve, clearIndex, getStatus };
