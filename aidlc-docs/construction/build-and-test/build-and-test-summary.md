# Build and Test サマリー

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | hono-inertia-blog |
| アーキテクチャ | pnpm モノレポ（apps/server + apps/client + packages/shared） |
| ランタイム | Cloudflare Workers（Edge Computing） |
| フレームワーク | Hono v4 + React + Inertia.js v2 + Tailwind CSS |
| ビルドツール | Vite + wrangler |
| リンター | Biome |

---

## 1. クイックスタート

```bash
# 1. 環境変数設定
cat > apps/server/.dev.vars << 'EOF'
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENVIRONMENT=development
EOF

# 2. 依存関係インストール
pnpm install

# 3. 開発サーバー起動
pnpm dev
```

ブラウザで `http://localhost:5173` にアクセスしてアプリを確認してください。

---

## 2. 環境変数リスト

### apps/server/.dev.vars（開発環境）

| 変数名 | 説明 | 必須 | 例 |
|--------|------|------|----|
| `SESSION_SECRET` | HMAC-SHA256 セッション署名キー（32 文字以上） | 必須 | `a1b2c3d4...（64文字）` |
| `ENVIRONMENT` | 実行環境の識別子 | 任意 | `development` |

### wrangler.toml（本番環境 Vars）

| 変数名 | 説明 | 設定方法 |
|--------|------|---------|
| `ENVIRONMENT` | 実行環境の識別子 | wrangler.toml `[vars]` |
| `SESSION_SECRET` | セッション署名キー | `wrangler secret put SESSION_SECRET` |

---

## 3. 主要コマンド一覧

```bash
# 開発
pnpm dev              # 開発サーバー起動（localhost:5173）

# ビルド
pnpm build            # クライアント + サーバーを全ビルド
pnpm build:client     # クライアントのみビルド（apps/server/public/ に出力）
pnpm build:server     # サーバーのみビルド（apps/server/dist/ に出力）

# 品質確認
pnpm lint             # Biome リントチェック
pnpm lint:fix         # Biome 自動修正
pnpm typecheck        # TypeScript 型チェック

# デプロイ
cd apps/server && pnpm deploy   # Cloudflare Workers へデプロイ
```

---

## 4. ビルドフロー

```
pnpm build
├── pnpm build:client
│   └── Vite build (apps/client)
│       └── 出力: apps/server/public/
│           ├── index.html
│           └── assets/
│               ├── index-[hash].js
│               ├── vendor-[hash].js    (React コアチャンク)
│               └── inertia-[hash].js   (Inertia ランタイムチャンク)
│
└── pnpm build:server
    └── Vite build (apps/server)
        └── 出力: apps/server/dist/
            └── index.js              (Hono Workers バンドル)
```

---

## 5. デプロイフロー

```
wrangler deploy
├── apps/server/dist/index.js       → Cloudflare Workers スクリプト
└── apps/server/public/             → Cloudflare Assets (静的ファイル)
    ├── index.html
    └── assets/
```

Cloudflare Workers が受け取ったリクエストを Hono でルーティングし、
HTML ページは Cloudflare Assets から配信、API は Workers で処理します。

---

## 6. アーキテクチャ決定記録（ADR）

| 決定 | 理由 |
|------|------|
| Cloudflare Workers | エッジ配信・低レイテンシ・無料枠が充実 |
| Hono v4 | Workers との相性が良く、型安全な API 設計が可能 |
| Inertia.js v2 | SPA UX を保ちつつサーバー駆動のルーティングを実現 |
| PBKDF2 + HMAC-SHA256 | Web Crypto API のみ使用（Node.js 不要）で Workers 対応 |
| モックデータ（インメモリ） | 学習用途のため DB は不要。Workers KV/D1 への移行も容易 |
| Biome | ESLint + Prettier の代替として高速・設定が少ない |

---

## 7. 手動動作確認の優先順位

以下の順序で `integration-test-instructions.md` のシナリオを実行してください:

1. **シナリオ 2: ログイン・ログアウトフロー** — 認証基盤の確認（最重要）
2. **シナリオ 1: ユーザー登録フロー** — 新規ユーザーの作成
3. **シナリオ 3: ブログ記事 CRUD フロー** — コア機能の確認
4. **シナリオ 4: コメント機能** — 追加機能の確認
5. **シナリオ 5: Inertia.js SPA ナビゲーション** — パフォーマンス確認
6. **シナリオ 6: セキュリティ確認** — セキュリティの確認
7. **シナリオ 7: レスポンシブデザイン** — UI の確認

---

## 8. 既知の制限事項

| 制限 | 内容 | 対応策 |
|------|------|-------|
| データ永続化 | インメモリストアのためサーバー再起動でデータがリセットされる | Cloudflare KV / D1 への移行 |
| セッション管理 | Cookie ベースのセッションはサーバー再起動でリセット | KV ストアへの移行 |
| スケーラビリティ | 複数 Worker インスタンス間でメモリ共有不可 | D1 / KV / Durable Objects の採用 |
| テスト | 自動テストなし | Vitest + `@cloudflare/vitest-pool-workers` の導入 |

---

## 9. 次のステップ（学習の発展）

1. **Cloudflare D1** への移行 — SQLite ベースのデータ永続化
2. **Cloudflare KV** でのセッション管理 — マルチインスタンス対応
3. **Vitest** + `@cloudflare/vitest-pool-workers` でのテスト追加
4. **GitHub Actions** による CI/CD パイプライン構築
5. **Cloudflare Pages** との比較検討
