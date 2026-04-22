# テスト規約

<!-- TODO: プロジェクトに合わせて記述してください -->

## テストフレームワーク

- ユニットテスト: Vitest (`packages/jimmy/src/**/__tests__/`)
- E2E テスト: Playwright (`e2e/`)

## 命名

- テストファイル: `*.test.ts`
- テスト名: `describe('ComponentName', () => { it('should ...') })`

## 方針

- エンジンの単体テストはモックを使用（実際の CLI は呼ばない）
- E2E テストは実際のデーモンプロセスを起動して検証
