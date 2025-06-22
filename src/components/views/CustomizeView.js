import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class CustomizeView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            padding: 16px;
            margin: 0 auto;
        }

        .settings-container {
            display: grid;
            gap: 16px;
        }

        .settings-section {
            background: var(--card-background, rgba(255, 255, 255, 0.05));
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color);
        }

        .form-grid {
            display: grid;
            gap: 12px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
        }

        @media (max-width: 600px) {
            .form-row {
                grid-template-columns: 1fr;
            }
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .form-group.full-width {
            grid-column: 1 / -1;
        }

        .form-label {
            font-weight: 500;
            font-size: 13px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .form-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            line-height: 1.3;
            margin-top: 2px;
        }

        .form-control {
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.2));
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            transition: all 0.2s ease;
            min-height: 16px;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
            background: var(--input-focus-background, rgba(0, 0, 0, 0.4));
        }

        .form-control:hover:not(:focus) {
            border-color: var(--input-hover-border, rgba(255, 255, 255, 0.3));
        }

        select.form-control {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 8px center;
            background-repeat: no-repeat;
            background-size: 14px;
            padding-right: 28px;
        }

        textarea.form-control {
            resize: vertical;
            min-height: 80px;
            line-height: 1.4;
            font-family: inherit;
        }

        textarea.form-control::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
        }

        .profile-option {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .current-selection {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--success-color, #28a745);
            background: var(--success-background, rgba(40, 167, 69, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
        }

        .keybind-input {
            cursor: pointer;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            text-align: center;
            letter-spacing: 0.5px;
        }

        .keybind-input:focus {
            cursor: text;
            background: var(--input-focus-background, rgba(0, 122, 255, 0.1));
        }

        .keybind-input::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
        }

        .reset-keybinds-button {
            background: var(--button-background, rgba(255, 255, 255, 0.1));
            color: var(--text-color);
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.2));
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .reset-keybinds-button:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.3));
        }

        .reset-keybinds-button:active {
            transform: translateY(1px);
        }

        .keybinds-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        .keybinds-table th,
        .keybinds-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
        }

        .keybinds-table th {
            background: var(--table-header-background, rgba(255, 255, 255, 0.05));
            font-weight: 600;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .keybinds-table td {
            vertical-align: middle;
        }

        .keybinds-table .action-name {
            font-weight: 500;
            color: var(--text-color);
            font-size: 13px;
        }

        .keybinds-table .action-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            margin-top: 1px;
        }

        .keybinds-table .keybind-input {
            min-width: 120px;
            padding: 6px 10px;
            margin: 0;
            font-size: 12px;
        }

        .keybinds-table tr:hover {
            background: var(--table-row-hover, rgba(255, 255, 255, 0.02));
        }

        .keybinds-table tr:last-child td {
            border-bottom: none;
        }

        .table-reset-row {
            border-top: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
        }

        .table-reset-row td {
            padding-top: 12px;
            padding-bottom: 10px;
            border-bottom: none;
        }

        .settings-note {
            font-size: 11px;
            color: var(--note-color, rgba(255, 255, 255, 0.5));
            font-style: italic;
            text-align: center;
            margin-top: 12px;
            padding: 8px;
            background: var(--note-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px dashed var(--note-border, rgba(255, 255, 255, 0.1));
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }

        .checkbox-input {
            width: 16px;
            height: 16px;
            accent-color: var(--focus-border-color, #007aff);
            cursor: pointer;
        }

        .checkbox-label {
            font-weight: 500;
            font-size: 13px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            cursor: pointer;
            user-select: none;
        }

        .rate-limit-controls {
            margin-left: 24px;
            opacity: 0.6;
            transition: opacity 0.2s ease;
        }

        .rate-limit-controls.enabled {
            opacity: 1;
        }

        .rate-limit-reset {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
        }

        .rate-limit-warning {
            background: var(--warning-background, rgba(255, 193, 7, 0.1));
            border: 1px solid var(--warning-border, rgba(255, 193, 7, 0.3));
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 16px;
            font-size: 12px;
            color: var(--warning-color, #ffc107);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            line-height: 1.4;
        }

        .rate-limit-warning-icon {
            flex-shrink: 0;
            font-size: 14px;
        }
    `;

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        throttleTokens: { type: Boolean },
        maxTokensPerMin: { type: Number },
        throttleAtPercent: { type: Number },
        googleSearchEnabled: { type: Boolean },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onScreenshotIntervalChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => {};
        this.onLanguageChange = () => {};
        this.onScreenshotIntervalChange = () => {};
        this.onImageQualityChange = () => {};
        this.onLayoutModeChange = () => {};

        // Rate limiting defaults
        this.throttleTokens = true;
        this.maxTokensPerMin = 1000000;
        this.throttleAtPercent = 75;

        // Google Search default
        this.googleSearchEnabled = true;

        this.loadKeybinds();
        this.loadRateLimitSettings();
        this.loadGoogleSearchSettings();
    }

    connectedCallback() {
        super.connectedCallback();
        // Load layout mode for display purposes
        this.loadLayoutMode();
    }

    getProfiles() {
        return [
            {
                value: 'interview',
                name: 'Job Interview',
                description: 'Get help with answering interview questions',
            },
            {
                value: 'sales',
                name: 'Sales Call',
                description: 'Assist with sales conversations and objection handling',
            },
            {
                value: 'meeting',
                name: 'Business Meeting',
                description: 'Support for professional meetings and discussions',
            },
            {
                value: 'presentation',
                name: 'Presentation',
                description: 'Help with presentations and public speaking',
            },
            {
                value: 'negotiation',
                name: 'Negotiation',
                description: 'Guidance for business negotiations and deals',
            },
        ];
    }

    getLanguages() {
        return [
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (United States)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
        };
    }

    handleProfileSelect(e) {
        this.selectedProfile = e.target.value;
        localStorage.setItem('selectedProfile', this.selectedProfile);
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = e.target.value;
        localStorage.setItem('selectedLanguage', this.selectedLanguage);
        this.onLanguageChange(this.selectedLanguage);
    }

    handleScreenshotIntervalSelect(e) {
        this.selectedScreenshotInterval = e.target.value;
        localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        this.onScreenshotIntervalChange(this.selectedScreenshotInterval);
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(e.target.value);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        localStorage.setItem('layoutMode', this.layoutMode);
        this.onLayoutModeChange(e.target.value);
    }

    handleCustomPromptInput(e) {
        localStorage.setItem('customPrompt', e.target.value);
    }

    getDefaultKeybinds() {
        const isMac = window.cheddar?.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            manualScreenshot: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    saveKeybinds() {
        localStorage.setItem('customKeybinds', JSON.stringify(this.keybinds));
        // Send to main process to update global shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        localStorage.removeItem('customKeybinds');
        this.requestUpdate();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: 'Move Window Up',
                description: 'Move the application window up',
            },
            {
                key: 'moveDown',
                name: 'Move Window Down',
                description: 'Move the application window down',
            },
            {
                key: 'moveLeft',
                name: 'Move Window Left',
                description: 'Move the application window left',
            },
            {
                key: 'moveRight',
                name: 'Move Window Right',
                description: 'Move the application window right',
            },
            {
                key: 'toggleVisibility',
                name: 'Toggle Window Visibility',
                description: 'Show/hide the application window',
            },
            {
                key: 'toggleClickThrough',
                name: 'Toggle Click-through Mode',
                description: 'Enable/disable click-through functionality',
            },
            {
                key: 'nextStep',
                name: 'Ask Next Step',
                description: 'Ask AI for the next step suggestion',
            },
            {
                key: 'manualScreenshot',
                name: 'Manual Screenshot',
                description: 'Take a manual screenshot for AI analysis',
            },
        ];
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();

        const modifiers = [];
        const keys = [];

        // Check modifiers
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        // Get the main key
        let mainKey = e.key;

        // Handle special keys
        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            case 'KeyS':
                if (e.shiftKey) mainKey = 'S';
                break;
            case 'KeyM':
                mainKey = 'M';
                break;
            default:
                if (e.key.length === 1) {
                    mainKey = e.key.toUpperCase();
                }
                break;
        }

        // Skip if only modifier keys are pressed
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        // Construct keybind string
        const keybind = [...modifiers, mainKey].join('+');

        // Get the action from the input's data attribute
        const action = e.target.dataset.action;

        // Update the keybind
        this.handleKeybindChange(action, keybind);

        // Update the input value
        e.target.value = keybind;
        e.target.blur();
    }

    // Rate limiting methods
    loadRateLimitSettings() {
        const throttleTokens = localStorage.getItem('throttleTokens');
        const maxTokensPerMin = localStorage.getItem('maxTokensPerMin');
        const throttleAtPercent = localStorage.getItem('throttleAtPercent');

        if (throttleTokens !== null) {
            this.throttleTokens = throttleTokens === 'true';
        }
        if (maxTokensPerMin !== null) {
            this.maxTokensPerMin = parseInt(maxTokensPerMin, 10) || 1000000;
        }
        if (throttleAtPercent !== null) {
            this.throttleAtPercent = parseInt(throttleAtPercent, 10) || 75;
        }
    }

    handleThrottleTokensChange(e) {
        this.throttleTokens = e.target.checked;
        localStorage.setItem('throttleTokens', this.throttleTokens.toString());
        this.requestUpdate();
    }

    handleMaxTokensChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            this.maxTokensPerMin = value;
            localStorage.setItem('maxTokensPerMin', this.maxTokensPerMin.toString());
        }
    }

    handleThrottlePercentChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0 && value <= 100) {
            this.throttleAtPercent = value;
            localStorage.setItem('throttleAtPercent', this.throttleAtPercent.toString());
        }
    }

    resetRateLimitSettings() {
        this.throttleTokens = true;
        this.maxTokensPerMin = 1000000;
        this.throttleAtPercent = 75;

        localStorage.removeItem('throttleTokens');
        localStorage.removeItem('maxTokensPerMin');
        localStorage.removeItem('throttleAtPercent');

        this.requestUpdate();
    }

    loadGoogleSearchSettings() {
        const googleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        if (googleSearchEnabled !== null) {
            this.googleSearchEnabled = googleSearchEnabled === 'true';
        }
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        localStorage.setItem('googleSearchEnabled', this.googleSearchEnabled.toString());

        // Notify main process if available
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }

        this.requestUpdate();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode) {
            this.layoutMode = savedLayoutMode;
        }
    }

    render() {
        const profiles = this.getProfiles();
        const languages = this.getLanguages();
        const profileNames = this.getProfileNames();
        const currentProfile = profiles.find(p => p.value === this.selectedProfile);
        const currentLanguage = languages.find(l => l.value === this.selectedLanguage);

        return html`
            <div class="settings-container">
                <!-- Profile & Behavior Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>AI Profile & Behavior</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    Profile Type
                                    <span class="current-selection">✓ ${currentProfile?.name || 'Unknown'}</span>
                                </label>
                                <select class="form-control" .value=${this.selectedProfile} @change=${this.handleProfileSelect}>
                                    ${profiles.map(
                                        profile => html`
                                            <option value=${profile.value} ?selected=${this.selectedProfile === profile.value}>
                                                ${profile.name}
                                            </option>
                                        `
                                    )}
                                </select>
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <label class="form-label">Custom AI Instructions</label>
                            <textarea
                                class="form-control"
                                placeholder="Add specific instructions for how you want the AI to behave during ${profileNames[
                                    this.selectedProfile
                                ] || 'this interaction'}..."
                                .value=${localStorage.getItem('customPrompt') || ''}
                                rows="4"
                                @input=${this.handleCustomPromptInput}
                            ></textarea>
                            <div class="form-description">
                                Personalize the AI's behavior with specific instructions that will be added to the
                                ${profileNames[this.selectedProfile] || 'selected profile'} base prompts
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Language & Audio Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Language & Audio</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    Speech Language
                                    <span class="current-selection">✓ ${currentLanguage?.name || 'Unknown'}</span>
                                </label>
                                <select class="form-control" .value=${this.selectedLanguage} @change=${this.handleLanguageSelect}>
                                    ${languages.map(
                                        language => html`
                                            <option value=${language.value} ?selected=${this.selectedLanguage === language.value}>
                                                ${language.name}
                                            </option>
                                        `
                                    )}
                                </select>
                                <div class="form-description">Language for speech recognition and AI responses</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Interface Layout Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Interface Layout</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    Layout Mode
                                    <span class="current-selection">✓ ${this.layoutMode === 'compact' ? 'Compact' : 'Normal'}</span>
                                </label>
                                <select class="form-control" .value=${this.layoutMode} @change=${this.handleLayoutModeSelect}>
                                    <option value="normal" ?selected=${this.layoutMode === 'normal'}>Normal</option>
                                    <option value="compact" ?selected=${this.layoutMode === 'compact'}>Compact</option>
                                </select>
                                <div class="form-description">
                                    ${this.layoutMode === 'compact'
                                        ? 'Smaller window size with reduced padding and font sizes for minimal screen footprint'
                                        : 'Standard layout with comfortable spacing and font sizes'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Screen Capture Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Screen Capture Settings</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    Capture Interval
                                    <span class="current-selection"
                                        >✓ ${this.selectedScreenshotInterval === 'manual' ? 'Manual' : this.selectedScreenshotInterval + 's'}</span
                                    >
                                </label>
                                <select class="form-control" .value=${this.selectedScreenshotInterval} @change=${this.handleScreenshotIntervalSelect}>
                                    <option value="manual" ?selected=${this.selectedScreenshotInterval === 'manual'}>Manual (On demand)</option>
                                    <option value="1" ?selected=${this.selectedScreenshotInterval === '1'}>Every 1 second</option>
                                    <option value="2" ?selected=${this.selectedScreenshotInterval === '2'}>Every 2 seconds</option>
                                    <option value="5" ?selected=${this.selectedScreenshotInterval === '5'}>Every 5 seconds</option>
                                    <option value="10" ?selected=${this.selectedScreenshotInterval === '10'}>Every 10 seconds</option>
                                </select>
                                <div class="form-description">
                                    ${this.selectedScreenshotInterval === 'manual'
                                        ? 'Screenshots will only be taken when you press the manual capture key (⌘+Shift+S)'
                                        : 'Automatic screenshots will be taken at the specified interval'}
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">
                                    Image Quality
                                    <span class="current-selection"
                                        >✓ ${this.selectedImageQuality.charAt(0).toUpperCase() + this.selectedImageQuality.slice(1)}</span
                                    >
                                </label>
                                <select class="form-control" .value=${this.selectedImageQuality} @change=${this.handleImageQualitySelect}>
                                    <option value="high" ?selected=${this.selectedImageQuality === 'high'}>High Quality</option>
                                    <option value="medium" ?selected=${this.selectedImageQuality === 'medium'}>Medium Quality</option>
                                    <option value="low" ?selected=${this.selectedImageQuality === 'low'}>Low Quality</option>
                                </select>
                                <div class="form-description">
                                    ${this.selectedImageQuality === 'high'
                                        ? 'Best quality, uses more tokens'
                                        : this.selectedImageQuality === 'medium'
                                          ? 'Balanced quality and token usage'
                                          : 'Lower quality, uses fewer tokens'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Keyboard Shortcuts Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Keyboard Shortcuts</span>
                    </div>

                    <table class="keybinds-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Shortcut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.getKeybindActions().map(
                                action => html`
                                    <tr>
                                        <td>
                                            <div class="action-name">${action.name}</div>
                                            <div class="action-description">${action.description}</div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                class="form-control keybind-input"
                                                .value=${this.keybinds[action.key]}
                                                placeholder="Press keys..."
                                                data-action=${action.key}
                                                @keydown=${this.handleKeybindInput}
                                                @focus=${this.handleKeybindFocus}
                                                readonly
                                            />
                                        </td>
                                    </tr>
                                `
                            )}
                            <tr class="table-reset-row">
                                <td colspan="2">
                                    <button class="reset-keybinds-button" @click=${this.resetKeybinds}>Reset to Defaults</button>
                                    <div class="form-description" style="margin-top: 8px;">
                                        Restore all keyboard shortcuts to their default values
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Rate Limiting Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Rate Limiting</span>
                    </div>

                    <div class="rate-limit-warning">
                        <span class="rate-limit-warning-icon">⚠️</span>
                        <span
                            ><strong>Warning:</strong> Don't mess with these settings if you don't know what this is about. Incorrect rate limiting
                            settings may cause the application to stop working properly or hit API limits unexpectedly.</span
                        >
                    </div>

                    <div class="form-grid">
                        <div class="checkbox-group">
                            <input
                                type="checkbox"
                                class="checkbox-input"
                                id="throttle-tokens"
                                .checked=${this.throttleTokens}
                                @change=${this.handleThrottleTokensChange}
                            />
                            <label for="throttle-tokens" class="checkbox-label"> Throttle tokens when close to rate limit </label>
                        </div>

                        <div class="rate-limit-controls ${this.throttleTokens ? 'enabled' : ''}">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Max Allowed Tokens Per Minute</label>
                                    <input
                                        type="number"
                                        class="form-control"
                                        .value=${this.maxTokensPerMin}
                                        min="1000"
                                        max="10000000"
                                        step="1000"
                                        @input=${this.handleMaxTokensChange}
                                        ?disabled=${!this.throttleTokens}
                                    />
                                    <div class="form-description">Maximum number of tokens allowed per minute before throttling kicks in</div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Throttle At Percent</label>
                                    <input
                                        type="number"
                                        class="form-control"
                                        .value=${this.throttleAtPercent}
                                        min="1"
                                        max="99"
                                        step="1"
                                        @input=${this.handleThrottlePercentChange}
                                        ?disabled=${!this.throttleTokens}
                                    />
                                    <div class="form-description">
                                        Start throttling when this percentage of the limit is reached (${this.throttleAtPercent}% =
                                        ${Math.floor((this.maxTokensPerMin * this.throttleAtPercent) / 100)} tokens)
                                    </div>
                                </div>
                            </div>

                            <div class="rate-limit-reset">
                                <button class="reset-keybinds-button" @click=${this.resetRateLimitSettings} ?disabled=${!this.throttleTokens}>
                                    Reset
                                </button>
                                <div class="form-description" style="margin-top: 8px;">Reset rate limiting settings to default values</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Google Search Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>Google Search</span>
                    </div>

                    <div class="form-grid">
                        <div class="checkbox-group">
                            <input
                                type="checkbox"
                                class="checkbox-input"
                                id="google-search-enabled"
                                .checked=${this.googleSearchEnabled}
                                @change=${this.handleGoogleSearchChange}
                            />
                            <label for="google-search-enabled" class="checkbox-label"> Enable Google Search </label>
                        </div>
                        <div class="form-description" style="margin-left: 24px; margin-top: -8px;">
                            Allow the AI to search Google for up-to-date information and facts during conversations
                            <br /><strong>Note:</strong> Changes take effect when starting a new AI session
                        </div>
                    </div>
                </div>

                <div class="settings-note">
                    💡 Settings are automatically saved as you change them. Changes will take effect immediately or on the next session start.
                </div>
            </div>
        `;
    }
}

customElements.define('customize-view', CustomizeView);
