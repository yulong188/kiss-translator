function normalizeLang(lang) {
  const value = String(lang || "")
    .trim()
    .replace(/_/g, "-");
  const lowerValue = value.toLowerCase();

  // Chrome TTS 不接受 auto 等检测值，统一兜底为英语发音。
  if (
    !value ||
    lowerValue === "en" ||
    lowerValue === "auto" ||
    lowerValue === "detect" ||
    lowerValue === "und" ||
    lowerValue === "unknown"
  ) {
    return "en-US";
  }

  // 只保留简单的 BCP-47 形态，避免 chrome.tts 报 Invalid lang。
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(value)) {
    return "en-US";
  }

  return value;
}

/**
 * 根据文本、检测语言和英语口音偏好选取系统 TTS 语言。
 */
export function resolveSpeechLanguage(
  text,
  lang = "auto",
  englishAccent = "en-US"
) {
  const normalized = String(lang || "auto").replace(/_/g, "-");
  const lower = normalized.toLowerCase();

  if (lower === "en" || lower.startsWith("en-")) return englishAccent;
  if (!["", "auto", "detect", "und", "unknown"].includes(lower)) {
    return normalized;
  }

  return /[\u3400-\u9fff]/.test(text || "") ? "zh-CN" : englishAccent;
}

function hasChromeTts() {
  return typeof globalThis.chrome?.tts?.speak === "function";
}

function hasWebSpeech() {
  return (
    typeof globalThis.speechSynthesis?.speak === "function" &&
    typeof globalThis.SpeechSynthesisUtterance === "function"
  );
}

const FINAL_CHROME_TTS_EVENTS = new Set([
  "end",
  "interrupted",
  "cancelled",
  "error",
]);

let activeSpeechEnd = null;

// Web Speech 通过 utterance 事件通知结束，不会返回可监听的播放句柄。
function speakWithWebSpeech(text, lang, callbacks = {}, options = {}) {
  if (!hasWebSpeech()) return false;

  try {
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    utterance.onend = callbacks.onEnd;
    utterance.onerror = callbacks.onEnd;
    globalThis.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    return false;
  }
}

export function canSpeak() {
  return hasChromeTts() || hasWebSpeech();
}

export function speak(text, lang = "en-US", callbacks = {}, options = {}) {
  const utteranceText = text?.trim();
  if (!utteranceText) return false;

  const normalizedLang = normalizeLang(lang);
  let ended = false;

  // Chrome TTS 和 Web Speech 都可能从多个终态路径回调，需保证只结束一次。
  const onEnd = () => {
    if (ended) return;
    ended = true;
    if (activeSpeechEnd === onEnd) activeSpeechEnd = null;
    callbacks.onEnd?.();
  };

  // 直接调用 speak 也遵循单实例播放；同时让上一处按钮恢复空闲状态。
  activeSpeechEnd?.();
  activeSpeechEnd = onEnd;

  if (hasChromeTts()) {
    try {
      const ttsOptions = {
        lang: normalizedLang,
        rate: options.rate ?? 1,
        pitch: options.pitch ?? 1,
        volume: options.volume ?? 1,
        onEvent: (event) => {
          if (FINAL_CHROME_TTS_EVENTS.has(event?.type)) {
            onEnd();
          }
        },
      };
      globalThis.chrome.tts.speak(utteranceText, ttsOptions, () => {
        // 读取 lastError，避免 Chrome 控制台出现 Unchecked runtime.lastError。
        if (globalThis.chrome?.runtime?.lastError) {
          if (
            !speakWithWebSpeech(
              utteranceText,
              normalizedLang,
              { onEnd },
              options
            )
          ) {
            onEnd();
          }
        }
      });
      return true;
    } catch (err) {
      const started = speakWithWebSpeech(
        utteranceText,
        normalizedLang,
        { onEnd },
        options
      );
      if (!started) onEnd();
      return started;
    }
  }

  const started = speakWithWebSpeech(
    utteranceText,
    normalizedLang,
    { onEnd },
    options
  );
  if (!started) onEnd();
  return started;
}

export function stopSpeech() {
  globalThis.chrome?.tts?.stop?.();
  globalThis.speechSynthesis?.cancel?.();
  const onEnd = activeSpeechEnd;
  activeSpeechEnd = null;
  onEnd?.();
}

export function pauseSpeech() {
  if (typeof globalThis.chrome?.tts?.pause === "function") {
    globalThis.chrome.tts.pause();
    return true;
  }
  if (typeof globalThis.speechSynthesis?.pause === "function") {
    globalThis.speechSynthesis.pause();
    return true;
  }
  return false;
}

export function resumeSpeech() {
  if (typeof globalThis.chrome?.tts?.resume === "function") {
    globalThis.chrome.tts.resume();
    return true;
  }
  if (typeof globalThis.speechSynthesis?.resume === "function") {
    globalThis.speechSynthesis.resume();
    return true;
  }
  return false;
}
