/**
 * X4 DOM Uploader
 * This script is injected into the X4 upload page to automate file upload
 * It finds the file input, sets the file, and submits the form
 */

// This will receive the file data via message from the service worker
(function () {
    'use strict';

    console.log('[X4 Uploader] Script loaded on X4 page');

    // Listen for upload command from extension
    window.addEventListener('message', async (event) => {
        // Only accept messages from our extension
        if (event.data?.type !== 'X4_UPLOAD_FILE') return;

        console.log('[X4 Uploader] Received upload command');

        try {
            const { fileData, filename, mimeType } = event.data;

            // Convert array back to ArrayBuffer then to Blob
            const arrayBuffer = new Uint8Array(fileData).buffer;
            const blob = new Blob([arrayBuffer], { type: mimeType });
            const file = new File([blob], filename, { type: mimeType });

            // Find the file input
            const fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) {
                throw new Error('File input not found on upload page');
            }

            console.log('[X4 Uploader] Found file input:', fileInput);

            // Create a DataTransfer to set the file
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('[X4 Uploader] File set on input, looking for submit button');

            // Wait a moment for any JS to process
            await new Promise(r => setTimeout(r, 500));

            // Find and click the submit button
            const submitSelectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'button:contains("Upload")',
                'button:contains("上传")',  // Chinese
                '.upload-btn',
                '#upload',
                'form button'
            ];

            let submitBtn = null;
            for (const selector of submitSelectors) {
                try {
                    submitBtn = document.querySelector(selector);
                    if (submitBtn) break;
                } catch (e) {
                    // :contains is not standard, try alternatives
                }
            }

            // Alternative: find by text content
            if (!submitBtn) {
                const buttons = document.querySelectorAll('button, input[type="submit"]');
                for (const btn of buttons) {
                    if (btn.textContent.match(/upload|submit|确定|上传/i)) {
                        submitBtn = btn;
                        break;
                    }
                }
            }

            // Try form submission directly if no button found
            if (!submitBtn) {
                const form = fileInput.closest('form');
                if (form) {
                    console.log('[X4 Uploader] No submit button found, submitting form directly');
                    form.submit();
                    window.postMessage({ type: 'X4_UPLOAD_RESULT', success: true }, '*');
                    return;
                }
            }

            if (submitBtn) {
                console.log('[X4 Uploader] Clicking submit button');
                submitBtn.click();

                // Wait for upload to complete
                await new Promise(r => setTimeout(r, 2000));

                window.postMessage({ type: 'X4_UPLOAD_RESULT', success: true }, '*');
            } else {
                throw new Error('Could not find submit button or form');
            }

        } catch (error) {
            console.error('[X4 Uploader] Error:', error);
            window.postMessage({
                type: 'X4_UPLOAD_RESULT',
                success: false,
                error: error.message
            }, '*');
        }
    });

    // Notify that the uploader is ready
    window.postMessage({ type: 'X4_UPLOADER_READY' }, '*');
})();
