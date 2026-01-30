/**
 * File Manager
 * Handles device communication (X4 standard and CrossPoint firmware)
 */
export class FileManager {
    constructor() {
        this.X4_URL = 'http://192.168.3.3';
        this.X4_EDIT_URL = 'http://192.168.3.3/edit';
        this.X4_LIST_URL = 'http://192.168.3.3/list';
        this.TARGET_FOLDER = 'send-to-x4';
    }

    /**
     * Check if device is reachable
     * @param {Object} settings - { useCrosspointFirmware, crosspointIp }
     * @returns {Promise<{connected: boolean, files: Array}>}
     */
    async checkDevice(settings) {
        try {
            const useCrosspoint = settings.useCrosspointFirmware;
            const listUrl = useCrosspoint
                ? `http://${settings.crosspointIp}/api/files`
                : this.X4_LIST_URL;

            const listPath = useCrosspoint ? `${listUrl}?path=/` : `${listUrl}?dir=/`;

            console.log('[File Manager] Checking device with', useCrosspoint ? 'CrossPoint' : 'standard', 'API');

            const response = await fetch(listPath, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (!response.ok) {
                return { connected: false, files: [] };
            }

            const files = await response.json();
            return { connected: true, files };

        } catch (error) {
            console.log('[File Manager] Device not reachable:', error.message);
            return { connected: false, files: [], error: error.message };
        }
    }

    /**
     * Load files from the target folder
     * @param {Object} settings 
     * @returns {Promise<Array>}
     */
    async loadFolderFiles(settings) {
        try {
            const useCrosspoint = settings.useCrosspointFirmware;
            let listUrl, epubFiles;

            if (useCrosspoint) {
                listUrl = `http://${settings.crosspointIp}/api/files?path=/${this.TARGET_FOLDER}`;
                const response = await fetch(listUrl);
                const files = await response.json();
                epubFiles = files.filter(f => !f.isDirectory && f.name.endsWith('.epub'));
            } else {
                listUrl = `${this.X4_LIST_URL}?dir=/${this.TARGET_FOLDER}/`;
                const response = await fetch(listUrl);
                const files = await response.json();
                epubFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.epub'));
            }

            return epubFiles;
        } catch (error) {
            console.error('[File Manager] Error loading folder:', error);
            return []; // Return empty on error (folder might not exist)
        }
    }

    /**
     * Delete a file from the device
     * @param {string} filename 
     * @param {Object} settings 
     * @returns {Promise<boolean>}
     */
    async deleteFile(filename, settings) {
        try {
            console.log('[File Manager] Deleting file:', filename);
            const useCrosspoint = settings.useCrosspointFirmware;
            const fullPath = `/${this.TARGET_FOLDER}/${filename}`;
            const formData = new FormData();
            formData.append('path', fullPath);

            let response;
            if (useCrosspoint) {
                // CrossPoint API
                formData.append('type', 'file');
                response = await fetch(`http://${settings.crosspointIp}/delete`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                // Standard X4 API
                response = await fetch(this.X4_EDIT_URL, {
                    method: 'DELETE',
                    body: formData
                });
            }

            if (response.ok) {
                return true;
            } else {
                throw new Error(`Delete failed: ${response.status}`);
            }

        } catch (error) {
            console.error('[File Manager] Delete error:', error);
            throw error;
        }
    }

    findTargetFolder(files, settings) {
        const useCrosspoint = settings.useCrosspointFirmware;
        if (useCrosspoint) {
            return files.find(f => f.isDirectory && f.name === this.TARGET_FOLDER);
        } else {
            return files.find(f => f.type === 'dir' && f.name === this.TARGET_FOLDER);
        }
    }
}
