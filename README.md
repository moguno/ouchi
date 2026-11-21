# ouchi.local Portal v1

Vite＋React の SPA と、TypeScript＋Hono の REST API、SQLite 台帳 v0.4 で
構成した ouchi.local ポータルの v1 プロトタイプです。ブラウザ内データ保存は
廃止し、SQLite を唯一の正としています。v1 は LAN 内利用を前提とした
認証なしの構成です。

## できること（v1）

- ホームラボのネットワーク／デバイス／サービスを台帳に登録し、ポータルに一覧表示
- サービスのタイルからワンクリックで各サービスの画面へ移動
- デバイス同士の関係を自由なタグと色で表現。デバイスを選ぶと関係先が色とタグで分かる
- 管理画面からネットワーク／デバイス／サービス／関係を追加・編集・削除
- 外部 SaaS（Notion など）もサービスとして登録可能
- ポータルのタイトルを管理画面から変更可能
- 設定一式を YAML でエクスポート／インポート（バックアップとバージョン移行用）
- ログインなし（LAN 内での利用が前提）

## v1 に含まれないもの

稼働監視（状態表示）、メーター収集、MCP、SSO、Avahi 広告は v1 に含まれない。後続のブロックで追加予定。

## 構成

- `src/portal/`: 表示・編集 UI、API クライアント、共有型・検証
- `server/`: Hono API、SQLite リポジトリ、SPA 静的配信
- `contract-v1/`: 台帳スキーマ v0.4、シード、検証スクリプト
- `data/ouchi.sqlite`: 初回起動時に生成される台帳（Git 管理外）
- `dist/`: 埋め込み用 React ライブラリ
- `demo-dist/`: SPA の本番ビルド
- `server-dist/`: API サーバーの本番ビルド

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
シードを上書きしません。

SQLite は起動時に `foreign_keys=ON`、`busy_timeout=5000`、WAL モード、
`synchronous=NORMAL` を設定します。バックアップは稼働中に `sqlite3 .backup`
を使ってください。

## Docker

```bash
docker compose up --build -d
```

build / runtime とも `node:22-alpine` を使います。`ouchi-data` ボリュームが
`/app/data` にマウントされます。API とビルド済み SPA は同一コンテナで動作し、
プロセスは `node` ユーザーで実行されます。Avahi はホスト側の既存構成へ
任せます。

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
- デバイス: `id, hostname, category, isVm, sshUser, sshPort, meterEnabled,
  memberships`
- 所属: `id, deviceId, networkId, ip, label`
- サービス: DB列に組み立て済みの `url` / `monitorUrl` を追加
- 関係: `id, fromDeviceId, toDeviceId, tag, fromLabel, toLabel, color`
- 設定: `domain, title`

`title` はポータル左上に表示する名称です。空文字・改行・100文字超は
HTTP 400 で拒否し、DB を変更しません。

サービス状態は v1 では状態プロバイダを接続していないため、レスポンスにも
`status` を付けません。将来のプロバイダ接続に備えて型と API 境界は残していますが、
v1 の GUI には状態ドット・状態ラベル・凡例を表示しません。

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
同じ値を復元します。

### URL 組み立て

`service_url` がある場合はリダイレクト先と監視URLの両方で優先します。
それ以外は所属 IP とポートから組み立て、80/443 でもポートを省略しません。

- `url`: `{scheme}://{ip}:{port}{top_path}`。パス空は `/`
- `monitorUrl`: 監視パス、空ならトップパス、両方空なら `/`
- 所属 IP が NULL で `service_url` も空なら、どちらも `null`

## SPA

通常のデモ起動では `GET /api/portal` を読み、編集操作は各 REST API を呼んだ
あと台帳を再取得します。localStorage はデータ保存にも移行期キャッシュにも
使いません。API 障害時は古い表示を出さず、接続エラーを表示します。
ポータルタイトルも `settings.title` を表示し、管理画面から
`PUT /api/settings` で保存します。

カテゴリーは `network / physical / vm / service` です。ポータルでは所属が
1件以上あるカテゴリー見出しだけを表示し、管理画面では追加導線として全カテゴリーを
選べます。ネットワーク自体が0件のときだけ「デバイス未登録」のプレースホルダを
表示します。

関係ラベルは、注目デバイスが from 側なら
`fromLabel || tag`、to 側なら `toLabel || tag` を使います。
色とタグは自由文字列です。

### GitHub Pages 向け YAML デモ

`npm run build:pages` は `--mode pages` で SPA をビルドし、静的ファイル一式を
`成果物/demo-pages/` へ出力します。このビルドは API ではなく、同梱の
`ouchi-ledger.sample.yaml` を相対 URL で読み込みます。`index.html`、JavaScript、
CSS、YAML はすべて相対参照なので、GitHub Pages の `/<リポジトリ名>/` 配下へ
`成果物/demo-pages/` の中身をそのまま配置できます。

デモのデータは `format: ouchi-ledger/1` の架空サンプルです。インターネット、
自宅 LAN、サーバーセグメントの3ネットワークへ TEST-NET-1／2／3
（`192.0.2.0/24`、`198.51.100.0/24`、`203.0.113.0/24`）を割り当て、
ゲートウェイは3ネットワークすべてへ所属します。物理ホストと3台のVMの関係は
`relations` で表し、インターネット上にはデモ自身を指すサービスを登録しています。
`https://moguno.github.io/ouchi/` は公開時に差し替えるプレースホルダです。
通常の `npm run build:demo` は引き続き REST API モードです。Pages デモは
表示専用で、管理・編集 UI は表示されません。GitHub への push と Pages の
有効化はリポジトリ利用者が行います。

### メーターと状態表示

`GET /api/devices/:id/meters` と台帳の SSH 関連列は将来の収集ブロック向けに
残しています。SSH コレクターは v1 では未接続で、API は
`memoryPercent: null, diskPercent: null` を返します。

v1 の GUI はメーターのパーセンテージ・「未取得」・メーター設定入力を表示せず、
サービスの状態ドット・状態ラベル・凡例も表示しません。ダミー値とランダム更新は
ありません。秘密鍵は DB やソースへ置かず、実装時に SOPS などから供給する想定です。

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
検証します。Playwright はビルド済み SPA と Hono サーバーを起動して表示・GUI編集・
API永続化を確認します。

## v1 の未決事項

- ネットワーク削除は「紐づく所属が残る場合は削除不可」として実装した。
- 既存 DB の `settings.title` 追加は、エクスポート→インポートによる移行が前提。
  自動 `ALTER TABLE` は実装しない。
- メーター収集用 SSH 秘密鍵の供給方法と収集間隔は未決。API 形状のみ実装。
- Gatus 状態プロバイダの接続方法は v1 の任意要件。今回は未接続。

## ライセンス

本プロジェクトは [Apache License 2.0](LICENSE) の下で提供されます。
