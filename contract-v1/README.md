# ouchi.local v1 実装ブリーフ（2026-11-21）— カイルから Codex へ

## 現在の優先仕様: インターフェースモデル（2026-11-23、もぐの決定）

本書の旧「所属（device_networks）」記述より、`schema.sql` v0.8 と
移行007を優先する。

- 所属はインターフェースに吸収された。`interfaces(id, device_id, name,
  network_id, ip, label)`：I/F と IP は 1:1、IP は nullable
  （スイッチのポート等は IP なし）、ネットワークは最大1つ。
  トランクポートは論理 I/F（ポート1-1、ポート1-2）に分けて表す
- 関係はデバイスではなく I/F 同士を結ぶ：
  `relations(id, relation_name_id, from_interface_id, to_interface_id,
  from_label, to_label)`、一意キーは（関係名、始点I/F、終点I/F、
  始点ラベル、終点ラベル）
- サービスは `interface_id` で I/F を参照する
- REST は `/api/interfaces` の CRUD（旧 `/api/memberships` は廃止）。
  MCP ツールも `*_interface` に改名（総数38は不変）
- YAML は `format: ouchi-ledger/7`。/3→/4 変換は移行007と同じ規則
  （所属→ eth0, eth1, …、関係端点は共有ネットワークのヒューリスティクス）、
  /4→/5 は I/F への MAC アドレス（任意）追加に伴う形式だけの前進、
  /5→/6 は I/F の表示ラベル削除（項目を取り除く）、
  /6→/7 はネットワークのアクセントをトーン名から自由色へ
  （トーン名はパレットの hex 値に変換）
- 起動時移行007が所属を I/F 化し、関係端点を付け替える。
  移行008は I/F に `mac`（NULL可）を追加し、移行009は I/F の `label` を削除、
  移行010はネットワークの `accent` のトーン名を hex 値に変換する

## 前の優先仕様: ラベルは関係側（2026-11-23、もぐの決定）

本書の旧 v0.4・関係タグ記述および `ADDENDUM-24.md`、
`ADDENDUM-24-SUPPLEMENT-1.md`、`schema.sql` v0.6 より、`schema.sql` v0.7
と移行006を優先する。

- 関係名 `relation_names(id, name, color)` は名前と色だけのカテゴリー
- 始点／終点ラベルは関係ごとに自由文で持つ。空のラベルは表示しない
  （関係名へのフォールバックはしない。`{}` テンプレートと
  プレースホルダーは廃止）
- 関係 `relations(id, relation_name_id, from_interface_id, to_interface_id,
  from_label, to_label)` は（関係名、始点I/F、終点I/F、始点ラベル、終点ラベル）を
  一意とする
- 使用中の関係名削除は409。同じI/Fペアに異なる関係名を併存できる
- YAML は `format: ouchi-ledger/7` と `relationNames` を使う。旧形式は
  1段ずつの変換で取り込む（/1→/2 はタグのグルーピング、/2→/3 は
  テンプレートを各関係のラベルへ展開、/3→/4 は所属のI/F化、
  /4→/5 は I/F の MAC 追加に伴う形式の前進、/5→/6 は I/F の表示ラベル削除、
  /6→/7 はネットワークのアクセントのトーン名→ hex 変換）
- REST は `/api/relation-names` の CRUD と、関係名を名前で指定する関係 CRUD
  を使う。旧 `PUT /api/relations/tags/:tag/color` は廃止
- 起動時移行004が旧関係をタグでグルーピングし、最初の関係から色・ラベルを
  引き継ぐ。移行005が2列追加と5列一意キーへの再構成を行い、移行006が
  ラベルを関係名から関係へ展開して移す。移行007が所属をインターフェースへ
  吸収し、関係端点をI/Fへ付け替える

## 0. これは何か

GUI のモック脱出。v1 としてリリースする **GUI表示＋GUI設定＋RDB＋薄いバックエンド** を作る。
モック（localStorage 駆動）をやめ、台帳（SQLite v0.4）を唯一の正にして、GUI と API をつなぐ。

**決まっていること（2026-11-21、もぐの決定）**

- v1 範囲：GUI表示＋GUI設定＋RDB（＋薄いバックエンド）。MCP・生成の本格化・SSO は v1 の外
- API 方式：**REST**（GraphQL / WebSocket は採用しない）
- バックエンド言語：**TypeScript**（GUI と型・検証ルールを共有するため。生成は Python のまま）
- フロント：**Vite＋React の SPA**（現行モックの延長）を静的配信＋独立した TS バックエンド。**Next.js 系は v1 で採用しない**
- 認証：**v1 はログインなし**（LAN 内前提のストロングスタイル。WAN に出さないことが前提）
- 分担：**Codex が作る、カイルが仕様と検収を持つ**。カイル側は契約（本書＋スキーマ v0.4）、出来上がりの検証、ouchi-test へのデプロイ、生成（Python）の改修を持つ

## 1. 出発点の注意（重要）

- **作業の起点は .32 上の現行モック**（`/root/261119 ouchi.local GUI`）。関係性（relations、fromLabel / toLabel）、サービス項目（scheme / port / topPath / monitorPath / serviceUrl）、メーター項目、SVG 接続線まで入った最新版がそこにある。
- カイル手元の `~/workspace/projects/ouchi.local/codex-mock/` のコピーは **11/19 時点の V1 スナップショットで古い**（types.ts は PortalDataV1、relations もサービス項目もない）。**これを起点にしないこと**。V2 の型・検証は .32 の現行ファイルを正とする。
- 契約の正は **スキーマ v0.4**：`DB_SCHEMA_DRAFT.md` v0.4、`app/v0.4/schema.sql` / `seed.sql` / `verify.py`。カイル環境で 2026-11-21 に verify.py を再実行し **ALL OK** を確認済み（外部キー整合、件数 networks 3 / devices 16 / 所属 17 / relations 5 / services 9、OMV のトラバース双方向、全9サービスの URL 組み立て）。

## 2. 契約：台帳 v0.4 の要点

- 階層：ネットワーク → デバイス（物理/VM 統合、category network / physical / vm / service、`is_vm` は CHECK で category と一致）→ サービス。**category=service は外部SaaSの疑似デバイス**：所属の IP は持たず（NULL）、SSH・メーター対象外で、配下サービスの `service_url` が完全な URL。インターネットを特別視しないための汎用化（2026-11-21 決定、スキーマ v0.4 が契約）
- **IP はデバイス本体に持たない**。所属（device_networks）に `id / ip / label` を持たせ、サービスは `device_network_id` で所属を参照する。同じデバイスが複数ネットワークに顔を出す（FortiGate はインターネット側 IP 未登録＋おうちLAN 192.168.0.1）のはこの多対多で表す
- 関係性は汎用モデル：`relations`（from_device_id / to_device_id / tag / from_label / to_label / color）。固定の種別なし。タグは自由文字列で、同じタグを持つ関係は全件同じ色でなければならない。色を変える場合はタグ単位で全関係へ反映する。1デバイスに複数関係可、同じ相手に複数タグ可。表示ラベルの解決は、注目デバイスが from 側なら `from_label ?? tag`、to 側なら `to_label ?? tag`。`parent_device_id` は廃止済み
- サービス：`subdomain`（リダイレクタのパス名）、`scheme`（http/https）、`port`、`protocol`（tcp/udp）、`top_path`（空＝`/`）、`monitor_path`（空＝ top_path で代用）、`service_url`（完全 URL の上書き、通常は空）、`icon_key`（`generic:<key>` / `favicon` / `url:<http(s)-image-url>`）、`enabled`
- サービスの稼働状態は **DB に持たない**。状態は外部プロバイダから読む差し込み式にする（第一候補は Gatus API）。**2026-11-21 決定で Gatus 連携はオプションに降格**：v1 のポータルは Gatus なしでも成立させ、プロバイダ未接続時は status を付けない
- メーター：メモリ % と `/` のディスク % のみ。**CPU は対象外**。取得は SSH＋Linux コマンド（`free` / `df -P /`）。`meter_enabled=0` の機器（スイッチ・AP・FortiGate）は対象外。収集専用キーペアの秘密鍵は SOPS 経由で供給し、DB には入れない
- 削除ルール：デバイス削除は、紐づくサービスが残っていたら**削除不可**（連鎖削除しない。先にサービスの移動か削除が必要）。relations の削除は行単位
- エンジン：SQLite（WAL＋busy_timeout）。バックアップは稼働中の吸い出しに `sqlite3 .backup` を使う

## 3. API 契約（REST）

ベースパス：`/api`。JSON。ID は DB の整数 id をそのまま返す（GUI 側で文字列化が必要なら境界で変換すること。モック V1 の文字列 id と混ぜない）。

### 3.1 エンドポイント一覧

| メソッド・パス | 役割 |
|---|---|
| `GET /api/portal` | ポータル表示用のスナップショット一式（下記 3.2）。GUI の初期表示はこれ1本で足りること |
| `GET /api/networks` / `POST /api/networks` / `PUT /api/networks/:id` / `DELETE /api/networks/:id` | ネットワーク CRUD |
| `GET /api/devices` / `POST /api/devices` / `PUT /api/devices/:id` / `DELETE /api/devices/:id` | デバイス CRUD（IP はここで持たない） |
| `GET /api/interfaces` / `POST /api/interfaces` / `PUT /api/interfaces/:id` / `DELETE /api/interfaces/:id` | インターフェース CRUD。名前・ネットワーク・IP の登録・変更はここ（旧 `/api/memberships` は移行007で廃止） |
| `GET /api/services` / `POST /api/services` / `PUT /api/services/:id` / `DELETE /api/services/:id` | サービス CRUD |
| `GET /api/relations` / `POST /api/relations` / `PUT /api/relations/:id` / `DELETE /api/relations/:id` | 関係 CRUD。既存タグと異なる色での作成・更新は400 |
| `PUT /api/relations/tags/:tag/color` | 指定タグを持つ全関係の色をトランザクション内で一括更新 |
| `GET /api/devices/:id/relations?depth=1` | 注目デバイスの関係トラバース。向き・タグ・色つきで列挙（双方向とも返す）。`depth` は将来の多ホップ用に受け付けるが、v1 は `depth=1` が動けばよい。MCP の構成問い合わせは後でこの流儀を再利用する |
| `GET /api/devices/:id/meters` | メモリ %・ディスク %。取得できない機器は `null` を返す（下記 3.4） |
| `GET /api/settings` | 全体設定（domain ほか1行もの） |

### 3.2 `GET /api/portal` の形

モックの PortalDataV2 の形に、DB の内容を組み立てて返す。生のテーブルをそのまま返さない。

- networks：`id, name, cidr, accent, note`
- devices：`id, hostname, petname, category, isVm, sshUser, sshPort, meterEnabled, interfaces: [{ id, name, networkId, ip, label }]`
- services：`id, interfaceId, subdomain, petname, description, port, protocol, scheme, topPath, monitorPath, serviceUrl, iconKey, enabled` に加え、組み立て済みの `url`（リダイレクト先）と `monitorUrl` を含める
- relations：`id, fromDeviceId, toDeviceId, fromInterfaceId, toInterfaceId, fromInterfaceName, toInterfaceName, relationName, fromLabel, toLabel, color`
- status：状態プロバイダ（Gatus 等）が接続されている場合のみ、サービスごとに `status: up / down / maintenance` を付ける。未接続時は status 自体を付けない（下記 3.4）

### 3.3 URL の組み立て規則（verify.py と同じにする）

- `service_url` が入っていればそれを優先する
- なければ `scheme://インターフェースIP:port` ＋ `top_path`（空なら `/`）がリダイレクト先・ポータルリンク用の `url`
- 監視用は `scheme://インターフェースIP:port` ＋ `monitor_path`（空なら `top_path`、それも空なら `/`）
- ポートは 80 / 443 でも省略せず明示する（verify.py の出力 `http://192.168.0.19:80/` に合わせる。生成側と食い違わないため）
- インターフェース IP が未登録（NULL）のサービスは `url` / `monitorUrl` を `null` にし、GUI ではリンクを出さない

### 3.4 状態とメーター：モックのランダムは使わない

- サービスの稼働状態は状態プロバイダ（Gatus 等、オプション）から読む。**ランダム更新は本実装では使わない**。プロバイダ未接続時は状態ドット自体を表示しない（「分からない」を色で誤魔化さない）
- Gatus を接続する場合のエンドポイント対応付けは、監視 URL の一致で突き合わせるのが第一候補。接続は v1 の必須ではなく、実装した場合は方法を報告に書くこと
- メーターは SSH で `free` と `df -P /` を取れた場合だけ数値を返す。取れない・対象外の機器は `null`。GUI は `null` を「未取得」と表示する。**ダミーの数値を出さない**
- メーター収集の実行方法（バックエンド内蔵か別プロセスか、収集間隔、専用鍵の受け渡し）は Codex の提案に任せる。ただし秘密鍵を DB やコードに直書きしないこと。鍵の供給方法が決まらない場合は、まず API の形だけ作って収集は `null` 返しでよい（その場合は報告に明記する）

### 3.5 検証ルールは一箇所に寄せる

- モックの `validation.ts`（型＋検証）をサーバと共有する。GUI と API で検証を二重実装しない。**型と検証ルールは PortalDataV2 のものを流用・拡張し、サーバ側も同じモジュールを使うこと**
- v0.4 に合わせた検証の更新点（モック V1 からの差分）：
  - デバイスの IP は所属（memberships）側の項目。IP 必須チェックはデバイスではなく所属に移す。所属 IP が空（NULL 可）の場合も許容する
  - CIDR の範囲チェックは所属ごとに行う（デバイス単体ではない）
  - サービスの参照先は `deviceId` ではなく `deviceNetworkId`。URL は組み立て規則（3.3）で検証する
  - `subdomain` の一意性、`port` 1–65535、`scheme` http/https、`color` は自由文字列（色名の列挙に縛らない）、`tag` は自由文字列
  - サービスの `status` は入力項目ではない（Gatus から読む）。GUI の編集フォームから status 入力を外す
- エラー形式は既存の ValidationIssue（`{ path, message }` の配列）に合わせる。API のバリデーション失敗は 400 で `{ issues: [...] }` を返す

### 3.6 フレームワーク

- フレームワークは **Hono で確定（2026-11-21、もぐの決定）**。TypeScript の軽量フレームワークで、SBC 上での軽さと SPA 静的配信との相性が理由
- Node は Arm でも動くこと。依存は最小限に
- SQLite ドライバはネイティブ依存のない形を優先すること（Node 組み込みの `node:sqlite` が使えれば、arm64 / amd64 マルチアーキの Docker イメージが素直になる）。製品版の配布形態は Docker イメージ（API＋ビルド済み SPA を1イメージ、台帳はボリューム）

## 4. GUI のモック脱出（やること）

- `usePortalData.ts` の localStorage 永続化をやめ、データの正を API にする。初期表示は `GET /api/portal` から読む。編集操作（追加・変更・削除）は API を呼んで成功したら再読込／反映する
- localStorage は移行期のキャッシュにも使わない（「API が落ちたら古い表示」より「API が落ちたと分かる表示」が正しい）
- 表示まわりは現行モックのまま：Explorer 風の矩形サービス・タイル、関係の接続線（最前面描画、無関係デバイスは通常表示のまま、起動直後は無選択がデフォルト）、同一デバイスの再表示、凡例、メモリ／ディスクのメーター表示（CPU なし）
- **カテゴリー見出しは、そのカテゴリーのデバイスが0件ならポータル表示では出さない**（2026-11-21 決定）。管理画面では追加の導線として残すこと。ネットワーク自体が0件のときだけ「デバイス未登録」のプレースホルダを出す
- 関係ハイライトの向きラベルは 3.2 の `fromLabel / toLabel`（空なら tag）を使う

## 5. デプロイと境界（Codex が触らないもの）

- デプロイ先は **ouchi-test（192.168.0.30）**。メインアプリは Docker コンテナに閉じ込める。Avahi はホスト側に外だし（変更なし）
- DB ファイルの置き場所と、SQLite の WAL 設定はバックエンド側で決めて報告に書くこと
- v0.1（現行の縦切り）→ v0.4 への移行は、DB_SCHEMA_DRAFT.md の移行対応表（v0.3→v0.4、v0.2→v0.3、v0.1→v0.2）に沿う。移行スクリプトを作る場合は、元 DB を壊さない形（新 DB を作って検証してから差し替え）にすること
- 追加ブリーフ18のデバイス petname は `devices.petname TEXT` に保存する。
  既存 DB には `migrations/001_add_device_petname.sql` の
  `ALTER TABLE devices ADD COLUMN petname TEXT` を適用する。API は入力を
  trim し、空文字を NULL として扱う。
- **生成スクリプト（`app/generate.py`、nginx / Gatus config 生成）は触らない**。v0.4 では services → device_networks の JOIN が要る改修があり、カイル側でやる。Codex 側は、生成が読む DB の形が v0.4 になったことだけ知っていればよい
- リダイレクタ（302）の挙動は v0.4 移行後も維持する。移行の検収で 302 を再確認する（カイル側で実施）

## 6. 検収（カイル側で確認すること）

- `npm run build`（または同等のビルド）と既存テストが通ること。関係・サービス項目まわりのテストがあれば追加する
- シード（v0.4 の実ラボ 16 デバイス・9 サービス（うち外部SaaS 2件））で API が起動し、`GET /api/portal` が PortalDataV2 形で返ること
- CRUD が一通り curl で叩けること（作成→読取→更新→削除、削除不可ルールの確認を含む）
- `GET /api/devices/4/relations`（omv）で acemagic（ホストOS・黄）と nanopi-r2s（バックアップ先・青）が返ること。逆向き（acemagic から omv）も返ること
- 全サービスの `url` / `monitorUrl` が verify.py の組み立て結果と一致すること（gitea は監視パス `/api/v1/version`、proxmox は https）
- GUI が API 経由で表示され、編集が DB に反映されること（localStorage を消しても表示が復元されること）
- ログインなしで LAN 内から開けること。WAN 公開の経路は作らないこと

## 7. 追加仕様：設定のテキストエクスポート／インポート（2026-11-21 追加、ユーザー要望）

バージョンアップ時のデータ移行に備え、台帳一式をテキストで出し入れできるようにする。移行の正道は「旧版でエクスポート → 新版でインポート」で、スキーマのインプレース移行に依存しない。

- 形式は **YAML**（人が読めて Git で差分が見える）。先頭に形式の版を持つ（例：`format: ouchi-ledger/1`、書き出し日時）
- `GET /api/export`：台帳一式を YAML で返す。含むもの：settings、networks、devices（所属 device_networks を含む）、relations、services、ssh_keys / device_keys（公開鍵のみ。秘密情報は DB に無いので輸出は安全）
- `devices[]` には任意の `petname` を含め、インポート／再エクスポートでも保持する
- **参照は内部 ID ではなく自然キーで書く**：networks は name、devices は hostname、services は subdomain、所属は「device の hostname ＋ network の name」、relations は from/to の hostname。インポート先で ID が振り直されても壊れないこと
- `POST /api/import`：YAML を受け取り、既存のバリデーションを全件通したら、トランザクションで**全置き換え**する。1件でも不正なら何も変えず、`{ issues: [...] }` を返す。マージはしない
- `relations[]` は従来どおり `from / to / tag / fromLabel / toLabel / color` を持ち、トップレベルの `tags` は持たない。同一タグで `color` が食い違う YAML は検証エラーとして拒否する
- GUI：管理画面にエクスポート（ダウンロード）とインポート（ファイル選択 → 内容確認 → 適用）を置く。適用前に「現在の設定は全て置き換わる」旨を明示すること
- 検収：ラウンドトリップ（export → 空 DB へ import → 再 export で、書き出し日時などのメタを除き内容が一致）、不正な YAML／検証エラー時に DB が無変更、ID が振り直されても所属と関係が名前で正しく再構成されること

## 8. v1 の外（やらないこと）

- MCP（設定読み書き・構成問い合わせ）、生成の本格化、SSO／ログイン、ネットワーク構成タブ（保留中）、Next.js 化、GraphQL / WebSocket
- キーペア管理サービス（May、優先度未決）は v1 の外。ただしメーター収集で専用鍵が必要になったら、その時点で相談する（DB に秘密鍵を入れない、という線引きだけ守る）

## 9. Codex へのお願い（報告してほしいこと）

- 採用フレームワーク Hono の構成メモ（依存と起動方法）
- 状態プロバイダの差し込み口の形（Gatus 接続は v1 では任意。接続した場合は突き合わせ方法も）
- メーター収集の実装方針（内蔵か別プロセスか、鍵の受け渡しの想定、未実装ならその旨）
- ネットワーク削除の扱い（デバイス削除と同じく「紐づく所属・サービスが残っていたら削除不可」でよいか。スキーマ草案ではデバイス側しか決まっていないので、確認したい）
- 作業は長時間になりそうなら、前回と同じく裏で起動してログを読む形で進めること。終わったら `/root/261119 ouchi.local GUI` の更新内容と、動作確認の結果を報告すること
- 質問や違和感があれば、もぐの経由でカイルまで
