import { describe, expect, test } from "bun:test";
import { DEFAULT_MAX_CHARS, maxSpeechChars, selectSpeechText, truncateSpeechText } from "./speech-text";

describe("selectSpeechText", () => {
  test.each([
    ["Finished. More details follow.", "Finished."],
    ["Finished, more details follow", "Finished,"],
    ["完了しました。詳細です。", "完了しました。"],
    ["\n  完了しました\n詳細です", "完了しました 詳細です"],
    ["   \n\t", ""],
  ])("selects the first boundary from %p", (message, expected) => {
    expect(selectSpeechText(message)).toBe(expected);
  });

  test("stops at 200 characters when no boundary appears", () => {
    expect(selectSpeechText("あ".repeat(201))).toBe("あ".repeat(DEFAULT_MAX_CHARS));
  });

  test("counts Unicode code points", () => {
    expect(selectSpeechText("😀😀😀", 2)).toBe("😀😀");
    expect(truncateSpeechText("😀😀😀", 2)).toBe("😀😀");
  });
});

describe("maxSpeechChars", () => {
  test.each([undefined, "", "0", "-1", "1.5", "invalid"])("defaults for %p", (value) => {
    expect(maxSpeechChars(value)).toBe(DEFAULT_MAX_CHARS);
  });

  test("accepts a positive integer", () => {
    expect(maxSpeechChars("80")).toBe(80);
  });

  test("does not allow the hard limit to be raised", () => {
    expect(maxSpeechChars("300")).toBe(DEFAULT_MAX_CHARS);
  });
});
