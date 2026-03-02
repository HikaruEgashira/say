import { ElevenLabsClient } from "elevenlabs";
import { writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

function getApiKey(): string {
  try {
    const key = Bun.spawnSync([
      "security", "find-generic-password",
      "-a", process.env.USER ?? "",
      "-s", "elevenlabs-api-key",
      "-w",
    ], { stderr: "pipe" });
    if (key.exitCode === 0) {
      return key.stdout.toString().trim();
    }
  } catch {}
  // fallback to env var (for CI / non-macOS)
  const envKey = process.env.ELEVENLABS_API_KEY;
  if (envKey) return envKey;
  console.error("Error: ElevenLabs API key not found in Keychain.\nRun: security add-generic-password -a \"$USER\" -s \"elevenlabs-api-key\" -W");
  process.exit(1);
}

async function speak(text: string): Promise<void> {
  const apiKey = getApiKey();

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
  const client = new ElevenLabsClient({ apiKey });

  const speed = process.env.ELEVENLABS_SPEED ? parseFloat(process.env.ELEVENLABS_SPEED) : 1.3;
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: "eleven_v3",
    output_format: "mp3_44100_128",
    voice_settings: { speed },
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk));
  }

  const outPath = join(tmpdir(), `say-${Date.now()}.mp3`);
  await writeFile(outPath, Buffer.concat(chunks));

  try {
    execSync(`afplay "${outPath}"`, { stdio: "inherit" });
  } catch {
    execSync(`mpg123 "${outPath}"`, { stdio: "inherit" });
  }
}

function check(): void {
  const results: { label: string; ok: boolean; detail: string }[] = [];

  const keychainOk = (() => {
    try {
      const r = Bun.spawnSync([
        "security", "find-generic-password",
        "-a", process.env.USER ?? "",
        "-s", "elevenlabs-api-key",
        "-w",
      ], { stderr: "pipe" });
      return r.exitCode === 0 && r.stdout.toString().trim().length > 0;
    } catch { return false; }
  })();
  results.push({
    label: "elevenlabs-api-key (Keychain)",
    ok: keychainOk,
    detail: keychainOk ? "found" : "not found",
  });

  results.push({
    label: "afplay (macOS)",
    ok: (() => { try { execSync("which afplay", { stdio: "pipe" }); return true; } catch { return false; } })(),
    detail: (() => { try { return execSync("which afplay", { stdio: "pipe" }).toString().trim(); } catch { return "not found"; } })(),
  });

  results.push({
    label: "mise say",
    ok: (() => { try { execSync("mise list | grep say", { stdio: "pipe" }); return true; } catch { return false; } })(),
    detail: (() => { try { return execSync("mise list | grep say", { stdio: "pipe" }).toString().trim() || "not found"; } catch { return "not found"; } })(),
  });

  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    console.log(`${icon} ${r.label}: ${r.detail}`);
    if (!r.ok) allOk = false;
  }

  process.exit(allOk ? 0 : 1);
}

const args = process.argv.slice(2);

if (args[0] === "--check") {
  check();
} else {
  const text = args.join(" ");
  if (!text) {
    console.error("Usage: say <text>");
    console.error("       say --check");
    process.exit(1);
  }
  await speak(text);
}
