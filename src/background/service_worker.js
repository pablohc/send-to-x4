/**
 * X4 Send - Service Worker (Background Script)
 * Handles EPUB generation, X4 upload, and download fallback
 */

// Import required modules (paths relative to service worker location in src/background/)
importScripts(
    '../epub/jszip.min.js',
    '../utils/logger.js',
    '../utils/sanitize.js',
    '../epub/epub_templates.js',
    '../epub/epub_builder.js',
    '../upload/x4_upload_tab.js',
    '../upload/crosspoint_upload.js',
    '../utils/settings.js'
);

console.log('[X4 Service Worker] Initialized');

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X4_SEND_ARTICLE') {
        handleSendArticle(message, sender, sendResponse);
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
        await chrome.tabs.sendMessage(tabId, {
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
async function handleSendArticle(messageData, sender, sendResponse) {
    const article = messageData.payload;
    const settings = messageData.settings || {};
    const tabId = sender.tab?.id;
    console.log('[X4 SW] Handling send article:', article.title);
    console.log('[X4 SW] Settings:', settings);

    try {
        // Step 1: Generate EPUB
        if (tabId) await sendStatusUpdate(tabId, 'generating', 'Creating EPUB...');
        console.log('[X4 SW] Generating EPUB...');

        const epubBlob = await EpubBuilder.build(article);
        const filename = EpubBuilder.generateFilename(article);
        const arrayBuffer = await EpubBuilder.blobToArrayBuffer(epubBlob);

        console.log('[X4 SW] EPUB generated:', filename, 'size:', arrayBuffer.byteLength);

        // Step 2: Choose uploader based on settings
        const uploader = settings.useCrosspointFirmware ? CrossPointUpload : X4UploadTab;
        const apiName = settings.useCrosspointFirmware ? 'CrossPoint' : 'standard X4';

        if (settings.useCrosspointFirmware && settings.crosspointIp) {
            console.log('[X4 SW] Configuring CrossPoint IP:', settings.crosspointIp);
            CrossPointUpload.setIp(settings.crosspointIp);
        }

        // Step 3: Try direct upload to X4 (no reachability check - just try it)
        if (tabId) await sendStatusUpdate(tabId, 'uploading', 'Sending to X4...');
        console.log(`[X4 SW] Attempting direct upload using ${apiName} API...`);

        const uploadResult = await uploader.uploadEpub(arrayBuffer, filename);
        console.log('[X4 SW] Upload result:', uploadResult);

        if (uploadResult.success) {
            console.log('[X4 SW] Upload successful!');
            sendResponse({
                success: true,
                message: 'Sent to X4!'
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
 * Service workers can't use URL.createObjectURL, so we use data URL
 */
async function downloadEpubFallback(arrayBuffer, filename) {
    try {
        console.log('[X4 SW] Triggering download fallback...');

        // Convert ArrayBuffer to base64 data URL
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:application/epub+zip;base64,${base64}`;

        // Trigger download using data URL
        await chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
        });

        console.log('[X4 SW] Download triggered:', filename);
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
