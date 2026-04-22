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
