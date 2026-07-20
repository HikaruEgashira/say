export const DEFAULT_VOICE = {
  id: "fUjY9K2nAIwlALOwSiwc",
  name: "Yui - Japanese girl female Anime voice",
} as const;

export interface VoiceIdentity {
  voice_id: string;
  name?: string;
  labels?: Record<string, string>;
}

export interface VoiceConfiguration {
  id: string;
  expectedName?: string;
  source: "default" | "environment";
}

export function configuredVoice(idValue: string | undefined, nameValue: string | undefined): VoiceConfiguration {
  const id = idValue?.trim();
  if (!id) return { id: DEFAULT_VOICE.id, expectedName: DEFAULT_VOICE.name, source: "default" };
  const expectedName = nameValue?.trim() || (id === DEFAULT_VOICE.id ? DEFAULT_VOICE.name : undefined);
  return { id, expectedName, source: "environment" };
}

export function voiceMatchesExpectation(config: VoiceConfiguration, voice: VoiceIdentity): boolean {
  return config.expectedName === undefined || config.expectedName === voice.name;
}

export function describeVoice(config: VoiceConfiguration, voice: VoiceIdentity): string {
  const labels = ["language", "gender", "age", "descriptive"]
    .flatMap((key) => voice.labels?.[key] ?? []);
  const attributes = labels.length > 0 ? `; ${labels.join(", ")}` : "";
  const mismatch = config.expectedName && !voiceMatchesExpectation(config, voice)
    ? `; expected=${config.expectedName}`
    : "";
  return `${voice.name ?? "unnamed"} (${voice.voice_id}${attributes}; source=${config.source}${mismatch})`;
}
