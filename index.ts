import { ElevenLabsClient } from "elevenlabs";
import { writeFile, readFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir, homedir } from "os";

/** bun build --define で埋め込まれるバージョン文字列。未定義時は dev */
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

// Claude Code settings.json のスキーマ
// https://docs.anthropic.com/en/docs/claude-code/hooks

/** hooks[].matcher に一致したときに実行されるコマンド */
interface HookEntry {
  type: "command";
  command: string;
  async?: boolean;
}

/** イベント種別ごとのフック群。matcher で絞り込める */
interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

/** ~/.claude/settings.json の既知フィールド */
interface ClaudeSettings {
  hooks?: {
    Stop?: HookGroup[];
    PreToolUse?: HookGroup[];
    PostToolUse?: HookGroup[];
    Notification?: HookGroup[];
  };
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
}

/** Claude Code が Stop hook の stdin に渡す JSON */
interface StopHookInput {
  /** 二重発火防止フラグ: true のときはフック自身が発火元 */
  stop_hook_active?: boolean;
  last_assistant_message?: string;
}


function getApiKey(): string {
  const result = Bun.spawnSync([
    "security", "find-generic-password",
    "-a", process.env.USER ?? "",
    "-s", "elevenlabs-api-key",
    "-w",
  ], { stderr: "pipe" });
  if (result.exitCode === 0) {
    return result.stdout.toString().trim();
  }
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

  execSync(`afplay "${outPath}"`, { stdio: "pipe" });
}

function check(): void {
  type CheckResult = { label: string; ok: boolean; detail: string };
  const results: CheckResult[] = [];

  const keychainResult = Bun.spawnSync([
    "security", "find-generic-password",
    "-a", process.env.USER ?? "",
    "-s", "elevenlabs-api-key",
    "-w",
  ], { stderr: "pipe" });
  const keychainOk = keychainResult.exitCode === 0 && keychainResult.stdout.toString().trim().length > 0;
  results.push({
    label: "elevenlabs-api-key (Keychain)",
    ok: keychainOk,
    detail: keychainOk ? "found" : "not found",
  });

  const afplayResult = Bun.spawnSync(["which", "afplay"], { stderr: "pipe" });
  const afplayOk = afplayResult.exitCode === 0;
  results.push({
    label: "afplay (macOS)",
    ok: afplayOk,
    detail: afplayOk ? afplayResult.stdout.toString().trim() : "not found",
  });

  let allOk = true;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.label}: ${r.detail}`);
    if (!r.ok) allOk = false;
  }

  process.exit(allOk ? 0 : 1);
}

// Claude Code Stop hook: stdinのJSONからlast_assistant_messageの先頭行を読んで発話
async function hookStop(): Promise<void> {
  const input = await Bun.stdin.text();
  let data: StopHookInput;
  try {
    data = JSON.parse(input) as StopHookInput;
  } catch {
    // stdinが不正なJSONの場合は発話せず正常終了
    process.exit(0);
  }

  if (data.stop_hook_active) process.exit(0);

  const message = data.last_assistant_message ?? "";
  const firstLine = message.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!firstLine) process.exit(0);

  await speak(firstLine);
}

// ~/.claude/settings.json の Stop hooks に say hook を追加する
async function hookInstall(): Promise<void> {
  const hookCommand = `${process.execPath} hook`;

  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settingsText = await readFile(settingsPath, "utf-8").catch(() => null);
  if (settingsText === null) {
    console.error(`settings.json が読み込めませんでした: ${settingsPath}`);
    process.exit(1);
  }

  let settings: ClaudeSettings;
  try {
    settings = JSON.parse(settingsText) as ClaudeSettings;
  } catch (e) {
    console.error(`settings.json のパースに失敗しました: ${e}`);
    process.exit(1);
  }

  const stopHooks: HookGroup[] = settings.hooks?.Stop ?? [];

  const isSayCommand = (cmd: string) =>
    cmd.includes("say hook") || cmd.startsWith("/$bunfs/");

  let updated = false;
  for (const group of stopHooks) {
    for (const h of group.hooks ?? []) {
      if (isSayCommand(h.command)) {
        h.command = hookCommand;
        updated = true;
      }
    }
  }
  if (!updated) {
    const newEntry: HookEntry = { type: "command", command: hookCommand, async: true };
    const firstGroup = stopHooks[0];
    if (firstGroup !== undefined) {
      (firstGroup.hooks ??= []).push(newEntry);
    } else {
      stopHooks.push({ hooks: [newEntry] });
    }
  }

  settings.hooks = { ...settings.hooks, Stop: stopHooks };
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(`${updated ? "更新" : "インストール"}完了: ${hookCommand}`);
}

const args = process.argv.slice(2);

if (args[0] === "version") {
  console.log(VERSION);
} else if (args[0] === "check") {
  check();
} else if (args[0] === "hook" && args[1] === "install") {
  await hookInstall();
} else if (args[0] === "hook") {
  await hookStop();
} else {
  const text = args.join(" ");
  if (!text) {
    console.error("Usage: say <text>");
    console.error("       say version");
    console.error("       say check");
    console.error("       say hook install");
    process.exit(1);
  }
  await speak(text);
}
