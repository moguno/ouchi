# ouchi.local Portal v1

Vite＋React の SPA と、TypeScript＋Hono の REST API、SQLite 台帳で構成した、
自宅ラボのポータルです。台帳に登録したネットワーク／デバイス／サービスを
ポータルで一覧でき、MCP サーバー経由で AI エージェントからも読み書きできます。
v1 は LAN 内利用を前提とした認証なしの構成です。

## できること（v1）

- ホームラボのネットワーク／デバイス／サービスを台帳に登録し、ポータルに一覧表示
- サービスのタイルからワンクリックで各サービスの画面へ移動
- デバイス同士の関係を再利用可能な「関係名」で表現。関係名が色と両端の
  方向ラベルを持ち、`{}` を関係ごとのプレースホルダーで置換できる
- 管理画面からネットワーク／デバイス／サービス／関係を追加・編集・削除
- デバイス／サービス本体へ任意のキーバリュー `properties` を保存
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
- `contract-v1/`: 台帳スキーマ v0.6、シード、起動時移行、検証スクリプト
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
`properties` 追加前の DB には、デバイス用とサービス用の `ALTER TABLE` を
それぞれ起動時に一度だけ適用し、既存行は空マップ `{}` で移行します。
ADDENDUM-24 より前のタグ付き関係は移行004で `relation_names` と
（関係名、始点、終点）の関係表へ変換します。補足1より前の関係表には
移行005を適用し、始点／終点プレースホルダーを空文字で追加して
5列の完全一致一意キーへ再構成します。

バックアップは稼働中に `sqlite3 .backup` を使ってください。

## Docker

GHCR でマルチアーキイメージ（linux/amd64 / linux/arm64）を公開しています。
このリポジトリの `compose.yaml` を取得して起動するだけです。

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
  `network`、`device`、`membership`、`service`、`relation_name`、`relation`
- 関係: `get_device_relations`、`create_relation`、`update_relation`、
  `delete_relation`
- 一括転送: `export_ledger_yaml`、`import_ledger_yaml`

地図テキストはネットワーク→デバイス→サービスの階層を含み、関係名が持つ
`fromLabel` / `toLabel` テンプレートをプレースホルダーで置換した方向ラベル、
関係名、色、方向を表示します。
デバイスとサービスの `properties` も地図テキストへ全件表示します。
`get_network_map` に `deviceId` と `depth` を渡すと、関係を双方向に
たどった近傍ビューも同じ結果へ含めます。検索は名前、ホスト名、
ペットネーム、IP、所属、説明、URL、関係名を対象にします。
さらにプロパティのキーと値を検索対象に含めます。

書き込みツールは REST の POST/PUT/DELETE をそのまま呼びます。REST が
HTTP 400 の `issues` を返した場合は MCP の `isError: true` と
`structuredContent.error.body.issues` に同じ内容を返します。削除時の
HTTP 409 も同様です。（関係名、始点、終点、始点プレースホルダー、
終点プレースホルダー）の完全一致重複禁止、使用中の関係名の削除禁止、
カテゴリ `service` の疑似デバイスが IP を持たず VM／メーターを無効にする、
という規則も REST 側で判定されます。
デバイス／サービスの作成・更新ツールは `properties` を受け取ります。

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
| `GET /api/devices/:id` | デバイス単体（プロパティを内包） |
| `POST /api/devices` | デバイス作成 |
| `PUT /api/devices/:id` | デバイス更新 |
| `DELETE /api/devices/:id` | デバイス削除（所属・サービス・関係が残る場合は409） |
| `GET /api/memberships` | 所属一覧 |
| `POST /api/memberships` | 所属作成（IPはNULL可） |
| `PUT /api/memberships/:id` | 所属更新 |
| `DELETE /api/memberships/:id` | 所属削除（サービスが残る場合は409） |
| `GET /api/services` | サービス一覧 |
| `GET /api/services/:id` | サービス単体（プロパティを内包） |
| `POST /api/services` | サービス作成 |
| `PUT /api/services/:id` | サービス更新 |
| `DELETE /api/services/:id` | サービス削除 |
| `GET /api/relation-names` | 関係名一覧（各要素に使用件数 `relationCount`） |
| `GET /api/relation-names/:id` | 関係名単体 |
| `POST /api/relation-names` | 関係名作成 |
| `PUT /api/relation-names/:id` | 関係名更新（名前・色・始点／終点ラベル） |
| `DELETE /api/relation-names/:id` | 関係名削除（使用中は409） |
| `GET /api/relations` | 関係一覧（色・方向ラベル解決済み） |
| `GET /api/relations/:id` | 関係単体（色・方向ラベル解決済み） |
| `POST /api/relations` | 関係作成（関係名、始点、終点、任意の両端プレースホルダー） |
| `PUT /api/relations/:id` | 関係更新（5列の完全一致重複は400） |
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
- デバイス: `id, hostname, petname, properties, category, isVm, sshUser,
  sshPort, meterEnabled, memberships`
- 所属: `id, deviceId, networkId, ip, label`
- サービス: DB列と `properties` に組み立て済みの `url` / `monitorUrl` を追加
- 関係名: `id, name, color, fromLabel, toLabel, relationCount`
- 関係: `id, relationNameId, relationName, fromDeviceId, toDeviceId,
  fromPlaceholder, toPlaceholder, fromLabel, toLabel, color`。
  `fromLabel` / `toLabel` はテンプレートの `{}` を値で置換済み
- 設定: `domain, title`

`title` はポータル左上に表示する名称です。空文字・改行・100文字超は
HTTP 400 で拒否し、DB を変更しません。

### 関係ラベルとプレースホルダー

関係名の始点／終点ラベルはテンプレートです。`{}` はすべて同じ値で置換され、
関係側の `fromPlaceholder` / `toPlaceholder` が空なら `-` になります。

- テンプレート `ポート{}`、終点プレースホルダー `8` → `ポート8`
- テンプレート `ポート{}`、終点プレースホルダー未入力 → `ポート-`
- テンプレートに `{}` がなければ、プレースホルダーは表示へ影響しない
- テンプレートが空なら関係名で代替し、プレースホルダーは適用しない
- 同じデバイスペア・同じ関係名でも、両端プレースホルダーが異なれば共存できる

関係編集ダイアログは、選択中の関係名ラベルに `{}` がある方向だけ
プレースホルダー入力欄を表示します。ポータル、関係タブ、MCP の地図／近傍では
置換済みラベルを表示します。REST の入力では両フィールドを省略でき、
省略時は空文字です。

デバイス `petname` は任意の愛称です。ポータルでは petname が主表示になり、
未設定時は hostname を表示します。

### デバイス／サービスのプロパティ

デバイスとサービスは本体属性として
`properties`（キー文字列→値文字列のマップ）を持ちます。独立した属性
リソースやキー単位の REST エンドポイントはありません。未設定時も API は
`{}` を返します。

- キーは前後空白を除去し、空文字不可、最大128文字です。
- 値は文字列で、最大64KiBです。
- 作成・更新で `properties` を指定すると全量置換します。
- 更新ペイロードで `properties` を省略すると既存値を保持します。
- 管理画面は全プロパティを行編集し、保存時にマップ全体を一括送信します。

**平文の秘密情報は入力しないこと。必要な場合は SOPS などで暗号化した文字列を入れること。**
値は SQLite に平文で保存され、ouchi は暗号化も復号も行いません。

### 管理画面

ポータル右上の「管理」は、ページを再読み込みせずに全画面の管理ビューへ
切り替えます。「ポータルに戻る」で元のポータルへ戻り、選択中のデバイスと
アイコン／リスト表示の状態は保持されます。管理ビューは画面幅いっぱいを使い、
次の5タブで構成します。

- ネットワーク: 件数付きのテーブル一覧と CRUD
- デバイス: 件数付きのテーブル一覧と CRUD。編集ダイアログには関係編集がある
- サービス: 件数付きのテーブル一覧と CRUD
- 関係: 関係名一覧（名前、色、始点／終点ラベル、使用件数）と CRUD。
  関係一覧は元デバイス→先デバイスと解決済み方向ラベルを表示する。関係編集は
  関係名選択＋始点／終点デバイス選択で、必要な方向だけプレースホルダー欄を
  表示する。デバイス編集と共通エディタを使う
- 共通設定: ポータルタイトルの保存、YAML エクスポート／インポート、全置換の注意書き

管理画面の一覧は共通テーブル部品で表示し、追加・編集は標準の `<dialog>` を
使います。関係名もインライン編集せず、編集ボタンから共通ダイアログを開きます。
既定タブはネットワークです。使用中の関係名は使用数と無効化された削除ボタンで
判別でき、先に使用中の関係を削除する必要があります。
静的な YAML データソースを使う表示専用デモでは、従来どおり管理 UI を表示しません。

### YAML エクスポート／インポート

`GET /api/export` は `format: ouchi-ledger/2` と `exportedAt` を持つ YAML を
返します。DB の内部 ID は含めず、所属はデバイスのホスト名とネットワーク名、
サービスは同じ自然キー、関係は `relationNames[]` の名前と from/to の
ホスト名で参照します。SSH 鍵は
`sshKeys` と `deviceKeys` に分け、公開鍵だけを出力します。

`POST /api/import` は YAML 全体の形式、既存の入力検証、自然キーの一意性、
参照、CIDR 内の IP を先に検証します。1件でも不正なら HTTP 400 と
`issues` を返し、DB を変更しません。検証後は `BEGIN IMMEDIATE` で台帳を
全置き換えし、途中で失敗した場合はロールバックします。管理画面では
エクスポートのダウンロードと、ファイル内容を確認してから実行するインポートを
提供します。YAML の `settings` には `domain` と `title` を含め、往復後も
同じ値を復元します。`devices[].petname` も出力・入力し、空値は未設定として
往復します。
`relations[]` は任意の `fromPlaceholder` / `toPlaceholder` を持ち、空値は
エクスポートで省略できます。フィールドのない旧 YAML は両方とも未入力
（空文字）として取り込みます。
`devices[].properties` と `services[].properties` も全件を出力・入力し、
往復で保持します。`properties` を持たない旧 YAML は空マップとして
インポートできます。同一エンティティ内で同じキーが重複した YAML は
HTTP 400 で拒否します。
旧 `ouchi-ledger/1` の `relations[].tag / color / fromLabel / toLabel` は、
タグでグルーピングして関係名を生成する1段変換を経て取り込みます。色と
方向ラベルは同じタグの最初の関係から採用し、DB移行004と同じ規則です。

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
`pages-dist/` へ出力します。このビルドは API ではなく、同梱の
`ouchi-ledger.sample.yaml` を相対 URL で読み込みます。`index.html`、JavaScript、
CSS、YAML はすべて相対参照なので、GitHub Pages の `/<リポジトリ名>/` 配下へ
`pages-dist/` の中身をそのまま配置できます。

`main` ブランチへのpush時は `.github/workflows/pages.yml` が
`npm run build:pages` を実行し、`pages-dist/` をGitHub Pagesへ
自動配備します。公開URLは
`https://moguno.github.io/ouchi/` です。

デモのデータは `format: ouchi-ledger/2` の架空サンプルです。インターネット、
家族用LAN、ホームラボ、個人ネットワークの4ネットワークへ TEST-NET-1／2／3
（`192.0.2.0/24`、`198.51.100.0/24`、`203.0.113.0/24`）と
RFC 2544 ベンチマーク用（`198.18.0.0/24`）を割り当てます。
`l3-switch` は家族用LAN、ホームラボ、個人ネットワークへ所属します。
物理ホストとVMの関係は `relationNames` と `relations` で表し、インターネット
上にはデモ自身を指すサービスを登録しています。
Pages デモでも管理画面を開けます。入力やダイアログ操作は試せますが、
追加・編集の保存、削除、YAML インポート、タイトル保存は無効になります。
YAML エクスポートは利用できます。

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

Vitest は共有検証、SPA の API 読み込み／全画面管理 UI と5タブ切り替え／
共通テーブルとネイティブダイアログ／関係名・関係 CRUD・使用件数、Hono API の in-process CRUD、
関係トラバース、URL 組み立て、YAML のラウンドトリップと不正時の DB 無変更を
検証します。旧スキーマDBの004移行、旧YAMLの1段変換、使用中関係名の409、
移行005、テンプレート置換、`-` 表示、5列の完全一致重複拒否も検証します。
MCP は初期化、ツール一覧、置換済み地図トラバース、URL 解決、
CRUD 往復、REST と同一の検証エラー、関係名／方向ラベル／疑似デバイス規則、
YAML 往復を検証します。実 HTTP メッセージと公式SDKクライアントを使う
MCP相互運用テストも含みます。
Playwright はビルド済み SPA と Hono サーバーを起動して表示・GUI編集・
API永続化を確認します。

## ライセンス

本プロジェクトは [Apache License 2.0](LICENSE) の下で提供されます。
