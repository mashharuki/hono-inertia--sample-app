# Deployment Guide — Cloudflare Workers

## 概要

このアプリケーションは Cloudflare Workers + Workers Assets を使用してデプロイします。
モノレポ構成（apps/server + apps/client）のため、ビルドとデプロイは特定の順序で実行する必要があります。

---

## アーキテクチャ

```
ユーザー
  |
  v
Cloudflare Edge Network
  |
  +---> Cloudflare Workers (Hono サーバー)
  |       main = "src/index.ts"
  |       name = "hono-inertia-blog"
  |
  +---> Workers Assets (静的ファイル配信)
          directory = "public"
          run_worker_first = true  <- Workers が先にリクエストを受ける
```

`run_worker_first = true` により、すべてのリクエストが Hono のルーターを通過します。
Hono が静的ファイルにマッチしない場合は Workers Assets にフォールバックします。

---

## 前提条件

| 項目 | 内容 |
|------|------|
| Node.js | v20 以上推奨 |
| pnpm | v9 以上 |
| wrangler | v3.90.0（devDependencies に含む） |
| Cloudflare アカウント | 無料プランで可 |

---

## 環境変数

### wrangler.toml（apps/server/wrangler.toml）

```toml
name = "hono-inertia-blog"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

[assets]
directory = "public"
binding = "ASSETS"
run_worker_first = true
```

### シークレット設定（本番環境）

認証機能で必要な環境変数は `wrangler secret` コマンドで安全に設定します。

```bash
# JWT シークレット（セッション署名用）
wrangler secret put JWT_SECRET

# 必要に応じて追加
wrangler secret put SESSION_SECRET
```

シークレットは wrangler.toml や .env ファイルにコミットしないこと。

---

## デプロイ手順

### 1. Cloudflare 認証

```bash
npx wrangler login
```

ブラウザが開き、Cloudflare アカウントへのログインを求められます。

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. クライアントビルド

```bash
pnpm build:client
```

- apps/client の React アプリをビルドします
- 出力先: apps/client/dist/

### 4. サーバービルド（Workers 用バンドル生成）

```bash
pnpm build:server
```

- apps/server の Hono アプリを Vite でバンドルします
- クライアントビルド成果物を apps/server/public/ へコピーします
- 出力先: apps/server/dist/ および apps/server/public/

### 5. まとめてビルド

```bash
pnpm build
```

上記の build:client と build:server を順に実行します（推奨）。

### 6. デプロイ実行

```bash
pnpm deploy
```

内部では以下を実行します:

```bash
wrangler deploy
```

デプロイが成功すると、以下のような出力が表示されます:

```
Total Upload: XX KiB / gzip: XX KiB
Worker Startup Time: XX ms
Deployed hono-inertia-blog triggers (XX sec)
  https://hono-inertia-blog.<your-subdomain>.workers.dev
```

---

## デプロイフロー（まとめ）

```
pnpm install
    |
    v
pnpm build:client  ->  apps/client/dist/
    |
    v
pnpm build:server  ->  apps/server/public/ (静的ファイルコピー)
                   ->  apps/server/dist/   (Workers バンドル)
    |
    v
pnpm deploy        ->  wrangler deploy
    |
    v
Cloudflare Workers にデプロイ完了
URL: https://hono-inertia-blog.<subdomain>.workers.dev
```

---

## ローカル動作確認

### 開発サーバー（ホットリロード）

```bash
pnpm dev
```

- Vite 開発サーバーが起動します
- デフォルト: http://localhost:5173

### ローカル Workers シミュレーション

```bash
pnpm preview
```

内部では `wrangler dev --local` を実行し、Cloudflare Workers ランタイムをローカルでシミュレートします。

---

## デプロイの削除

```bash
pnpm delete
```

内部では `wrangler delete` を実行し、Workers からアプリを削除します。

---

## トラブルシューティング

### 「assets が見つからない」エラー

```
Error: Could not find directory "public"
```

原因: `pnpm build:client` を先に実行していない。または apps/server/public/ が存在しない。

対処:
```bash
pnpm build  # build:client -> build:server の順で実行
pnpm deploy
```

### wrangler 認証エラー

```
Error: You need to login to Cloudflare
```

対処:
```bash
npx wrangler login
```

### nodejs_compat フラグ関連エラー

wrangler.toml の `compatibility_flags = ["nodejs_compat"]` が必要です。
crypto モジュール（PBKDF2 によるパスワードハッシュ）の使用に必要です。

### デプロイ後に 500 エラー

1. Cloudflare ダッシュボード > Workers > hono-inertia-blog > Logs でエラーを確認
2. `JWT_SECRET` などのシークレットが設定されているか確認:
   ```bash
   wrangler secret list
   ```

---

## CI/CD（参考）

GitHub Actions で自動デプロイを行う場合の設定例:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - name: Deploy to Cloudflare Workers
        run: pnpm deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

必要なシークレット:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API トークン（Workers: Edit 権限が必要）

---

*最終更新: 2026-05-05*
