# セキュリティ例外記録

最終更新: 2026-04-23（node-cron 4.x 更新後）  
audit 実行時: `pnpm audit` (npm registry)

## 概要

`pnpm.overrides` + `node-cron` 3→4 アップグレードにより 30 件 → 4 件に削減済み。  
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

### [moderate] request@2.88.2 — SSRF (Server-Side Request Forgery)

| 項目 | 内容 |
|------|------|
| CVE | GHSA-p8p7-x288-28g6 |
| 深刻度 | moderate |
| 修正バージョン | なし（deprecated パッケージ） |
| 依存パス | `packages/jimmy > node-telegram-bot-api@0.67.0 > request@2.88.2` |
| 修正不能の理由 | `request` パッケージは deprecated で修正版が存在しない。`node-telegram-bot-api` が `request` に強依存しており、代替なしには除去できない。 |
| 緩和策 | Telegram Bot API 通信は Telegram サーバーへの HTTPS リクエストのみ。任意 URL へのリクエストをアプリケーションコードから行っていない。 |
| 解消条件 | `node-telegram-bot-api` を `node-telegram-bot-api` 後継または `grammy` / `telegraf` 等の request-free ライブラリに置き換える。 |

---

### [moderate] tough-cookie@2.5.0 — Prototype Pollution

| 項目 | 内容 |
|------|------|
| CVE | GHSA-72xf-g2v4-qvf3 |
| 深刻度 | moderate |
| 修正バージョン | >=4.1.3 |
| 依存パス | `packages/jimmy > node-telegram-bot-api@0.67.0 > request@2.88.2 > tough-cookie@2.5.0` |
| 修正不能の理由 | `request@2.88.2` が tough-cookie 2.x API に依存しており、4.x への上書きで request が破壊される。request 自体の修正版が存在しないため連鎖的に対処不能。 |
| 緩和策 | `request` 経由上記同様。クッキー処理は Telegram サーバーとのセッション管理のみ。 |
| 解消条件 | `node-telegram-bot-api` 置き換えにより request ごと除去。 |

---

### [moderate] uuid@8.3.2 — Buffer Bounds Check 欠落

| 項目 | 内容 |
|------|------|
| CVE | GHSA-w5hq-g745-h8pq |
| 深刻度 | moderate |
| 修正バージョン | >=14.0.0 |
| 依存パス | `packages/jimmy > node-telegram-bot-api@0.67.0 > @cypress/request@3.0.10 > uuid@8.3.2` |
| 修正不能の理由 | 修正バージョンは uuid 14.x（メジャー番号 8→14、API 破壊的変更）。`@cypress/request@3.0.10` が uuid 8.x API に依存しており上書きで破壊される。node-cron 経由のパスは node-cron 4.x 更新で解消済み。 |
| 緩和策 | uuid は HTTP リクエストの内部 boundary 生成に使用。外部からの `buf` パラメータ付き uuid 呼び出しは行っていない（CVE の攻撃条件に該当しない）。 |
| 解消条件 | `node-telegram-bot-api` を `grammy` 等に置き換えることで `@cypress/request` ごと除去可能。 |

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
