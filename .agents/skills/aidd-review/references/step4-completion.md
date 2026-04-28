# Step 4: 完了処理 — /aidd-review

Step 3 の処理結果（修正済み件数・見送り件数）と PASS/FAIL 判定に基づいて、種別ごとの完了処理を実行する。

## 4-1. PASS/FAIL 判定基準

| 判定 | 条件 |
|------|------|
| **PASS** | critical が 0 件（修正済みまたは理由付き見送りで全件処理済み） |
| **FAIL** | critical が 1 件以上残存（未処理または理由なし見送りが存在） |

> non-critical の見送りは PASS/FAIL 判定に影響しない。

## 4-2. 種別ごとの完了処理

### `code` — コードレビュー

**PASS 時:**

```bash
gh pr comment <PR番号> --body "<!-- merge-guard:code-review timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ✅ Code Review PASS

| 項目 | 結果 |
|------|------|
| 検出問題数（critical） | [M] 件（全件処理済み） |
| 検出問題数（non-critical） | [N] 件（全件処理済み） |
| 修正済み | [P] 件 |
| 見送り（理由記録済み） | [Q] 件 |

### 問題サマリー
[問題一覧（修正済み・見送り分類付き）]
<!-- /merge-guard:code-review -->"
```

**FAIL 時:**

```bash
gh pr comment <PR番号> --body "<!-- merge-guard:code-review-fail timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ❌ Code Review FAIL

| 項目 | 結果 |
|------|------|
| 未処理 critical 問題数 | [N] 件 |

### 未処理問題一覧
| # | 問題 | 種別 |
|---|------|------|
| 1 | [問題概要] | critical |

修正後に `/aidd-review --type code` を再実行してください。
<!-- /merge-guard:code-review-fail -->"
```

---

### `epic` — Epic 総合レビュー

**PASS 時:**

```bash
# gate:reviewed ラベル付与
gh pr edit <PR番号> --add-label "gate:reviewed"

# Epic Issue の status:in-progress を除去
gh issue edit <Epic Issue番号> --remove-label "status:in-progress"

# draft 解除
IS_DRAFT=$(gh pr view <PR番号> --json isDraft --jq '.isDraft' 2>/dev/null || echo "false")
if [ "$IS_DRAFT" = "true" ]; then
  gh pr ready <PR番号>
  CURRENT_TITLE=$(gh pr view <PR番号> --json title --jq '.title')
  NEW_TITLE="${CURRENT_TITLE#\[WIP\] }"
  gh pr edit <PR番号> --title "${NEW_TITLE}"
fi

# PR コメント記録
gh pr comment <PR番号> --body "<!-- merge-guard:reviewed timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ✅ Gate: Epic Review PASS

| 項目 | 結果 |
|------|------|
| ビジネス要件 | PASS |
| ドキュメント | PASS |
| コード | PASS |
| 検出問題数（critical） | [M] 件（全件処理済み） |
| 検出問題数（non-critical） | [N] 件（全件処理済み） |
| 修正済み | [P] 件 |
| 見送り（理由記録済み） | [Q] 件 |

### 問題サマリー
[問題一覧（修正済み・見送り分類付き）]
<!-- /merge-guard:reviewed -->"
```

**FAIL 時:**

```bash
# gate:reviewed ラベルを除去（付与済みの場合）
gh pr edit <PR番号> --remove-label "gate:reviewed" 2>/dev/null || true

# PR コメント記録
gh pr comment <PR番号> --body "<!-- merge-guard:epic-review-fail timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ❌ Gate: Epic Review FAIL

| 項目 | 結果 |
|------|------|
| 未処理 critical 問題数 | [N] 件 |

### 未処理問題一覧
| # | 観点 | 問題 | 種別 |
|---|------|------|------|
| 1 | [観点] | [問題概要] | critical |

修正後に `/aidd-review --type epic ES-NNN` を再実行してください。
<!-- /merge-guard:epic-review-fail -->"
```

---

### `phase` — Phase 完了レビュー

PASS/FAIL の記録のみを行う。G6 処理（マイルストーン通過・Phase クローズ）は `/aidd-phase-closing` が担う。

**PASS 時:**

```
## ✅ Phase Review PASS

| 項目 | 結果 |
|------|------|
| 全 Epic 完了確認 | PASS |
| 成功基準充足 | PASS |
| マスタドキュメント最新化 | PASS |
| 検出問題数（critical） | [M] 件（全件処理済み） |

次のステップ: `/aidd-phase-closing` を実行して G6 を処理してください。
```

**FAIL 時:**

```
## ❌ Phase Review FAIL

| 項目 | 結果 |
|------|------|
| 未処理 critical 問題数 | [N] 件 |

### 未処理問題一覧
| # | 問題 | 種別 |
|---|------|------|
| 1 | [問題概要] | critical |

修正後に `/aidd-review --type phase` を再実行してください。
```

---

### `epic-spec` — Epic 仕様書レビュー

記録のみ（PR・Issue 操作なし）。

**PASS 時:**

```
## ✅ Epic 仕様書レビュー PASS

| 項目 | 結果 |
|------|------|
| 仕様完全性 | PASS |
| ストーリー整合 | PASS |
| AC 品質 | PASS |
| 検出問題数（critical） | [M] 件（全件処理済み） |
| 修正済み | [P] 件 |
| 見送り（理由記録済み） | [Q] 件 |

次のステップ: `/aidd-new-epic` を継続して承認ゲートへ進んでください。
```

**FAIL 時:**

```
## ❌ Epic 仕様書レビュー FAIL

| 項目 | 結果 |
|------|------|
| 未処理 critical 問題数 | [N] 件 |

修正後に `/aidd-review --type epic-spec ES-NNN` を再実行してください。
```

---

### `task-spec` — Task 定義レビュー

記録のみ（PR・Issue 操作なし）。

**PASS 時:**

```
## ✅ Task 定義レビュー PASS

| 項目 | 結果 |
|------|------|
| Task 分解妥当性 | PASS |
| AC 充足 | PASS |
| 実装可能性 | PASS |
| 検出問題数（critical） | [M] 件（全件処理済み） |
| 修正済み | [P] 件 |
| 見送り（理由記録済み） | [Q] 件 |

次のステップ: Task 定義に問題がなければ `/aidd-impl` で実装を開始してください。
```

**FAIL 時:**

```
## ❌ Task 定義レビュー FAIL

| 項目 | 結果 |
|------|------|
| 未処理 critical 問題数 | [N] 件 |

修正後に `/aidd-review --type task-spec TASK-NNN` を再実行してください。
```

## 4-3. 次のステップ案内（共通）

完了処理の最後に以下を提示する。

```
レビューが完了しました:
- 種別: [種別]
- 対象: [対象ID]
- 結果: PASS / FAIL
- 修正済み: [M] 件 / 見送り: [N] 件（理由記録済み）

次のステップ:
→ [種別・結果に応じた案内]
```

**CRITICAL: `epic` 種別レビュー完了後、AI は merge を実行しない。** 結果を提示した後、必ず以下のメッセージで締めくくる:

```
レビュー結果を提示しました。マージする場合は「merge」と指示してください。
```
