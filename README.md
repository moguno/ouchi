# ouchi.local Portal

ネットワーク、デバイス、所属IP、サービス、方向別ラベル付き関係を表示する、
埋め込み可能なReactポータルです。

2026-11-20の設計更新と `portal-screen-v7.png` に合わせて、データモデルを
`PortalDataV2` へ更新しました。ネットワーク所属IPとサービス配置を分離しつつ、
同一デバイスの複数ネットワーク表示、メモリ／ディスクメーター、
Explorer風サービスタイルを備えています。

## 現在のテストデータ

2026-11-20時点のGatus監視登録と、RAGの
`サーバー保守/IPアドレス命名ルール.md`（commit `4be1dd9`）を基にしています。

- `インターネット`: Gatus／RAGからWANアドレスを取得できないため、所属ノードなし
- `おうちLAN` `192.168.0.0/24`: 9デバイス、9所属IP
- `OCIネットワーク` `192.168.253.0/24`: 2デバイス、2所属IP

おうちLANの登録デバイスは次のとおりです。

| IP | デバイス | 種別 |
| --- | --- | --- |
| `192.168.0.1` | FortiGate 50E | ネットワーク機器 |
| `192.168.0.2` | WAC505 | 無線AP |
| `192.168.0.6` | WAC540 | 無線AP |
| `192.168.0.8` | GS116Ev2 | L2スイッチ |
| `192.168.0.9` | GS308EP | PoEスイッチ |
| `192.168.0.11` | ACEMAGIC | Proxmoxホスト |
| `192.168.0.12` | Beelink | 物理サーバー |
| `192.168.0.19` | NanoPi R2S | Gitea／Gatus |
| `192.168.0.21` | openmediavault | NAS |

OCIネットワークには`OCI-Kuro`（`192.168.253.1`）と
`OCI-Shiro`（`192.168.253.3`）を登録しています。

サービスタイルには、FortiGate、WAC505、WAC540、GS116Ev2、GS308EPの管理画面、
Proxmox、Gitea、Gatus、openmediavault、OCI上のGatusを登録しています。
状態は取得時点のGatus成功状態に合わせています。

## 起動

```bash
npm install
npm run dev
```

## ビルドとテスト

```bash
npm run typecheck
npm test
npm run build
npm run screenshots
```

- `dist/`: Reactライブラリと型定義
- `demo-dist/`: 確認用デモの本番ビルド
- `成果物/`: デモ、npmパッケージ、確認用スクリーンショット

## 埋め込み

```tsx
import { OuchiPortal, type PortalDataV2 } from "ouchi-local-portal";
import "ouchi-local-portal/styles.css";

export function Dashboard({ data }: { data: PortalDataV2 }) {
  return (
    <OuchiPortal
      data={data}
      storageKey="example.portal.v11"
      onDataChange={(next) => console.log(next)}
    />
  );
}
```

`data` を省略すると `src/data/portal-data.json` のサンプルを利用します。
localStorageの保存形式も `PortalDataV2` です。

## データモデル

```json
{
  "version": 2,
  "networks": [
    {
      "id": "home-lan",
      "name": "おうちLAN",
      "cidr": "192.168.0.0/24",
      "accent": "blue"
    }
  ],
  "devices": [
    {
      "id": "fortigate",
      "name": "fortigate",
      "category": "network",
      "isVm": false
    },
    {
      "id": "nanopi",
      "name": "nanopi-r2s",
      "category": "physical",
      "isVm": false,
      "ssh": {
        "user": "portal-monitor",
        "port": 22
      },
      "resources": {
        "memoryPercent": 38,
        "diskPercent": 57
      }
    }
  ],
  "deviceNetworks": [
    {
      "id": "fortigate-lan",
      "deviceId": "fortigate",
      "networkId": "home-lan",
      "ip": "192.168.0.1",
      "label": "LAN"
    },
    {
      "id": "nanopi-home",
      "deviceId": "nanopi",
      "networkId": "home-lan",
      "ip": "192.168.0.19"
    }
  ],
  "relations": [
    {
      "id": "omv-host-of-acemagic",
      "fromDeviceId": "omv-vm",
      "toDeviceId": "acemagic",
      "fromLabel": "VM",
      "toLabel": "親ホスト",
      "color": "#d5a22b"
    }
  ],
  "services": [
    {
      "id": "gitea",
      "deviceNetworkId": "nanopi-home",
      "name": "gitea",
      "subtitle": "おうちGit",
      "scheme": "http",
      "port": 3000,
      "topPath": "/",
      "monitorPath": "/explore/repos",
      "iconKey": "gitea",
      "status": "up"
    }
  ]
}
```

### デバイスカテゴリー

`devices[].category` は `network`、`physical`、`vm` のいずれかです。
ポータルではネットワーク配下を「ネットワーク機器」「物理マシン」「VM」の
3階層に分けて表示します。既存の `isVm` は互換性のため保持し、
`category: "vm"` と一致させます。

### ネットワーク所属

`devices[].networkId` は廃止しました。デバイスとネットワークの多対多所属は
`deviceNetworks` で表し、所属レコードがネットワークとアクセス用IPv4アドレスを
持ちます。

同じ `deviceId` が複数の `deviceNetworks` を持つと、各ネットワーク配下へ
同じデバイスが表示されます。デバイスIDによる選択ハイライトは全表示へ
同期し、同一デバイス同士は青い接続線で結びます。サービスは
`deviceNetworkId` が一致する表示にだけ出ます。

### 汎用関係

固定の親子種別はありません。関係は `relations` の次の5項目で表現します。

- `fromDeviceId`: 関係元デバイス
- `toDeviceId`: 関係先デバイス
- `fromLabel`: 関係元側の自由入力ラベル
- `toLabel`: 関係先側の自由入力ラベル
- `color`: `#RRGGBB` の関係色

関係ハイライトは双方向です。デバイスを選択すると、関係先の全ネットワーク表示を
関係色で強調します。`from`側を選択した場合は`toLabel`、`to`側を選択した場合は
`fromLabel`を相手側に表示し、関係デバイス同士をSVGの関係色付き曲線で結びます。
無関係のデバイスは通常表示を維持します。
同一デバイス判定と関係判定は別概念です。

### サービスURL

サービスはデバイス本体ではなく、アクセス先の所属IPへ配置します。
`serviceUrl` が空の場合、次の値から表示URLとGatus監視URLを生成します。

- サービスURL: `scheme://IP[:port]/topPath`
- 監視URL: `scheme://IP[:port]/monitorPath`

80番HTTPと443番HTTPSではポートを省略します。`serviceUrl` を指定した場合は
リダイレクト先URLとして優先します。

### リソースメーター

`resources.memoryPercent` と `resources.diskPercent` をメモリ／ディスクメーターとして
表示します。CPUは表示しません。SSH計測のユーザーとポートは `ssh` に保持し、
秘密鍵はフロントエンドデータへ含めません。SSH対象外の機器では
`ssh` と `resources` を省略します。

## v1からの変更

- データ形式を `version: 1` から `version: 2` へ変更
- `PortalDataV1` から `PortalDataV2` へ変更
- `devices[].networkId`、`devices[].ip` を廃止
- `deviceNetworks`、`relations` を追加
- `services[].deviceId`、`services[].url` を廃止
- `services[].deviceNetworkId`、`scheme`、`port`、`topPath`、`monitorPath`、
  `serviceUrl` を追加
