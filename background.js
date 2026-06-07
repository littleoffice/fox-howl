browser.contextMenus.create({
  id: "fox-howl-speak",
  title: "Speak with Fox Howl",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fox-howl-speak") {
    browser.tabs.sendMessage(tab.id, {
      action: "speak",
      text: info.selectionText
    }).catch((err) => console.error("[fox-howl] sendMessage failed:", err));
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === "speak-selection") {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { action: "speak" })
          .catch((err) => console.error("[fox-howl] sendMessage failed:", err));
      }
    });
  }
});

// Handle all network requests from popup/options/content
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchVoices") {
    fetchVoices(message.serverUrl).then(sendResponse);
    return true; // async response
  }

  if (message.action === "openServerTab") {
    const url = message.serverUrl.replace(/\/+$/, "") + "/docs";
    browser.tabs.create({ url });
    return;
  }

  if (message.target === "content") {
    return browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        return browser.tabs.sendMessage(tabs[0].id, message)
          .catch((err) => console.error("[fox-howl] relay failed:", err));
      }
    });
  }
});

async function fetchVoices(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/v1/audio/voices`);
    const data = await res.json();
    // Kokoro-FastAPI returns { voices: ["af_heart", ...] }
    // Kokoros / OpenAI-compatible servers return { data: [{ id: "..." }, ...] }
    const voices =
      Array.isArray(data.voices) ? data.voices :
      Array.isArray(data.data)   ? data.data.map(v => (typeof v === "string" ? v : v.id)) :
      Array.isArray(data)        ? data :
      null;
    if (!voices) throw new Error("Unexpected voices response format");
    return { ok: true, voices };
  } catch (err) {
    const msg = err.message || "";
    const isCertIssue = serverUrl.startsWith("https") &&
      (msg.includes("NetworkError") || msg.includes("SSL") || msg.includes("certificate"));
    return {
      ok: false,
      error: isCertIssue
        ? "Connection failed — self-signed certificate? Click Test to accept it in Firefox."
        : msg || "Cannot reach server"
    };
  }
}

// Stream TTS via Port connection from content script
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "fox-howl-tts") return;

  let abortController = null;

  port.onMessage.addListener(async (msg) => {
    if (msg.action === "start") {
      abortController = new AbortController();

      try {
        console.log("[fox-howl] background fetching TTS from:", msg.serverUrl);
        const response = await fetch(`${msg.serverUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: msg.text,
            voice: msg.voice,
            model: msg.model || "kokoro",
            response_format: msg.responseFormat || "pcm",
            stream: msg.stream !== undefined ? msg.stream : true
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          port.postMessage({ type: "error", error: `Server error: ${response.status}` });
          return;
        }

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Transfer the ArrayBuffer for efficiency
          port.postMessage({ type: "chunk", data: Array.from(value) });
        }

        port.postMessage({ type: "done" });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[fox-howl] TTS fetch error:", err);
        port.postMessage({ type: "error", error: err.message });
      }
    }

    if (msg.action === "stop") {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  });
});
