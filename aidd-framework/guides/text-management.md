# 自然文管理ガイド

アプリケーション内のボタンラベル・エラーメッセージ・バリデーションテキストなどの自然文をコードから分離し、一元管理するためのガイドライン。

## フォーマット選択ガイダンス

スタックに応じて最適なファイル形式を選択する。

| 観点 | JSON | YAML |
|------|------|------|
| パース速度 | 高速・軽量 | 低速・重い |
| コメント | 不可 | 可能 |
| 複数行文字列 | `\n` エスケープ必要 | ネイティブサポート（`|`, `>` 記法） |
| バリデーション | JSON Schema で堅牢 | 弱い（インデントエラーがサイレント） |
| JS/TS エコシステム | ネイティブ | 要変換ステップ |
| 人間の直接編集 | 引用符・括弧が多い | クリーン |

### 推奨判断フロー

```
スタックは JS/TS（React / Next.js / Node.js）か？
  YES → JSON を推奨
  NO  → スタック標準に従う
         Rails / Django / Symfony → YAML
         Go / Rust 等 → JSON または TOML（エコシステム慣習に従う）

編集者が翻訳者・非開発者でコメントが必要か？
  YES → YAML を選択（または YAML 編集 → JSON ビルドのハイブリッド）
```

### ハイブリッド方式（YAML 編集 → JSON ビルド）

翻訳者が YAML を直接編集し、ビルドステップで JSON に変換する構成。両方のメリットを得られるが、ビルドパイプラインの管理コストが増える。

```
src/locales/en.yaml  ←翻訳者が編集
    ↓ build script
src/locales/en.json  ←アプリが参照
```

## キー命名規則

### セマンティックキーを使う

キー自体が文字列の内容（自然言語）であってはならない。文言変更でキーが変わると参照箇所の全置換が必要になる。

```
✅ Good: errors.validation.required
❌ Bad:  "This field is required."  をキーとして使用
```

### 形式

```
namespace.component.element
```

- **ドット記法**でヒエラルキーを表現する
- **最大 3 段ネスト**（組織化とシンプルさのバランス）
- **casing は統一**: camelCase または snake_case のどちらかで揃える（混在禁止）

### 命名例

```
errors.validation.required
errors.validation.maxLength
errors.network.timeout
ui.button.submit
ui.button.cancel
validation.password.tooShort
```

## 名前空間設計

名前空間は**機能・ドメイン単位**で分割する（ファイルパス・画面単位ではない）。

### 推奨名前空間

| 名前空間 | 対象 |
|---------|------|
| `errors` | エラーメッセージ全般 |
| `ui` | ボタン・ラベル・プレースホルダー |
| `validation` | フォームバリデーションメッセージ |
| `notifications` | Toast・アラート・バナー |
| `pages` | ページタイトル・見出し |
| `common` | 複数箇所で使われる汎用テキスト（厳格に管理する） |

### ファイル構成例

```
src/locales/
  text-master.json        ← 単一ファイル方式（小〜中規模）
  # または
  errors.json             ← 名前空間分割方式（大規模）
  ui.json
  validation.json
```

> **注意:** `common` 名前空間はコンテキスト依存の翻訳差異を招くリスクがある。
> 本当に文脈に依存しないテキストのみを配置し、不明な場合は専用キーを作成する。

## 外部化手順

コードにハードコードされた自然文を外部ファイルに移行する手順。

### Step 1: 洗い出し

コードベース内のハードコード文字列を列挙する。

```bash
# UI 文字列の洗い出し例（JS/TS）
grep -rn '"[A-Z][^"]*"' src/ --include="*.tsx" --include="*.ts"
```

### Step 2: 名前空間設計

洗い出した文字列を機能・ドメイン単位でグルーピングし、名前空間と各キーを設計する。

### Step 3: マスタファイル作成

設計したキー構造で `text-master.json`（または名前空間別ファイル）を作成する。スターターテンプレートは `skills/aidd-setup/references/text-master.json` を参照。

### Step 4: キー参照への置換

ハードコード文字列をキー参照に置き換える。

```tsx
// Before
<button>Submit</button>

// After（next-intl の例）
const t = useTranslations();
<button>{t('ui.button.submit')}</button>
```

### Step 5: 検証

- 全キーが参照されていることを確認（未使用キーを検出）
- 全参照先キーが存在することを確認（欠損キーを検出）
- CI でリントを実行する

## アンチパターン

### キーの再利用・共有（避ける）

同じ文言でも文脈が異なれば翻訳が変わる場合がある。共有キーは一見 DRY に見えるが、後から別翻訳が必要になったときの対応コストが高い。

```
✅ Good: errors.login.unauthorized  + errors.api.unauthorized  （別キー）
❌ Bad:  errors.unauthorized        （全文脈で共有）
```

### 文字列結合（避ける）

英語の語順前提になり、他言語への対応が困難になる。

```ts
// ❌ Bad
const msg = "Hello, " + userName + "!";

// ✅ Good（ICU MessageFormat または変数補完を使う）
// text-master.json: { "greeting": "Hello, {name}!" }
t('greeting', { name: userName });
```

### 翻訳文字列内の HTML（避ける）

XSS リスクを生み、メンテナンスが困難になる。

```json
// ❌ Bad
{ "terms": "Please read our <a href='/terms'>Terms of Service</a>" }

// ✅ Good（コンポーネント側でリンクを組み立てる）
{ "terms": "Please read our {termsLink}" }
```

### 深すぎるネスト（避ける）

3 段を超えるネストはキーの可読性を損ない、参照コードが冗長になる。

```json
// ❌ Bad
{ "errors": { "form": { "field": { "email": { "invalid": "..." } } } } }

// ✅ Good（3 段以内）
{ "errors": { "form": { "emailInvalid": "..." } } }
```

## ライブラリ選定ガイダンス

i18n ライブラリを導入する場合の参考。aidd-fw はスタック非依存のため特定ライブラリを強制しない。

| 用途 | 推奨 |
|------|------|
| Next.js App Router | next-intl（App Router ネイティブ対応・軽量） |
| React / Node.js 汎用 | i18next / react-i18next（最大シェア・プラグイン豊富） |
| 非 JS バックエンド | 各エコシステム標準（Django: `.po`、Rails: `config/locales/*.yml`） |
| 翻訳なし・単一言語 | ライブラリなし（JSON ファイルを直接 import） |

> i18n ライブラリを導入しない段階（外部化のみ）でも、このガイドのキー命名・名前空間設計は適用できる。
