# ディレクトリ構造

<!-- TODO: プロジェクトに合わせて記述してください -->

```
unstopia-gateway/
├── packages/
│   ├── jimmy/          # コアデーモン (TypeScript ESM)
│   │   └── src/
│   │       ├── engines/       # AI エンジンアダプター
│   │       ├── connectors/    # プラットフォームコネクター
│   │       ├── sessions/      # セッション管理
│   │       ├── gateway/       # ゲートウェイコア
│   │       ├── memory/        # 記憶システム (Phase 1 追加予定)
│   │       └── shared/        # 共通型・ユーティリティ
│   └── web/            # Next.js Web UI
├── docs/
│   ├── requirements/   # 要件定義・Phase 定義書
│   ├── architecture/   # アーキテクチャ・ADR
│   ├── tasks/          # Task 定義
│   ├── conventions/    # 規約ドキュメント (このディレクトリ)
│   └── research/       # 技術調査ドキュメント
└── aidd-framework/     # フレームワーク本体 (直接編集禁止)
```
