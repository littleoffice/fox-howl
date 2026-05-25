let currentAudioContext = null;
let currentPort = null;
let isPlaying = false;
let scheduledTime = 0;

// For non-PCM formats: accumulate chunks then decode all at once
let collectedChunks = [];
let currentResponseFormat = "pcm";

console.log("[fox-howl] content script loaded on:", window.location.href);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[fox-howl] content got message:", message);
  if (message.action === "speak") {
    const text = message.text || window.getSelection().toString().trim();
    console.log("[fox-howl] text to speak:", text);
    if (!text) {
      notifyStatus("error", "No text selected");
      return;
    }
    speak(text);
  } else if (message.action === "stop") {
    stopPlayback();
  } else if (message.action === "getStatus") {
    sendResponse({ isPlaying });
  }
});

async function speak(text) {
  stopPlayback();

  const settings = await browser.storage.local.get({
    serverUrl: "http://localhost:8880",
    voice: "af_heart",
    responseFormat: "pcm",
    stream: true
  });

  currentResponseFormat = settings.responseFormat;
  collectedChunks = [];

  // PCM requires 24000 sample rate; for decoded formats let decodeAudioData decide
  const sampleRate = currentResponseFormat === "pcm" ? 24000 : undefined;
  currentAudioContext = new AudioContext(sampleRate ? { sampleRate } : {});
  isPlaying = true;
  scheduledTime = currentAudioContext.currentTime;
  notifyStatus("playing");

  console.log("[fox-howl] opening port to background, server:", settings.serverUrl,
    "voice:", settings.voice, "format:", settings.responseFormat, "stream:", settings.stream);

  currentPort = browser.runtime.connect({ name: "fox-howl-tts" });

  currentPort.onMessage.addListener((msg) => {
    if (msg.type === "chunk") {
      const value = new Uint8Array(msg.data);
      if (currentResponseFormat === "pcm") {
        playPcmChunk(value);
      } else {
        collectedChunks.push(value);
      }
    } else if (msg.type === "done") {
      console.log("[fox-howl] stream complete");
      if (currentResponseFormat === "pcm") {
        waitForPlaybackEnd();
      } else {
        decodeAndPlay();
      }
    } else if (msg.type === "error") {
      console.error("[fox-howl] server error:", msg.error);
      notifyStatus("error", msg.error);
      cleanupPlayback();
    }
  });

  currentPort.onDisconnect.addListener(() => {
    currentPort = null;
  });

  currentPort.postMessage({
    action: "start",
    text: text,
    serverUrl: settings.serverUrl,
    voice: settings.voice,
    responseFormat: settings.responseFormat,
    stream: settings.stream
  });
}

// --- PCM path (streaming, low-latency) ---

let leftover = new Uint8Array(0);

function playPcmChunk(value) {
  if (!currentAudioContext || currentAudioContext.state === "closed") return;

  const combined = new Uint8Array(leftover.length + value.length);
  combined.set(leftover);
  combined.set(value, leftover.length);

  const usableBytes = combined.length - (combined.length % 2);
  leftover = combined.slice(usableBytes);

  if (usableBytes === 0) return;

  const dataView = new DataView(combined.buffer, combined.byteOffset, usableBytes);
  const sampleCount = usableBytes / 2;
  const audioBuffer = currentAudioContext.createBuffer(1, sampleCount, 24000);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < sampleCount; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }

  const source = currentAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(currentAudioContext.destination);

  if (scheduledTime < currentAudioContext.currentTime) {
    scheduledTime = currentAudioContext.currentTime;
  }
  source.start(scheduledTime);
  scheduledTime += audioBuffer.duration;
}

// --- Encoded formats path (mp3, wav, opus, aac, flac) ---

async function decodeAndPlay() {
  if (!currentAudioContext || currentAudioContext.state === "closed") return;
  if (collectedChunks.length === 0) {
    cleanupPlayback();
    return;
  }

  try {
    // Concatenate all received chunks into one ArrayBuffer
    const totalLength = collectedChunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of collectedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const audioBuffer = await currentAudioContext.decodeAudioData(merged.buffer);
    if (!currentAudioContext || currentAudioContext.state === "closed") return;

    const source = currentAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(currentAudioContext.destination);
    source.onended = () => cleanupPlayback();
    source.start(0);
    scheduledTime = currentAudioContext.currentTime + audioBuffer.duration;
  } catch (err) {
    console.error("[fox-howl] decodeAudioData failed:", err);
    notifyStatus("error", `Decode failed: ${err.message}`);
    cleanupPlayback();
  }
}

// --- Shared helpers ---

function waitForPlaybackEnd() {
  if (!currentAudioContext) return;
  const remaining = scheduledTime - currentAudioContext.currentTime;
  if (remaining > 0) {
    setTimeout(() => cleanupPlayback(), remaining * 1000);
  } else {
    cleanupPlayback();
  }
}

function stopPlayback() {
  if (currentPort) {
    currentPort.postMessage({ action: "stop" });
    currentPort.disconnect();
    currentPort = null;
  }
  leftover = new Uint8Array(0);
  collectedChunks = [];
  cleanupPlayback();
}

function cleanupPlayback() {
  if (currentAudioContext && currentAudioContext.state !== "closed") {
    currentAudioContext.close();
  }
  currentAudioContext = null;
  currentPort = null;
  isPlaying = false;
  leftover = new Uint8Array(0);
  collectedChunks = [];
  notifyStatus("stopped");
}

function notifyStatus(status, error = null) {
  browser.runtime.sendMessage({ type: "status", status, error }).catch(() => {});
}
