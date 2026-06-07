const serverUrlInput = document.getElementById("serverUrl");
const modelInput = document.getElementById("model");
const voiceSelect = document.getElementById("voice");
const fetchBtn = document.getElementById("fetchVoices");
const responseFormatSelect = document.getElementById("responseFormat");
const streamCheckbox = document.getElementById("stream");
const shortcutInput = document.getElementById("shortcut");
const clearShortcutBtn = document.getElementById("clearShortcut");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

let pendingShortcut = null;

async function init() {
  const settings = await browser.storage.local.get({
    serverUrl: "http://localhost:8880",
    voice: "af_heart",
    model: "kokoro",
    responseFormat: "pcm",
    stream: true
  });
  serverUrlInput.value = settings.serverUrl;
  modelInput.value = settings.model;
  responseFormatSelect.value = settings.responseFormat;
  streamCheckbox.checked = settings.stream;
  await fetchVoices(settings.serverUrl, settings.voice);
  await loadCurrentShortcut();
}

async function loadCurrentShortcut() {
  try {
    const commands = await browser.commands.getAll();
    const cmd = commands.find((c) => c.name === "speak-selection");
    if (cmd && cmd.shortcut) {
      shortcutInput.value = cmd.shortcut;
    } else {
      shortcutInput.value = "";
      shortcutInput.placeholder = "No shortcut set";
    }
  } catch {
    shortcutInput.value = "Alt+S";
  }
}

async function fetchVoices(serverUrl, currentVoice) {
  try {
    const result = await browser.runtime.sendMessage({
      action: "fetchVoices",
      serverUrl: serverUrl
    });
    if (result.ok) {
      while (voiceSelect.firstChild) {
        voiceSelect.removeChild(voiceSelect.firstChild);
      }
      for (const v of result.voices) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        if (v === currentVoice) opt.selected = true;
        voiceSelect.appendChild(opt);
      }
      statusEl.textContent = `${result.voices.length} voices loaded`;
      statusEl.className = "";
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    while (voiceSelect.firstChild) {
      voiceSelect.removeChild(voiceSelect.firstChild);
    }
    const opt = document.createElement("option");
    opt.value = currentVoice || "af_heart";
    opt.textContent = currentVoice || "af_heart";
    voiceSelect.appendChild(opt);
    statusEl.textContent = err.message || "Cannot reach server";
    statusEl.className = "error";
  }
}

fetchBtn.addEventListener("click", () => {
  fetchVoices(serverUrlInput.value, voiceSelect.value);
});

shortcutInput.addEventListener("keydown", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  if (!e.ctrlKey && !e.altKey) {
    statusEl.textContent = "Shortcut must include Ctrl or Alt";
    statusEl.className = "error";
    return;
  }

  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  pendingShortcut = parts.join("+");
  shortcutInput.value = pendingShortcut;
  statusEl.textContent = "Press Save to apply";
  statusEl.className = "";
});

clearShortcutBtn.addEventListener("click", async () => {
  try {
    await browser.commands.reset("speak-selection");
    pendingShortcut = null;
    await loadCurrentShortcut();
    statusEl.textContent = "Shortcut reset to default (Alt+S)";
    statusEl.className = "";
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "error";
  }
});

saveBtn.addEventListener("click", async () => {
  browser.storage.local.set({
    serverUrl: serverUrlInput.value.trim(),
    model: modelInput.value.trim() || "kokoro",
    voice: voiceSelect.value,
    responseFormat: responseFormatSelect.value,
    stream: streamCheckbox.checked
  });

  if (pendingShortcut) {
    try {
      await browser.commands.update({
        name: "speak-selection",
        shortcut: pendingShortcut
      });
      pendingShortcut = null;
      statusEl.textContent = "Saved";
      statusEl.className = "";
    } catch (err) {
      statusEl.textContent = `Invalid shortcut: ${err.message}`;
      statusEl.className = "error";
      return;
    }
  } else {
    statusEl.textContent = "Saved";
    statusEl.className = "";
  }
});

init();
