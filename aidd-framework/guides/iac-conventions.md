# IaC 規約ガイド

Terraform / Terragrunt + GitOps を使うプロジェクト向けの規約。AI エージェントが IaC 変更を行う際に従うべきルールを定義する。

---

## 1. IaC 横展開（全環境同時適用）

### 規約

**アプリリソースまたはインフラモジュールを追加する場合、全環境に同時に追加すること。**

1 環境だけに追加して他環境への適用を後回しにしてはならない。

### 対象パターン

| 操作 | 全環境への適用 |
|------|-------------|
| GitOps アプリリソース追加（`gitops/apps/<env>/` 等） | stg / prod（またはプロジェクト定義の全環境）に同時追加 |
| Terragrunt モジュール追加（`infra/envs/<env>/` 等） | dev / stg / prod（またはプロジェクト定義の全環境）に同時追加 |

> **Note:** 環境ディレクトリの命名（`apps-stg/` `apps-prod/` 等）はプロジェクトによって異なる。プロジェクトのディレクトリ構造を確認して適用すること。

### 理由

- 環境間の構成ドリフトを防ぐ
- 「stg には存在するが prod には存在しない」という状態がインシデントの原因になる
- GitOps の原則（宣言的・全環境一致）に従う

### 例外

環境ごとに段階的ロールアウトが業務要件として明示されている場合のみ許容する。その場合は PR に理由を明記し、残り環境への適用 Issue を即時作成する。

---

## 2. Terraform validation 必須

### 規約

**新規 Terraform モジュールの必須変数には `validation` ブロックを定義すること。`default = ""` で誤魔化してはならない。**

### 禁止パターン

```hcl
# ❌ 禁止: 空文字デフォルトで必須チェックを回避
variable "cluster_name" {
  type    = string
  default = ""
}
```

### 必須パターン

```hcl
# ✅ 必須: validation ブロックで明示的に検証
variable "cluster_name" {
  type        = string
  description = "EKS クラスター名"

  validation {
    condition     = length(var.cluster_name) > 0
    error_message = "cluster_name は空文字にできません。"
  }
}
```

### 理由

- `default = ""` は「値が設定されていない」状態を隠蔽し、実行時エラーを引き起こす
- `validation` ブロックは `terraform validate` 時にエラーを検出できる（早期発見）
- 必須変数に `default` を設定しない（`default` なし）か、`validation` を組み合わせることで意図が明確になる

### 適用範囲

- 新規モジュールの **必須変数**（デフォルト値を持たせるべきでない変数）
- 既存モジュールの修正時は対象外（別途リファクタリング Issue を作成）

---

---

## 3. GitOps / Kubernetes 直接操作禁止

IaC + GitOps 構成（Terraform+Terragrunt / Helm+Flux 等）を採用するプロジェクトでは、**全ての変更は Git を通じてコードで管理する**。`kubectl` や `helm` による直接操作は原則禁止。

### 禁止操作（検証目的を除く）

| コマンド | 禁止理由 |
|---------|---------|
| `kubectl apply / delete / patch / edit` | Git に記録されない変更が発生する |
| `helm upgrade / install / uninstall`（CI/CD 外） | GitOps の自動同期と競合する |
| `kubectl exec` 等による実行時設定変更 | 状態がコードに反映されない |

### 許可される例外

| 操作 | 用途 |
|------|------|
| `kubectl get / describe / logs / port-forward` | 読み取り専用 |
| `kubectl diff` / `helm template` / `helm lint` / `helm dry-run` | 検証目的 |
| 緊急インシデント対応 | 事後に**必ず**コードへ反映 + Issue 起票が必要 |

### 変更フロー

```
Git（単一の真実の源）
  ↓ PR → レビュー → マージ
インフラ層（Terraform+Terragrunt）: CI が terraform apply
k8s マニフェスト層（Helm Chart）:   Flux が自動同期
```

### 理由

- `kubectl` での直接変更は次の `terraform apply` / Flux 同期で上書きされる（または競合する）
- GitOps の原則「Git が Single Source of Truth」を守ることで環境ドリフトを防ぐ

---

## 4. AI エージェントへの指示

IaC / GitOps 変更を行う際は以下を必ず確認する:

1. **全環境確認**: 追加・変更対象のリソース/モジュールが全環境に存在するか確認し、欠けている環境があれば同一 PR に含める
2. **validation 確認**: 新規モジュールに必須変数がある場合、`validation` ブロックが定義されているか確認する
3. **ドリフト検出**: `terraform plan` の差分に意図しない変更が含まれていないか確認する
4. **kubectl/helm 直接操作の禁止**: k8s リソースの変更は Helm Chart の values や GitOps マニフェストの変更として提案すること。`kubectl apply` 等の直接操作コマンドを提案してはならない
5. **緊急対応後の必須作業**: インシデント対応で直接操作した場合は、コードへの反映と Issue 起票を必ず行う

---

## 参考

- [Terraform - Custom Validation Rules](https://developer.hashicorp.com/terraform/language/values/variables#custom-validation-rules)
- [Terragrunt ドキュメント](https://docs.terragrunt.com/)
- [OpenGitOps 原則](https://opengitops.dev/)
- [Flux GitOps](https://fluxcd.io/flux/concepts/)
