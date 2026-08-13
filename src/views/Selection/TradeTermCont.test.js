import { act } from "react";
import { createRoot } from "react-dom/client";
import { apiDict } from "../../apis";
import TradeTermCont from "./TradeTermCont";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../apis", () => ({
  apiDict: jest.fn(),
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("react-markdown", () => {
  const React = require("react");
  return ({ children }) => React.createElement("div", null, children);
});

jest.mock("./CopyBtn", () => {
  const React = require("react");
  return ({ text }) =>
    React.createElement("button", { "data-copy-text": text }, "copy");
});

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderTradeTermCont(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TradeTermCont
        text="PVC hose"
        fromLang="en"
        context="We supply reinforced PVC hose for industrial applications."
        apiSetting={{
          apiSlug: "DeepSeek",
          apiType: "DeepSeek",
          dictPrompt: "trade prompt",
          dictUserPrompt: "trade user prompt",
        }}
        {...props}
      />
    );
  });

  return { container, root };
}

describe("TradeTermCont", () => {
  beforeEach(() => {
    apiDict.mockReset();
    document.body.innerHTML = "";
  });

  test.each([
    ["PVC hose", "en"],
    ["聚氯乙烯软管", "zh-CN"],
  ])(
    "analyzes English learning points for %s input",
    async (text, fromLang) => {
      apiDict.mockResolvedValueOnce(
        "**推荐表达**：`PVC hose`\n\n- **PVC** — polyvinyl chloride\n- **hose** — 软管"
      );

      const { container, root } = renderTradeTermCont({ text, fromLang });
      await flushEffects();

      expect(apiDict).toHaveBeenCalledWith(
        expect.objectContaining({
          text,
          fromLang,
          toLang: "zh-CN",
          context: "We supply reinforced PVC hose for industrial applications.",
          apiSetting: expect.objectContaining({ apiSlug: "DeepSeek" }),
        })
      );
      expect(container.textContent).toContain("polyvinyl chloride");
      expect(
        container.querySelector("[data-copy-text]").dataset.copyText
      ).toContain("PVC hose");

      act(() => root.unmount());
    }
  );

  test("renders streamed learning content before completion", async () => {
    let resolveRequest;
    apiDict.mockImplementationOnce(
      ({ onStreamChunk }) =>
        new Promise((resolve) => {
          resolveRequest = resolve;
          onStreamChunk({ markdown: "**推荐表达**：`PVC hose`" });
        })
    );

    const { container, root } = renderTradeTermCont();
    await flushEffects();
    expect(container.textContent).toContain("PVC hose");

    await act(async () => {
      resolveRequest("**推荐表达**：`PVC hose`\n\n完整解释");
      await Promise.resolve();
    });
    expect(container.textContent).toContain("完整解释");

    act(() => root.unmount());
  });
});
