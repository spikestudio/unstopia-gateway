# Task: [ES-032] Story 1.6 — utils.ts 残存カバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #233 |
| Epic 仕様書 | ES-032 |
| Story | 1.6 |
| Complexity | S |
| PR | #226 |

## 責務

`src/gateway/api/utils.ts` の未カバーブランチ（resolveAttachmentPaths のファイル不在パス / deepMerge の `***` スキップ / checkInstanceHealth の失敗パス / readBodyRaw）をテストし、branch カバレッジを 68% から 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/utils.test.ts`（新規作成。既存テストがないため全体をカバー）
- `packages/jimmy/src/gateway/api/utils.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-099〜104: 他ハンドラーのテスト（utils.ts から export された関数を使用するのみ）

## Epic から委ねられた詳細

- `checkInstanceHealth` は実際の HTTP リクエストを発行するため、`node:http` の `request` をモックする
- `resolveAttachmentPaths` は `getFile` が null を返すケース / meta.path が存在しないケース / ファイルが disk に存在しないケースをすべてカバーする
- `deepMerge` の `***` スキップ: token / botToken / signingSecret / appToken に `***` を渡した場合に元の値が保持されることを確認する
- `readBodyRaw` は Buffer を返すことを確認する（`readBody` と同じ仕組みだが型が異なる）
- `serializeSession` は `context.sessionManager.getQueue()` をモックして `queueDepth` / `transportState` が付与されることを確認する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-36: `utils.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E032-37: `resolveAttachmentPaths` がファイル ID 不正 / ファイルメタ不在 / disk 上のファイル不在 の各条件でパスを除外することが検証される
- [ ] AC-E032-38: `deepMerge` が `***` プレースホルダーを持つ sanitized キーを上書きしないことが検証される
- [ ] AC-E032-39: `checkInstanceHealth` が正常応答（200）時に true を返し、タイムアウトや接続拒否時に false を返すことが検証される
- [ ] AC-E032-40: `readBodyRaw` が Buffer を返すことが検証される
- [ ] Epic 仕様書の AC-E032-36〜40 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | utils.ts の全 export 関数の未カバーブランチ | node:http.request / getFile / FS はモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ユーティリティ関数の単体テストのみ | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §Story 1.6
- 参照コード: `packages/jimmy/src/gateway/api/utils.ts`

**モック対象一覧:**

- `node:fs` → `existsSync`
- `node:http` → `request`（checkInstanceHealth のみ）
- `../../sessions/registry` → `getFile`
- `../../shared/logger` → `logger`
- `../../shared/paths` → `FILES_DIR`

**`checkInstanceHealth` のモック方法:**

```typescript
// node:http の request は EventEmitter を返す。レスポンスも EventEmitter として模倣する
vi.mock('node:http', () => ({
  request: vi.fn((options, callback) => {
    // callback({ statusCode: 200 }) でレスポンスを模倣
  })
}))
```

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
