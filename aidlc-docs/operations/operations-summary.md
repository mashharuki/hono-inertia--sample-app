# Operations Phase — サマリー

## 概要

このドキュメントは Hono × Inertia.js × React ブログアプリ（hono-inertia-blog）の
Operations Phase の成果物まとめです。

---

## 実施内容

| ドキュメント | 内容 |
|------------|------|
| deployment.md | Cloudflare Workers へのデプロイ手順（wrangler / pnpm コマンド） |
| monitoring.md | モニタリング・ログ確認・障害対応手順 |
| operations-summary.md | Operations Phase サマリー（本ドキュメント） |

---

## 技術スタック（Operations 観点）

| レイヤー | 技術 | 役割 |
|---------|------|------|
| ランタイム | Cloudflare Workers | サーバーレス実行環境（エッジ配信） |
| 静的アセット | Cloudflare Workers Assets | React/JS/CSS の配信 |
| デプロイツール | Wrangler v3.90.0 | Workers のビルド・デプロイ・管理 |
| ビルドツール | Vite v6 | クライアント・サーバー両方のバンドル |
| パッケージ管理 | pnpm v9 | モノレポ依存関係管理 |

---

## デプロイ手順（クイックリファレンス）

```bash
# 1. 依存関係インストール
pnpm install

# 2. ビルド（クライアント -> サーバーの順）
pnpm build

# 3. デプロイ
pnpm deploy
```

デプロイ後の URL:
`https://hono-inertia-blog.<your-subdomain>.workers.dev`

---

## 主要コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動（Vite HMR） |
| `pnpm build` | クライアント + サーバーをビルド |
| `pnpm build:client` | クライアント（React）のみビルド |
| `pnpm build:server` | サーバー（Hono Workers）のみビルド |
| `pnpm preview` | ローカル Workers シミュレーション |
| `pnpm deploy` | Cloudflare Workers にデプロイ |
| `pnpm delete` | Cloudflare Workers から削除 |
| `npx wrangler tail` | デプロイ済み Workers のリアルタイムログ |
| `wrangler secret put <KEY>` | シークレット設定 |

---

## 運用チェックリスト

### デプロイ前

- [ ] `pnpm build` が正常完了している
- [ ] `pnpm preview` でローカル動作確認済み
- [ ] 必要なシークレット（JWT_SECRET など）が設定済み
- [ ] `wrangler.toml` の name・compatibility_date が正しい

### デプロイ後

- [ ] デプロイ URL でアクセス確認
- [ ] トップページ（記事一覧）が表示される
- [ ] ユーザー登録・ログインができる
- [ ] 記事の投稿・編集・削除ができる
- [ ] Cloudflare ダッシュボードでエラーが出ていないことを確認

### 定期メンテナンス

- [ ] 依存関係の更新確認（pnpm outdated）
- [ ] Cloudflare メトリクスの確認
- [ ] シークレットのローテーション（必要に応じて）
- [ ] compatibility_date の更新検討

---

## 制限事項・既知の制限

| 制限 | 内容 | 影響 |
|------|------|------|
| モックデータ | DB なし・インメモリストア | デプロイ後にデータがリセットされる可能性あり |
| 無料プラン CPU 制限 | 10ms/リクエスト | 重い処理は課金プランが必要 |
| ステートレス | Workers はリクエストごとに独立 | セッションをグローバル変数で管理不可 |
| ログ保持期間 | wrangler tail はリアルタイムのみ | 過去ログの永続保存は別途設定が必要 |

---

## 今後の拡張ポイント

本アプリは学習目的のため最小構成ですが、本番化する場合は以下を検討:

1. **データ永続化**: Cloudflare D1（SQLite）または KV の導入
2. **認証強化**: JWTの適切な有効期限設定・リフレッシュトークン
3. **CI/CD**: GitHub Actions による自動デプロイ
4. **監視強化**: Cloudflare Analytics または外部モニタリング（Datadog など）
5. **カスタムドメイン**: wrangler.toml に routes 設定を追加
6. **R2 Storage**: 画像アップロード機能の追加

---

## AI-DLC フェーズ完了状況

| フェーズ | 状態 |
|---------|------|
| Inception Phase | 完了 |
| Construction Phase | 完了（Unit-01, 02, 03 + Build & Test） |
| Operations Phase | 完了（本ドキュメント） |

**すべてのフェーズが完了しました。**

---

*最終更新: 2026-05-05*
