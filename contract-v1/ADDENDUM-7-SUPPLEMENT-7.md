# 追加ブリーフ 7 補足 7：インターネットのサービス 2 件の改名（2026-11-21、カイル）

## 内容

デモサイト（サンプルデータ）の、インターネット ネットワークに属するサービス 2 件を改名する。ユーザー指示。対象は**デモのサンプルデータのみ**。

## 現状（サンプル YAML で確認済み）

- `lumen-notes`：petname「Lumen Notes」、架空の外部ノート SaaS、serviceUrl `https://notes.example.com/`
- `ouchi-pages`：petname「ouchi.local デモ」、serviceUrl `https://moguno.github.io/ouchi/`

## 変更内容

1. `ouchi-pages` の petname を **GitHub** に変更する。serviceUrl は現状のまま（GitHub Pages の URL なので整合する）。説明文は GitHub を指す内容に調整してよい。
2. `lumen-notes` の petname を **Google Drive** に変更する。serviceUrl は `https://drive.google.com/` に変更し、説明文もクラウドストレージを指す内容に調整する。デバイス名・subdomain は変更しない。
3. アイコンは、追加ブリーフ 17 の 3 種形式の **url 参照**で、dashboard-icons の実アイコンを設定する：GitHub は `github.svg`、Google Drive は `google-drive.svg` の jsDelivr CDN URL（`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/<slug>.svg` 形式）。読み込み失敗時のフォールバックは既存仕様（generic）どおり。

## 仕様

- 台帳の実データ（API モード用シード等）には手を入れない。
- 検証（verify／テスト）を通し、デモを再ビルドして `成果物/demo-pages/` に同期すること。`成果物/v1/` 側にもサンプルが含まれる場合はそちらも同期する。

## 報告

- 結果をプロジェクトの `報告書.md` に追記すること（変更前後の対応表と、設定したアイコン URL）。
