# アイコン出典・ライセンス

## 既存プリセット由来の generic アイコン

旧プリセット9種は `generic:*` のキーとして統合しました。本プロジェクト向けに
作成した SVG マークです。
本プロジェクトの Apache License 2.0 で提供します。

## 同梱汎用アイコン

`generic:*` の全30キー（一般概念21種と旧プリセット9種）は、
本プロジェクト向けに作成した独自 SVG です。本プロジェクトの
Apache License 2.0 で提供します。

## dashboard-icons

- 配布元: <https://github.com/homarr-labs/dashboard-icons>
- 取得元: <https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/>
- 同梱物: slug と表示名だけを含む検索索引
  `src/data/dashboard-icons-index.json`
- 個別 SVG はアプリへ静的収録せず、選択時に jsDelivr の URL を `url:`
  参照として保存します。SVG の権利・ライセンスは上流リポジトリの各アイコンに
  従います。アプリ側のローカル SVG キャッシュは廃止しました。

索引生成処理は `scripts/generate-dashboard-icon-index.mjs` にあります。
