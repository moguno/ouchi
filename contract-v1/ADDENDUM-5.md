# 追加ブリーフ 5：Docker ベースイメージを Alpine に変更（2026-11-21、カイル）

## 背景

ユーザーの決定：ファーストリリースの Docker イメージを小型化する。ベースを Debian slim から Alpine に変える。このアプリはネイティブ依存ゼロ（SQLite は Node 内蔵の `node:sqlite`）なので、musl 化の影響は小さいはず、という前提での変更。

## 仕様

1. **Dockerfile**：全ステージ（build / runtime）の `FROM` を `node:22-bookworm-slim` から **`node:22-alpine`** に変更する。
2. **確認事項**：
   - `npm ci`（build / runtime 両方）、`npm run build`、テストが通ること。
   - `node:sqlite` が Alpine（musl）上で動作すること。サーバー起動・DB 初期化・API の基本応答まで確認する（実起動できない環境なら in-process でも可。その旨を明記）。
   - `node` ユーザーでの実行と `/app/data` の所有権まわりが従来どおり動くこと。
   - **変更前後のイメージサイズを実測して報告する**こと（`docker images` の値）。ビルドできない環境なら、その旨と未確認であることを明記する。
   - マルチアーキ（arm64 / amd64）：公式 alpine タグは両対応の前提。実ビルドで確認できない場合は、残課題として報告する。
3. **compose.yaml**：変更不要のはず。影響があれば直して報告する。

## 報告

- 結果をプロジェクトの `報告書.md` に追記すること。
- 成果物は `成果物/v1/` へ同期すること（Dockerfile も含む）。
