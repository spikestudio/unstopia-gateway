# セキュリティ例外記録

最終更新: 2026-04-23（protobufjs@6.8.8 override 解消 — **脆弱性ゼロ達成**）  
audit 実行時: `pnpm audit` (npm registry)

## 概要

`pnpm.overrides` + `node-cron` 3→4 + `grammy` 移行 + `uuid@14.0.0` + `libsignal-node>protobufjs` override により **30 件 → 0 件**を達成。  
現時点で修正不能な脆弱性はない。

## 例外一覧

**(現在は例外なし)**

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
| uuid | 11.1.0 | 14.0.0 | moderate (GHSA-w5hq-g745-h8pq) |
| protobufjs (libsignal-node chain) | 6.8.8 | >=7.5.5 (override) | critical (GHSA-f3wb-9pbb-3jjj) |
