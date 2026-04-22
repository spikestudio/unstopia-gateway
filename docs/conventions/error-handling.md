# エラーハンドリング方針

技術スタック: TypeScript 5.8 / Node.js 22

## エラーの分類

| 分類 | 定義 | 対処 |
|------|------|------|
| **トランジェントエラー** | ECONNRESET / タイムアウト / 503 等の一時的な外部障害 | エンジン層でリトライ（最大 MAX_RETRIES 回） |
| **レートリミットエラー** | API レート超過 | 待機 or フォールバックエンジンに切り替え |
| **設定エラー** | YAML/JSON パースエラー・必須フィールド欠如 | 起動時に検出して即座に終了 |
| **セッションエラー** | 存在しないセッション参照・期限切れ | エラーをコネクターに返してユーザーに通知 |
| **致命的エラー** | 回復不能な内部エラー | ログを残してプロセス継続（daemon のためクラッシュさせない） |

## エラーの伝播方法

```
Engine（リトライ）→ Gateway（分類・ルーティング）→ Connector（ユーザー通知）
```

- Engine: トランジェントエラーは内部でリトライ後、失敗なら `EngineResult.error` に格納（MUST）
- Gateway: `EngineResult.error` を受け取り、エラー種別に応じてコネクターへ通知（MUST）
- Connector: エラーメッセージをユーザーに送信（SHOULD）

```ts
// 正: エラーを EngineResult に格納して返す
return { sessionId, result: "", error: err.message };

// 誤: エラーをスローして呼び出し元で処理させる（gateway がキャッチできない）
throw new Error(err.message);
```

## Fail Fast（バリデーション）

バリデーションはエントリポイントで即座に行う（MUST）。不正入力をドメイン層まで伝播させない。

```ts
// 正: ハンドラ冒頭でバリデーション
function handleMessage(raw: unknown): IncomingMessage {
  if (!raw || typeof raw !== "object") throw new ValidationError("Invalid message");
  // ...
}

// 誤: ドメインロジック内部で初めて不正値に気づく
function processSession(msg: any) {
  // ... 処理の途中で null アクセスエラー
}
```

## 空 catch の禁止

```ts
// 誤: エラーを握りつぶす
try {
  await engine.run(opts);
} catch (_e) {}

// 正: 最低限ログを残す
try {
  await engine.run(opts);
} catch (err) {
  logger.error("Engine run failed", { error: err });
}
```

## ログ出力のルール

| レベル | 用途 | 例 |
|--------|------|---|
| `logger.error` | 回復不能・ユーザーに影響するエラー | Engine クラッシュ、DB 接続失敗 |
| `logger.warn` | 回復可能だが注意が必要な事象 | リトライ発生、レートリミット到達 |
| `logger.info` | 通常の動作の節目 | セッション開始・終了、Connector 起動 |
| `logger.debug` | 詳細なデバッグ情報（本番では出力しない） | ストリームデルタの中身、CLI 引数 |

```ts
// 正: 構造化ログ（オブジェクトで文脈を渡す）
logger.error("Engine process exited unexpectedly", { sessionId, exitCode, stderr });

// 誤: 文字列連結
logger.error("Engine process " + sessionId + " exited with " + exitCode);
```

## 防御的プログラミング

- 外部境界（API 入力・YAML 読み込み・CLI 出力パース）は常に検証する（MUST）
- 内部境界（自モジュール内の関数呼び出し）は TypeScript 型で保証し、冗長な null チェックをしない（SHOULD）

```ts
// 正: 外部入力を検証し、内部では型を信頼
const config = parseConfig(rawYaml);  // 外部: 検証あり
engine.run(config.opts);              // 内部: 型保証済みなので再検証不要

// 誤: 全関数で null チェック
function run(opts: EngineRunOpts) {
  if (!opts) throw new Error("opts is null"); // 型があるなら不要
}
```
