const { getSystemPrompt } = require('./prompts');
const { sendToRenderer, initializeNewSession, saveConversationTurn } = require('./gemini');
const codeIndex = require('./codeIndex');
const docIndex = require('./docIndex');
const storage = require('../storage');

// ── State ──

let localConversationHistory = [];
let currentSystemPrompt = null;
let isSessionActive = false;

// Custom OpenAI-compatible API config, set on session init.
let customLlmConfig = null; // { baseUrl, apiKey, model }
let customSttConfig = null; // { baseUrl, apiKey, model }

// VAD state
let isSpeaking = false;
let speechBuffers = [];
let silenceFrameCount = 0;
let speechFrameCount = 0;

// VAD configuration
const VAD_MODES = {
    NORMAL: { energyThreshold: 0.01, speechFramesRequired: 3, silenceFramesRequired: 30 },
    LOW_BITRATE: { energyThreshold: 0.008, speechFramesRequired: 4, silenceFramesRequired: 35 },
    AGGRESSIVE: { energyThreshold: 0.015, speechFramesRequired: 2, silenceFramesRequired: 20 },
    VERY_AGGRESSIVE: { energyThreshold: 0.02, speechFramesRequired: 2, silenceFramesRequired: 15 },
};
let vadConfig = VAD_MODES.VERY_AGGRESSIVE;

// Audio resampling buffer
let resampleRemainder = Buffer.alloc(0);

// ── Audio Resampling (24kHz → 16kHz) ──

function resample24kTo16k(inputBuffer) {
    // Combine with any leftover samples from previous call
    const combined = Buffer.concat([resampleRemainder, inputBuffer]);
    const inputSamples = Math.floor(combined.length / 2); // 16-bit = 2 bytes per sample
    // Ratio: 16000/24000 = 2/3, so for every 3 input samples we produce 2 output samples
    const outputSamples = Math.floor((inputSamples * 2) / 3);
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
        // Map output sample index to input position
        const srcPos = (i * 3) / 2;
        const srcIndex = Math.floor(srcPos);
        const frac = srcPos - srcIndex;

        const s0 = combined.readInt16LE(srcIndex * 2);
        const s1 = srcIndex + 1 < inputSamples ? combined.readInt16LE((srcIndex + 1) * 2) : s0;
        const interpolated = Math.round(s0 + frac * (s1 - s0));
        outputBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
    }

    // Store remainder for next call
    const consumedInputSamples = Math.ceil((outputSamples * 3) / 2);
    const remainderStart = consumedInputSamples * 2;
    resampleRemainder = remainderStart < combined.length ? combined.slice(remainderStart) : Buffer.alloc(0);

    return outputBuffer;
}

// ── VAD (Voice Activity Detection) ──

function calculateRMS(pcm16Buffer) {
    const samples = pcm16Buffer.length / 2;
    if (samples === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples; i++) {
        const sample = pcm16Buffer.readInt16LE(i * 2) / 32768;
        sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / samples);
}

function processVAD(pcm16kBuffer) {
    const rms = calculateRMS(pcm16kBuffer);
    const isVoice = rms > vadConfig.energyThreshold;

    if (isVoice) {
        speechFrameCount++;
        silenceFrameCount = 0;

        if (!isSpeaking && speechFrameCount >= vadConfig.speechFramesRequired) {
            isSpeaking = true;
            speechBuffers = [];
            console.log('[LocalAI] Speech started (RMS:', rms.toFixed(4), ')');
            sendToRenderer('update-status', 'Listening... (speech detected)');
        }
    } else {
        silenceFrameCount++;
        speechFrameCount = 0;

        if (isSpeaking && silenceFrameCount >= vadConfig.silenceFramesRequired) {
            isSpeaking = false;
            console.log('[LocalAI] Speech ended, accumulated', speechBuffers.length, 'chunks');
            sendToRenderer('update-status', 'Transcribing...');

            // Trigger transcription with accumulated audio
            const audioData = Buffer.concat(speechBuffers);
            speechBuffers = [];
            handleSpeechEnd(audioData);
            return;
        }
    }

    // Accumulate audio during speech
    if (isSpeaking) {
        speechBuffers.push(Buffer.from(pcm16kBuffer));
    }
}

// ── STT via API ──

function pcm16ToWav(pcm16Buffer, sampleRate = 16000) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm16Buffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write('data', 36);
    header.writeUInt32LE(pcm16Buffer.length, 40);
    return Buffer.concat([header, pcm16Buffer]);
}

async function transcribeAudio(pcm16kBuffer) {
    try {
        const wav = pcm16ToWav(pcm16kBuffer);
        const form = new FormData();
        form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
        form.append('model', customSttConfig.model);
        // Omitting language lets the model auto-detect; passing a hint measurably
        // improves accuracy on ambiguous audio (verified: same clip transcribed
        // differently with language=zh vs language=en).
        if (customSttConfig.language && customSttConfig.language !== 'auto') {
            form.append('language', customSttConfig.language);
        }

        const res = await fetch(`${customSttConfig.baseUrl}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${customSttConfig.apiKey}` },
            body: form,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`STT API ${res.status}: ${errText.substring(0, 200)}`);
        }

        const result = await res.json();
        const text = (result.text || '').trim();
        console.log('[LocalAI] API transcription:', text);
        return text;
    } catch (error) {
        console.error('[LocalAI] API transcription error:', error);
        sendToRenderer('update-status', 'STT error: ' + error.message);
        return null;
    }
}

// ── Speech End Handler ──

async function handleSpeechEnd(audioData) {
    if (!isSessionActive) return;

    // Minimum audio length check (~0.5 seconds at 16kHz, 16-bit)
    if (audioData.length < 16000) {
        console.log('[LocalAI] Audio too short, skipping');
        sendToRenderer('update-status', 'Listening...');
        return;
    }

    const transcription = await transcribeAudio(audioData);

    if (!transcription || transcription.trim() === '' || transcription.trim().length < 2) {
        console.log('[LocalAI] Empty transcription, skipping');
        sendToRenderer('update-status', 'Listening...');
        return;
    }

    sendToRenderer('update-status', 'Generating response...');
    await sendToCustomLLM(transcription);
}

// ── Code retrieval (per-turn, not stored in conversation history) ──

function getEmbedConfig() {
    try {
        const prefs = storage.getPreferences();
        const creds = storage.getCredentials();
        if (!creds.customSttApiKey) return null;
        return {
            baseUrl: (prefs.embeddingBaseUrl || 'https://api.siliconflow.cn/v1').replace(/\/+$/, ''),
            apiKey: creds.customSttApiKey,
            model: prefs.embeddingModel || 'BAAI/bge-m3',
        };
    } catch {
        return null;
    }
}

// Retrieves from the code index and the personal-documents index in parallel
// and stitches whatever comes back into one block. Either can independently
// be disabled or simply have nothing loaded — both are treated as "no result".
async function maybeRetrieveContext(query) {
    try {
        const prefs = storage.getPreferences();
        const embedConfig = getEmbedConfig();

        const [codeBlock, docBlock] = await Promise.all([
            prefs.codeSearchEnabled === false ? null : codeIndex.retrieve(query, embedConfig).catch(() => null),
            prefs.docSearchEnabled === false ? null : docIndex.retrieve(query, embedConfig).catch(() => null),
        ]);

        return [codeBlock, docBlock].filter(Boolean).join('\n\n');
    } catch (error) {
        console.error('[LocalAI] Context retrieval error:', error);
        return '';
    }
}

// Builds the messages array for one API call: system prompt + prior history +
// the current user turn, with retrieved code/notes (if any) folded into that
// turn's content only — localConversationHistory itself stays free of bloat.
async function buildMessagesWithRetrieval(query) {
    const retrieval = await maybeRetrieveContext(query);
    const lastIdx = localConversationHistory.length - 1;
    const lastMessage = localConversationHistory[lastIdx];

    const finalUserMessage = retrieval
        ? { ...lastMessage, content: `${retrieval}\n\n---\n\nInterviewer question: ${query.trim()}` }
        : lastMessage;

    return [
        { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
        ...localConversationHistory.slice(0, lastIdx),
        finalUserMessage,
    ];
}

// ── Custom OpenAI-compatible Chat ──

async function streamCustomChat(messages) {
    const res = await fetch(`${customLlmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customLlmConfig.apiKey}`,
        },
        body: JSON.stringify({
            model: customLlmConfig.model,
            messages,
            stream: true,
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM API ${res.status}: ${errText.substring(0, 200)}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let isFirst = true;

    for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            let parsed;
            try {
                parsed = JSON.parse(payload);
            } catch {
                continue;
            }

            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
                fullText += token;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }
    }

    return fullText;
}

async function sendToCustomLLM(transcription) {
    console.log('[LocalAI] Sending to custom API:', transcription.substring(0, 100) + '...');

    localConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    if (localConversationHistory.length > 20) {
        localConversationHistory = localConversationHistory.slice(-20);
    }

    try {
        const messages = await buildMessagesWithRetrieval(transcription);

        const fullText = await streamCustomChat(messages);

        if (fullText.trim()) {
            localConversationHistory.push({
                role: 'assistant',
                content: fullText.trim(),
            });

            saveConversationTurn(transcription, fullText);
        }

        console.log('[LocalAI] Custom API response completed');
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('[LocalAI] Custom API error:', error);
        sendToRenderer('update-status', 'API error: ' + error.message);
    }
}

// ── Public API ──

async function initializeCustomSession(config, profile, customPrompt) {
    console.log('[LocalAI] Initializing custom API session:', {
        baseUrl: config.baseUrl,
        model: config.model,
        sttModel: config.sttModel,
    });

    sendToRenderer('session-initializing', true);

    try {
        currentSystemPrompt = getSystemPrompt(profile, customPrompt, false);

        customLlmConfig = {
            baseUrl: (config.baseUrl || '').trim().replace(/\/+$/, ''),
            apiKey: (config.apiKey || '').trim(),
            model: config.model,
        };

        if (!customLlmConfig.baseUrl || !customLlmConfig.model) {
            sendToRenderer('session-initializing', false);
            sendToRenderer('update-status', 'Custom API base URL and model are required');
            customLlmConfig = null;
            return false;
        }

        customSttConfig = {
            baseUrl: ((config.sttBaseUrl || '').trim() || customLlmConfig.baseUrl).replace(/\/+$/, ''),
            apiKey: (config.sttApiKey || '').trim() || customLlmConfig.apiKey,
            model: config.sttModel || 'FunAudioLLM/SenseVoiceSmall',
            language: config.sttLanguage || 'auto',
        };

        // Reset VAD state
        isSpeaking = false;
        speechBuffers = [];
        silenceFrameCount = 0;
        speechFrameCount = 0;
        resampleRemainder = Buffer.alloc(0);
        localConversationHistory = [];

        // Initialize conversation session
        initializeNewSession(profile, customPrompt);

        isSessionActive = true;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Custom API ready - Listening...');

        console.log('[LocalAI] Custom API session initialized successfully');
        return true;
    } catch (error) {
        console.error('[LocalAI] Custom API initialization error:', error);
        customLlmConfig = null;
        customSttConfig = null;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Custom API error: ' + error.message);
        return false;
    }
}

function processLocalAudio(monoChunk24k) {
    if (!isSessionActive) return;

    // Resample from 24kHz to 16kHz
    const pcm16k = resample24kTo16k(monoChunk24k);
    if (pcm16k.length > 0) {
        processVAD(pcm16k);
    }
}

function closeLocalSession() {
    console.log('[LocalAI] Closing session');
    isSessionActive = false;
    isSpeaking = false;
    speechBuffers = [];
    silenceFrameCount = 0;
    speechFrameCount = 0;
    resampleRemainder = Buffer.alloc(0);
    localConversationHistory = [];
    customLlmConfig = null;
    customSttConfig = null;
    currentSystemPrompt = null;
}

function isLocalSessionActive() {
    return isSessionActive;
}

async function sendLocalText(text) {
    if (!isSessionActive || !customLlmConfig) {
        return { success: false, error: 'No active session' };
    }

    try {
        await sendToCustomLLM(text);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendLocalImage(base64Data, prompt) {
    if (!isSessionActive || !customLlmConfig) {
        return { success: false, error: 'No active session' };
    }

    console.log('[LocalAI] Sending image to custom API');
    sendToRenderer('update-status', 'Analyzing image...');

    const userMessage = {
        role: 'user',
        content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
        ],
    };

    // Store text-only version in history
    localConversationHistory.push({ role: 'user', content: prompt });

    if (localConversationHistory.length > 20) {
        localConversationHistory = localConversationHistory.slice(-20);
    }

    const messages = [
        { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
        ...localConversationHistory.slice(0, -1),
        userMessage,
    ];

    try {
        const fullText = await streamCustomChat(messages);

        if (fullText.trim()) {
            localConversationHistory.push({ role: 'assistant', content: fullText.trim() });
            saveConversationTurn(prompt, fullText);
        }

        console.log('[LocalAI] Custom API image response completed');
        sendToRenderer('update-status', 'Listening...');
        return { success: true, text: fullText, model: customLlmConfig.model };
    } catch (error) {
        console.error('[LocalAI] Custom API image error:', error);
        sendToRenderer('update-status', 'API error: ' + error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initializeCustomSession,
    processLocalAudio,
    closeLocalSession,
    isLocalSessionActive,
    sendLocalText,
    sendLocalImage,
};
