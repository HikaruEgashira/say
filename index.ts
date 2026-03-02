import { ElevenLabsClient } from "elevenlabs";
import { writeFile, readFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir, homedir } from "os";

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

  const tmpBase = process.env.TMPDIR ?? tmpdir();
  const outPath = join(tmpBase, `say-${Date.now()}.mp3`);
  await writeFile(outPath, Buffer.concat(chunks));

  const players = [
    `afplay "${outPath}"`,
    `open -W -a "QuickTime Player" "${outPath}"`,
    `mpg123 "${outPath}"`,
  ];
  let played = false;
  for (const cmd of players) {
    try {
      execSync(cmd, { stdio: "pipe" });
      played = true;
      break;
    } catch {}
  }
  if (!played) throw new Error("No audio player succeeded");
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

// Claude Code Stop hook: stdinのJSONからlast_assistant_messageの先頭行を読んで発話
async function hookStop(): Promise<void> {
  const input = await Bun.stdin.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  if (data.stop_hook_active) process.exit(0);

  const message = typeof data.last_assistant_message === "string" ? data.last_assistant_message : "";
  const firstLine = message.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!firstLine) process.exit(0);

  await speak(firstLine);
}

// ~/.claude/settings.json の Stop hooks に say --hook を追加する
async function hookInstall(): Promise<void> {
  const sayBin = join(import.meta.dir, "say");
  const hookCommand = sayBin;

  const settingsPath = join(homedir(), ".claude", "settings.json");
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(await readFile(settingsPath, "utf-8"));
  } catch {
    console.error(`settings.json が読み込めませんでした: ${settingsPath}`);
    process.exit(1);
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const stopHooks = (Array.isArray(hooks.Stop) ? hooks.Stop : []) as Array<{ hooks: Array<{ type: string; command: string; async?: boolean }> }>;

  // 既存エントリの重複チェック
  const alreadyExists = stopHooks.some((group) =>
    group.hooks?.some((h) => h.command === hookCommand)
  );
  if (alreadyExists) {
    console.log("すでにインストール済みです。");
    process.exit(0);
  }

  // 既存グループがあれば追加、なければ新規グループ作成
  if (stopHooks.length > 0) {
    stopHooks[0].hooks.push({ type: "command", command: hookCommand, async: true });
  } else {
    stopHooks.push({ hooks: [{ type: "command", command: hookCommand, async: true }] });
  }

  hooks.Stop = stopHooks;
  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(`インストール完了: ${hookCommand}`);
}

const args = process.argv.slice(2);

if (args[0] === "--check") {
  check();
} else if (args[0] === "hook") {
  await hookInstall();
} else if (!process.stdin.isTTY) {
  // TTY なし = パイプ/hook経由 → Stop hook モード
  await hookStop();
} else {
  const text = args.join(" ");
  if (!text) {
    console.error("Usage: say <text>");
    console.error("       say --check");
    console.error("       say hook");
    process.exit(1);
  }
  await speak(text);
}
