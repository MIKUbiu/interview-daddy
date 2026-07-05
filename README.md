# interview-daddy

A real-time AI assistant for interviews, sales calls, and meetings — screen + audio in, contextual answers out. This is a heavily modified fork of [sohzm/cheating-daddy](https://github.com/sohzm/cheating-daddy), stripped down to a single, simpler provider model and extended with project/document-aware answers.

## Based on

This project is a derivative work of [sohzm/cheating-daddy](https://github.com/sohzm/cheating-daddy), licensed under **GPL-3.0**. Per the license, this fork is also distributed under GPL-3.0 (see [LICENSE](LICENSE)). All credit for the original architecture, UI shell, and audio-capture pipeline goes to the upstream author.

### What's different from upstream

- **One provider model, not three.** The original supported BYOK (Gemini Live), a hosted Cloud mode, and Local (Ollama + Whisper). This fork removes BYOK and Local entirely and keeps only **Custom API** — point it at any OpenAI-compatible chat endpoint and any OpenAI-compatible `/audio/transcriptions` endpoint (SiliconFlow, DeepSeek, Moonshot, self-hosted, etc).
- **Project & document retrieval (RAG).** Load a project folder or personal documents (`.md`, `.txt`, `.docx`, `.pdf`) and the assistant retrieves relevant code/notes per question (hybrid keyword + vector search) instead of answering from the system prompt alone.
- **Working speech-language hint.** The language selector now actually biases the transcription model instead of being a vestigial, unused setting.
- **System tray.** Closing the window minimizes to tray instead of quitting; a real quit is one tray-menu click away.
- **Removed:** the BYOK/Local settings UI, Feedback and Help pages, the global keyboard-shortcut system (window movement, click-through, screenshot/start-session hotkey, response navigation hotkeys, emergency-erase hotkey), and the Gemini/Groq daily-usage rate-limit tracker that only made sense for the old free-tier BYOK flow.

None of this is meant to replace the upstream project — if you want the original multi-provider feature set, use [sohzm/cheating-daddy](https://github.com/sohzm/cheating-daddy) directly.

## Quick Start

```bash
git clone <this-repo-url>
cd interview-daddy
npm install
npm start
```

On first launch, go to the **Home** screen and fill in:

| Field | Example |
|---|---|
| API Base URL | `https://api.siliconflow.cn/v1` (any OpenAI-compatible endpoint) |
| API Key | your provider's key |
| Chat Model | `deepseek-v3.2` |
| STT Model | `FunAudioLLM/SenseVoiceSmall` |
| STT Base URL | same as API Base URL, or a different provider |
| STT API Key | same as API Key, or a different provider's key |

Then click **Start Session**. During a live session:
- The app listens to system audio (or mic, depending on Settings → Audio Mode) and answers automatically after each detected question.
- You can also type a message or click the screenshot button to ask about what's on screen.

> [!NOTE]
> During testing it won't answer if you just talk to yourself — simulate an interviewer actually asking a question through system audio.

## Optional: project & document context

Under **AI Context**:
- **Project Context** — pick a folder; it scans the README, dependency manifest, structure, and entry files for a project summary, and builds a searchable code index for implementation-detail questions.
- **Personal Documents** — add your resume, prep notes, etc. (`.md`/`.txt`/`.docx`/`.pdf`); relevant snippets are pulled in per question alongside code search.

Both use the same API key as your Chat/STT config for embeddings (`BAAI/bge-m3` by default via SiliconFlow) — if no embedding key is configured, retrieval falls back to keyword-only search automatically.

## Requirements

- Node.js + npm
- Electron-compatible OS (developed/tested on Windows; macOS/Linux inherited from upstream but not verified in this fork)
- Screen recording + microphone/audio permissions
- An OpenAI-compatible chat API key and an OpenAI-compatible speech-to-text API key

## License

GPL-3.0, inherited from and required by the upstream project. See [LICENSE](LICENSE).
