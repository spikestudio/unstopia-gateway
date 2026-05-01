<!-- 配置先: docs/requirements/PD-003-test-coverage-90.md — 相対リンクはこの配置先を前提としている -->
<!-- このフォーマットは Phase 12 以降の軽量版。ADR-013 参照 -->
# PD-003: Phase 3 — テストカバレッジ 90% 達成

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-28 |

## 1. 実現したいこと（機能意図一覧）

- branch カバレッジを現状 50% から 80% に向上させる（unit test で到達可能な上限）
- 対象モジュール優先順: `src/mcp`（0%）、`src/stt`（0%）、`src/cli`（3%）、`src/gateway/api`（31%）、`src/gateway`（33%）、`src/sessions`（66%）、`src/engines`（78%）
- `src/connectors`（discord: 51.38%, slack: 70%, whatsapp: 66.4%, telegram: 82.89%）のカバレッジ向上
- `src/shared`（87%）、`src/cron`（96%）は既に高いため対象外

## 2. Epic マッピング

| # | Epic 名 | 対応する機能意図 | 優先度 |
|---|---------|---------------|--------|
| E1 | src/mcp テストカバレッジ向上 Epic | ・`src/mcp`（0% → 90%以上）のテスト追加 | MUST |
| E2 | src/stt テストカバレッジ向上 Epic | ・`src/stt`（0% → 90%以上）のテスト追加 | MUST |
| E3 | src/cli テストカバレッジ向上 Epic | ・`src/cli`（3% → 90%以上）のテスト追加 | MUST |
| E4 | src/gateway/api テストカバレッジ向上 Epic | ・`src/gateway/api`（31% → 90%以上）のテスト追加 | MUST |
| E5 | src/gateway テストカバレッジ向上 Epic | ・`src/gateway`（33% → 90%以上）のテスト追加 | MUST |
| E6 | src/sessions テストカバレッジ向上 Epic | ・`src/sessions`（66% → 90%以上）のテスト追加 | MUST |
| E7 | src/engines テストカバレッジ向上 Epic | ・`src/engines`（78% → 90%以上）のテスト追加 | MUST |
| E8 | src/connectors テストカバレッジ向上 Epic | ・`src/connectors`（discord: 51.38%, slack: 70%, whatsapp: 66.4%, telegram: 82.89% → 各 90%以上）のテスト追加 | MUST |

## 3. Won't Have（スコープ外）

- `src/shared`（87%）のカバレッジ向上（理由: 既に基準値近くであり、追加コストに対する効果が低い）
- `src/cron`（96%）のカバレッジ向上（理由: 既に基準値を大幅に超えている）
- 機能拡張（Antigravity エンジン、クロスセッション記憶、多層スキル管理 等）（理由: Phase 4 以降で対応する）

---

### 成功基準

- [ ] branch カバレッジが全体で 80% 以上に到達する（unit test 上限）
- [ ] 優先対象モジュール（mcp / stt / cli / gateway/api / gateway / sessions / engines）がそれぞれ 90% 以上を達成する

### 参照ドキュメント

- Phase 定義書 Issue: https://github.com/spikestudio/unstopia-gateway/issues/174
- Milestone: Phase 3: テストカバレッジ 90% 達成
