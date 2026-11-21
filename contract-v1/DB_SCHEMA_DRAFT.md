# DBスキーマ案（ドラフト v0.4 / 2026-11-21）

REQUIREMENTS.md の Must 4（サーバとサービスをDBに登録し、各アプリへ反映）を具体化した叩き台。v1 リリース範囲（GUI表示＋GUI設定＋RDB、2026-11-21 確定）の契約になるスキーマ。

> **2026-11-21 改定（v0.3）**：関係性を汎用モデル化した。`devices.parent_device_id` を廃止し、`relations` テーブル（関係先＋タグ＋程度＝色）を新設する（2026-11-20 ユーザー決定「固定の考え方をしない。関係先とタグ。程度にして」）。あわせて Codex モック実装（PortalDataV2）の形を吸収した：IP はデバイスではなく所属（device_networks）ごとに持ち、サービスは所属レコードを参照する。デバイスには category（network / physical / vm）が入り、関係ラベルは from / to の双方向（Codex 実装）も任意で持てる。
>
> **2026-11-21 改定（v0.4）**：外部 SaaS の扱いを決めた。インターネットを特別視せず、`devices.category` に 'service' を追加して汎用化する（2026-11-21 ユーザー決定）。category='service' は外部サービスを表す疑似デバイスで、ネットワーク（通常はインターネット）に IP なし（所属の ip は NULL）で所属し、SSH・メーターはオフ、配下サービスの `service_url` に完全な URL を持つ。関係もオンプレのデバイスと同様に張れる。
>
> **注意**：本書は草案の改定であって実装ではない。`app/schema.sql` はまだ v0.1、過去のドラフトは `app/v0.2/` と `app/v0.3/` にある。v0.4 の SQL は `app/v0.4/`（schema.sql / seed.sql / verify.py、検証 ALL OK）。ouchi-test へのデプロイは次のステップ。

## 設計の前提（要件から）

- 階層：ネットワーク → デバイス（物理/VM統合、`is_vm` フラグ）→ サービス（Codex モック採用、2026-11-20）
- サービス：リダイレクタのパス名、ポート番号、tcp/udp、サービスURL（Gatus監視対象＋ポータルのジャンプ先）
- リダイレクタ：`ouchi.local/<サービス名>` → 302 → サービスの実URL（リバースプロキシは廃止、2026-11-19）。転送先はDBの所属IP＋ポートから引く
- 監視：Gatusバックエンド。DBから `config.yaml` を生成、状態は Gatus API から読む（状態そのものはDBに持たない）
- ポータル：メインアプリの機能。アイコンはモック通りプリセット選択式
- リソースメーター（2026-11-20、ユーザー決定）：デバイス表示にメモリ使用率と `/` のあるディスクの使用率を小さなグラフで載せる。**CPU は載せない**。取得は **SSH＋Linuxコマンド**（メモリは `free`＝/proc/meminfo の MemTotal/MemAvailable、ディスクは `df -P /` の Use%）。SSH で入れない機器（スイッチ・AP・FortiGate等）はメーター対象外。収集用は専用キーペアを1つ作り、秘密鍵は SOPS 経由で供給し DB には入れない（キーペア管理サービスの最初の実利用）
- 関係性（2026-11-20／21、ユーザー決定）：**固定の関係種別は持たない**。関係は「関係先＋タグ＋程度（色）」の汎用モデルで `relations` に持つ。1デバイスに複数の関係を定義でき、同じ相手に複数タグも可。ハイライトは双方向に効く（向きはラベル側に保持）。所属（ネットワーク階層とまたがり表示＝同一デバイスの再表示）は `device_networks` の多対多で持ち、関係とは別概念として分ける

## テーブル案

### networks（ネットワーク）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| name | TEXT UNIQUE NOT NULL | 例：`おうちLAN`。モックのネットワーク名に相当 |
| cidr | TEXT | 例：`192.168.0.0/24`。インターネットのように CIDR を持たないものは空 |
| accent | TEXT | モックのアクセント色（`blue` / `orange` / `violet` 等）。表示用 |
| note | TEXT | 任意 |

### devices（デバイス：物理サーバとVMの統合）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| hostname | TEXT UNIQUE NOT NULL | 例：`nanopi-r2s`。モックのデバイス名に相当 |
| category | TEXT NOT NULL DEFAULT 'physical' CHECK (category IN ('network','physical','vm','service')) | Codex モック実装から吸収（2026-11-20）。ネットワーク配下の分類（ネットワーク機器／物理マシン／VM／サービス）の見出しに使う。'service' は外部SaaSの疑似デバイス（2026-11-21 追加） |
| is_vm | INTEGER NOT NULL DEFAULT 0 CHECK (is_vm IN (0,1)) | VM なら 1。`CHECK (is_vm = (category = 'vm'))` で category と常に一致させる |
| ssh_user | TEXT | メーター収集用のSSHユーザー（空なら既定値）。SSHで入れない機器は空のまま |
| ssh_port | INTEGER CHECK (ssh_port BETWEEN 1 AND 65535) | メーター収集用のSSHポート。空なら22 |
| meter_enabled | INTEGER NOT NULL DEFAULT 1 | 0でメーター収集の対象外（スイッチ・AP・FortiGate等のネットワーク機器は0） |
| note | TEXT | 任意。機種・設置場所などのメモ |

v0.2 から廃止した列：`ip_address`（IP は所属ごとに持つ。下の device_networks へ）、`parent_device_id`（関係は relations へ一本化）。

IP はデバイス本体に持たない。SSH 収集先の IP は、そのデバイスの所属（device_networks）のうち到達可能なものを実装側が選ぶ。

### device_networks（デバイス⇔ネットワーク：またがり用・多対多）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | 所属レコードの ID。サービスが参照する（Codex 実装の deviceNetworkId） |
| device_id | INTEGER NOT NULL REFERENCES devices(id) | |
| network_id | INTEGER NOT NULL REFERENCES networks(id) | |
| ip | TEXT | このネットワークでの IP。未登録なら空（例：FortiGate のインターネット側） |
| label | TEXT | 任意。所属の表示名（例：`WAN` / `管理`） |
| UNIQUE (device_id, network_id) | | 同じ紐付けの二重登録を防ぐ |

通常のデバイスは1行だけ。ネットワークをまたがるデバイス（例：FortiGate がインターネットとおうちLANの両方に表示される）は2行持つ。「同一デバイス」の再表示はこのテーブルの複数行が根拠になる。

### relations（デバイス間の関係：汎用モデル）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| from_device_id | INTEGER NOT NULL REFERENCES devices(id) | 関係の起点 |
| to_device_id | INTEGER NOT NULL REFERENCES devices(id) | 関係先。`CHECK (from_device_id <> to_device_id)` |
| tag | TEXT | 関係のタグ（自由文字列）。例：`ホストOS`。ラベルの既定値になる |
| from_label | TEXT | 任意。from 側から見た表示ラベル（Codex 実装の双方向ラベル）。空なら tag で代用 |
| to_label | TEXT | 任意。to 側から見た表示ラベル。空なら tag で代用 |
| color | TEXT NOT NULL | 程度＝表示色。例：`yellow`。ユーザーが自由に決める |

表示ラベルの解決規則：注目デバイスが from 側なら `from_label ?? tag`、to 側なら `to_label ?? tag`。関係の同一性は (from, to, tag) で見る。同じペアに複数タグを持てる（行を分ける）。

### services（サービス）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| device_network_id | INTEGER NOT NULL REFERENCES device_networks(id) | v0.2 の device_id から変更。サービスは「どの所属（＝どのネットワークでの顔）」に載るかで決まる。デバイス削除時は要検討（CASCADEにしない。先にサービスの移動か削除が必要） |
| subdomain | TEXT UNIQUE NOT NULL | 例：`gitea`。リダイレクタのパス `ouchi.local/<この値>` になる（2026-11-19、リダイレクタ本命化に伴い改定） |
| petname | TEXT | ペットネーム（任意文字列）。一覧の1行目メイン表示。未設定ならサブドメインで代用（2026-11-18 ユーザー指定で追加） |
| description | TEXT | 一覧画面に表示するサービスの説明文（2026-11-18 ユーザー指定で追加）。登録画面でも入力する |
| port | INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535) | 転送先ポート |
| scheme | TEXT NOT NULL DEFAULT 'http' CHECK (scheme IN ('http','https')) | サービスが話すのが HTTP か HTTPS か（2026-11-19 ユーザー指定）。リダイレクト先URLと Gatus 監視URLの両方をこの値で組み立てる |
| protocol | TEXT NOT NULL CHECK (protocol IN ('tcp','udp')) | DBの tcp/udp 項目 |
| service_url | TEXT | 上書き用の完全URL（任意）。通常は空でよく、実URLは scheme＋所属IP＋port＋パスから組み立てる。リダイレクト先と監視URLはその実URLを使う |
| top_path | TEXT | トップページのパス（例：`/ui/`）。空なら `/`。リダイレクト先とポータルのリンクに使う（2026-11-19 ユーザー指定） |
| monitor_path | TEXT | 監視用パス（例：`/api/health`）。空なら top_path で代用。Gatus のチェックURLに使う（2026-11-19 ユーザー指定） |
| icon_key | TEXT | モックのプリセットアイコン（`gitea` / `gatus` / `proxmox` / `omv` / `server` 等）。採用したモックの方式 |
| favicon_url | TEXT | 登録時に自動取得した結果。取得失敗時は空欄のまま。モック採用によりアイコンはプリセット選択が本線のため、自動取得の扱いは未決 — 列は残置 |
| enabled | INTEGER NOT NULL DEFAULT 1 | 0で監視・リダイレクト生成から外す（メンテナンス時の簡易停止用） |

サービスの稼働状態（up/down/maintenance）はDBに持たない。Gatus API から読んでポータルに表示する（モックのランダム更新は本実装では使わない）。

### settings（全体設定・1行だけ）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY CHECK (id = 1) | 常に1行だけ |
| domain | TEXT NOT NULL DEFAULT 'ouchi.local' | ポータル名の基になるドメイン |
| title | TEXT NOT NULL DEFAULT 'あなたのホームラボ' | ポータルのタイトル。管理画面から変更可能（2026-11-21 ユーザー決定で追加） |

v0.1 の `proxy_ip` は廃止済み（リバースプロキシ廃止に伴い不要）。

## 生成物の対応表（DB → 各アプリ）

| 生成物 | 元になる列 |
|---|---|
| Avahi広告 | ポータルの `ouchi.local` のみ（ホスト側 avahi の host-name 設定で広告。DBからの生成対象ではない） |
| リダイレクタの転送先 | `services.service_url` があればそれ。なければ `scheme://所属IP:port` ＋ `top_path`（空なら `/`）を組み立てる。所属IP は services → device_networks の `ip` |
| Gatus `config.yaml` のエンドポイント | `scheme://所属IP:port` ＋ `monitor_path`（空なら `top_path` で代用）。https の場合は証明書検証が論点：オレオレ証明書は検証スキップ設定、ouchi CA（May）発行の証明書なら CA を信頼して正規検証。`protocol='udp'` は Gatusの汎用チェック対象外なので、監視対象外かDNS型のみと割り切る |
| ポータルの一覧・リンク | `networks`＋`devices`＋`device_networks`＋`services`。リンク先は実URL、アイコンは `icon_key`、状態は Gatus API から |
| リソースメーター | `devices` のうち `meter_enabled=1` のもの。SSH（`ssh_user`/`ssh_port`、収集専用キーペア）で `free` と `df -P /` を取り、メモリとディスクの使用率を出す。CPU は対象外 |
| 関連ハイライト | `relations`（色とラベル）と `device_networks`（またがり・同一デバイス）。選択時にだけ使う表示用データで、常時の描画対象ではない |
| MCP 構成問い合わせ | `relations` を辿るトラバース（注目デバイス→関係先がタグ・色・向きつきで列挙。深さ指定で多ホップ）。コンセプト「AI用のネットワーク地図」（2026-11-21 決定稿） |

## シード例（現行ラボの実績＋モックのデータから）

正は `app/v0.4/seed.sql`。概要だけ抜粋する。

### networks

| name | cidr | accent |
|---|---|---|
| インターネット | （空） | violet |
| おうちLAN | 192.168.0.0/24 | blue |
| OCIネットワーク | 192.168.253.0/24 | orange |

### devices（所属と IP は device_networks 側）

| hostname | category | 所属（IP） | meter_enabled |
|---|---|---|---|
| nanopi-r2s | physical | おうちLAN（192.168.0.19） | 1 |
| acemagic | physical | おうちLAN（192.168.0.11） | 1 |
| beelink | physical | おうちLAN（192.168.0.12） | 1 |
| omv | vm | おうちLAN（192.168.0.21） | 1 |
| omv2 | vm | おうちLAN（192.168.0.222） | 1 |
| sandbox | vm | おうちLAN（192.168.0.32） | 1 |
| ouchi-test | vm | おうちLAN（192.168.0.30） | 1 |
| oci-kuro | vm | OCIネットワーク（192.168.253.1） | 1 |
| oci-shiro | vm | OCIネットワーク（192.168.253.3） | 1 |
| fortigate | network | インターネット（IP未登録）＋おうちLAN（192.168.0.1） | 0（SSHで入れない機器のため） |
| wac505 / wac540 | network | おうちLAN（.2 / .6） | 0 |
| gs116ev2 / gs308ep | network | おうちLAN（.8 / .9） | 0 |

### relations

| from | to | tag | color |
|---|---|---|---|
| omv | acemagic | ホストOS | yellow |
| omv2 | acemagic | ホストOS | yellow |
| sandbox | beelink | ホストOS | yellow |
| ouchi-test | beelink | ホストOS | yellow |
| omv | nanopi-r2s | バックアップ先 | blue（設計議論時のサンプル） |

### services

| サービス | 所属 | ポート | URL（組み立て結果） |
|---|---|---|---|
| gitea | nanopi-r2s＠おうちLAN | 3000 | http://192.168.0.19:3000 |
| gatus | nanopi-r2s＠おうちLAN | 8080 | http://192.168.0.19:8080 |
| homepage | nanopi-r2s＠おうちLAN | 80 | http://192.168.0.19:80 |
| proxmox | acemagic＠おうちLAN | 8006 | https://192.168.0.11:8006 |
| omv | omv＠おうちLAN | 80 | http://192.168.0.21 |
| fortigate | fortigate＠おうちLAN | 443 | https://192.168.0.1 |
| gatus（OCI監視） | oci-kuro＠OCIネットワーク | 8080 | http://192.168.253.1:8080 |

## 決めてほしいこと（2点）→ 推奨案を仮置き（2026-11-18、異論があれば差し替え）

1. `service_url` が空のとき → **scheme＋所属IP＋port から組み立てたURL**を使う。手入力があればそちらを優先（2026-11-19 改定、v0.3 でデバイスIP→所属IPに読み替え）
2. デバイスを削除したとき → 紐づくサービスが残っていたら**削除不可**（連鎖削除はしない。先にサービスの移動か削除が必要）。v0.1 の「サーバ削除時」と同じ方針をデバイスに付け替え

（v0.1 の旧2番「proxy_ip」はリバースプロキシ廃止により解決済みのため削除）

## 決定事項

- エンジン：**SQLite**。書き込み競合はWALモード＋busy_timeoutで吸収する前提（2026-11-18）
- バックアップ：DBファイルのコピーで完結。稼働中の一貫性のため、吸い出しは `sqlite3 .backup` を使う（2026-11-18）
- 階層とデザイン：Codex モック採用（ネットワーク → デバイス → サービス、2026-11-20）
- メーター：メモリとディスクのみ、CPUなし、SSH＋Linuxコマンドで取得（2026-11-20）
- 関係性：固定種別を持たない汎用モデル（関係先＋タグ＋程度＝色、relations テーブル）。関連ハイライトは選択時に浮かせる（2026-11-20／21）
- IP：デバイス本体ではなく所属（device_networks）ごとに持つ。サービスは所属を参照する（Codex 実装 PortalDataV2 の吸収、2026-11-21）
- v1 リリース範囲：GUI表示＋GUI設定＋RDB、認証なし（2026-11-21 確定）。本スキーマがその契約

## v0.3 → v0.4 移行対応表（実装時のメモ）

| v0.3 | v0.4 | 扱い |
|---|---|---|
| devices.category の CHECK（network / physical / vm） | 'service' を追加 | 既存行は無変更。外部 SaaS は category='service' の疑似デバイスとして登録し、所属 ip は NULL、配下サービスの service_url に完全な URL を持たせる |

## v0.2 → v0.3 移行対応表（実装時のメモ）

| v0.2 | v0.3 | 扱い |
|---|---|---|
| devices.ip_address | device_networks.ip | 所属ごとに移す。単一所属のデバイスはそのまま1行へ |
| devices.parent_device_id | relations | 「ホストOS」タグ＋色 yellow の行として移す |
| devices.is_vm | devices.category ＋ is_vm | category を 'vm' / 'physical' / 'network' で埋め、is_vm は連動 CHECK で一致を保証 |
| device_networks（device_id, network_id） | device_networks（id, …, ip, label） | id と ip / label を追加 |
| services.device_id | services.device_network_id | そのデバイスの所属（通常は LAN 所属）の id に付け替え |
| （新規） | relations | 追加 |

## v0.1 → v0.2 移行対応表（実装時のメモ）

| v0.1 | v0.2 | 扱い |
|---|---|---|
| physical_servers | networks＋devices | 分割。hostname/ip_address/note は devices へ。networks はモックの3ネットワークを新規作成 |
| services.server_id | services.device_id | 付け替え（値は physical_servers.id → devices.id の対応表で引き継ぐ） |
| services.pos_x / pos_y | — | 廃止 |
| services.advertise_mdns | — | 廃止済み |
| categories | — | 廃止（自由配置キャンバスとともに） |
| settings.proxy_ip | — | 廃止済み |
| server_keys.server_id | device_keys.device_id | 下のキーペア管理の表も参照 |
| （新規） | networks、device_networks、devices.parent_device_id、devices.ssh_user/ssh_port/meter_enabled、services.icon_key | 追加 |

移行の際は `app/schema.sql`・`app/seed.sql`・`app/generate.py`・`app/verify.sh` をまとめて合わせ、ouchi-test でリダイレクタの 302 と Gatus config 生成を再確認する。v0.1 の垂直スライスは移行まで現行のまま動かしておく。

## 提案：キーペア管理サービス（未決定・2026-11-19提案）

ユーザー要望（2026-11-19 02:18 JST「キーペア管理サービス欲しい」）の具体化案。優先度は未回答（May相当で記録中）。REQUIREMENTS.md の設計メモ（秘密鍵は手元に置き、公開鍵の台帳＋authorized_keys生成がouchiの「DBが正」と相性がいい）をそのままテーブル化したもの。

**2026-11-20 追記**：メーター収集用の専用キーペアがこのサービスの最初の実利用になる（REQUIREMENTS.md 参照）。収集用キーペアは `ssh_keys` に purpose（例：`meter-collection`）つきで登録し、秘密鍵は SOPS 経由で供給する。デバイスごとの鍵は作らず1つのキーペアを使い回すため、配布先は device_keys でデバイス単位に紐付ける。

### ssh_keys（公開鍵の台帳）

| 列 | 型・制約 | 備考 |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| owner | TEXT NOT NULL | 誰の鍵か。例：`moguno` / `kyle` / `codex`（人間＋AI2人の3者共有が前提） |
| purpose | TEXT NOT NULL | 何用か。例：`ssh-login` / `age-sops` / `tls-client` / `meter-collection`（収集専用） |
| key_type | TEXT NOT NULL | 例：`ssh-ed25519` / `age` / `ecdsa`。age鍵はSOPSの受信者台帳と兼用できる |
| public_key | TEXT UNIQUE NOT NULL | 公開鍵そのもの。秘密鍵はこのDBに絶対に入れない（SOPSの役目） |
| fingerprint | TEXT | `ssh-keygen -lf` の指紋。登録時の目視確認用 |
| expires_at | TEXT | 期限（任意）。空なら無期限。期限切れは生成時に警告 |
| enabled | INTEGER NOT NULL DEFAULT 1 | 0で配布対象から外す（失効・一時停止用。行は残す） |
| note | TEXT | 任意。例：登録した日・発行した端末 |

### device_keys（どの鍵をどのデバイスへ配るか）

v0.1 の server_keys をデバイス付け替えしたもの。

| 列 | 型・制約 | 備考 |
|---|---|---|
| device_id | INTEGER NOT NULL REFERENCES devices(id) | 配布先デバイス |
| key_id | INTEGER NOT NULL REFERENCES ssh_keys(id) | 配る鍵 |
| PRIMARY KEY (device_id, key_id) | | 同じ鍵を同じデバイスへ二重登録しない |

### 生成物（DB → 各デバイス）

| 生成物 | 元になる列 |
|---|---|
| 各デバイスの `~/.ssh/authorized_keys`（ユーザーごと） | `device_keys` で紐づいた `ssh_keys.public_key`（`enabled=1` かつ未期限のものだけ）。Gatus `config.yaml` の生成と同じパターン |
| 失効・停止した鍵の除去 | `enabled=0` にすれば次回生成で authorized_keys から消える（行を消さずに無効化できる） |

### 決めてほしいこと（2点）

1. **優先度**：May のまま（後回し）か、Must に上げるか。Must化するなら、配布の実行方法（各デバイスへの書き込みは SSH 経由の生成スクリプトか、Ansible か）も決める
2. **発展形（SSH CA）**：短命証明書の発行に進むか。進むなら step-ca（SSH証明書も発行可）か、.19 で稼働中の HashiCorp Vault の SSH シークレットエンジンか。CA化すれば authorized_keys の配布自体が不要になるが、CA鍵の保管（SOPS）と失効運用が別途要る
