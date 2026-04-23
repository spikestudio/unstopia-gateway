# セキュリティ例外記録

最終更新: 2026-04-23（grammy 移行後 — request chain 3 件を根本解消）  
audit 実行時: `pnpm audit` (npm registry)

## 概要

`pnpm.overrides` + `node-cron` 3→4 アップグレード + `grammy` 移行により 30 件 → 2 件に削減済み。  
以下は技術的制約により現時点で修正不能な脆弱性の記録。

---

## 例外一覧

### [critical] protobufjs@6.8.8 — 任意コード実行

| 項目 | 内容 |
|------|------|
| CVE | GHSA-f3wb-9pbb-3jjj |
| 深刻度 | critical |
| 修正バージョン | >=7.5.5 |
| 依存パス | `packages/jimmy > @whiskeysockets/baileys@7.0.0-rc.9 > @whiskeysockets/libsignal-node > protobufjs@6.8.8` |
| 修正不能の理由 | `@whiskeysockets/libsignal-node` が protobufjs 6.x API に依存しており、7.x への上書きは API 破壊となる。`@whiskeysockets/baileys` の上流で libsignal-node が更新されるまで対処不能。 |
| 緩和策 | protobufjs@6.8.8 の使用は WhatsApp セッション処理の内部プロセスに限定。外部入力を直接渡す経路はない。 |
| 解消条件 | `@whiskeysockets/baileys` が `@whiskeysockets/libsignal-node` の新版（protobufjs 7.x 以降対応）に更新された時点で `@whiskeysockets/baileys>protobufjs` override を削除し再テスト。 |

---

### [moderate] uuid@11.1.0 — Buffer Bounds Check 欠落

| 項目 | 内容 |
|------|------|
| CVE | GHSA-w5hq-g745-h8pq |
| 深刻度 | moderate |
| 修正バージョン | >=14.0.0 |
| 依存パス | `packages/jimmy > uuid@11.1.0` |
| 修正不能の理由 | 修正バージョンは uuid 14.x（メジャー番号、API 破壊的変更の可能性あり）。プロジェクト直接依存として uuid@11.x を使用中。node-telegram-bot-api 経由の旧パス（uuid@8.3.2）は grammy 移行で除去済み。 |
| 緩和策 | uuid はセッション ID 生成に使用。外部からの `buf` パラメータ付き uuid 呼び出しは行っていない（CVE の攻撃条件に該当しない）。 |
| 解消条件 | `uuid@14.x` に更新可能になった時点でアップグレードを検討。 |

---

## 修正済み脆弱性（`pnpm.overrides` 適用）

| パッケージ | 旧バージョン | 新バージョン | 深刻度 |
|-----------|------------|------------|-------|
| axios | 1.13.6 | >=1.15.2 | moderate |
| follow-redirects | 1.15.11 | >=1.16.0 | moderate |
| path-to-regexp | 8.3.0 | >=8.4.0 | high/moderate |
| lodash | 4.17.23 | >=4.18.0 | high/moderate |
| undici | 6.21.3 | >=6.24.0 | high/moderate |
| picomatch | 4.0.3 | >=4.0.4 | high/moderate |
| vite | 8.0.0 | >=8.0.5 | high/moderate |
| next | <15.5.15 | ^15.5.15 | high/moderate |
| protobufjs (baileys chain) | 7.5.4 | >=7.5.5 | critical |
| request>form-data | 2.3.3 | ^2.5.4 | critical |
| request>qs | 6.x古版 | ^6.14.1 | moderate |
| node-cron | 3.0.3 | 4.2.1 | — (uuid 依存を完全除去) |
| node-telegram-bot-api | 0.67.0 | 除去（grammy に移行） | — (request chain を完全除去) |
