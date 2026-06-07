# Fox Howl

A Firefox extension that streams selected text to a local TTS server and plays it back instantly — no cloud, no latency, no data leaving your machine.

Built for [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) and any OpenAI-compatible `/v1/audio/speech` endpoint.

---

## How it works

Selected text is sent from the page to a background script, which opens a streaming HTTP connection to your TTS server. Audio arrives as raw PCM chunks and is scheduled directly into the Web Audio API for gapless, low-latency playback — no buffering the full response before you hear anything.

Non-PCM formats (mp3, wav, opus, aac, flac) are also supported; they accumulate in full before decoding.

---

## Setup

**Prerequisites:** a running OpenAI-compatible TTS server like [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI).

### From the Mozilla Addon-Store

Get it [here](https://addons.mozilla.org/en-US/firefox/addon/fox-howl/) 

### From Scratch

```sh
git clone https://github.com/yourname/fox-howl
cd fox-howl
./build.sh          # produces fox-howl.xpi
```

Install via `about:addons` → gear icon → *Install Add-on From File*.

> For temporary use without signing: `about:debugging` → *Load Temporary Add-on* → select `manifest.json`.

---

## Usage

| Method | Action |
|---|---|
| `Alt+S` | Speak selected text |
| Right-click | *Speak with Fox Howl* |
| Toolbar popup | Speak / Stop |

**HTTPS with self-signed certificates:** click *Test* in the popup or settings page — Firefox opens the server URL so you can accept the certificate. Only needed once.

---

## Configuration

Open the extension settings to configure:

- **Server URL** — your Kokoro-FastAPI instance
- **Model** — `kokoro` for Kokoro-FastAPI; check `/docs` for others
- **Voice** — fetched live from the server
- **Response format** — `pcm` recommended for streaming; others buffer fully before playback
- **Keyboard shortcut** — rebind or clear; must include `Ctrl` or `Alt`

---

## Project structure

```
manifest.json   Extension manifest (MV2)
background.js   Network layer — TTS streaming, voice fetching, port management
content.js      Page layer — text selection, Web Audio scheduling, playback control
popup.html/js   Toolbar UI
options.html/js Settings page
icons/          Extension icon (SVG)
build.sh        Packages everything into fox-howl.xpi
```

---

## License

[GPL-3.0](LICENSE)
