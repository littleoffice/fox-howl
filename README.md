# Fox howl

A Firefox extension to read selected text aloud via any OpenAI-compatible TTS server (Kokoro, etc.)

## What it does

Select any text on a webpage and have it spoken back to you with natural-sounding voices. Fox howl streams audio in real time from a self-hosted Kokoro TTS server, so your text never leaves your network.

## Features

- **Text-to-speech from any webpage** — select text and trigger speech via context menu, keyboard shortcut, or the popup
- **Streaming playback** — audio begins playing immediately as it's generated, no waiting for the full response
- **Multiple voices** — fetches available voices from your Kokoro server and lets you pick a default
- **Configurable keyboard shortcut** — default `Alt+S`, changeable in settings
- **Self-signed certificate support** — built-in "Test Connection" button to accept HTTPS certs in Firefox
- **Fully local** — works with your own Kokoro-FastAPI instance; no cloud services, no data leaves your machine

## How it works

The extension consists of three parts:

1. **Content script** (`content.js`) — injected into every page. Captures selected text, receives PCM audio chunks from the background script, and plays them through the Web Audio API with gapless scheduling.
2. **Background script** (`background.js`) — handles all network communication. Streams TTS audio from the Kokoro-FastAPI `/v1/audio/speech` endpoint using a persistent Port connection to the content script, and fetches available voices from `/v1/audio/voices`.
3. **Popup & Options UI** — configure the server URL, select a voice, and trigger playback. The options page also supports remapping the keyboard shortcut.

Audio is streamed as raw PCM (16-bit signed LE, 24 kHz) and decoded directly into `AudioBuffer` nodes for low-latency playback.

## Prerequisites

A running, OpenAI-compatible TTS server like [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI). The default URL is `http://localhost:8880`.

## Installation

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and select the `manifest.json` file
4. The Fox howl icon appears in the toolbar

For permanent installation, the extension can be packaged as an `.xpi` and signed through [addons.mozilla.org](https://addons.mozilla.org).

## Usage

1. **Configure** — click the toolbar icon or go to the extension's preferences to set your Kokoro server URL
2. **Select text** on any webpage
3. **Speak** using any of these methods:
   - Press `Alt+S` (default shortcut)
   - Right-click and choose **Speak with Kokoro**
   - Click the toolbar icon and press **Speak**
4. **Stop** playback via the popup's Stop button or by triggering speech again

### HTTPS with self-signed certificates

If your Kokoro server uses HTTPS with a self-signed certificate, Firefox will block requests from the extension. To fix this:

1. Open the extension settings (or popup)
2. Click the **Test** button next to the server URL
3. Firefox opens the server page — accept the certificate warning
4. Return to the extension and click **Refresh** — voices will load and TTS will work

Firefox remembers the certificate exception permanently, so you only need to do this once.

## Project structure

```
├── manifest.json    # Extension manifest (Manifest V2)
├── background.js    # Network requests, TTS streaming, voice fetching
├── content.js       # Text selection, Web Audio playback
├── popup.html/js    # Toolbar popup UI
├── options.html/js  # Settings page
├── popup.css        # Popup styles
├── options.css      # Options styles
└── icons/
    └── icon.svg     # Extension icon
```

## Attribution

This extension was written by [Claude](https://claude.ai), Anthropic's AI assistant (Claude Opus 4.6), with direction and oversight from the project maintainer.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
