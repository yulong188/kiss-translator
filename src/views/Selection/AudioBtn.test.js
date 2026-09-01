import { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserTtsBtn } from "./AudioBtn";
import {
  canSpeak,
  pauseSpeech,
  resolveSpeechLanguage,
  resumeSpeech,
  speak,
  stopSpeech,
} from "../../libs/speech";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../libs/speech", () => ({
  canSpeak: jest.fn(),
  pauseSpeech: jest.fn(),
  resolveSpeechLanguage: jest.fn(),
  resumeSpeech: jest.fn(),
  speak: jest.fn(),
  stopSpeech: jest.fn(),
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../hooks/Audio", () => ({
  useAudio: () => ({
    error: null,
    ready: true,
    playing: false,
    onPlay: jest.fn(),
  }),
}));

jest.mock("query-string", () => ({
  stringify: jest.fn(() => ""),
}));

function renderBrowserTtsBtn(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<BrowserTtsBtn text="hello" lang="en" {...props} />);
  });

  return { container, root };
}

describe("BrowserTtsBtn", () => {
  beforeEach(() => {
    canSpeak.mockReturnValue(true);
    pauseSpeech.mockReturnValue(true);
    resolveSpeechLanguage.mockReturnValue("en-US");
    resumeSpeech.mockReturnValue(true);
    speak.mockReset();
    stopSpeech.mockReset();
    document.body.innerHTML = "";
  });

  test("does not render when browser speech is unsupported", () => {
    canSpeak.mockReturnValue(false);

    const { container, root } = renderBrowserTtsBtn();

    expect(container.querySelector("button")).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  test("plays, pauses, resumes, and resets after speech ends", () => {
    let onEnd;
    speak.mockImplementation((text, lang, callbacks) => {
      onEnd = callbacks.onEnd;
      return true;
    });

    const { container, root } = renderBrowserTtsBtn({
      englishAccent: "en-GB",
      rate: 0.75,
    });
    const button = container.querySelector("button");

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(stopSpeech).toHaveBeenCalledTimes(1);
    expect(resolveSpeechLanguage).toHaveBeenCalledWith("hello", "en", "en-GB");
    expect(speak).toHaveBeenCalledWith(
      "hello",
      "en-US",
      expect.objectContaining({ onEnd: expect.any(Function) }),
      { rate: 0.75 }
    );
    expect(speak).toHaveBeenCalledTimes(1);
    expect(button.className).toContain("MuiIconButton-colorPrimary");
    expect(button.getAttribute("title")).toBe("暂停朗读");

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(pauseSpeech).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("title")).toBe("继续朗读");

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(resumeSpeech).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("title")).toBe("暂停朗读");

    act(() => {
      onEnd();
    });

    expect(button.className).not.toContain("MuiIconButton-colorPrimary");

    act(() => {
      root.unmount();
    });
  });
});
