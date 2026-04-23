# TASK-012: connector 純粋関数のテスト追加

| 項目 | 内容 |
|------|------|
| Epic | ES-003 |
| AC | AC-E003-04 |
| 複雑度 | S |
| 依存 | TASK-009 |

## 作業内容

Discord・connector の純粋な変換関数のユニットテストを追加する。外部依存がなく最もテストしやすいモジュール群。

## 対象ファイル

- `src/connectors/discord/format.ts` — Discord メッセージのフォーマット関数
- `src/connectors/discord/threads.ts` — スレッドキーの生成・解析ロジック

## テスト配置先

- `src/connectors/discord/__tests__/format.test.ts`
- `src/connectors/discord/__tests__/threads.test.ts`

## テスト観点

**discord/format.ts:**
- テキストのフォーマット変換（Markdown → Discord 形式等）
- 長いメッセージのチャンク分割ロジック
- 特殊文字のエスケープ処理

**discord/threads.ts:**
- `deriveSessionKey()` が正しいキーを生成する
- `buildReplyContext()` が正しいコンテキストを返す
- エッジケース（undefined・空文字）の処理

## Acceptance Criteria

- [ ] `src/connectors/discord/__tests__/format.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] `src/connectors/discord/__tests__/threads.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] リファクタリングなし（外部モックも不要なはず）
