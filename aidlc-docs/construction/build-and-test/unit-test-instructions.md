# ユニットテスト手順

## テストについて

このプロジェクトは **学習用途** のため、要件段階でテストは省略することが決定されています。
（Requirements Analysis Q9: 「テスト不要 - 学習用なので省略」）

---

## テストを追加する場合の推奨構成

将来的にテストを追加する際は以下を参考にしてください。

### 推奨テストフレームワーク

| 用途 | フレームワーク | 理由 |
|------|--------------|------|
| サーバーユニットテスト | Vitest | Vite との統合が容易 |
| Cloudflare Workers テスト | `@cloudflare/vitest-pool-workers` | Workers ランタイムをシミュレート |
| クライアントコンポーネントテスト | Vitest + React Testing Library | React コンポーネントのテスト |
| E2E テスト | Playwright | ブラウザ操作の自動化 |

### テスト対象として優先度が高いモジュール

サーバー側:
- `apps/server/src/lib/crypto.ts` - PBKDF2 ハッシュ・HMAC-SHA256 署名の検証
- `apps/server/src/lib/session.ts` - セッション作成・検証・削除のロジック
- `apps/server/src/stores/usersStore.ts` - ユーザー登録・検索ロジック
- `apps/server/src/stores/postsStore.ts` - 記事 CRUD ロジック
- `apps/server/src/stores/commentsStore.ts` - コメント追加・取得ロジック

クライアント側:
- `apps/client/src/pages/` - 各ページコンポーネントのレンダリング確認
- `apps/client/src/components/` - 再利用可能コンポーネントの Props バリデーション

### Vitest セットアップ例（参考）

```bash
# サーバーにテストを追加する場合
cd apps/server
pnpm add -D vitest @cloudflare/vitest-pool-workers
```

`apps/server/vitest.config.ts`:
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
})
```

---

## 現在の品質確認手順

テストフレームワークの代わりに、以下の手動確認を実施してください:

1. `integration-test-instructions.md` の手動動作確認手順を参照
2. TypeScript 型チェックでコンパイルエラーがないことを確認: `pnpm typecheck`
3. Biome リンターでコード品質を確認: `pnpm lint`
