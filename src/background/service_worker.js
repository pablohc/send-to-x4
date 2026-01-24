/**
 * X4 Send - Service Worker (Background Script)
 * Handles EPUB generation, X4 upload, and download fallback
 */

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Import required modules (paths relative to service worker location in src/background/)
importScripts(
    '../epub/jszip.min.js',
    '../utils/logger.js',
    '../utils/sanitize.js',
    '../epub/epub_templates.js',
    '../epub/epub_builder.js',
    '../upload/x4_upload_tab.js'
);

console.log('[X4 Service Worker] Initialized');

// Message handler
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X4_SEND_ARTICLE') {
        handleSendArticle(message.payload, sender, sendResponse);
        return true; // Keep channel open for async response
    }

    if (message.type === 'X4_DOWNLOAD_ARTICLE') {
        handleDownloadArticle(message.payload, sendResponse);
        return true;
    }

    if (message.type === 'X4_DOWNLOAD_EPUB') {
        handleDownloadEpub(message.payload)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }
});

/**
 * Handle download article request (generate EPUB and download locally)
 */
async function handleDownloadArticle(article, sendResponse) {
    console.log('[X4 SW] Handling download article:', article.title);

    try {
        // Generate EPUB - returns a Blob
        const epubBlob = await EpubBuilder.build(article);

        if (!epubBlob || !(epubBlob instanceof Blob)) {
            throw new Error('EPUB generation failed');
        }

        const filename = EpubBuilder.generateFilename(article);
        const arrayBuffer = await EpubBuilder.blobToArrayBuffer(epubBlob);

        console.log('[X4 SW] EPUB generated for download:', filename, 'size:', arrayBuffer.byteLength);

        // Download the EPUB
        await downloadEpubFallback(arrayBuffer, filename);

        sendResponse({ success: true, message: 'Downloaded!' });

    } catch (error) {
        console.error('[X4 SW] Download error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Send status update to content script
 */
async function sendStatusUpdate(tabId, status, message) {
    try {
        await browserAPI.tabs.sendMessage(tabId, {
            type: 'X4_STATUS_UPDATE',
            status: status,
            message: message
        });
    } catch (e) {
        console.log('[X4 SW] Could not send status update:', e.message);
    }
}

/**
 * Handle send article request
 * Strategy: Try upload first, download as fallback
 */
async function handleSendArticle(article, sender, sendResponse) {
    const tabId = sender.tab?.id;
    console.log('[X4 SW] Handling send article:', article.title);

    try {
        // Step 1: Generate EPUB
        if (tabId) await sendStatusUpdate(tabId, 'generating', 'Creating EPUB...');
        console.log('[X4 SW] Generating EPUB...');

        const epubBlob = await EpubBuilder.build(article);
        const filename = EpubBuilder.generateFilename(article);
        const arrayBuffer = await EpubBuilder.blobToArrayBuffer(epubBlob);

        console.log('[X4 SW] EPUB generated:', filename, 'size:', arrayBuffer.byteLength);

        // Step 2: Try direct upload to X4 (no reachability check - just try it)
        if (tabId) await sendStatusUpdate(tabId, 'uploading', 'Sending to X4...');
        console.log('[X4 SW] Attempting direct upload to X4...');

        const uploadResult = await X4UploadTab.uploadEpub(arrayBuffer, filename);
        console.log('[X4 SW] Upload result:', uploadResult);

        if (uploadResult.success) {
            console.log('[X4 SW] Upload successful!');
            sendResponse({
                success: true,
                message: '✅ Sent to X4!'
            });
            return;
        }

        // Step 3: Upload failed - trigger download as fallback
        console.log('[X4 SW] Upload failed, downloading as fallback. Error:', uploadResult.error);
        if (tabId) await sendStatusUpdate(tabId, 'downloading', 'Downloading (X4 upload failed)...');

        await downloadEpubFallback(arrayBuffer, filename);

        sendResponse({
            success: true, // Still a success - user got the file
            message: '📥 EPUB downloaded',
            downloadTriggered: true,
            uploadError: uploadResult.error
        });

    } catch (error) {
        console.error('[X4 SW] Error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Download EPUB as fallback
 * Chrome MV3 service workers: Use data URL (can't use createObjectURL)
 * Firefox MV3 service workers: Use Blob URL (data URLs blocked for security)
 */
async function downloadEpubFallback(arrayBuffer, filename) {
    try {
        console.log('[X4 SW] Triggering download fallback...');

        // Detect if we're in Firefox (has 'browser' namespace) or Chrome
        const isFirefox = typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
        console.log('[X4 SW] Browser detected:', isFirefox ? 'Firefox' : 'Chrome');

        let downloadUrl;

        if (isFirefox) {
            // Firefox: Use Blob URL (works in MV3 service workers)
            console.log('[X4 SW] Using Blob URL for Firefox...');
            const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
            downloadUrl = URL.createObjectURL(blob);
            console.log('[X4 SW] Blob URL created:', downloadUrl);
        } else {
            // Chrome: Use data URL (works in service workers)
            console.log('[X4 SW] Converting to data URL for Chrome...');
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            downloadUrl = `data:application/epub+zip;base64,${base64}`;
            console.log('[X4 SW] Data URL length:', downloadUrl.length);
        }

        // Trigger download
        console.log('[X4 SW] Calling browserAPI.downloads.download...');
        const downloadId = await browserAPI.downloads.download({
            url: downloadUrl,
            filename: filename,
            saveAs: false
        });

        console.log('[X4 SW] Download triggered successfully, ID:', downloadId);

        // Clean up Blob URL after download starts (Firefox only)
        if (isFirefox) {
            // Give the download a moment to start before revoking
            setTimeout(() => {
                URL.revokeObjectURL(downloadUrl);
                console.log('[X4 SW] Blob URL revoked');
            }, 1000);
        }
    } catch (error) {
        console.error('[X4 SW] Download failed:', error);
        throw error;
    }
}

/**
 * Handle direct download request (for popup action)
 */
async function handleDownloadEpub(payload) {
    const { article } = payload;

    const epubBlob = await EpubBuilder.build(article);
    const filename = EpubBuilder.generateFilename(article);
    const arrayBuffer = await EpubBuilder.blobToArrayBuffer(epubBlob);

    await downloadEpubFallback(arrayBuffer, filename);

    return { success: true, filename };
}

console.log('[X4 Service Worker] Ready');
