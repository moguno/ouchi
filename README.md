# ouchi.local Portal v1

Vite＋React の SPA と、TypeScript＋Hono の REST API、SQLite 台帳で構成した、
自宅ラボのポータルです。台帳に登録したネットワーク／デバイス／サービスを
ポータルで一覧でき、MCP サーバー経由で AI エージェントからも読み書きできます。
v1 は LAN 内利用を前提とした認証なしの構成です。

## できること（v1）

- ホームラボのネットワーク／デバイス／サービスを台帳に登録し、ポータルに一覧表示
- サービスのタイルからワンクリックで各サービスの画面へ移動
- デバイス同士の関係を自由なタグと色で表現。デバイスを選ぶと関係先が色とタグで分かる
- 管理画面からネットワーク／デバイス／サービス／関係を追加・編集・削除
- dashboard-icons と同梱汎用アイコンを文字列検索してサービスへ設定
- 外部 SaaS（Notion など）もサービスとして登録可能
- ポータルのタイトルを管理画面から変更可能
- 設定一式を YAML でエクスポート／インポート（バックアップとバージョン移行用）
- AI エージェントから台帳を読み書きする TypeScript 製 MCP サーバー
  （Streamable HTTP、別プロセス）
- ログインなし（LAN 内での利用が前提）

## v1 に含まれないもの

稼働監視（状態表示）、メーター収集、SSO、Avahi 広告は v1 に含まれない。
後続のブロックで追加予定。

## 構成

- `src/portal/`: 表示・編集 UI、API クライアント、共有型・検証
- `server/`: Hono API、SQLite リポジトリ、SPA 静的配信
- `mcp/`: REST API 上に載る MCP サーバー、地図テキスト、MCP ツール
- `contract-v1/`: 台帳スキーマ v0.4、シード、検証スクリプト
- `docs/design-notes.md`: 表示仕様や未決事項などの設計メモ（開発者向け）
- `data/ouchi.sqlite`: 初回起動時に生成される台帳（Git 管理外）
- `dist/`: 埋め込み用 React ライブラリ
- `demo-dist/`: SPA の本番ビルド
- `server-dist/`: API サーバーの本番ビルド
- `mcp-dist/`: MCP サーバーの本番ビルド

API は `node:sqlite` を使うためネイティブ npm モジュールが不要です。
Node.js 22.22 以降を想定しています。

## 起動

開発時は API と Vite を別プロセスで起動します。

```bash
npm install
npm run dev:api
npm run dev
```

Vite は `/api` を `http://127.0.0.1:3000` へプロキシします。

本番相当の単一プロセスでは、SPA と API を同じ Hono サーバーから配信します。

```bash
npm run build
npm start
```

既定値は `http://0.0.0.0:3000`、台帳は `data/ouchi.sqlite` です。
必要に応じて次の環境変数を指定できます。

| 変数 | 既定値 |
| --- | --- |
| `PORT` | `3000` |
| `HOST` | `0.0.0.0` |
| `OUCHI_DB_PATH` | `data/ouchi.sqlite` |

初回起動時は `contract-v1/schema.sql` と `contract-v1/seed.sql` から
16デバイス・17所属・9サービスの実ラボ台帳を作成します。既存 DB がある場合は
シードを上書きしません。デバイス petname 追加前の DB は起動時に
`contract-v1/migrations/001_add_device_petname.sql` の
`ALTER TABLE devices ADD COLUMN petname TEXT` を一度だけ適用します。

バックアップは稼働中に `sqlite3 .backup` を使ってください。

## Docker

GHCR でマルチアーキイメージ（linux/amd64 / linux/arm64）を公開しています。
アーキテクチャは自動で選択されます。このリポジトリの `compose.yaml` を
取得して起動するだけです。

```bash
docker compose up -d
```

ポータルは `http://<ホスト>:3000`、MCP は別サービスとして
`http://<ホスト>:3333/mcp` を公開します。台帳は `ouchi-data` ボリューム
（`/app/data`）に保存されます。API とビルド済み SPA は同一コンテナで
動作し、プロセスは `node` ユーザーで実行されます。

ソースからビルドする場合は `docker build -t ouchi-local-portal .` を使い、
`compose.yaml` の `image:` を `build: .` に置き換えてください。

## MCP サーバー

AI エージェント（Claude など）をこの MCP サーバーに接続すると、台帳の
ネットワーク構成を「地図」として AI に渡せます。デバイスの保守時に構成を
踏まえて手伝わせたり、自然言語でデバイスやサービスの登録・変更を任せたり
できます。

MCP は公式 `@modelcontextprotocol/sdk` 1.32.2 のサーバー／
Streamable HTTPトランスポートを使い、既存 REST API の薄いクライアントとして
動作します。ネットワーク／デバイス／サービス／関係のドメイン検証は
REST 側だけにあります。MCP には認証を
設けていません。**LAN 内利用だけを前提とし、ポート `3333` を WAN や
インターネットへ公開しないでください。** ルーターのポート開放、WAN 向け
リバースプロキシ、公開クラウドへのデプロイは禁止です。

開発時は REST API を起動したまま、MCP を別プロセスで起動します。

```bash
npm run dev:api
npm run dev:mcp
```

本番相当では次のいずれかを使います。

```bash
npm run build
npm start
# 別ターミナル
npm run start:mcp
```

```bash
docker compose up --build -d
```

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `MCP_HOST` | `0.0.0.0` | LAN へ待ち受けるホスト |
| `MCP_PORT` | `3333` | MCP の待受ポート |
| `OUCHI_REST_URL` | `http://127.0.0.1:3000` | REST API のベース URL |

接続先は Streamable HTTP の `http://<LAN IP>:3333/mcp` です。ステートレスな
JSON-RPC サーバーなので、セッション ID は返しません。MCP クライアントの
リモート MCP 設定でこの URL を指定してください。認証ヘッダーはありません。

初期化の最小 HTTP リクエストは次のとおりです。

```bash
curl -sS http://192.168.0.32:3333/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {"name": "curl", "version": "1.0.0"}
    }
  }'
```

利用できるツールは次の系統です。

- 読み取り: `get_network_map`、`get_device_neighborhood`、
  `search_devices`、`search_services`、`resolve_service_url`
- 台帳 CRUD: `list/get/create/update/delete` の
  `network`、`device`、`membership`、`service`、`relation`
- 関係: `get_device_relations`、`create_relation`、`update_relation`、
  `delete_relation`
- 一括転送: `export_ledger_yaml`、`import_ledger_yaml`

地図テキストはネットワーク→デバイス→サービスの階層を含み、関係の
`fromLabel` / `toLabel` フォールバック、タグ、色、方向を表示します。
`get_network_map` に `deviceId` と `depth` を渡すと、関係を双方向に
たどった近傍ビューも同じ結果へ含めます。検索は名前、ホスト名、
ペットネーム、IP、所属、説明、URL、関係タグを対象にします。

書き込みツールは REST の POST/PUT/DELETE をそのまま呼びます。REST が
HTTP 400 の `issues` を返した場合は MCP の `isError: true` と
`structuredContent.error.body.issues` に同じ内容を返します。削除時の
HTTP 409 も同様です。同じタグは同じ色、カテゴリ `service` の疑似デバイスは
IP を持たず VM／メーターを無効にする、という規則も REST 側で判定されます。

## REST API

ベースパスは `/api` です。ID は SQLite の整数 ID をそのまま返します。
入力検証に失敗した場合は HTTP 400 と
`{ "issues": [{ "path": "...", "message": "..." }] }` を返します。

| メソッド・パス | 役割 |
| --- | --- |
| `GET /api/portal` | SPA 初期表示用スナップショット |
| `GET /api/networks` | ネットワーク一覧 |
| `POST /api/networks` | ネットワーク作成 |
| `PUT /api/networks/:id` | ネットワーク更新 |
| `DELETE /api/networks/:id` | ネットワーク削除（所属が残る場合は409） |
| `GET /api/devices` | デバイス一覧（所属を内包） |
| `POST /api/devices` | デバイス作成 |
| `PUT /api/devices/:id` | デバイス更新 |
| `DELETE /api/devices/:id` | デバイス削除（サービス・関係が残る場合は409） |
| `GET /api/memberships` | 所属一覧 |
| `POST /api/memberships` | 所属作成（IPはNULL可） |
| `PUT /api/memberships/:id` | 所属更新 |
| `DELETE /api/memberships/:id` | 所属削除（サービスが残る場合は409） |
| `GET /api/services` | サービス一覧 |
| `POST /api/services` | サービス作成 |
| `PUT /api/services/:id` | サービス更新 |
| `DELETE /api/services/:id` | サービス削除 |
| `GET /api/relations` | 関係一覧 |
| `POST /api/relations` | 関係作成 |
| `PUT /api/relations/:id` | 関係更新（既存タグと異なる色は400） |
| `PUT /api/relations/tags/:tag/color` | タグを持つ全関係の色を一括更新 |
| `DELETE /api/relations/:id` | 関係削除 |
| `GET /api/devices/:id/relations?depth=1` | 双方向の関係トラバース |
| `GET /api/devices/:id/meters` | メモリ／ディスク使用率 |
| `GET /api/settings` | 全体設定 |
| `PUT /api/settings` | ポータルタイトルを保存 |
| `GET /api/export` | 台帳一式をYAMLでダウンロード |
| `POST /api/import` | YAMLを全件検証し、トランザクションで全置き換え |
| `GET /api/health` | ヘルスチェック |

`GET /api/portal` は次の表示用データを返します。

- ネットワーク: `id, name, cidr, accent, note`
- デバイス: `id, hostname, petname, category, isVm, sshUser, sshPort,
  meterEnabled, memberships`
- 所属: `id, deviceId, networkId, ip, label`
- サービス: DB列に組み立て済みの `url` / `monitorUrl` を追加
- 関係: `id, fromDeviceId, toDeviceId, tag, fromLabel, toLabel, color`
- 設定: `domain, title`

`title` はポータル左上に表示する名称です。空文字・改行・100文字超は
HTTP 400 で拒否し、DB を変更しません。

デバイス `petname` は任意の愛称です。ポータルでは petname が主表示になり、
未設定時は hostname を表示します。

### YAML エクスポート／インポート

`GET /api/export` は `format: ouchi-ledger/1` と `exportedAt` を持つ YAML を
返します。DB の内部 ID は含めず、所属はデバイスのホスト名とネットワーク名、
サービスは同じ自然キー、関係は from/to のホスト名で参照します。SSH 鍵は
`sshKeys` と `deviceKeys` に分け、公開鍵だけを出力します。

`POST /api/import` は YAML 全体の形式、既存の入力検証、自然キーの一意性、
参照、CIDR 内の IP を先に検証します。1件でも不正なら HTTP 400 と
`issues` を返し、DB を変更しません。検証後は `BEGIN IMMEDIATE` で台帳を
全置き換えし、途中で失敗した場合はロールバックします。管理画面では
エクスポートのダウンロードと、ファイル内容を確認してから実行するインポートを
提供します。YAML の `settings` には `domain` と `title` を含め、往復後も
同じ値を復元します。`devices[].petname` も出力・入力し、空値は未設定として
往復します。

### サービスアイコン

アイコン参照は次の3形式だけです。

- `generic:<key>`: アプリ同梱の汎用アイコン。既存9キー
  （`gitea`、`gatus`、`proxmox`、`omv`、`server`、`database`、
  `monitor`、`container`、`globe`）も含みます。
- `favicon`: サービス URL の origin にある `/favicon.ico` を使います。
- `url:<http(s)-image-url>`: 明示した画像 URL を使います。

旧 YAML の `gitea` などは `generic:gitea`、`preset:gitea` は
`generic:gitea` に正規化します。`dashboard:plex` は
`url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg`
へ正規化します。読み込み／インポート時に正規化し、エクスポートでは3形式だけを
出力します。

管理画面の検索ピッカーは、同梱索引
`src/data/dashboard-icons-index.json` をローカル検索するため、オフラインでも
候補名と slug を絞り込めます。索引は次のコマンドで jsDelivr の
dashboard-icons メタデータから再生成できます。

```bash
npm run generate:icon-index
```

検索候補を選ぶと、対応する
`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/<slug>.svg` を
`url:` 参照として保存します。ローカル SVG キャッシュは使用しません。
`favicon` または `url:` の画像読み込みに失敗した場合は
`generic:applications` を代替表示します。読み取り専用デモは同梱 generic
アイコンだけで描画します。全30キーの汎用アイコンは本プロジェクトで作成した
Apache-2.0 の独自 SVG です。

### URL 組み立て

`service_url` がある場合はリダイレクト先と監視URLの両方で優先します。
それ以外は所属 IP とポートから組み立て、80/443 でもポートを省略しません。

- `url`: `{scheme}://{ip}:{port}{top_path}`。パス空は `/`
- `monitorUrl`: 監視パス、空ならトップパス、両方空なら `/`
- 所属 IP が NULL で `service_url` も空なら、どちらも `null`

### GitHub Pages 向け YAML デモ

`npm run build:pages` は `--mode pages` で SPA をビルドし、静的ファイル一式を
`成果物/demo-pages/` へ出力します。このビルドは API ではなく、同梱の
`ouchi-ledger.sample.yaml` を相対 URL で読み込みます。`index.html`、JavaScript、
CSS、YAML はすべて相対参照なので、GitHub Pages の `/<リポジトリ名>/` 配下へ
`成果物/demo-pages/` の中身をそのまま配置できます。

`main` ブランチへのpush時は `.github/workflows/pages.yml` が
`npm run build:pages` を実行し、`成果物/demo-pages/` をGitHub Pagesへ
自動配備します。公開URLは
`https://moguno.github.io/ouchi/` です。

デモのデータは `format: ouchi-ledger/1` の架空サンプルです。インターネット、
家族用LAN、ホームラボ、個人ネットワークの4ネットワークへ TEST-NET-1／2／3
（`192.0.2.0/24`、`198.51.100.0/24`、`203.0.113.0/24`）と
RFC 2544 ベンチマーク用（`198.18.0.0/24`）を割り当てます。
`l3-switch` は家族用LAN、ホームラボ、個人ネットワークへ所属します。
物理ホストとVMの関係は `relations` で表し、インターネット上にはデモ自身を
指すサービスを登録しています。
Pages デモは表示専用で、管理・編集 UI は表示されません。

## 埋め込み利用

`data` を渡すと、そのスナップショットを読み取り専用の初期データとして表示
できます。API 駆動の通常デモでは `data` を省略してください。

```tsx
import { OuchiPortal, type PortalDataV2 } from "ouchi-local-portal";
import "ouchi-local-portal/styles.css";

export function Dashboard({ data }: { data: PortalDataV2 }) {
  return <OuchiPortal data={data} />;
}
```

## テストとビルド

```bash
npm run typecheck
npm test
npm run build
python3 contract-v1/verify.py
npm run screenshots
```

Vitest は共有検証、SPA の API 読み込み／管理 UI、Hono API の in-process CRUD、
関係トラバース、URL 組み立て、YAML のラウンドトリップと不正時の DB 無変更を
検証します。MCP は初期化、ツール一覧、地図トラバース、URL 解決、
CRUD 往復、REST と同一の検証エラー、タグ色／疑似デバイス規則、
YAML 往復を検証します。実 HTTP メッセージと公式SDKクライアントを使う
MCP相互運用テストも含みます。
Playwright はビルド済み SPA と Hono サーバーを起動して表示・GUI編集・
API永続化を確認します。

## ライセンス

本プロジェクトは [Apache License 2.0](LICENSE) の下で提供されます。
