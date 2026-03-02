# say-setup

`say` CLI (ElevenLabs v3 TTS) のインストールとパーソナライズを行うウィザード。

## 手順

以下のステップを順番に実行すること。
ステップごとに、say --checkコマンドで確認を行ってください。

### 1. インストール

```bash
mise use -g github:HikaruEgashira/say
```

### 2. API キー設定

ユーザーに「API キーを入力してください」と伝え、以下のコマンドをユーザーに案内する（実行はユーザー自身が行う）

```bash
security add-generic-password -a "$USER" -s "elevenlabs-api-key" -w
```

> API キーは https://elevenlabs.io/app/settings/api-keys で取得できる。

### 3. パーソナライズ質問（1問ずつ聞くこと）

以下を順番に1問ずつユーザーに確認する

1. 言語: 通知は日本語・英語・どちら？
2. 完了トーン: `[excited]` 元気に / `[calm]` 落ち着いて / `[relieved]` ほっとした感じ
3. エラートーン: `[sighs]` ため息 / `[frustrated]` 残念そう / `[calm]` 淡々と
4. 詳細度: 1文で簡潔 / キーワードのみ / 詳細に

### 4. CLAUDE.md スニペット生成と書き込み

回答を元にスニペットを生成してユーザーに見せ、`~/.claude/CLAUDE.md` の `<bash>` ブロックへの追記を確認してから書き込む。

生成例（English / calm / frustrated / keyword）:
```
- On task completion, run `say` to announce what was done in English.
  - Done: `say "[calm] <keyword summary> complete"`
  - Error: `say "[frustrated] Task failed, please check the output"`
```

### 5. 動作テスト

```bash
say "[excited] Setup is complete!"
```

## ElevenLabs v3 Audio Tags

ユーザーの指示に応えるように利用してください。

| カテゴリ | タグ |
|---|---|
| 感情 | `[excited]` `[calm]` `[relieved]` `[nervous]` `[frustrated]` `[sorrowful]` |
| リアクション | `[sighs]` `[laughs]` `[gasps]` `[whispers]` |
| 間・テンポ | `[pause]` `[short pause]` `[long pause]` `[rushed]` |

> ⚠️ `eleven_v3` は SSML `<break>` 非対応。代わりに `[pause]` を使うこと。
