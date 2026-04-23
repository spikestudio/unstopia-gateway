# TASK-007: 初回カバレッジ計測・現状値確認・閾値確定

| 項目 | 内容 |
|------|------|
| Epic | ES-002 |
| AC | AC-E002-04 |
| 複雑度 | S |
| 依存 | TASK-006 |

## 作業内容

TASK-006 の設定完了後、`pnpm test --coverage` を実行して branch カバレッジの現状値を計測し、E3（CI 品質ゲート）で使用する閾値（60% or 50%）を確定する。

## 実施手順

```bash
# カバレッジ計測実行
cd packages/jimmy && pnpm test --coverage

# 結果を Epic 仕様書の未決定事項セクションに記録
# docs/requirements/ES-002-test-coverage-foundation.md の「未決定事項 #1」を更新
```

## 閾値確定ルール

| 現状値 | 採用閾値 |
|-------|---------|
| 60% 以上 | 60%（branch） |
| 50〜60% 未満 | 50%（branch）でスタートし、E2 完了後に 60% へ段階引き上げ |
| 50% 未満 | ユーザーと相談して閾値を確定 |

## Acceptance Criteria

- [ ] `pnpm test --coverage` の実行後に branch カバレッジ現状値が判明している（AC-E002-04）
- [ ] 目標閾値（60% または 50%）が確定し、Epic 仕様書の未決定事項 #1 が解決済みになっている（AC-E002-04）
