import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class MainView extends LitElement {
    static styles = css`
        * {
            font-family: var(--font);
            cursor: default;
            user-select: none;
            box-sizing: border-box;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: var(--space-xl) var(--space-lg);
        }

        .form-wrapper {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            gap: var(--space-md);
        }

        .page-title {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
            margin-bottom: var(--space-xs);
        }

        .page-subtitle {
            font-size: var(--font-size-sm);
            color: var(--text-muted);
            margin-bottom: var(--space-md);
        }

        /* ── Form controls ── */

        .form-group {
            display: flex;
            flex-direction: column;
            gap: var(--space-xs);
        }

        .form-label {
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-medium);
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input {
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 10px 12px;
            width: 100%;
            border-radius: var(--radius-sm);
            font-size: var(--font-size-sm);
            font-family: var(--font);
            transition: border-color var(--transition), box-shadow var(--transition);
        }

        input:hover:not(:focus) {
            border-color: var(--text-muted);
        }

        input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent);
        }

        input::placeholder {
            color: var(--text-muted);
        }

        input.error {
            border-color: var(--danger, #EF4444);
        }

        .form-hint {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
        }

        /* ── Start button ── */

        .start-button {
            position: relative;
            background: #e8e8e8;
            color: #111111;
            border: none;
            padding: 12px var(--space-md);
            border-radius: var(--radius-sm);
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-semibold);
            cursor: pointer;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-sm);
        }

        .start-button .btn-label {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
        }

        .start-button:hover {
            opacity: 0.9;
        }

        .start-button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .start-button.disabled:hover {
            opacity: 0.5;
        }

    `;

    static properties = {
        onStart: { type: Function },
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        isInitializing: { type: Boolean },
        // Custom API state
        _customBaseUrl: { state: true },
        _customApiKey: { state: true },
        _customModel: { state: true },
        _customSttBaseUrl: { state: true },
        _customSttApiKey: { state: true },
        _customSttModel: { state: true },
        _keyError: { state: true },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this.isInitializing = false;

        this._customBaseUrl = 'https://taotoken.net/api/v1';
        this._customApiKey = '';
        this._customModel = 'deepseek-v3.2';
        this._customSttBaseUrl = 'https://api.siliconflow.cn/v1';
        this._customSttApiKey = '';
        this._customSttModel = 'FunAudioLLM/SenseVoiceSmall';
        this._keyError = false;

        this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            const [prefs, creds] = await Promise.all([
                cheatingDaddy.storage.getPreferences(),
                cheatingDaddy.storage.getCredentials().catch(() => ({})),
            ]);

            this._customBaseUrl = prefs.customBaseUrl || 'https://taotoken.net/api/v1';
            this._customApiKey = creds.customApiKey || '';
            this._customModel = prefs.customModel || 'deepseek-v3.2';
            this._customSttBaseUrl = prefs.customSttBaseUrl || 'https://api.siliconflow.cn/v1';
            this._customSttApiKey = creds.customSttApiKey || '';
            this._customSttModel = prefs.customSttModel || 'FunAudioLLM/SenseVoiceSmall';

            this.requestUpdate();
        } catch (e) {
            console.error('Error loading MainView storage:', e);
        }
    }

    // ── Persistence ──

    async _saveCustomPref(key, prop, val) {
        this[prop] = val;
        await cheatingDaddy.storage.updatePreference(key, val);
        this.requestUpdate();
    }

    async _saveCustomApiKey(val) {
        this._customApiKey = val;
        this._keyError = false;
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            await cheatingDaddy.storage.setCredentials({ ...creds, customApiKey: val });
        } catch (e) {}
        this.requestUpdate();
    }

    async _saveCustomSttApiKey(val) {
        this._customSttApiKey = val;
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            await cheatingDaddy.storage.setCredentials({ ...creds, customSttApiKey: val });
        } catch (e) {}
        this.requestUpdate();
    }

    _handleProfileChange(e) {
        this.onProfileChange(e.target.value);
    }

    // ── Start ──

    _handleStart() {
        if (this.isInitializing) return;

        if (!this._customApiKey.trim() || !this._customBaseUrl.trim() || !this._customModel.trim()) {
            this._keyError = true;
            this.requestUpdate();
            return;
        }

        this.onStart();
    }

    triggerApiKeyError() {
        this._keyError = true;
        this.requestUpdate();
        setTimeout(() => {
            this._keyError = false;
            this.requestUpdate();
        }, 2000);
    }

    // ── Render helpers ──

    _renderStartButton() {
        return html`
            <button
                class="start-button ${this.isInitializing ? 'disabled' : ''}"
                @click=${() => this._handleStart()}
            >
                <span class="btn-label">Start Session</span>
            </button>
        `;
    }

    // ── Main render ──

    render() {
        return html`
            <div class="form-wrapper">
                <div class="page-title">Cheating Daddy</div>
                <div class="page-subtitle">Any OpenAI-compatible provider</div>

                <div class="form-group">
                    <label class="form-label">API Base URL</label>
                    <input
                        type="text"
                        placeholder="https://api.siliconflow.cn/v1"
                        .value=${this._customBaseUrl}
                        @input=${e => this._saveCustomPref('customBaseUrl', '_customBaseUrl', e.target.value)}
                    />
                    <div class="form-hint">Any OpenAI-compatible endpoint (SiliconFlow, DeepSeek, Moonshot, OpenAI...)</div>
                </div>

                <div class="form-group">
                    <label class="form-label">API Key</label>
                    <input
                        type="password"
                        placeholder="Required"
                        .value=${this._customApiKey}
                        @input=${e => this._saveCustomApiKey(e.target.value)}
                        class=${this._keyError ? 'error' : ''}
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">Chat Model</label>
                    <input
                        type="text"
                        placeholder="deepseek-ai/DeepSeek-V3"
                        .value=${this._customModel}
                        @input=${e => this._saveCustomPref('customModel', '_customModel', e.target.value)}
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">STT Model</label>
                    <input
                        type="text"
                        placeholder="FunAudioLLM/SenseVoiceSmall"
                        .value=${this._customSttModel}
                        @input=${e => this._saveCustomPref('customSttModel', '_customSttModel', e.target.value)}
                    />
                    <div class="form-hint">Called via /audio/transcriptions</div>
                </div>

                <div class="form-group">
                    <label class="form-label">STT Base URL</label>
                    <input
                        type="text"
                        placeholder="Same as API Base URL"
                        .value=${this._customSttBaseUrl}
                        @input=${e => this._saveCustomPref('customSttBaseUrl', '_customSttBaseUrl', e.target.value)}
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">STT API Key</label>
                    <input
                        type="password"
                        placeholder="Same as API Key"
                        .value=${this._customSttApiKey}
                        @input=${e => this._saveCustomSttApiKey(e.target.value)}
                    />
                </div>

                ${this._renderStartButton()}
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
