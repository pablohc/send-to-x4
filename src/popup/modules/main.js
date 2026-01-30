import { UIManager } from './ui_manager.js';
import { FileManager } from './file_manager.js';
import { ArticleManager } from './article_manager.js';

// Global settings object from settings.js (loaded via script tag)
// We assume Settings is available on window/global scope

class PopupController {
    constructor() {
        this.ui = new UIManager();
        this.fileManager = new FileManager();
        this.articleManager = new ArticleManager();
        this.settings = { useCrosspointFirmware: false, crosspointIp: '192.168.1.224', settingsPanelOpen: false };
    }

    async init() {
        console.log('[Popup Controller] Initializing...');
        await this.loadSettings();

        // Setup listeners
        this.ui.setupListeners({
            onSend: () => this.handleSend(),
            onDownload: () => this.handleDownload(),
            onSettingsChange: (e) => this.handleSettingsChange(e),
            onIpChange: (e) => this.handleIpChange(e),
            onConnect: () => this.handleConnect(),
            onSettingsToggle: () => this.handleSettingsToggle()
        });

        // Run checks in parallel
        await Promise.all([
            this.checkArticle(),
            this.checkDevice()
        ]);
    }

    async loadSettings() {
        if (window.Settings) {
            try {
                const allSettings = await window.Settings.getAll();
                this.settings.useCrosspointFirmware = allSettings.useCrosspointFirmware;
                this.settings.crosspointIp = allSettings.crosspointIp;
                this.settings.settingsPanelOpen = allSettings.settingsPanelOpen;

                this.ui.updateSettingsUI(this.settings);
                this.ui.setSettingsPanelState(this.settings.settingsPanelOpen);

                console.log('[Popup Controller] Settings loaded:', this.settings);
            } catch (error) {
                console.error('[Popup Controller] Error loading settings:', error);
            }
        } else {
            console.error('[Popup Controller] Settings module not found!');
        }
    }

    // --- Actions ---

    async checkArticle() {
        try {
            const article = await this.articleManager.checkArticle();
            if (article) {
                this.ui.showArticleFound(article);
            } else {
                // Determine if it was an error or just not found? 
                // ArticleManager returns null on "not found" (e.g. too short).
                this.ui.showArticleNotFound();
            }
        } catch (error) {
            console.error('[Popup Controller] Article check failed:', error);
            // If error is "No active tab", show error?
            this.ui.showArticleError(error.message);
        }
    }

    async checkDevice(force = false) {
        if (force) {
            this.ui.setConnectButtonState('loading');
        } else {
            // Initial check doesn't spin the connect button, maybe spins a general loading indicator?
            // Original code: this.elements.deviceLoading...
            // UIManager handles this in showDeviceConnected/Disconnected which hides loading.
            // But we need to SHOW loading first? UIManager doesn't have a specific showLoading method for device, 
            // but the HTML starts with loading visible.
        }

        const result = await this.fileManager.checkDevice(this.settings);

        if (result.connected) {
            this.ui.showDeviceConnected(this.settings.useCrosspointFirmware ? this.settings.crosspointIp : '192.168.3.3');

            // Load files
            const files = await this.fileManager.loadFolderFiles(this.settings);
            this.ui.showFileList(files, (filename, li) => this.handleDelete(filename, li));

            if (force) this.ui.setConnectButtonState('success');
            return true;
        } else {
            this.ui.showDeviceDisconnected();
            if (force) this.ui.setConnectButtonState('error');
            return false;
        }
    }

    // --- Handlers ---

    async handleSettingsChange(event) {
        const useCrosspoint = event.target.checked;
        this.settings.useCrosspointFirmware = useCrosspoint;

        if (window.Settings) {
            await window.Settings.setUseCrosspoint(useCrosspoint);
        }

        // Refresh device
        await this.checkDevice();
    }

    async handleIpChange(event) {
        const newIp = event.target.value.trim();
        if (!newIp) return;

        this.settings.crosspointIp = newIp;

        if (window.Settings) {
            await window.Settings.setCrosspointIp(newIp);
        }
        console.log('[Popup Controller] IP saved:', newIp);
    }

    async handleConnect() {
        // Force save current input value first
        const currentInput = this.ui.getSettingsFromUI().crosspointIp;
        if (currentInput && currentInput !== this.settings.crosspointIp) {
            await this.handleIpChange({ target: { value: currentInput } });
        }

        await this.checkDevice(true);
    }

    async handleSettingsToggle() {
        this.settings.settingsPanelOpen = !this.settings.settingsPanelOpen;
        this.ui.setSettingsPanelState(this.settings.settingsPanelOpen);

        if (window.Settings) {
            await window.Settings.setSettingsPanelOpen(this.settings.settingsPanelOpen);
        }
    }

    async handleDelete(filename, liElement) {
        if (!confirm(`Delete "${filename}" from X4?`)) return;

        liElement.classList.add('deleting'); // UI optimistically? UIManager should handle this ideally but we passed liElement
        // Actually UIManager doesn't expose class manipulation for list items easily.
        // We can access properties on liElement directly since it's a DOM node passed back.

        try {
            await this.fileManager.deleteFile(filename, this.settings);
            // On success, remove from UI
            liElement.remove();

            // Update count? UIManager needs to know.
            // Reload files to be safe and update count
            const files = await this.fileManager.loadFolderFiles(this.settings);
            this.ui.showFileList(files, (f, l) => this.handleDelete(f, l));

        } catch (error) {
            console.error('[Popup Controller] Delete error:', error);
            alert(`Failed to delete file: ${error.message}`);
            liElement.classList.remove('deleting');
        }
    }

    async handleSend() {
        const article = this.articleManager.articleData;
        if (!article) return;

        this.ui.setSendButtonState('sending');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'X4_SEND_ARTICLE',
                payload: {
                    kind: 'generic_article',
                    ...article
                },
                settings: {
                    useCrosspointFirmware: this.settings.useCrosspointFirmware,
                    crosspointIp: this.settings.crosspointIp
                }
            });

            if (response && response.success) {
                this.ui.setSendButtonState('success', response.message);

                // Refresh files after delay
                setTimeout(async () => {
                    const files = await this.fileManager.loadFolderFiles(this.settings);
                    this.ui.showFileList(files, (f, l) => this.handleDelete(f, l));
                }, 1500);
            } else {
                this.ui.setSendButtonState('error', response?.error || 'Unknown error');
            }
        } catch (error) {
            console.error('[Popup Controller] Send error:', error);
            this.ui.setSendButtonState('error', error.message);
        }
    }

    async handleDownload() {
        const article = this.articleManager.articleData;
        if (!article) return;

        this.ui.setDownloadButtonState('downloading');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'X4_DOWNLOAD_ARTICLE',
                payload: {
                    kind: 'generic_article',
                    ...article
                }
            });

            if (response && response.success) {
                this.ui.setDownloadButtonState('success');
            } else {
                this.ui.setDownloadButtonState('error', response?.error || 'Unknown error');
            }
        } catch (error) {
            console.error('[Popup Controller] Download error:', error);
            this.ui.setDownloadButtonState('error', error.message);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
});
