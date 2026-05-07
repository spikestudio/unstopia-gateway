# 用語集

| 用語 | 定義 | 備考 |
|------|------|------|
| Gateway | AI エンジンとコネクターを束ねるデーモンプロセス | jinn のコアコンセプト |
| Engine | AI CLI を実行するアダプター (claude / codex / gemini / antigravity) | `InterruptibleEngine` インターフェースを実装 |
| Connector | メッセージプラットフォームとのブリッジ (Slack / Discord / Telegram / WhatsApp) | |
| Employee | YAML で定義するエージェントの設定単位。名前・役職・使用エンジン・ペルソナを持つ | |
| Session | エンジンとの一連の会話。SQLite で状態管理 | |
| Skill | エージェントに追加できる Markdown ベースのプレイブック | npm パッケージとして配布可能 |
| Triage | Slack メッセージを silent / react / reply に分類する軽量 LLM 処理 | Haiku を使用 |
| Memory System | クロスセッション記憶。Working / Episodic / Semantic の 3 層構造 | Phase 1 で実装予定 |
| Multi-layer Skill Management | Global → Dept → Agent の 3 層スキル継承システム | Phase 2 で実装予定 |
| TranscriptReader | JSONL Transcript ファイルの fs 操作を抽象化した注入可能インターフェース。`existsSync` / `readdirSync` / `readFileSync` を提供し、テスト時にインメモリモックで代替できる | ES-026 で導入（案A: optional 関数引数） |
| SessionRateLimitService | Claude レートリミット検出後の待機・リトライループを管理するモジュール。依存注入可能なシグネチャで単体テスト可能 | ES-026 で `gateway/api/session-rate-limit.ts` として導入 |
| SessionFallbackService | Claude レートリミット時に fallback エンジン（Codex 等）への切り替えを管理するモジュール | ES-026 で `gateway/api/session-fallback.ts` として導入 |
| engineOverride | セッションの `transportMeta` に格納する、一時的なエンジン切り替え情報。`originalEngine`・`until`・`syncSince` を持つ | フォールバック中の状態を記録し、Claude 復旧後に自動で元のエンジンに戻す |
| rateLimitStrategy | `config.sessions.rateLimitStrategy` で設定するレートリミット対応戦略。`"fallback"` の場合は fallback エンジンに切り替え、それ以外は待機・リトライ | `"fallback"` がデフォルト |
