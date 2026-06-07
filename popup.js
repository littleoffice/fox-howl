const serverUrlInput = document.getElementById("serverUrl");
const voiceSelect = document.getElementById("voice");
const testBtn = document.getElementById("testConnection");
const playBtn = document.getElementById("play");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");

async function init() {
  const settings = await browser.storage.local.get({
    serverUrl: "http://localhost:8880",
    voice: "af_heart",
    responseFormat: "pcm",
    stream: true
  });

  serverUrlInput.value = settings.serverUrl;
  await loadVoices(settings.serverUrl, settings.voice);

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      const response = await browser.tabs.sendMessage(tabs[0].id, { action: "getStatus" });
      if (response && response.isPlaying) setPlaying(true);
    } catch {}
  }
}

async function loadVoices(serverUrl, currentVoice) {
  try {
    const result = await browser.runtime.sendMessage({
      action: "fetchVoices",
      serverUrl: serverUrl
    });
    if (result.ok) {
      voiceSelect.innerHTML = "";
      for (const v of result.voices) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        if (v === currentVoice) opt.selected = true;
        voiceSelect.appendChild(opt);
      }
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    voiceSelect.innerHTML = `<option>${currentVoice}</option>`;
    statusEl.textContent = err.message || "Cannot reach server — click Test";
    statusEl.className = "error";
  }
}

serverUrlInput.addEventListener("change", () => {
  const url = serverUrlInput.value.trim();
  browser.storage.local.set({ serverUrl: url });
  loadVoices(url, voiceSelect.value);
});

testBtn.addEventListener("click", () => {
  const url = serverUrlInput.value.trim();
  if (!url) {
    statusEl.textContent = "Enter a server URL first";
    statusEl.className = "error";
    return;
  }
  browser.runtime.sendMessage({ action: "openServerTab", serverUrl: url });
  statusEl.textContent = "Accept cert, then reopen popup";
  statusEl.className = "";
});

voiceSelect.addEventListener("change", () => {
  browser.storage.local.set({ voice: voiceSelect.value });
});

playBtn.addEventListener("click", () => {
  // Always flush both fields to storage before speaking, so the content
  // script reads the exact URL shown in the popup even if the input's
  // `change` event hasn't fired yet (e.g. user typed and clicked Speak
  // without blurring the field first).
  const url = serverUrlInput.value.trim();
  browser.storage.local.set({ serverUrl: url, voice: voiceSelect.value });
  browser.runtime.sendMessage({ target: "content", action: "speak" });
  setPlaying(true);
});

stopBtn.addEventListener("click", () => {
  browser.runtime.sendMessage({ target: "content", action: "stop" });
  setPlaying(false);
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "status") {
    if (message.status === "playing") {
      setPlaying(true);
    } else if (message.status === "stopped") {
      setPlaying(false);
      statusEl.textContent = "";
      statusEl.className = "";
    } else if (message.status === "error") {
      setPlaying(false);
      statusEl.textContent = message.error || "Error";
      statusEl.className = "error";
    }
  }
});

function setPlaying(playing) {
  playBtn.disabled = playing;
  stopBtn.disabled = !playing;
  if (playing) {
    statusEl.textContent = "Playing...";
    statusEl.className = "";
  }
}

init();
