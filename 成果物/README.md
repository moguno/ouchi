# 成果物

- `v1/demo/`: SQLite＋Hono REST API 駆動の v1 SPA 本番ビルド
- `v1/server/index.js`: SPA も配信する v1 Hono サーバービルド
- `v1/mcp/index.js`: REST API を読み書きする v1 MCP サーバービルド
- `v1/compose.yaml`: API と MCP を別サービスで起動する Docker Compose 定義
- `v1/package/ouchi-local-portal-1.0.0.tgz`: v1 埋め込み用 React コンポーネント
- `v1/LICENSE`: プロジェクト本体と同じ Apache License 2.0
- `v1/Dockerfile`: `node:22-alpine` を使う v1 マルチステージビルド定義
- `demo-pages/`: 架空 YAML を相対パスで読む、GitHub Pages 向け表示専用デモ
- `screenshots/`: 旧モック時点の画面確認画像（今回の Playwright は実行環境の
  localhost bind 制限 `EPERM` により未更新）

以下は v0.2 モック時点の履歴です。

- `demo/`: `PortalDataV2` 対応の確認用ポータル
- `package/ouchi-local-portal-0.2.0.tgz`: 埋め込み用Reactコンポーネント
- `screenshots/`: アイコン／リスト、管理画面、関係ハイライトを含む確認画像

このファイルは成果物の配置を説明するためのものです。
