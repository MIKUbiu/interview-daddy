import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

export class AICustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .unified-page {
                height: 100%;
            }
            .unified-wrap {
                height: 100%;
            }
            section.surface {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .form-grid {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .form-group.vertical {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            textarea.control {
                flex: 1;
                resize: none;
                overflow-y: auto;
                min-height: 0;
            }
            .project-row {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            .project-btn {
                padding: 7px 14px;
                border-radius: 6px;
                border: 1px solid var(--border-color, rgba(255,255,255,0.15));
                background: var(--bg-elevated, rgba(255,255,255,0.06));
                color: inherit;
                cursor: pointer;
                font-size: 12px;
            }
            .project-btn:hover {
                background: var(--bg-hover, rgba(255,255,255,0.12));
            }
            .project-btn.danger {
                border-color: rgba(255,90,90,0.4);
                color: #ff8a8a;
            }
            .project-status {
                font-size: 11px;
                opacity: 0.85;
                margin-top: 6px;
                line-height: 1.5;
                word-break: break-all;
            }
            .project-status.error {
                color: #ff8a8a;
            }
            .project-status .ok {
                color: #6ee787;
            }
            .project-status .error-inline {
                color: #ffb86c;
            }
            .code-search-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                font-size: 12px;
            }
            .doc-list {
                list-style: none;
                margin: 6px 0 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .doc-list li {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 11px;
                background: var(--bg-elevated, rgba(255,255,255,0.06));
                border-radius: 4px;
                padding: 4px 8px;
            }
            .doc-list .doc-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .doc-list .doc-remove {
                background: none;
                border: none;
                color: #ff8a8a;
                cursor: pointer;
                font-size: 13px;
                padding: 0 4px;
                flex-shrink: 0;
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        _context: { state: true },
        _projectPath: { state: true },
        _projectStats: { state: true },
        _scanning: { state: true },
        _projectError: { state: true },
        _embedProgress: { state: true },
        _codeSearchEnabled: { state: true },
        _docFiles: { state: true },
        _docStats: { state: true },
        _docScanning: { state: true },
        _docEmbedProgress: { state: true },
        _docError: { state: true },
        _docSearchEnabled: { state: true },
        _embeddingModel: { state: true },
        _embeddingBaseUrl: { state: true },
        _embeddingApiKey: { state: true },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this._context = '';
        this._projectPath = '';
        this._projectStats = null;
        this._scanning = false;
        this._projectError = '';
        this._embedProgress = null;
        this._codeSearchEnabled = true;
        this._docFiles = [];
        this._docStats = null;
        this._docScanning = false;
        this._docEmbedProgress = null;
        this._docError = '';
        this._docSearchEnabled = true;
        this._embeddingModel = 'BAAI/bge-m3';
        this._embeddingBaseUrl = 'https://api.siliconflow.cn/v1';
        this._embeddingApiKey = '';
        this._loadFromStorage();
    }

    connectedCallback() {
        super.connectedCallback();
        const ipc = this._ipc();
        if (ipc) {
            this._onEmbedProgress = (event, { done, total }) => {
                this._embedProgress = { done, total };
                this.requestUpdate();
            };
            ipc.on('code-index-progress', this._onEmbedProgress);

            this._onDocEmbedProgress = (event, { done, total }) => {
                this._docEmbedProgress = { done, total };
                this.requestUpdate();
            };
            ipc.on('doc-index-progress', this._onDocEmbedProgress);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        const ipc = this._ipc();
        if (ipc && this._onEmbedProgress) {
            ipc.removeListener('code-index-progress', this._onEmbedProgress);
        }
        if (ipc && this._onDocEmbedProgress) {
            ipc.removeListener('doc-index-progress', this._onDocEmbedProgress);
        }
    }

    async _loadFromStorage() {
        try {
            const prefs = await cheatingDaddy.storage.getPreferences();
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            this._context = prefs.customPrompt || '';
            this._projectPath = prefs.projectPath || '';
            this._codeSearchEnabled = prefs.codeSearchEnabled !== false;
            this._docFiles = prefs.docFilePaths || [];
            this._docSearchEnabled = prefs.docSearchEnabled !== false;
            this._embeddingModel = prefs.embeddingModel || 'BAAI/bge-m3';
            this._embeddingBaseUrl = prefs.embeddingBaseUrl || 'https://api.siliconflow.cn/v1';
            this._embeddingApiKey = creds.embeddingApiKey || '';
            // Reconstruct a light status line from stored context length if a project is loaded
            if (prefs.projectContext) {
                this._projectStats = { chars: prefs.projectContext.length };
            }
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading AI customize storage:', error);
        }
    }

    _ipc() {
        if (!window.require) return null;
        return window.require('electron').ipcRenderer;
    }

    async _handleLoadProject() {
        const ipc = this._ipc();
        if (!ipc) return;
        this._projectError = '';
        try {
            const sel = await ipc.invoke('select-project-dir');
            if (!sel.success) {
                if (!sel.canceled) this._projectError = sel.error || 'Could not open folder picker';
                this.requestUpdate();
                return;
            }
            this._scanning = true;
            this._embedProgress = null;
            this.requestUpdate();

            const res = await ipc.invoke('scan-project', sel.path);
            this._scanning = false;
            this._embedProgress = null;
            if (res.success) {
                this._projectPath = res.stats.path;
                this._projectStats = res.stats;
            } else {
                this._projectError = res.error || 'Scan failed';
            }
            this.requestUpdate();
        } catch (error) {
            this._scanning = false;
            this._embedProgress = null;
            this._projectError = error.message;
            this.requestUpdate();
        }
    }

    async _handleClearProject() {
        const ipc = this._ipc();
        if (!ipc) return;
        await ipc.invoke('clear-project-context');
        this._projectPath = '';
        this._projectStats = null;
        this._projectError = '';
        this.requestUpdate();
    }

    async _saveEmbeddingModel(val) {
        this._embeddingModel = val;
        await cheatingDaddy.storage.updatePreference('embeddingModel', val);
        this.requestUpdate();
    }

    async _saveEmbeddingBaseUrl(val) {
        this._embeddingBaseUrl = val;
        await cheatingDaddy.storage.updatePreference('embeddingBaseUrl', val);
        this.requestUpdate();
    }

    async _saveEmbeddingApiKey(val) {
        this._embeddingApiKey = val;
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            await cheatingDaddy.storage.setCredentials({ ...creds, embeddingApiKey: val });
        } catch (e) {}
        this.requestUpdate();
    }

    async _handleCodeSearchToggle(e) {
        this._codeSearchEnabled = e.target.checked;
        await cheatingDaddy.storage.updatePreference('codeSearchEnabled', this._codeSearchEnabled);
        this.requestUpdate();
    }

    async _handleAddDocs() {
        const ipc = this._ipc();
        if (!ipc) return;
        this._docError = '';
        try {
            const sel = await ipc.invoke('select-doc-files');
            if (!sel.success) {
                if (!sel.canceled) this._docError = sel.error || 'Could not open file picker';
                this.requestUpdate();
                return;
            }
            this._docScanning = true;
            this._docEmbedProgress = null;
            this.requestUpdate();

            const res = await ipc.invoke('add-doc-files', sel.paths);
            this._docScanning = false;
            this._docEmbedProgress = null;
            if (res.success) {
                this._docStats = res.stats;
                this._docFiles = (await cheatingDaddy.storage.getPreferences()).docFilePaths || [];
            } else {
                this._docError = res.error || 'Indexing failed';
            }
            this.requestUpdate();
        } catch (error) {
            this._docScanning = false;
            this._docEmbedProgress = null;
            this._docError = error.message;
            this.requestUpdate();
        }
    }

    async _handleRemoveDoc(filePath) {
        const ipc = this._ipc();
        if (!ipc) return;
        this._docScanning = true;
        this._docEmbedProgress = null;
        this.requestUpdate();

        const res = await ipc.invoke('remove-doc-file', filePath);
        this._docScanning = false;
        this._docEmbedProgress = null;
        if (res.success) {
            this._docStats = res.stats;
            this._docFiles = this._docFiles.filter(p => p !== filePath);
        } else {
            this._docError = res.error || 'Failed to remove document';
        }
        this.requestUpdate();
    }

    async _handleClearDocs() {
        const ipc = this._ipc();
        if (!ipc) return;
        await ipc.invoke('clear-doc-files');
        this._docFiles = [];
        this._docStats = null;
        this._docError = '';
        this.requestUpdate();
    }

    async _handleDocSearchToggle(e) {
        this._docSearchEnabled = e.target.checked;
        await cheatingDaddy.storage.updatePreference('docSearchEnabled', this._docSearchEnabled);
        this.requestUpdate();
    }

    _docBaseName(filePath) {
        return filePath.split(/[\\/]/).pop();
    }

    _handleProfileChange(e) {
        this.onProfileChange(e.target.value);
    }

    async _saveContext(val) {
        this._context = val;
        await cheatingDaddy.storage.updatePreference('customPrompt', val);
    }

    _renderProjectStatus() {
        if (this._projectError) {
            return html`<div class="project-status error">Error: ${this._projectError}</div>`;
        }
        if (this._scanning) {
            const p = this._embedProgress;
            return html`
                <div class="project-status">
                    Scanning project…
                    ${p ? html`<br />Embedding code chunks: ${p.done}/${p.total}` : ''}
                </div>
            `;
        }
        if (!this._projectPath && !this._projectStats) return '';
        const s = this._projectStats || {};
        const kb = s.chars ? Math.round(s.chars / 1024) : 0;
        return html`
            <div class="project-status">
                <span class="ok">✓ Loaded</span>
                ${this._projectPath ? html`<br />${this._projectPath}` : ''}
                ${s.tech && s.tech.length ? html`<br />Tech: ${s.tech.join(', ')}` : ''}
                ${s.chars ? html`<br />${kb} KB of project summary${s.hasReadme ? ' · README included' : ''}` : ''}
                ${s.chunkCount ? html`<br />Code search: ${s.chunkCount} chunks from ${s.fileCount} files
                    ${s.hasVectors ? '· semantic + keyword search' : '· keyword search only'}` : ''}
                ${s.embeddingError ? html`<br /><span class="error-inline">Embeddings unavailable, using keyword-only search (${s.embeddingError})</span>` : ''}
            </div>
        `;
    }

    _renderDocStatus() {
        if (this._docError) {
            return html`<div class="project-status error">Error: ${this._docError}</div>`;
        }
        if (this._docScanning) {
            const p = this._docEmbedProgress;
            return html`
                <div class="project-status">
                    Indexing documents…
                    ${p ? html`<br />Embedding chunks: ${p.done}/${p.total}` : ''}
                </div>
            `;
        }
        if (!this._docStats) return '';
        const s = this._docStats;
        return html`
            <div class="project-status">
                ${s.chunkCount ? html`<span class="ok">✓</span> ${s.chunkCount} chunks from ${s.fileCount} document(s)
                    ${s.hasVectors ? '· semantic + keyword search' : '· keyword search only'}` : ''}
                ${s.skippedFiles && s.skippedFiles.length ? html`<br /><span class="error-inline">Skipped (couldn't read): ${s.skippedFiles.join(', ')}</span>` : ''}
                ${s.embeddingError ? html`<br /><span class="error-inline">Embeddings unavailable, using keyword-only search (${s.embeddingError})</span>` : ''}
            </div>
        `;
    }

    _getProfileName(profile) {
        const names = {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
        return names[profile] || profile;
    }

    render() {
        const profiles = [
            { value: 'interview', label: 'Job Interview' },
            { value: 'sales', label: 'Sales Call' },
            { value: 'meeting', label: 'Business Meeting' },
            { value: 'presentation', label: 'Presentation' },
            { value: 'negotiation', label: 'Negotiation' },
            { value: 'exam', label: 'Exam Assistant' },
        ];

        return html`
            <div class="unified-page">
                <div class="unified-wrap">
                    <div>
                        <div class="page-title">AI Context</div>
                    </div>

                    <section class="surface">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Profile</label>
                                <select class="control" .value=${this.selectedProfile} @change=${this._handleProfileChange}>
                                    ${profiles.map(profile => html`<option value=${profile.value}>${profile.label}</option>`)}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Embedding Model</label>
                                <input
                                    class="control"
                                    type="text"
                                    placeholder="BAAI/bge-m3"
                                    .value=${this._embeddingModel}
                                    @input=${e => this._saveEmbeddingModel(e.target.value)}
                                />
                                <div class="form-help">Used to power semantic search over your project code and documents (below). Falls back to keyword-only search if unset or unreachable.</div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Embedding Base URL</label>
                                <input
                                    class="control"
                                    type="text"
                                    placeholder="https://api.siliconflow.cn/v1"
                                    .value=${this._embeddingBaseUrl}
                                    @input=${e => this._saveEmbeddingBaseUrl(e.target.value)}
                                />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Embedding API Key</label>
                                <input
                                    class="control"
                                    type="password"
                                    placeholder="Optional — falls back to your STT API key if left blank"
                                    .value=${this._embeddingApiKey}
                                    @input=${e => this._saveEmbeddingApiKey(e.target.value)}
                                />
                                <div class="form-help">Only needed if embeddings use a different provider/account than STT (set on Home).</div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Project Context</label>
                                <div class="project-row">
                                    <button class="project-btn" @click=${this._handleLoadProject} ?disabled=${this._scanning}>
                                        ${this._scanning ? 'Scanning…' : (this._projectPath ? 'Change project folder' : 'Load project folder')}
                                    </button>
                                    ${this._projectPath ? html`
                                        <button class="project-btn danger" @click=${this._handleClearProject}>Clear</button>
                                    ` : ''}
                                </div>
                                ${this._renderProjectStatus()}
                                <div class="form-help">Scans README, dependencies, structure &amp; entry files so the AI can answer questions grounded in your real project.</div>
                                ${this._projectPath ? html`
                                    <label class="code-search-row">
                                        <input type="checkbox" .checked=${this._codeSearchEnabled} @change=${this._handleCodeSearchToggle} />
                                        Pull in matching code snippets when asked about implementation details
                                    </label>
                                ` : ''}
                            </div>

                            <div class="form-group">
                                <label class="form-label">Personal Documents</label>
                                <div class="project-row">
                                    <button class="project-btn" @click=${this._handleAddDocs} ?disabled=${this._docScanning}>
                                        ${this._docScanning ? 'Indexing…' : 'Add documents…'}
                                    </button>
                                    ${this._docFiles.length ? html`
                                        <button class="project-btn danger" @click=${this._handleClearDocs}>Clear all</button>
                                    ` : ''}
                                </div>
                                ${this._docFiles.length ? html`
                                    <ul class="doc-list">
                                        ${this._docFiles.map(f => html`
                                            <li>
                                                <span class="doc-name" title=${f}>${this._docBaseName(f)}</span>
                                                <button class="doc-remove" @click=${() => this._handleRemoveDoc(f)} title="Remove">✕</button>
                                            </li>
                                        `)}
                                    </ul>
                                ` : ''}
                                ${this._renderDocStatus()}
                                <div class="form-help">Resume, study notes, prep Q&amp;A — .md, .txt, .docx, .pdf. Retrieved snippets are pulled in per-question alongside code search.</div>
                                ${this._docFiles.length ? html`
                                    <label class="code-search-row">
                                        <input type="checkbox" .checked=${this._docSearchEnabled} @change=${this._handleDocSearchToggle} />
                                        Pull in matching notes when answering
                                    </label>
                                ` : ''}
                            </div>

                            <div class="form-group vertical">
                                <label class="form-label">Custom Instructions</label>
                                <textarea
                                    class="control"
                                    placeholder="Resume details, role requirements, constraints..."
                                    .value=${this._context}
                                    @input=${e => this._saveContext(e.target.value)}
                                ></textarea>
                                <div class="form-help">Sent as context at session start. Keep it short.</div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        `;
    }
}

customElements.define('ai-customize-view', AICustomizeView);
