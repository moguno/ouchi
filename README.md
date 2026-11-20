# ouchi.local Portal

ネットワーク、デバイス、サービスを階層表示する、埋め込み可能なReactポータルです。
参考画面のアイコン表示を基調に、アイコン／リスト切替、入力検証、localStorage保存、
10秒ごとの状態更新モックを備えています。

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
```

- `demo-dist/`: 確認用デモの本番ビルド
- `dist/`: Reactライブラリと型定義

## 埋め込み

```tsx
import { OuchiPortal, type PortalDataV1 } from "ouchi-local-portal";
import "ouchi-local-portal/styles.css";

export function Dashboard({ data }: { data: PortalDataV1 }) {
  return (
    <OuchiPortal
      data={data}
      storageKey="example.portal.v5"
      onDataChange={(next) => console.log(next)}
    />
  );
}
```

`data` を省略すると、`src/data/portal-data.json` のサンプルを利用します。
localStorageに有効な保存データがある場合は、そちらを優先します。

## データモデル

```json
{
  "version": 1,
  "networks": [
    {
      "id": "internet",
      "name": "インターネット",
      "accent": "violet"
    }
  ],
  "devices": [
    {
      "id": "device-1",
      "networkId": "internet",
      "name": "example",
      "ip": "203.0.113.10",
      "isVm": false
    },
    {
      "id": "vm-1",
      "networkId": "internet",
      "name": "application",
      "ip": "203.0.113.20",
      "isVm": true
    }
  ],
  "services": [
    {
      "id": "service-1",
      "deviceId": "vm-1",
      "name": "status",
      "subtitle": "監視",
      "url": "https://example.com/",
      "iconKey": "monitor",
      "status": "up"
    }
  ]
}
```

`devices` は物理デバイスとVMをまとめて表します。`isVm: true` のデバイスをVMとして表示し、
すべてのデバイスが `networkId` を直接持ちます。
サービスは `services.deviceId` で対象デバイスを参照します。

`cidr` は任意です。CIDRがあるネットワークでは、登録するデバイスのIPv4アドレスが
範囲内にあることを検証します。「インターネット」のようなCIDRなしネットワークでは
所属範囲のチェックを省略します。
