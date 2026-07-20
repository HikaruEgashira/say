export const DEFAULT_MAX_CHARS = 200;

const SPEECH_BOUNDARIES = new Set([".", ",", "。"]);

export function maxSpeechChars(value?: string): number {
  if (value === undefined) return DEFAULT_MAX_CHARS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, DEFAULT_MAX_CHARS)
    : DEFAULT_MAX_CHARS;
}

export function truncateSpeechText(text: string, maxChars = DEFAULT_MAX_CHARS): string {
  return Array.from(text).slice(0, maxChars).join("");
}

export function selectSpeechText(message: string, maxChars = DEFAULT_MAX_CHARS): string {
  const characters = Array.from(message.replace(/\s+/gu, " ").trim());
  const boundary = characters.findIndex((character) => SPEECH_BOUNDARIES.has(character));
  const end = boundary === -1 ? maxChars : Math.min(boundary + 1, maxChars);
  return characters.slice(0, end).join("");
}
