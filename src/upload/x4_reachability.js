/**
 * X4 Reachability Check
 * Checks if the X4 e-ink reader is reachable at 192.168.3.3
 * 
 * Note: This runs in service worker context, so no DOM/Image available
 */
const X4Reachability = {
    X4_URL: 'http://192.168.3.3/',
    TIMEOUT_MS: 3000,

    /**
     * Check if X4 is reachable
     * @returns {Promise<boolean>}
     */
    async isReachable() {
        console.log('[X4-Send] Checking X4 reachability at', this.X4_URL);

        try {
            // Try fetch with no-cors mode (we can't read the response, but we can detect if it connects)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            // We use mode: 'no-cors' because the X4 won't have CORS headers
            // This means we can't read the response, but we can detect connection success
            await fetch(this.X4_URL, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log('[X4-Send] X4 appears reachable');

            // In no-cors mode, an "opaque" response is returned on success
            // If we get here without an error, the device is likely reachable
            return true;

        } catch (error) {
            console.log('[X4-Send] X4 reachability check failed:', error.message);
            return false;
        }
    }
};
