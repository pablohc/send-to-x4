/**
 * Settings Manager
 * Handles persistent storage of extension settings
 */
const Settings = {
    KEYS: {
        USE_CROSSPOINT: 'useCrosspointFirmware',
        CROSSPOINT_IP: 'crosspointIp',
        SETTINGS_PANEL_OPEN: 'settingsPanelOpen'
    },

    /**
     * Get whether CrossPoint firmware is enabled
     * @returns {Promise<boolean>}
     */
    async getUseCrosspoint() {
        try {
            const result = await chrome.storage.sync.get(this.KEYS.USE_CROSSPOINT);
            return result[this.KEYS.USE_CROSSPOINT] || false;
        } catch (error) {
            console.error('[Settings] Error getting setting:', error);
            return false;
        }
    },

    /**
     * Set whether CrossPoint firmware is enabled
     * @param {boolean} enabled
     * @returns {Promise<void>}
     */
    async setUseCrosspoint(enabled) {
        try {
            await chrome.storage.sync.set({ [this.KEYS.USE_CROSSPOINT]: enabled });
            console.log('[Settings] CrossPoint firmware setting updated:', enabled);
        } catch (error) {
            console.error('[Settings] Error saving setting:', error);
            throw error;
        }
    },

    /**
     * Get CrossPoint IP address
     * @returns {Promise<string>}
     */
    async getCrosspointIp() {
        try {
            const result = await chrome.storage.sync.get(this.KEYS.CROSSPOINT_IP);
            return result[this.KEYS.CROSSPOINT_IP] || '192.168.1.224';
        } catch (error) {
            console.error('[Settings] Error getting IP:', error);
            return '192.168.1.224';
        }
    },

    /**
     * Set CrossPoint IP address
     * @param {string} ip
     * @returns {Promise<void>}
     */
    async setCrosspointIp(ip) {
        try {
            await chrome.storage.sync.set({ [this.KEYS.CROSSPOINT_IP]: ip });
            console.log('[Settings] IP updated:', ip);
        } catch (error) {
            console.error('[Settings] Error saving IP:', error);
            throw error;
        }
    },

    /**
     * Get whether settings panel is open
     * @returns {Promise<boolean>}
     */
    async getSettingsPanelOpen() {
        try {
            const result = await chrome.storage.sync.get(this.KEYS.SETTINGS_PANEL_OPEN);
            return result[this.KEYS.SETTINGS_PANEL_OPEN] || false;
        } catch (error) {
            return false;
        }
    },

    /**
     * Set whether settings panel is open
     * @param {boolean} isOpen
     * @returns {Promise<void>}
     */
    async setSettingsPanelOpen(isOpen) {
        try {
            await chrome.storage.sync.set({ [this.KEYS.SETTINGS_PANEL_OPEN]: isOpen });
        } catch (error) {
            console.error('[Settings] Error saving panel state:', error);
        }
    },

    /**
     * Get all settings
     * @returns {Promise<{useCrosspointFirmware: boolean, crosspointIp: string, settingsPanelOpen: boolean}>}
     */
    async getAll() {
        try {
            const keys = Object.values(this.KEYS);
            const result = await chrome.storage.sync.get(keys);
            return {
                useCrosspointFirmware: result[this.KEYS.USE_CROSSPOINT] || false,
                crosspointIp: result[this.KEYS.CROSSPOINT_IP] || '192.168.1.224',
                settingsPanelOpen: result[this.KEYS.SETTINGS_PANEL_OPEN] || false
            };
        } catch (error) {
            console.error('[Settings] Error getting all settings:', error);
            return {
                useCrosspointFirmware: false,
                crosspointIp: '192.168.1.224',
                settingsPanelOpen: false
            };
        }
    }
};

// Attach to window for global access
window.Settings = Settings;
