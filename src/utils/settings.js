/**
 * Settings Manager
 * Handles persistent storage of extension settings
 */
const Settings = {
    KEYS: {
        USE_CROSSPOINT: 'useCrosspointFirmware'
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
     * Get all settings
     * @returns {Promise<{useCrosspointFirmware: boolean}>}
     */
    async getAll() {
        try {
            const result = await chrome.storage.sync.get(Object.values(this.KEYS));
            return {
                useCrosspointFirmware: result[this.KEYS.USE_CROSSPOINT] || false
            };
        } catch (error) {
            console.error('[Settings] Error getting all settings:', error);
            return { useCrosspointFirmware: false };
        }
    }
};
