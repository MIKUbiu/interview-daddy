const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { buildInvertedIndex, embedAll, hybridRank } = require('./retrieval');

// pdfjs-dist is ESM-only; load it lazily via dynamic import from this CJS module.
let _pdfjsLib = null;
async function getPdfjs() {
    if (!_pdfjsLib) {
        _pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return _pdfjsLib;
}

function pdfResourcePath(sub) {
    // pdf.js resource loaders want forward-slash paths with a trailing slash,
    // regardless of platform.
    return path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), sub).replace(/\\/g, '/') + '/';
}

async function extractPdfText(buffer) {
    const pdfjsLib = await getPdfjs();
    const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: pdfResourcePath('standard_fonts'),
        cMapUrl: pdfResourcePath('cmaps'),
        cMapPacked: true,
        useSystemFonts: true,
        isEvalSupported: false,
    }).promise;

    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n\n';
    }
    return text;
}

// ── Tuning knobs ──

const MAX_CHUNKS = 300;
const CHUNK_CHARS = 900; // target chunk size for prose (paragraph-packed, not line-based)
const CHUNK_OVERLAP_CHARS = 150;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB guard for oversized PDFs/docs
const TOP_K = 5;
const SNIPPET_CHAR_BUDGET = 3000; // per-turn injected notes budget

function getIndexPath() {
    return path.join(app.getPath('userData'), 'doc-index.json');
}

let activeIndex = null;

// ── Text extraction per file type ──

async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch {
        return null;
    }
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_BYTES) return null;

    try {
        if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
            return fs.readFileSync(filePath, 'utf8');
        }
        if (ext === '.docx') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }
        if (ext === '.pdf') {
            const buffer = fs.readFileSync(filePath);
            return await extractPdfText(buffer);
        }
    } catch (error) {
        console.error(`[DocIndex] Failed to extract text from ${filePath}:`, error.message);
        return null;
    }
    return null;
}

// ── Paragraph-aware chunking ──
// Prose doesn't have meaningful "lines" the way code does, so we pack whole
// paragraphs into ~900-char chunks instead of a blind sliding window, which
// keeps chunk boundaries from landing mid-sentence.

function splitParagraphs(text) {
    return text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

function chunkDocument(text, sourceName) {
    const paragraphs = splitParagraphs(text);
    const chunks = [];
    let current = [];
    let currentLen = 0;

    function flush() {
        if (!current.length) return;
        const chunkText = current.join('\n\n').trim();
        if (chunkText.length > 20) {
            chunks.push({ source: sourceName, text: chunkText, tokenSource: `${sourceName} ${chunkText}` });
        }
    }

    for (const para of paragraphs) {
        // A single paragraph longer than the target size gets hard-split.
        if (para.length > CHUNK_CHARS * 1.5) {
            flush();
            current = [];
            currentLen = 0;
            for (let i = 0; i < para.length; i += CHUNK_CHARS) {
                const slice = para.slice(i, i + CHUNK_CHARS);
                chunks.push({ source: sourceName, text: slice, tokenSource: `${sourceName} ${slice}` });
            }
            continue;
        }

        if (currentLen + para.length > CHUNK_CHARS && current.length > 0) {
            flush();
            // Carry the last paragraph forward as overlap context for the next chunk.
            const overlapPara = current[current.length - 1];
            current = overlapPara.length <= CHUNK_OVERLAP_CHARS ? [overlapPara] : [];
            currentLen = current.reduce((n, p) => n + p.length, 0);
        }

        current.push(para);
        currentLen += para.length;
    }
    flush();

    return chunks;
}

// ── Build & persist ──

async function buildDocIndex(filePaths, embedConfig, onProgress) {
    let chunks = [];
    const includedFiles = [];
    const skippedFiles = [];

    for (const filePath of filePaths) {
        const text = await extractText(filePath);
        if (!text || !text.trim()) {
            skippedFiles.push(path.basename(filePath));
            continue;
        }
        const sourceName = path.basename(filePath);
        const fileChunks = chunkDocument(text, sourceName);
        if (!fileChunks.length) {
            skippedFiles.push(sourceName);
            continue;
        }
        chunks.push(...fileChunks);
        includedFiles.push(sourceName);
        if (chunks.length >= MAX_CHUNKS) break;
    }
    chunks = chunks.slice(0, MAX_CHUNKS);

    const { inverted, idf } = buildInvertedIndex(chunks);

    let vectors = null;
    let embeddingError = null;
    if (chunks.length && embedConfig && embedConfig.apiKey) {
        try {
            vectors = await embedAll(
                chunks.map(c => c.tokenSource),
                embedConfig,
                onProgress
            );
        } catch (error) {
            console.error('[DocIndex] Embedding failed, falling back to keyword-only:', error.message);
            embeddingError = error.message;
            vectors = null;
        }
    }

    const index = {
        filePaths,
        builtAt: Date.now(),
        chunkCount: chunks.length,
        fileCount: includedFiles.length,
        includedFiles,
        skippedFiles,
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
        console.error('[DocIndex] Failed to persist index:', error.message);
    }

    return {
        chunkCount: chunks.length,
        fileCount: includedFiles.length,
        includedFiles,
        skippedFiles,
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

// ── Retrieval ──

async function retrieve(query, embedConfig) {
    const index = loadIndex();
    if (!index || !index.chunks.length || !query || !query.trim()) return null;

    const fused = await hybridRank(query, index, embedConfig);
    if (!fused.length) return null;

    const perFileCount = {};
    const picked = [];
    let charTotal = 0;

    for (const id of fused) {
        if (picked.length >= TOP_K) break;
        const chunk = index.chunks[id];
        if (!chunk) continue;
        perFileCount[chunk.source] = perFileCount[chunk.source] || 0;
        if (perFileCount[chunk.source] >= 2) continue;
        if (charTotal + chunk.text.length > SNIPPET_CHAR_BUDGET && picked.length > 0) break;
        picked.push(chunk);
        perFileCount[chunk.source]++;
        charTotal += chunk.text.length;
    }

    if (!picked.length) return null;

    const block = picked.map(c => `**${c.source}**\n${c.text}`).join('\n\n---\n\n');

    return `[Relevant notes from your personal documents, retrieved for this question]\n\n${block}`;
}

function getStatus() {
    const index = loadIndex();
    if (!index) return null;
    return {
        chunkCount: index.chunkCount,
        fileCount: index.fileCount,
        includedFiles: index.includedFiles,
        skippedFiles: index.skippedFiles,
        hasVectors: index.hasVectors,
        embeddingModel: index.embeddingModel,
        builtAt: index.builtAt,
    };
}

module.exports = { buildDocIndex, retrieve, clearIndex, getStatus };
