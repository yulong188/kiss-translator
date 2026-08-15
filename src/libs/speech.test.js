import {
  canSpeak,
  pauseSpeech,
  resolveSpeechLanguage,
  resumeSpeech,
  speak,
  stopSpeech,
} from "./speech";

describe("speech", () => {
  const originalChrome = globalThis.chrome;
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;

  beforeEach(() => {
    stopSpeech();
    delete globalThis.chrome;
    delete globalThis.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
  });

  afterEach(() => {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }

    if (originalSpeechSynthesis === undefined) {
      delete globalThis.speechSynthesis;
    } else {
      globalThis.speechSynthesis = originalSpeechSynthesis;
    }

    if (originalSpeechSynthesisUtterance === undefined) {
      delete globalThis.SpeechSynthesisUtterance;
    } else {
      globalThis.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
    }
  });

  test("uses chrome tts first when available", () => {
    const chromeSpeak = jest.fn();
    const webSpeak = jest.fn();
    globalThis.chrome = { tts: { speak: chromeSpeak } };
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = jest.fn();

    expect(canSpeak()).toBe(true);
    expect(speak("search", "en")).toBe(true);
    expect(chromeSpeak).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({ lang: "en-US", onEvent: expect.any(Function) }),
      expect.any(Function)
    );
    expect(webSpeak).not.toHaveBeenCalled();
  });

  test("normalizes automatic language detection values for chrome tts", () => {
    const chromeSpeak = jest.fn();
    globalThis.chrome = { tts: { speak: chromeSpeak } };

    expect(speak("search", "auto")).toBe(true);
    expect(chromeSpeak).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({ lang: "en-US", onEvent: expect.any(Function) }),
      expect.any(Function)
    );
  });

  test("resolves automatic Chinese and the configured English accent", () => {
    expect(resolveSpeechLanguage("不锈钢储罐", "auto", "en-GB")).toBe("zh-CN");
    expect(resolveSpeechLanguage("stainless steel tank", "auto", "en-GB")).toBe(
      "en-GB"
    );
    expect(resolveSpeechLanguage("tank", "en", "en-GB")).toBe("en-GB");
  });

  test("passes speaking rate to chrome tts", () => {
    const chromeSpeak = jest.fn();
    globalThis.chrome = { tts: { speak: chromeSpeak } };

    expect(speak("storage tank", "en-US", {}, { rate: 0.75 })).toBe(true);
    expect(chromeSpeak).toHaveBeenCalledWith(
      "storage tank",
      expect.objectContaining({ rate: 0.75, pitch: 1, volume: 1 }),
      expect.any(Function)
    );
  });

  test("runs onEnd when chrome tts reports a final event", () => {
    let chromeOnEvent;
    const onEnd = jest.fn();
    globalThis.chrome = {
      tts: {
        speak: jest.fn((text, options) => {
          chromeOnEvent = options.onEvent;
        }),
      },
    };

    expect(speak("search", "en", { onEnd })).toBe(true);
    chromeOnEvent({ type: "end" });
    chromeOnEvent({ type: "end" });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test("falls back to Web Speech API", () => {
    const webSpeak = jest.fn();
    function MockUtterance(text) {
      this.text = text;
      this.lang = "";
    }
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    expect(canSpeak()).toBe(true);
    expect(speak("search", "en-GB")).toBe(true);
    expect(webSpeak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "search", lang: "en-GB" })
    );
  });

  test("passes speaking rate to Web Speech", () => {
    const webSpeak = jest.fn();
    function MockUtterance(text) {
      this.text = text;
    }
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    expect(speak("storage tank", "en-GB", {}, { rate: 1.25 })).toBe(true);
    expect(webSpeak).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "en-GB", rate: 1.25 })
    );
  });

  test("controls the active chrome tts session", () => {
    const onEnd = jest.fn();
    globalThis.chrome = {
      tts: {
        speak: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
      },
    };

    speak("storage tank", "en", { onEnd });
    expect(pauseSpeech()).toBe(true);
    expect(resumeSpeech()).toBe(true);
    stopSpeech();

    expect(globalThis.chrome.tts.pause).toHaveBeenCalledTimes(1);
    expect(globalThis.chrome.tts.resume).toHaveBeenCalledTimes(1);
    expect(globalThis.chrome.tts.stop).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test("falls back to Web Speech API when chrome tts throws", () => {
    const webSpeak = jest.fn();
    function MockUtterance(text) {
      this.text = text;
      this.lang = "";
    }
    globalThis.chrome = {
      tts: {
        speak: jest.fn(() => {
          throw new Error("tts unavailable");
        }),
      },
    };
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    expect(speak("search", "en")).toBe(true);
    expect(webSpeak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "search", lang: "en-US" })
    );
  });

  test("runs onEnd when Web Speech finishes", () => {
    const webSpeak = jest.fn();
    const onEnd = jest.fn();
    function MockUtterance(text) {
      this.text = text;
      this.lang = "";
      this.onend = null;
      this.onerror = null;
    }
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    expect(speak("search", "en", { onEnd })).toBe(true);
    webSpeak.mock.calls[0][0].onend();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test("checks chrome runtime errors in callback and falls back", () => {
    const webSpeak = jest.fn();
    let chromeCallback;
    function MockUtterance(text) {
      this.text = text;
      this.lang = "";
    }
    globalThis.chrome = {
      runtime: { lastError: { message: "Invalid lang." } },
      tts: {
        speak: jest.fn((text, options, callback) => {
          chromeCallback = callback;
        }),
      },
    };
    globalThis.speechSynthesis = { speak: webSpeak };
    globalThis.SpeechSynthesisUtterance = MockUtterance;

    expect(speak("search", "auto")).toBe(true);
    chromeCallback();
    expect(webSpeak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "search", lang: "en-US" })
    );
  });

  test("returns false when speech is unsupported", () => {
    expect(canSpeak()).toBe(false);
    expect(speak("search", "en")).toBe(false);
  });
});
