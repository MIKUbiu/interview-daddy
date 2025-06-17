import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class HelpView extends LitElement {
    static styles = css`
        .option-group {
            margin-bottom: 24px;
        }

        .option-label {
            display: block;
            margin-bottom: 8px;
            color: var(--option-label-color);
            font-weight: 500;
            font-size: 14px;
        }

        .description {
            color: var(--description-color);
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.5;
        }

        .link {
            color: var(--link-color);
            text-decoration: underline;
            cursor: pointer;
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            margin: 0px;
        }
    `;

    static properties = {
        onExternalLinkClick: { type: Function },
        keybinds: { type: Object }
    };

    constructor() {
        super();
        this.onExternalLinkClick = () => {};
        this.keybinds = this.getDefaultKeybinds();
        this.loadKeybinds();
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
            manualScreenshot: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S'
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

    formatKeybind(keybind) {
        return keybind.split('+').map(key => html`<span class="key">${key}</span>`);
    }

    handleExternalLinkClick(url) {
        this.onExternalLinkClick(url);
    }

    render() {
        const isMacOS = window.cheddar?.isMacOS || false;
        const isLinux = window.cheddar?.isLinux || false;

        return html`
            <div>
                <div class="option-group">
                    <span class="option-label">Community & Support</span>
                    <div class="description">
                        <span @click=${() => this.handleExternalLinkClick('https://github.com/sohzm/cheating-daddy')} class="link">📂 GitHub Repository</span><br />
                        <span @click=${() => this.handleExternalLinkClick('https://discord.gg/GCBdubnXfJ')} class="link">💬 Join Discord Community</span>
                    </div>
                </div>

                <div class="option-group">
                    <span class="option-label">Keyboard Shortcuts</span>
                    <div class="description">
                        <strong>Window Movement:</strong><br />
                        ${this.formatKeybind(this.keybinds.moveUp)} - Move window up<br />
                        ${this.formatKeybind(this.keybinds.moveDown)} - Move window down<br />
                        ${this.formatKeybind(this.keybinds.moveLeft)} - Move window left<br />
                        ${this.formatKeybind(this.keybinds.moveRight)} - Move window right<br /><br />

                        <strong>Window Control:</strong><br />
                        ${this.formatKeybind(this.keybinds.toggleClickThrough)} - Toggle click-through mode<br />
                        ${this.formatKeybind(this.keybinds.toggleVisibility)} - Toggle window visibility<br /><br />

                        <strong>AI Actions:</strong><br />
                        ${this.formatKeybind(this.keybinds.nextStep)} - Ask for next step<br />
                        ${this.formatKeybind(this.keybinds.manualScreenshot)} - Take manual screenshot<br /><br />

                        <strong>Text Input:</strong><br />
                        <span class="key">Enter</span> - Send text message to AI<br />
                        <span class="key">Shift</span> + <span class="key">Enter</span> - New line in text input<br /><br />

                        <em>💡 You can customize these shortcuts in the Settings page!</em>
                    </div>
                </div>

                <div class="option-group">
                    <span class="option-label">How to Use</span>
                    <div class="description">
                        1. <strong>Start a Session:</strong> Enter your Gemini API key and click "Start Session"<br />
                        2. <strong>Customize:</strong> Choose your profile and language in the settings<br />
                        3. <strong>Position Window:</strong> Use keyboard shortcuts to move the window to your desired location<br />
                        4. <strong>Click-through Mode:</strong> Use ${this.formatKeybind(this.keybinds.toggleClickThrough)} to make the window click-through<br />
                        5. <strong>Get AI Help:</strong> The AI will analyze your screen and audio to provide assistance<br />
                        6. <strong>Text Messages:</strong> Type questions or requests to the AI using the text input
                    </div>
                </div>

                <div class="option-group">
                    <span class="option-label">Supported Profiles</span>
                    <div class="description">
                        <strong>Job Interview:</strong> Get help with interview questions and responses<br />
                        <strong>Sales Call:</strong> Assistance with sales conversations and objection handling<br />
                        <strong>Business Meeting:</strong> Support for professional meetings and discussions<br />
                        <strong>Presentation:</strong> Help with presentations and public speaking<br />
                        <strong>Negotiation:</strong> Guidance for business negotiations and deals
                    </div>
                </div>

                <div class="option-group">
                    <span class="option-label">Audio Input</span>
                    <div class="description">
                        ${isMacOS
                            ? html`<strong>macOS:</strong> Uses SystemAudioDump for system audio capture`
                            : isLinux
                            ? html`<strong>Linux:</strong> Uses microphone input`
                            : html`<strong>Windows:</strong> Uses loopback audio capture`}<br />
                        The AI listens to conversations and provides contextual assistance based on what it hears.
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('help-view', HelpView); 