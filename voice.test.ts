import { describe, expect, test } from "bun:test";
import { DEFAULT_VOICE, configuredVoice, describeVoice, voiceMatchesExpectation } from "./voice";

describe("configuredVoice", () => {
  test.each([undefined, "", "  "])("uses the identifiable default for %p", (value) => {
    expect(configuredVoice(value, undefined)).toEqual({
      id: DEFAULT_VOICE.id,
      expectedName: DEFAULT_VOICE.name,
      source: "default",
    });
  });

  test("preserves an explicitly named environment voice", () => {
    expect(configuredVoice(" custom ", " Chosen Voice ")).toEqual({
      id: "custom",
      expectedName: "Chosen Voice",
      source: "environment",
    });
  });
});

test("a valid but unintended voice fails the expected-name check", () => {
  const config = configuredVoice("george", "Yui");
  const voice = { voice_id: "george", name: "George" };
  expect(voiceMatchesExpectation(config, voice)).toBe(false);
  expect(describeVoice(config, voice)).toContain("source=environment; expected=Yui");
});
