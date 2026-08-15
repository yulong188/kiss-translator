import {
  DEFAULT_INPUT_RULE,
  DEFAULT_MOUSE_HOVER_SETTING,
  DEFAULT_SETTING,
  DEFAULT_SUBTITLE_SETTING,
  DEFAULT_TRANBOX_SETTING,
} from "./setting";
import { OPT_TRANS_DEEPSEEK, OPT_TRANS_MICROSOFT } from "./api";
import { DEFAULT_TRADE_TERM_PROMPT_SLUG } from "./prompt";
import { GLOBAL_KEY } from "./rules";

describe("translation box defaults", () => {
  test("translates language variants by default", () => {
    expect(DEFAULT_SETTING.translateVariants).toBe(true);
  });

  test("does not read the clipboard automatically by default", () => {
    expect(DEFAULT_SETTING.autoTranslateClipboard).toBe(false);
  });

  test("uses Microsoft for every default translation entry point", () => {
    expect(DEFAULT_INPUT_RULE.apiSlug).toBe(OPT_TRANS_MICROSOFT);
    expect(DEFAULT_TRANBOX_SETTING.apiSlugs).toEqual([OPT_TRANS_MICROSOFT]);
    expect(DEFAULT_SUBTITLE_SETTING.apiSlug).toBe(OPT_TRANS_MICROSOFT);
  });

  test("does not ignore any language by default", () => {
    expect(DEFAULT_TRANBOX_SETTING.skipLangs).toEqual([]);
  });

  test("enables the DeepSeek foreign-trade learning card by default", () => {
    expect(DEFAULT_TRANBOX_SETTING.tradeTermLearning).toBe(true);
    expect(DEFAULT_TRANBOX_SETTING.tradeTermApiSlug).toBe(OPT_TRANS_DEEPSEEK);
    expect(DEFAULT_TRANBOX_SETTING.tradeTermPromptSlug).toBe(
      DEFAULT_TRADE_TERM_PROMPT_SLUG
    );
  });

  test("enables system speech with a neutral default speed", () => {
    expect(DEFAULT_TRANBOX_SETTING.ttsEnabled).toBe(true);
    expect(DEFAULT_TRANBOX_SETTING.ttsEnglishAccent).toBe("en-US");
    expect(DEFAULT_TRANBOX_SETTING.ttsRate).toBe(1);
  });

  test("follows the current page rule for hover bubbles by default", () => {
    expect(DEFAULT_MOUSE_HOVER_SETTING.apiSlug).toBe(GLOBAL_KEY);
  });
});
