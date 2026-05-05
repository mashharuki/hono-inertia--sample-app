# Monitoring & Observability Guide

## 概要

Cloudflare Workers は独自のログ・メトリクス基盤を提供します。
このガイドでは、hono-inertia-blog アプリのモニタリング手法、ログ確認、障害対応の手順を説明します。

---

## 1. Cloudflare ダッシュボードによるモニタリング

### アクセス方法

1. https://dash.cloudflare.com にログイン
2. 左メニュー > Workers & Pages
3. `hono-inertia-blog` を選択

### 確認できるメトリクス

| メトリクス | 説明 | 確認場所 |
|-----------|------|---------|
| Requests | リクエスト数（成功/エラー別） | Metrics タブ |
| CPU Time | Workers の CPU 使用時間 | Metrics タブ |
| Error Rate | 4xx/5xx エラーの割合 | Metrics タブ |
| Subrequests | 外部 API 呼び出し数 | Metrics タブ |

### アラート設定

Cloudflare Notifications（ダッシュボード > Notifications）から設定可能:
- Error Rate が閾値を超えた場合
- Worker が CPU 時間制限に近づいた場合

---

## 2. リアルタイムログ（Workers Logs）

### wrangler tail でリアルタイム確認

デプロイ済みの Workers ログをリアルタイムで確認します:

```bash
# リアルタイムログストリーミング
npx wrangler tail hono-inertia-blog

# ステータスコードでフィルタリング（エラーのみ）
npx wrangler tail hono-inertia-blog --status error

# サンプリングレートを指定（デフォルト: 1.0）
npx wrangler tail hono-inertia-blog --sampling-rate 0.1
```

### ログ出力例

```
[2026-05-05T10:00:00.000Z] GET /posts 200 OK (15ms)
[2026-05-05T10:00:01.000Z] POST /posts 201 Created (23ms)
[2026-05-05T10:00:02.000Z] GET /posts/999 404 Not Found (5ms)
```

---

## 3. アプリケーションログ

### Hono での構造化ログ

現在の実装では `console.log` / `console.error` が Cloudflare Workers のログに記録されます。

**ログ確認コマンド:**

```bash
# wrangler tail でコンソール出力を確認
npx wrangler tail hono-inertia-blog
```

### 推奨ログ実装パターン

エラーハンドリング時に context 情報を含めたログを出力することを推奨します:

```typescript
// apps/server/src/index.ts での例
app.onError((err, c) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  }));
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

---

## 4. パフォーマンスモニタリング

### Cloudflare Workers の制限値

| リソース | 無料プラン | 有料プラン（Workers Paid） |
|---------|----------|--------------------------|
| CPU 時間 | 10ms/リクエスト | 30秒/リクエスト |
| メモリ | 128MB | 128MB |
| リクエスト数 | 100,000/日 | 10,000,000/月 |
| スクリプトサイズ | 1MB（圧縮後） | 10MB |

### パフォーマンス確認方法

1. **Cloudflare ダッシュボード > Analytics**:
   - P50/P75/P95/P99 レスポンスタイム
   - バイト転送量

2. **ローカルでの性能確認**:
   ```bash
   # ローカル Workers シミュレーションで動作確認
   pnpm preview
   # ブラウザの DevTools > Network タブで確認
   ```

3. **Lighthouse による計測**:
   ```bash
   # Chrome DevTools > Lighthouse でレポート生成
   # または CLI
   npx lighthouse https://hono-inertia-blog.<subdomain>.workers.dev
   ```

---

## 5. 障害対応（Incident Response）

### インシデント分類

| レベル | 定義 | 対応時間目安 |
|-------|------|------------|
| P1 - Critical | サービス全停止（5xx が 50% 超） | 即時対応 |
| P2 - High | 主要機能が使用不可（認証・投稿機能） | 1時間以内 |
| P3 - Medium | 一部機能の劣化（パフォーマンス低下） | 当日対応 |
| P4 - Low | 軽微な問題（UI の乱れなど） | 次スプリント |

### 障害調査フロー

```
1. 症状の確認
   |
   v
2. ダッシュボード確認
   - Cloudflare: Workers Metrics / Error Rate
   - ブラウザ: DevTools > Console / Network
   |
   v
3. ログ確認
   npx wrangler tail hono-inertia-blog --status error
   |
   v
4. 直近のデプロイ確認
   git log --oneline -10
   |
   v
5. ロールバック判断
   - 問題のコミットを特定
   - 前バージョンへの revert
   |
   v
6. 修正・再デプロイ
   pnpm build && pnpm deploy
```

### ロールバック手順

```bash
# 直近のコミット履歴を確認
git log --oneline -10

# 問題のないコミットへ revert
git revert <commit-hash>

# または特定コミットの状態に戻す（注意: 強制的）
git reset --hard <commit-hash>

# ビルド & デプロイ
pnpm build
pnpm deploy
```

---

## 6. 可用性・SLO

### このアプリの目標（学習プロジェクト）

| 指標 | 目標値 | 備考 |
|------|-------|------|
| 可用性 | 99.9%（Cloudflare SLA に依存） | Workers 自体の可用性 |
| レスポンスタイム（P95） | < 200ms | エッジ配信の恩恵 |
| エラーレート | < 1% | 5xx エラー |

### Cloudflare の公式 SLA

- Cloudflare Workers は世界 200+ のデータセンターで動作
- グローバル可用性 99.99% を提供（エンタープライズプラン）
- 無料・有料プランでも Cloudflare の冗長性を享受できる

---

## 7. セキュリティモニタリング

### Cloudflare の組み込みセキュリティ機能

- **DDoS 保護**: Cloudflare が自動で DDoS 攻撃を緩和
- **WAF（Web Application Firewall）**: 有料プランで利用可能
- **Bot 管理**: 悪意のあるボットのブロック

### アプリレベルのセキュリティ確認ポイント

1. **セッション/JWT の有効期限確認**:
   - 長期間ログインしたままのセッションがないか

2. **レート制限の確認**:
   - 短時間に大量のリクエストが来ていないか（wrangler tail で確認）

3. **シークレットのローテーション**:
   ```bash
   # JWT_SECRET などのシークレットを定期的に更新
   wrangler secret put JWT_SECRET
   ```

---

## 8. 定期メンテナンス

### 推奨メンテナンス項目

| 頻度 | タスク |
|------|-------|
| デプロイごと | wrangler.toml の設定確認 |
| 週次 | Cloudflare ダッシュボードのメトリクス確認 |
| 月次 | 依存関係の更新（pnpm update） |
| 月次 | シークレットのローテーション（必要に応じて） |
| 四半期 | compatibility_date の更新検討 |

### 依存関係の更新

```bash
# 依存関係の最新版確認
pnpm outdated

# インタラクティブな更新
pnpm update --interactive

# ビルドして問題がないことを確認
pnpm build

# ローカルでテスト
pnpm preview

# デプロイ
pnpm deploy
```

---

*最終更新: 2026-05-05*
