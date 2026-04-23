# TASK-004: pnpm audit 確認・security-exceptions.md 更新

| 項目 | 内容 |
|------|------|
| Epic | ES-001 |
| AC | AC-4 |
| 複雑度 | S |
| 依存 | TASK-002（node-telegram-bot-api が除去されていること） |

## 作業内容

`pnpm audit` を実行し、request chain 由来の脆弱性 3 件が消滅していることを確認する。
その後 `docs/research/security-exceptions.md` から該当 3 件を削除する。

## 変更ファイル

- `docs/research/security-exceptions.md`

## 実施手順

```bash
# 1. audit 実行
pnpm audit

# 2. request chain 由来の advisory が消えていることを確認
pnpm audit --json | python3 -c "
import sys, json
d = json.load(sys.stdin)
a = d.get('advisories', {})
request_related = [v['module_name'] for v in a.values()
                   if v['module_name'] in ['request', 'tough-cookie', 'uuid']]
print('Still present:', request_related)
print('Total advisories:', len(a))
"
```

## security-exceptions.md の更新

以下の 3 セクションを削除する:
- `### [moderate] request@2.88.2 — SSRF (Server-Side Request Forgery)`
- `### [moderate] tough-cookie@2.5.0 — Prototype Pollution`
- `### [moderate] uuid@8.3.2 — Buffer Bounds Check 欠落`

また「修正済み脆弱性」表に以下を追記する:
```
| node-telegram-bot-api | 0.67.0 | 除去（grammy に移行） | — (request chain を完全除去) |
```

## Acceptance Criteria

- [ ] `pnpm audit` の出力に `request`, `tough-cookie`, `uuid` の advisory が含まれていない（Telegram 経路）
- [ ] `docs/research/security-exceptions.md` から該当 3 セクションが削除されている
- [ ] 「修正済み脆弱性」表が最新の状態になっている
- [ ] 残存脆弱性は `protobufjs@6.8.8`（baileys 経由）のみであることを確認
