/**
 * Popup Script for Send to X4 Extension
 * Handles article detection, sending, and device status
 */

const Popup = {
    // X4 device endpoints (standard firmware)
    X4_URL: 'http://192.168.3.3',
    X4_EDIT_URL: 'http://192.168.3.3/edit',
    X4_LIST_URL: 'http://192.168.3.3/list',

    TARGET_FOLDER: 'send-to-x4',

    // DOM elements
    elements: {},

    // Current article data
    articleData: null,

    // Current settings
    settings: {
        useCrosspointFirmware: false,
        crosspointIp: '192.168.1.224'
    },

    async init() {
        console.log('[X4 Popup] Initializing...');
        this.cacheElements();
        await this.loadSettings();
        this.setupListeners();

        await Promise.all([
            this.checkArticle(),
            this.checkDevice()
        ]);
    },

    cacheElements() {
        this.elements = {
            articleLoading: document.getElementById('article-loading'),
            articleFound: document.getElementById('article-found'),
            articleNotFound: document.getElementById('article-not-found'),
            articleError: document.getElementById('article-error'),
            articleTitle: document.getElementById('article-title'),
            articleAuthor: document.getElementById('article-author'),
            articleWords: document.getElementById('article-words'),
            errorMessage: document.getElementById('error-message'),
            sendBtn: document.getElementById('send-btn'),
            downloadBtn: document.getElementById('download-btn'),
            deviceLoading: document.getElementById('device-loading'),
            deviceConnected: document.getElementById('device-connected'),
            deviceDisconnected: document.getElementById('device-disconnected'),
            deviceFiles: document.getElementById('device-files'),
            fileCount: document.getElementById('file-count'),
            fileListItems: document.getElementById('file-list-items'),
            fileListItems: document.getElementById('file-list-items'),
            crosspointCheckbox: document.getElementById('crosspoint-firmware-checkbox'),
            crosspointIpContainer: document.getElementById('crosspoint-ip-container'),
            crosspointIpInput: document.getElementById('crosspoint-ip'),
            connectBtn: document.getElementById('connect-btn')
        };
    },

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['useCrosspointFirmware', 'crosspointIp']);
            this.settings.useCrosspointFirmware = result.useCrosspointFirmware || false;
            this.settings.crosspointIp = result.crosspointIp || '192.168.1.224';

            this.elements.crosspointCheckbox.checked = this.settings.useCrosspointFirmware;
            this.elements.crosspointIpInput.value = this.settings.crosspointIp;

            console.log('[X4 Popup] Settings loaded:', this.settings);
        } catch (error) {
            console.error('[X4 Popup] Error loading settings:', error);
        }
    },

    setupListeners() {
        this.elements.sendBtn.addEventListener('click', () => this.handleSend());
        this.elements.downloadBtn.addEventListener('click', () => this.handleDownload());
        this.elements.crosspointCheckbox.addEventListener('change', (e) => this.handleSettingsChange(e));
        this.elements.crosspointIpInput.addEventListener('change', (e) => this.handleIpChange(e));
        this.elements.connectBtn.addEventListener('click', () => this.handleConnect());
    },

    async handleSettingsChange(event) {
        const useCrosspoint = event.target.checked;
        try {
            await chrome.storage.sync.set({ useCrosspointFirmware: useCrosspoint });
            this.settings.useCrosspointFirmware = useCrosspoint;
            console.log('[X4 Popup] Settings updated:', this.settings);

            // Refresh device status with new settings
            await this.checkDevice();
        } catch (error) {
            console.error('[X4 Popup] Error saving settings:', error);
        }
    },

    async handleIpChange(event) {
        const newIp = event.target.value.trim();
        if (!newIp) return;

        try {
            await chrome.storage.sync.set({ crosspointIp: newIp });
            this.settings.crosspointIp = newIp;
            console.log('[X4 Popup] IP saved:', newIp);
        } catch (error) {
            console.error('[X4 Popup] Error saving IP:', error);
        }
    },

    async handleConnect() {
        const newIp = this.elements.crosspointIpInput.value.trim();
        if (!newIp) return;

        // Save first
        await this.handleIpChange({ target: { value: newIp } });

        // Visual feedback
        this.setConnectButtonState('loading');

        // Force check
        const connected = await this.checkDevice(true);

        if (connected) {
            this.setConnectButtonState('success');
        } else {
            this.setConnectButtonState('error');
        }
    },

    setConnectButtonState(state) {
        const btn = this.elements.connectBtn;
        const iconSpan = btn.querySelector('.btn-icon');

        btn.className = 'icon-btn'; // reset

        switch (state) {
            case 'loading':
                btn.disabled = true;
                iconSpan.innerHTML = '<div class="btn-spinner"></div>';
                break;
            case 'success':
                btn.disabled = false;
                btn.classList.add('success');
                iconSpan.textContent = '✅';
                setTimeout(() => this.setConnectButtonState('idle'), 2000);
                break;
            case 'error':
                btn.disabled = false;
                btn.classList.add('error');
                iconSpan.textContent = '❌';
                setTimeout(() => this.setConnectButtonState('idle'), 2000);
                break;
            default:
                btn.disabled = false;
                iconSpan.textContent = '🔄';
                break;
        }
    },

    /**
     * Check current tab for article content
     */
    async checkArticle() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.id) {
                this.showArticleNotFound();
                return;
            }

            console.log('[X4 Popup] Checking tab:', tab.url);

            // First, inject Readability into the page
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content/readability.min.js']
                });
                console.log('[X4 Popup] Readability injected');
            } catch (injectError) {
                console.log('[X4 Popup] Could not inject Readability:', injectError.message);
            }

            // Now execute extraction
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractArticle
            });

            const result = results?.[0]?.result;
            console.log('[X4 Popup] Extraction result:', result);

            if (result && result.success) {
                this.articleData = result.article;
                this.showArticleFound(result.article);
            } else {
                console.log('[X4 Popup] No article:', result?.reason);
                this.showArticleNotFound();
            }

        } catch (error) {
            console.error('[X4 Popup] Article check error:', error);
            this.showArticleError(error.message);
        }
    },

    showArticleFound(article) {
        this.elements.articleLoading.classList.add('hidden');
        this.elements.articleNotFound.classList.add('hidden');
        this.elements.articleError.classList.add('hidden');
        this.elements.articleFound.classList.remove('hidden');

        this.elements.articleTitle.textContent = article.title;
        this.elements.articleAuthor.textContent = article.author;
        this.elements.articleWords.textContent = `${article.wordCount?.toLocaleString() || '—'} words`;
    },

    showArticleNotFound() {
        this.elements.articleLoading.classList.add('hidden');
        this.elements.articleFound.classList.add('hidden');
        this.elements.articleError.classList.add('hidden');
        this.elements.articleNotFound.classList.remove('hidden');
    },

    showArticleError(message) {
        this.elements.articleLoading.classList.add('hidden');
        this.elements.articleFound.classList.add('hidden');
        this.elements.articleNotFound.classList.add('hidden');
        this.elements.articleError.classList.remove('hidden');
        this.elements.errorMessage.textContent = message;
    },

    async checkDevice(force = false) {
        try {
            const useCrosspoint = this.settings.useCrosspointFirmware;
            // distinct logic for standard/crosspoint URLs 
            const listUrl = useCrosspoint
                ? `http://${this.settings.crosspointIp}/api/files`
                : this.X4_LIST_URL;

            const listPath = useCrosspoint ? `${listUrl}?path=/` : `${listUrl}?dir=/`;

            console.log('[X4 Popup] Checking device with', useCrosspoint ? 'CrossPoint' : 'standard', 'API');

            const response = await fetch(listPath, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (!response.ok) {
                this.showDeviceDisconnected();
                return false;
            }

            const files = await response.json();
            console.log('[X4 Popup] Device files:', files);

            this.showDeviceConnected(useCrosspoint);

            // Check for our folder - API format differs
            let ourFolder;
            if (useCrosspoint) {
                ourFolder = files.find(f => f.isDirectory && f.name === this.TARGET_FOLDER);
            } else {
                ourFolder = files.find(f => f.type === 'dir' && f.name === this.TARGET_FOLDER);
            }

            if (ourFolder) {
                await this.loadFolderContents();
            } else {
                this.showEmptyFileList();
            }

            return true;

        } catch (error) {
            console.log('[X4 Popup] Device not reachable:', error.message);
            this.showDeviceDisconnected();
            return false;
        }
    },

    async loadFolderContents() {
        try {
            const useCrosspoint = this.settings.useCrosspointFirmware;
            let listUrl, epubFiles;

            if (useCrosspoint) {
                // Construct URL dynamically
                listUrl = `http://${this.settings.crosspointIp}/api/files?path=/${this.TARGET_FOLDER}`;
                const response = await fetch(listUrl);
                const files = await response.json();
                epubFiles = files.filter(f => !f.isDirectory && f.name.endsWith('.epub'));
            } else {
                listUrl = `${this.X4_LIST_URL}?dir=/${this.TARGET_FOLDER}/`;
                const response = await fetch(listUrl);
                const files = await response.json();
                epubFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.epub'));
            }

            this.showFileList(epubFiles);
        } catch (error) {
            console.error('[X4 Popup] Error loading folder:', error);
            this.showEmptyFileList();
        }
    },

    showDeviceConnected(useCrosspoint = false) {
        this.elements.deviceLoading.classList.add('hidden');
        this.elements.deviceDisconnected.classList.add('hidden');
        this.elements.deviceConnected.classList.remove('hidden');

        // Update the displayed IP address
        const ipDisplay = this.elements.deviceConnected.querySelector('span:last-child');
        if (ipDisplay) {
            const ip = useCrosspoint ? this.settings.crosspointIp : '192.168.3.3';
            ipDisplay.textContent = `Connected to ${ip}`;
        }
    },

    showDeviceDisconnected() {
        this.elements.deviceLoading.classList.add('hidden');
        this.elements.deviceConnected.classList.add('hidden');
        this.elements.deviceFiles.classList.add('hidden');
        this.elements.deviceDisconnected.classList.remove('hidden');
    },

    showFileList(files) {
        this.elements.deviceFiles.classList.remove('hidden');
        this.elements.fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

        if (files.length === 0) {
            this.elements.fileListItems.innerHTML = '<li class="empty"><span class="file-name">No files yet</span></li>';
        } else {
            const recentFiles = files.slice(-5).reverse();
            this.elements.fileListItems.innerHTML = recentFiles
                .map(f => {
                    const escapedName = f.name.replace(/"/g, '&quot;');
                    return `<li data-filename="${escapedName}">
                        <button class="delete-btn" title="Delete file">🗑️</button>
                        <span class="file-name" title="${escapedName}">${f.name}</span>
                    </li>`;
                })
                .join('');

            // Add click handlers for delete buttons
            this.elements.fileListItems.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const li = btn.closest('li');
                    const filename = li.dataset.filename;
                    this.handleDelete(filename, li);
                });
            });
        }
    },

    showEmptyFileList() {
        this.elements.deviceFiles.classList.remove('hidden');
        this.elements.fileCount.textContent = '0 files';
        this.elements.fileListItems.innerHTML = '<li class="empty"><span class="file-name">No files yet</span></li>';
    },

    /**
     * Handle file deletion with confirmation
     */
    async handleDelete(filename, liElement) {
        // Confirm deletion
        const confirmed = confirm(`Delete "${filename}" from X4?`);
        if (!confirmed) return;

        console.log('[X4 Popup] Deleting file:', filename);

        // Show deleting state
        liElement.classList.add('deleting');

        try {
            const useCrosspoint = this.settings.useCrosspointFirmware;
            const fullPath = `/${this.TARGET_FOLDER}/${filename}`;
            const formData = new FormData();
            formData.append('path', fullPath);

            let response;
            if (useCrosspoint) {
                // CrossPoint API: POST /delete with type parameter
                formData.append('type', 'file');
                // response = await fetch('http://192.168.4.1/delete', {
                response = await fetch(`http://${this.settings.crosspointIp}/delete`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                // Standard X4 API: DELETE /edit
                response = await fetch(this.X4_EDIT_URL, {
                    method: 'DELETE',
                    body: formData
                });
            }

            if (response.ok) {
                console.log('[X4 Popup] File deleted successfully');
                // Remove the element from DOM
                liElement.remove();
                // Update file count
                const remaining = this.elements.fileListItems.querySelectorAll('li:not(.empty)').length;
                this.elements.fileCount.textContent = `${remaining} file${remaining !== 1 ? 's' : ''}`;

                if (remaining === 0) {
                    this.showEmptyFileList();
                }
            } else {
                throw new Error(`Delete failed: ${response.status}`);
            }

        } catch (error) {
            console.error('[X4 Popup] Delete error:', error);
            alert(`Failed to delete file: ${error.message}`);
            liElement.classList.remove('deleting');
        }
    },

    async handleSend() {
        if (!this.articleData) return;

        console.log('[X4 Popup] Sending article:', this.articleData.title);
        this.setSendButtonState('sending');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'X4_SEND_ARTICLE',
                payload: {
                    kind: 'generic_article',
                    title: this.articleData.title,
                    author: this.articleData.author,
                    date: this.articleData.date,
                    body: this.articleData.body,
                    url: this.articleData.sourceUrl,
                    rawText: this.articleData.rawText
                },
                settings: {
                    useCrosspointFirmware: this.settings.useCrosspointFirmware,
                    crosspointIp: this.settings.crosspointIp
                }
            });

            console.log('[X4 Popup] Response:', response);

            if (response && response.success) {
                this.setSendButtonState('success', response.message);
                // Refresh device file list after a delay (give device time to process)
                setTimeout(() => {
                    console.log('[X4 Popup] Refreshing device file list after upload...');
                    this.loadFolderContents();
                }, 1500);
            } else {
                this.setSendButtonState('error', response?.error || 'Unknown error');
            }

        } catch (error) {
            console.error('[X4 Popup] Send error:', error);
            this.setSendButtonState('error', error.message);
        }
    },

    /**
     * Handle download button - download EPUB locally
     */
    async handleDownload() {
        if (!this.articleData) return;

        console.log('[X4 Popup] Downloading article:', this.articleData.title);
        this.setDownloadButtonState('downloading');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'X4_DOWNLOAD_ARTICLE',
                payload: {
                    kind: 'generic_article',
                    title: this.articleData.title,
                    author: this.articleData.author,
                    date: this.articleData.date,
                    body: this.articleData.body,
                    url: this.articleData.sourceUrl,
                    rawText: this.articleData.rawText
                }
            });

            console.log('[X4 Popup] Download response:', response);

            if (response && response.success) {
                this.setDownloadButtonState('success');
            } else {
                this.setDownloadButtonState('error', response?.error || 'Unknown error');
            }

        } catch (error) {
            console.error('[X4 Popup] Download error:', error);
            this.setDownloadButtonState('error', error.message);
        }
    },

    setDownloadButtonState(state, message = '') {
        const btn = this.elements.downloadBtn;
        const iconSpan = btn.querySelector('.btn-icon');
        const textSpan = btn.querySelector('.btn-text');

        switch (state) {
            case 'downloading':
                btn.disabled = true;
                iconSpan.innerHTML = '<div class="btn-spinner"></div>';
                textSpan.textContent = '...';
                break;

            case 'success':
                btn.disabled = false;
                iconSpan.textContent = '✅';
                textSpan.textContent = 'Saved!';
                setTimeout(() => this.setDownloadButtonState('idle'), 2000);
                break;

            case 'error':
                btn.disabled = false;
                iconSpan.textContent = '❌';
                textSpan.textContent = 'Failed';
                setTimeout(() => this.setDownloadButtonState('idle'), 3000);
                break;

            default:
                btn.disabled = false;
                iconSpan.textContent = '📥';
                textSpan.textContent = 'Download';
                break;
        }
    },

    setSendButtonState(state, message = '') {
        const btn = this.elements.sendBtn;
        const iconSpan = btn.querySelector('.btn-icon');
        const textSpan = btn.querySelector('.btn-text');

        btn.classList.remove('success', 'error');

        switch (state) {
            case 'sending':
                btn.disabled = true;
                iconSpan.innerHTML = '<div class="btn-spinner"></div>';
                textSpan.textContent = 'Sending...';
                break;

            case 'success':
                btn.disabled = false;
                btn.classList.add('success');
                iconSpan.textContent = '✅';
                textSpan.textContent = message || 'Sent!';
                setTimeout(() => this.setSendButtonState('idle'), 3000);
                break;

            case 'error':
                btn.disabled = false;
                btn.classList.add('error');
                iconSpan.textContent = '❌';
                textSpan.textContent = message || 'Failed';
                setTimeout(() => this.setSendButtonState('idle'), 4000);
                break;

            default:
                btn.disabled = false;
                iconSpan.textContent = '📖';
                textSpan.textContent = 'Send to X4';
                break;
        }
    }
};

/**
 * Article extraction function - runs in page context
 * Must be self-contained
 */
function extractArticle() {
    try {
        console.log('[X4] Extracting article...');

        // Check if Readability is available
        const hasReadability = typeof Readability !== 'undefined';
        console.log('[X4] Readability available:', hasReadability);

        let title = document.title;
        let author = '';
        let date = new Date().toISOString().split('T')[0];
        let body = '';
        let textContent = '';
        let wordCount = 0;

        if (hasReadability) {
            // Use Readability
            const docClone = document.cloneNode(true);
            const reader = new Readability(docClone);
            const article = reader.parse();

            if (article && article.textContent && article.textContent.length >= 400) {
                title = article.title || document.title;
                author = article.byline || article.siteName || '';
                body = article.content;
                textContent = article.textContent;
                wordCount = textContent.split(/\s+/).length;

                // Try to get date
                const dateEl = document.querySelector('meta[property="article:published_time"]') ||
                    document.querySelector('time[datetime]');
                if (article.publishedTime) {
                    date = article.publishedTime.split('T')[0];
                } else if (dateEl) {
                    const dt = dateEl.getAttribute('content') || dateEl.getAttribute('datetime');
                    if (dt) date = dt.split('T')[0];
                }

                // Get author from meta if not in article
                if (!author) {
                    author = document.querySelector('meta[name="author"]')?.content ||
                        document.querySelector('meta[property="article:author"]')?.content ||
                        new URL(window.location.href).hostname.replace('www.', '');
                }

                console.log('[X4] Readability extracted:', title, wordCount, 'words');

                return {
                    success: true,
                    article: {
                        title,
                        author,
                        date,
                        wordCount,
                        body,
                        rawText: textContent,
                        sourceUrl: window.location.href
                    }
                };
            }
        }

        // Fallback: basic extraction
        console.log('[X4] Using fallback extraction');

        // Get main content area
        const mainContent = document.querySelector('article') ||
            document.querySelector('[role="main"]') ||
            document.querySelector('main') ||
            document.body;

        textContent = mainContent.innerText || mainContent.textContent || '';
        wordCount = textContent.split(/\s+/).length;

        if (textContent.length < 400) {
            console.log('[X4] Content too short:', textContent.length);
            return { success: false, reason: 'content_too_short', length: textContent.length };
        }

        // Get metadata
        author = document.querySelector('meta[name="author"]')?.content ||
            document.querySelector('meta[property="article:author"]')?.content ||
            new URL(window.location.href).hostname.replace('www.', '');

        const dateEl = document.querySelector('meta[property="article:published_time"]') ||
            document.querySelector('time[datetime]');
        if (dateEl) {
            const dt = dateEl.getAttribute('content') || dateEl.getAttribute('datetime');
            if (dt) date = dt.split('T')[0];
        }

        // Create simple HTML body
        const paragraphs = textContent.split(/\n\n+/).filter(p => p.trim().length > 0);
        body = paragraphs.map(p => `<p>${p.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('\n');

        return {
            success: true,
            article: {
                title,
                author,
                date,
                wordCount,
                body,
                rawText: textContent,
                sourceUrl: window.location.href
            }
        };

    } catch (error) {
        console.error('[X4] Extraction error:', error);
        return { success: false, reason: error.message };
    }
}

document.addEventListener('DOMContentLoaded', () => Popup.init());
