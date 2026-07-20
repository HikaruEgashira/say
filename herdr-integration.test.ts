import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function fixture(): Promise<{ directory: string; herdr: string; sayHook: string }> {
  const directory = await mkdtemp(join(tmpdir(), "say-hook-test-"));
  temporaryDirectories.push(directory);
  const sayHook = join(directory, "say-hook");
  const herdr = join(directory, "herdr");
  await writeFile(sayHook, `#!/bin/sh
if [ "$1" = excerpt ]; then
  exec bun run "$SAY_HOOK_ROOT/index.ts" excerpt
fi
printf '%s' "$1" > "$SAY_HOOK_CAPTURE"
`);
  await writeFile(herdr, `#!/bin/sh
if [ "$1" = pane ] && [ "$2" = get ]; then
  printf '{"result":{"pane":{"title":null}}}'
  exit 0
fi
if [ "$1" = pane ] && [ "$2" = read ]; then
  printf '%s' "$HERDR_PANE_OUTPUT"
  exit 0
fi
printf '%s\n' "$@" > "$HERDR_CAPTURE"
`);
  await Promise.all([chmod(sayHook, 0o755), chmod(herdr, 0o755)]);
  return { directory, herdr, sayHook };
}

describe("Herdr integration", () => {
  test("reports the same excerpt from the Claude Stop hook", async () => {
    const { directory, herdr, sayHook } = await fixture();
    const capture = join(directory, "herdr.args");
    const process = Bun.spawn(["sh", "herdr/claude-stop-title.sh"], {
      env: {
        ...Bun.env,
        HERDR_CAPTURE: capture,
        HERDR_ENV: "1",
        HERDR_BIN_PATH: herdr,
        HERDR_PANE_ID: "pane-1",
        SAY_BIN: sayHook,
        SAY_HOOK_ROOT: import.meta.dir,
      },
      stdin: "pipe",
    });
    process.stdin.write(JSON.stringify({ last_assistant_message: "完了しました。\n詳細です" }));
    process.stdin.end();
    expect(await process.exited).toBe(0);
    const args = (await readFile(capture, "utf8")).trim().split("\n");
    expect(args.slice(args.indexOf("--title"), args.indexOf("--title") + 2)).toEqual(["--title", "完了しました。"]);
  });

  test("applies the excerpt contract to pane titles", async () => {
    const { directory, herdr, sayHook } = await fixture();
    const capture = join(directory, "spoken.txt");
    const process = Bun.spawn(["sh", "herdr/say-hook-speak.sh"], {
      env: {
        ...Bun.env,
        HERDR_BIN_PATH: herdr,
        HERDR_PLUGIN_EVENT_JSON: JSON.stringify({ data: { agent_status: "done", title: "Finished, details follow" } }),
        SAY_BIN: sayHook,
        SAY_HOOK_CAPTURE: capture,
        SAY_HOOK_ROOT: import.meta.dir,
      },
    });
    expect(await process.exited).toBe(0);
    expect(await readFile(capture, "utf8")).toBe("Finished,");
  });

  test("persists a configured say-hook path when installing the Claude hook", async () => {
    const { directory, herdr, sayHook } = await fixture();
    const config = join(directory, "config");
    const home = join(directory, "home");
    const capture = join(directory, "herdr.args");
    await Promise.all([mkdir(config), mkdir(home)]);
    await writeFile(join(config, ".env"), `SAY_BIN='${sayHook}'\n`);
    const install = Bun.spawnSync(["sh", "herdr/say-hook-speak.sh", "--install-claude-hook"], {
      env: {
        ...Bun.env,
        HERDR_PLUGIN_CONFIG_DIR: config,
        HERDR_PLUGIN_ROOT: join(import.meta.dir, "herdr"),
        HOME: home,
      },
    });
    expect(install.exitCode).toBe(0);
    const settings = JSON.parse(await readFile(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.Stop[0].hooks[0].command as string;
    expect(command).toContain(sayHook);

    const process = Bun.spawn(["sh", "-c", command], {
      env: {
        HERDR_CAPTURE: capture,
        HERDR_ENV: "1",
        HERDR_BIN_PATH: herdr,
        HERDR_PANE_ID: "pane-1",
        HOME: home,
        PATH: Bun.env.PATH ?? "",
        SAY_HOOK_ROOT: import.meta.dir,
      },
      stdin: "pipe",
    });
    process.stdin.write(JSON.stringify({ last_assistant_message: "完了しました。詳細です" }));
    process.stdin.end();
    expect(await process.exited).toBe(0);
    expect(await readFile(capture, "utf8")).toContain("完了しました。");
  });

  test("identifies the configured voice before the Herdr test speaks", async () => {
    const { directory, sayHook } = await fixture();
    const capture = join(directory, "say-hook.args");
    await writeFile(sayHook, `#!/bin/sh
printf '%s\n' "$1" >> "$SAY_HOOK_CAPTURE"
if [ "$1" = check ]; then
  echo '✓ ElevenLabs voice: Yui'
fi
`);
    await chmod(sayHook, 0o755);

    const process = Bun.spawnSync(["sh", "herdr/say-hook-speak.sh", "--test"], {
      env: { ...Bun.env, SAY_BIN: sayHook, SAY_HOOK_CAPTURE: capture },
    });
    expect(process.exitCode).toBe(0);
    expect(process.stdout.toString()).toContain("ElevenLabs voice: Yui");
    expect((await readFile(capture, "utf8")).trim().split("\n")).toEqual([
      "check",
      "This is a test line from the Herdr say-hook plugin.",
    ]);
  });

  test("does not speak when the configured voice check fails", async () => {
    const { directory, sayHook } = await fixture();
    const capture = join(directory, "say-hook.args");
    await writeFile(sayHook, `#!/bin/sh
printf '%s\n' "$1" >> "$SAY_HOOK_CAPTURE"
[ "$1" != check ]
`);
    await chmod(sayHook, 0o755);

    const process = Bun.spawnSync(["sh", "herdr/say-hook-speak.sh", "--test"], {
      env: { ...Bun.env, SAY_BIN: sayHook, SAY_HOOK_CAPTURE: capture },
    });
    expect(process.exitCode).toBe(1);
    expect((await readFile(capture, "utf8")).trim()).toBe("check");
    expect(process.stdout.toString()).not.toContain("Speaking:");
  });

  test("checks the voice from the effective Herdr environment", async () => {
    const { directory, sayHook } = await fixture();
    const config = join(directory, "config");
    const capture = join(directory, "voice.txt");
    await mkdir(config);
    await writeFile(join(config, ".env"), `SAY_BIN='${sayHook}'
ELEVENLABS_VOICE_ID=voice-id
ELEVENLABS_VOICE_NAME='Chosen Voice'
`);
    await writeFile(sayHook, `#!/bin/sh
printf '%s|%s|%s' "$1" "$ELEVENLABS_VOICE_ID" "$ELEVENLABS_VOICE_NAME" > "$SAY_HOOK_CAPTURE"
`);
    await chmod(sayHook, 0o755);

    const process = Bun.spawnSync(["sh", "herdr/say-hook-speak.sh", "--check"], {
      env: { ...Bun.env, HERDR_PLUGIN_CONFIG_DIR: config, SAY_HOOK_CAPTURE: capture },
    });
    expect(process.exitCode).toBe(0);
    expect(await readFile(capture, "utf8")).toBe("check|voice-id|Chosen Voice");
  });

  test("joins unanchored screen rows before selecting the excerpt", async () => {
    const { directory, herdr, sayHook } = await fixture();
    const capture = join(directory, "spoken.txt");
    const process = Bun.spawn(["sh", "herdr/say-hook-speak.sh"], {
      env: {
        ...Bun.env,
        HERDR_BIN_PATH: herdr,
        HERDR_PANE_OUTPUT: "First row\ncontinues. Later details",
        HERDR_PLUGIN_EVENT_JSON: JSON.stringify({ data: { agent_status: "done", pane_id: "pane-1" } }),
        SAY_BIN: sayHook,
        SAY_HOOK_CAPTURE: capture,
        SAY_HOOK_ROOT: import.meta.dir,
      },
    });
    expect(await process.exited).toBe(0);
    expect(await readFile(capture, "utf8")).toBe("First row continues.");
  });
});
