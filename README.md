# Send to X4

A Chrome extension to send long-form articles from the web directly to your **Xteink X4** e-ink reader as clean EPUB files.

> Status: **Stable (v1.1.0)** — Tested with Xteink X4


<p align="center">
  <img src="media/screenshot_popup.png" alt="Extension Popup" width="300">
</p>

<p align="center">
  <img src="media/infographic.jpg" alt="How Send to X4 Works" width="600">
</p>

---

## What is this?

**Send to X4** is a small, offline-first utility that helps you move reading-focused content from the web to your Xteink X4 with minimal friction.

It is designed for people who:
- prefer reading on e-ink
- want distraction-free, offline reading
- don't want accounts, sync services, or cloud storage

![Send to X4 Demo](media/demo.gif)

---

## Features

- 📤 **Send to X4** — One-click conversion and upload to your Xteink X4
- 📖 **Long-form article support** — Optimized for reading-oriented pages
- 💾 **Offline-first & local** — No accounts, no servers, no tracking
- 📥 **EPUB download fallback** — Keep a local copy if needed
- 🗂️ **Basic file management** — List and delete files on the device

---

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `send-to-x4` folder
5. Pin the extension for easy access

---

## Usage

### Sending an Article

1. **Load the article**  
   Open a long-form article or reading-focused page while connected to the internet.

2. **Connect to X4**  
   Switch your computer's WiFi to the Xteink X4 hotspot.

3. **Open the extension**  
   Click the **Send to X4** icon in the Chrome toolbar.

4. **Send**  
   Click **Send to X4** to upload the EPUB, or **Download** to save it locally.

---

## Workflow (Important)

Send to X4 works best as a simple two-step ritual:

1. ✅ Load the article while connected to the internet  
2. ✅ Switch to the X4 WiFi hotspot  
3. ✅ Open the popup and send  
4. ❌ Do not refresh the page while connected to the X4 hotspot

---

## Managing Files on the Device

When connected to the X4 hotspot, the extension popup shows:

- **Connection status** — Green indicator when the device is reachable
- **File list** — Recent files stored on the device
- **Delete option** — Remove files directly from the X4

---

## X4 Device API (for developers)

The extension communicates with the Xteink X4 using its local HTTP interface:

| Endpoint | Method | Purpose |
|--------|--------|--------|
| `/list?dir=/` | GET | List directory contents |
| `/edit` | POST | Upload file |
| `/edit` | PUT | Create folder |
| `/edit` | DELETE | Delete file |

All communication happens locally over the device hotspot.

---

## Technical Details

- **Chrome Extension**: Manifest V3
- **Permissions**: `scripting`, `activeTab`, `downloads`, `tabs`
- **Host Permissions**: `http://192.168.3.3/*`
- **Article extraction**: Mozilla Readability.js
- **EPUB generation**: JSZip (in-browser)

---

## EPUB Output

- **Filename**: `Author - YYYY-MM-DD - Title.epub`
- **Location on X4**: `/send-to-x4/`
- **Content**: Clean text with title and basic metadata
- **Images**: Not included (text-focused by design)

---

## Troubleshooting

### "No article detected"
- The page must contain enough long-form text
- Try waiting a few seconds for dynamic pages to load
- Some highly dynamic sites may not extract well

### "Not connected to X4"
- Make sure you are connected to the X4 WiFi hotspot
- Open `http://192.168.3.3/` in your browser to verify connectivity
- Retry the send after confirming the page loads

### "Extension context invalidated"
- Reload the extension from `chrome://extensions/`
- Reload the article page while on internet WiFi
- Switch back to the X4 hotspot and try again

---

## Known Limitations

- Text-only (images are not included)
- Requires manual WiFi switching
- Works best on long-form, reading-oriented pages
- Not a read-later service or cloud sync tool

---

## License

MIT
