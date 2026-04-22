# レイヤー間のルール

<!-- TODO: プロジェクトに合わせて記述してください -->

## 依存方向

```
Connector → Gateway → Session → Engine
                 ↓
              Memory (クロスカット)
```

- Connector は Gateway を通じてのみ Engine にアクセスする
- Engine は Connector / Gateway に依存しない
- Memory は任意のレイヤーから参照可能（ただし書き込みは Session 経由）

## データの受け渡し

- レイヤー間のデータは `shared/types.ts` で定義された型を使用する
- 生のオブジェクトをレイヤーをまたいで渡さない
