# ビルド手順

## 概要

このプロジェクトは pnpm モノレポ構成です。
クライアント（React + Inertia.js）とサーバー（Hono + Cloudflare Workers）の 2 つのアプリで構成されています。

```
hono-inertia-blog/          # ルート（モノレポ）
├── apps/
│   ├── client/             # @repo/client - React + Inertia.js + Tailwind CSS
│   └── server/             # @repo/server - Hono v4 + Cloudflare Workers
├── packages/
│   └── shared/             # @repo/shared - 型定義・共有コード
├── biome.json              # Biome（リンター・フォーマッター）
├── package.json            # ルートスクリプト
└── pnpm-workspace.yaml     # ワークスペース設定
```

---

## 前提条件

| ツール | バージョン | 確認コマンド |
|--------|-----------|-------------|
| Node.js | 18 以上（推奨: 20 LTS） | `node --version` |
| pnpm | 8 以上 | `pnpm --version` |
| wrangler | 3.90 以上（dev dependency） | `npx wrangler --version` |

pnpm が未インストールの場合:
```bash
npm install -g pnpm
```

---

## Step 1: 環境変数の設定

### 開発環境（.dev.vars）

Cloudflare Workers の開発サーバーは `.dev.vars` ファイルで環境変数を読み込みます。

`apps/server/.dev.vars` を作成してください:

```bash
# apps/server/.dev.vars
SESSION_SECRET=your-super-secret-key-at-least-32-characters-long
ENVIRONMENT=development
```

**重要な注意事項:**
- `SESSION_SECRET` は最低 32 文字以上のランダム文字列を設定してください
- HMAC-SHA256 署名に使用するため、推測困難な値を使用してください
- `.dev.vars` は `.gitignore` に含まれているため、コミットしないでください

**ランダム文字列の生成方法:**
```bash
# Node.js で生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# または openssl で生成
openssl rand -hex 32
```

### 本番環境（Cloudflare Workers Secrets）

本番デプロイ時は wrangler secrets を使用します:
```bash
cd apps/server
npx wrangler secret put SESSION_SECRET
```

---

## Step 2: 依存関係のインストール

```bash
# リポジトリルートで実行（全パッケージ一括インストール）
pnpm install
```

インストール後の確認:
```bash
# ワークスペース一覧の確認
pnpm ls --depth 0
```

---

## Step 3: 開発サーバーの起動

### 方法 A: サーバーのみ起動（推奨）

```bash
# ルートから実行
pnpm dev
```

または:
```bash
cd apps/server
pnpm dev
```

このコマンドは `@hono/vite-dev-server` と Cloudflare adapter を使って起動します。
開発時はクライアントのホットリロードも自動で行われます。

**アクセス URL**: `http://localhost:5173`

### 方法 B: クライアントとサーバーを個別起動

```bash
# ターミナル 1: クライアントをビルドしてサーバーの public/ に出力
cd apps/client
pnpm build

# ターミナル 2: サーバー起動
cd apps/server
pnpm dev
```

---

## Step 4: プロダクションビルド

```bash
# ルートから実行（クライアント→サーバーの順でビルド）
pnpm build
```

内部的に以下を順番に実行します:

### Step 4-1: クライアントビルド

```bash
pnpm build:client
# = pnpm --filter @repo/client build
```

- 出力先: `apps/server/public/` （サーバーの静的アセットフォルダ）
- 生成物: `index.html`, `assets/` (JS, CSS チャンク)

### Step 4-2: サーバービルド

```bash
pnpm build:server
# = pnpm --filter @repo/server build
```

- 出力先: `apps/server/dist/index.js`
- バンドル形式: ES Module

---

## Step 5: ビルド確認

```bash
# ビルド成果物の確認
ls apps/server/public/       # クライアント成果物
ls apps/server/dist/         # サーバー成果物
```

期待される出力:
```
apps/server/public/
├── index.html
└── assets/
    ├── index-[hash].js      # メインバンドル
    ├── vendor-[hash].js     # React コアチャンク
    └── inertia-[hash].js    # Inertia ランタイムチャンク

apps/server/dist/
└── index.js                 # Hono Workers バンドル
```

---

## Step 6: Cloudflare Workers へのデプロイ

### 前提: Cloudflare アカウントのセットアップ

```bash
# Cloudflare にログイン
npx wrangler login
```

### デプロイ実行

```bash
cd apps/server
pnpm deploy
# = wrangler deploy
```

---

## リンター・フォーマッター

```bash
# リントチェック（ルートから）
pnpm lint

# 自動修正
pnpm lint:fix

# TypeScript 型チェック
pnpm typecheck
```

---

## トラブルシューティング

### `SESSION_SECRET is not set` エラー

`apps/server/.dev.vars` ファイルが存在しない、または `SESSION_SECRET` が設定されていない場合に発生します。
「Step 1: 環境変数の設定」を参照してください。

### `@repo/shared が見つからない` エラー

```bash
# workspace パッケージのリビルド
pnpm install
pnpm --filter @repo/shared build
```

### ポート 5173 が使用中

```bash
# 別のポートで起動
# apps/server/vite.config.ts の server.port を変更するか、
# 環境変数で指定
PORT=3000 pnpm dev
```

### `wrangler.toml` の ASSETS binding エラー

開発時に `c.env.ASSETS` が undefined になる場合は、`@hono/vite-dev-server` の cloudflare adapter が
クライアントの `index.html` を自動的に提供します。本番ビルドでのみ ASSETS binding が有効になります。

### node_modules のクリーンアップ

```bash
# 全 node_modules を削除して再インストール
find . -name "node_modules" -not -path "*/.git/*" -exec rm -rf {} + 2>/dev/null || true
pnpm install
```
