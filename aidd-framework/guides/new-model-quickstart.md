# クイックスタート: 新 Phase/Epic モデル（Phase 12 以降）

Phase 12 から導入された「薄い Phase・重い Epic」モデルで開発を始めるためのガイド。

## 新モデルの核心

**「AI が計画し、人間が承認し、AI が実装する」**

| 単位 | 役割 | 重さ | 主なスキル |
|------|------|------|-----------|
| **Phase** | 「このマイルストーンで何を作るか」を決める | 薄い（30分以内） | `/aidd-new-phase` |
| **Epic** | 「その機能をどう定義するか」を決める | 重い（ストーリー+AC+モック） | `/aidd-new-epic` |

## 5分で分かる: AI-DLC フェーズとスキルの対応

```
[Release Planning]  /aidd-new-phase  → G1（機能意図 + Epic マッピングに合意）
[Inception 道具箱]  ※ G1後・G2前。任意。プロジェクト特性に応じて選択
                    /aidd-mob            : ペルソナ議論でストーリーを深掘り
                    /aidd-inception      : 具体的成果物の対話的生成（親スキル）
                      └── mock          : 画面モック（UI 系）
                      └── api-spec      : API 仕様（API 系）
                      └── cli           : CLI 仕様（CLI 系）
[Inception]         /aidd-new-epic   → G2（ストーリー + AC を承認）
                    G3（/aidd-screen-plan → /aidd-screen-spec → /aidd-screen-ui）
[Construction]      /aidd-decompose-epic → /aidd-impl × N → G4
[Operations]        /aidd-epic-review → G5
[Release]           /aidd-phase-review → G6
```

---

## ステップバイステップ: 新 Phase の始め方

### Step 1: Phase を始める（30分以内）

```
/aidd-new-phase
```

AI が以下を実施する:

1. Phase の「やりたいこと（機能意図）」を列挙する
2. 機能意図を Epic に割り付ける
3. Won't Have（このマイルストーンでやらないこと）を確定する

**G1 ゲート**: 機能意図一覧と Epic マッピングに合意したら G1 通過。

> **旧モデルとの違い**: 旧モデルの Phase はドメイン分析・BC 識別・ユーザーストーリー定義まで含む重い16セクション構成だった。新モデルは「何を作るか」の一覧だけ。詳細はすべて Epic で行う。

---

### Step 2: Epic を始める（1〜2時間）

```
/aidd-new-epic
```

AI が以下を実施する:

1. Phase の機能意図を受け取り、ユーザーストーリーを詳細化する
2. ストーリーごとに受入基準（AC）を定義する
3. ドメイン分析・設計課題の洗い出しを行う

**G2 ゲート**: ストーリー + AC の承認を得たら G2 通過。

> **Inception 道具箱を使う場合（G1後・G2前）**: `/aidd-mob`（ペルソナ議論）や `/aidd-inception`（モック・API仕様・CLI仕様の対話的生成）を先に実行すると、ストーリー・ACの品質が上がる（Phase 13 以降に提供予定）。

---

### Step 3: 画面設計（G3）

```
/aidd-screen-plan   # 画面洗い出し
/aidd-screen-spec   # 画面仕様書・遷移図
/aidd-screen-ui     # UIKit 選定・G3 ゲート
```

---

### Step 4: Task に分解して実装する（G4〜G5）

```
/aidd-decompose-epic  # G4: Task 分解
/aidd-impl            # Task ごとに実装
/aidd-epic-review     # G5: Epic の総合レビュー
```

---

### Step 5: Phase をクローズする（G6）

```
/aidd-screen-catalog  # 画面系のみ: Phase 横断カタログ生成
/aidd-phase-review    # G6: Phase 完了検証
```

---

## 旧モデル vs 新モデル 対照表

| 項目 | 旧モデル（Phase 11 以前） | 新モデル（Phase 12 以降） |
|------|--------------------------|--------------------------|
| Phase 定義書のセクション数 | 16セクション | 3セクション（機能意図・Epicマッピング・Won't Have） |
| Phase 完了にかかる時間 | 2〜4時間 | 30分以内 |
| ユーザーストーリー定義の場所 | Phase 定義書 | Epic 仕様書（`/aidd-new-epic` 内） |
| ドメイン分析の場所 | Phase 定義書 | Epic 仕様書（`/aidd-new-epic` 内） |
| G1 の定義 | 旧: Phase 定義書全体の承認 | 新: 機能意図一覧 + Epic マッピングへの合意 |
| G2 の定義 | 旧: Epic の AC 承認 | 新: ストーリー + AC + モックの承認 |
| 画面設計フロー | 常に G3 全ステップ | G3 は通常通り実行。Inception 道具箱（/aidd-inception）の成果物が G3 の参考資料になる |

---

## よくある質問

### Q: 旧モデルで作った Phase 定義書はどうすればいい？

そのまま使い続けて問題ない。旧フォーマットの Phase 定義書は参照用として残す。
新 Phase から新フォーマット（3セクション）を使い始めればよい。

### Q: `/aidd-mob` はいつ使うの？

要件が曖昧、複数ステークホルダーの視点が必要、新技術領域のケースで有効。
シンプルな Epic では `/aidd-new-epic` に直行してよい。
（Phase 13 以降に提供予定）

### Q: 画面系 Epic で `/aidd-inception-mock` を使うべき？

**G1後（`/aidd-new-epic` を実行する前）** に画面モックを作って PO と方向を合わせることで、
ストーリー・AC の品質が大幅に上がる。特に UI の方向性が未確定な場合は強く推奨。
Inception モックは要件探索ツールであり、G3 の代替ではなく G3 の参考資料として活用する。
（Phase 13 以降に提供予定。現在は `/aidd-new-epic` → G3 の通常フローを使用）

---

## 関連ドキュメント

- フレームワーク全体像: `aidd-framework/FRAMEWORK.md`
- マイルストーン定義（G0〜G6）: `aidd-framework/process/milestones.md`
- ADR-013 Phase 軽量化: `docs/architecture/adr/ADR-013-phase-lightweight.md`
- ADR-014 条件分岐パイプライン: `docs/architecture/adr/ADR-014-screen-design-conditional-pipeline.md`
- AI-DLC コンセプト: `docs/research/ai-dlc-concepts.md`
