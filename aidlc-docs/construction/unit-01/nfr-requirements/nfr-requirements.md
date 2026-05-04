# NFR Requirements - Unit-01: 基盤セットアップ

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-01 基盤セットアップ
**作成日**: 2026-05-04
**バージョン**: 1.0

---

## 1. 概要

Unit-01 はプロジェクト全体の技術的基盤を確立するユニットである。
Cloudflare Workers という特殊なランタイム環境を対象とするため、
通常の Node.js プロジェクトとは異なる非機能要件（NFR）を慎重に設計する必要がある。

---

## 2. Cloudflare Workers ランタイム制約

### NFR-CW-001: バンドルサイズ制限

| 項目 | 要件 |
|------|------|
| 最大バンドルサイズ | 1 MB（Workers 制限）|
| 推奨目標サイズ | 500 KB 以下（余裕を持たせる）|
| 対応策 | Tree-shaking 活用、不要依存を含まない |

**実装ガイドライン**:
- `vite.config.ts` でバンドル解析を有効化（`rollup-plugin-visualizer` 任意）
- `wrangler.toml` に `compatibility_date` を設定し、最新 Workers API を活用
- サーバーバンドルは `apps/server` のみ対象（クライアントは Cloudflare Pages/静的ホスティング）

### NFR-CW-002: Node.js ネイティブ API 禁止

| 禁止 API | 代替 |
|---------|------|
| `crypto` (Node.js) | `globalThis.crypto` (Web Crypto API) |
| `fs`, `path` | 使用不可（Workers はファイルシステム非対応）|
| `Buffer` | `Uint8Array` / `TextEncoder` / `TextDecoder` |
| `process.env` | `c.env`（Hono の環境変数アクセス）|
| `setTimeout` 長時間 | Workers の CPU 時間制限（10ms〜30秒）を考慮 |

**Vite 設定で強制**:
```toml
# wrangler.toml
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
```

注: `nodejs_compat` フラグを使用する場合も、暗号化は Web Crypto API を優先する。

### NFR-CW-003: メモリ永続化禁止

Workers はリクエスト間でメモリを共有しない（ステートレス設計）。

| 禁止パターン | 代替パターン |
|------------|------------|
| グローバル変数でセッション管理 | Cookie ベースのセッション（署名付き）|
| インメモリキャッシュ | Workers KV / D1（今回はスコープ外）|
| モックデータの動的変更永続化 | モックデータはコード内定数として定義 |

---

## 3. パフォーマンス要件

### NFR-PERF-001: 初回レスポンスタイム

| 環境 | 目標値 |
|------|-------|
| ローカル開発（Vite dev） | < 500ms（HMR含む）|
| Cloudflare Workers（本番） | < 200ms（エッジキャッシュ前）|

### NFR-PERF-002: クライアントバンドルサイズ

| 対象 | 目標値 |
|------|-------|
| React + Inertia.js ランタイム | < 200 KB（gzip）|
| 共有コンポーネント | < 50 KB（gzip）|
| Tailwind CSS（purge後）| < 30 KB（gzip）|

**実装ガイドライン**:
- `vite.config.ts` の `build.rollupOptions.output.manualChunks` でコード分割
- Shadcn/ui はツリーシェーキング前提で必要コンポーネントのみインポート

---

## 4. TypeScript 型安全性要件

### NFR-TS-001: strict モード

```json
// tsconfig.json（サーバー・クライアント共通）
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### NFR-TS-002: 型定義の共有

- `packages/shared` の型定義をサーバー・クライアント双方から参照
- Hono の `ExtractSchema` を使用した API 型の自動推論
- `packages/shared/src/types/index.ts` に `User`, `Post`, `Comment`, `PublicUser` を定義

---

## 5. コード品質要件

### NFR-QUAL-001: Biome 設定

```json
// biome.json（ルート）
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

### NFR-QUAL-002: pnpm workspace 設定

- `pnpm-workspace.yaml` でモノレポパッケージを定義
- 各パッケージ間の依存は `workspace:*` プロトコルを使用
- ルートの `package.json` に共通スクリプト（`dev`, `build`, `lint`）を定義

---

## 6. セキュリティ基本要件（基盤レベル）

### NFR-SEC-001: 環境変数管理

| 変数名 | 用途 | 管理方法 |
|-------|------|---------|
| `SESSION_SECRET` | HMAC-SHA256 署名キー | `wrangler.toml` の `[vars]` または Secrets |
| `ENVIRONMENT` | dev/prod 判定 | `wrangler.toml` の `[vars]` |

`.dev.vars` ファイルをローカル開発用に使用（`.gitignore` 必須）。

### NFR-SEC-002: CORS・ヘッダー設定

基盤レベルでは以下のヘッダーをデフォルト設定：

```typescript
// Hono middleware
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
})
```

---

## 7. 開発環境要件

### NFR-DEV-001: 開発サーバー起動

| コマンド | 動作 |
|---------|------|
| `pnpm dev` (apps/server) | `@hono/vite-dev-server` で起動、HMR 有効 |
| `pnpm build` (apps/client) | Vite ビルド → `apps/server/public/` に出力 |
| `pnpm lint` (root) | Biome によるリンティング実行 |

### NFR-DEV-002: Wrangler 設定

```toml
# apps/server/wrangler.toml（基本設定）
name = "hono-inertia-blog"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "pnpm build"
```

---

## 8. NFR 適合チェックリスト

- [ ] バンドルサイズ 1MB 以下でビルドできる
- [ ] Node.js ネイティブ API（`crypto`, `fs`, `Buffer`）を使用していない
- [ ] グローバル変数でのステート管理をしていない
- [ ] TypeScript strict モードで型エラーがない
- [ ] Biome リンティングでエラーがない
- [ ] `pnpm-workspace.yaml` が正しく設定されている
- [ ] `.dev.vars` が `.gitignore` に含まれている
- [ ] `SESSION_SECRET` が環境変数で管理されている

---

*作成: AI-DLC Construction Phase - Unit-01 NFR Requirements ステージ*
*最終更新: 2026-05-04*
