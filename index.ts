import { ElevenLabsClient } from "elevenlabs";
import { writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

async function speak(text: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("Error: ELEVENLABS_API_KEY is not set in .env");
    process.exit(1);
  }

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

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error("Usage: say <text>");
  process.exit(1);
}

await speak(text);
