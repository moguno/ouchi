import { useMemo, useState } from "react";
import "./styles/memo-view.css";
import {
  DEVICE_CATEGORY_LABELS,
  type PortalDataV2,
  type PortalProperties,
} from "./types";
import { sortNetworksForDisplay } from "./networkOrder";

export type MemoTargetKind =
  | "project"
  | "network"
  | "device"
  | "interface"
  | "service"
  | "relation";

interface MemoEntry {
  kind: MemoTargetKind;
  id: string;
  title: string;
  sub: string;
  meta: string;
  properties: PortalProperties;
}

const GROUPS: { kind: MemoTargetKind; label: string }[] = [
  { kind: "project", label: "ouchi" },
  { kind: "network", label: "ネットワーク" },
  { kind: "device", label: "デバイス" },
  { kind: "interface", label: "インターフェース" },
  { kind: "service", label: "サービス" },
  { kind: "relation", label: "関係" },
];

const GROUP_LABELS: Record<MemoTargetKind, string> = {
  project: "ouchi",
  network: "ネットワーク",
  device: "デバイス",
  interface: "インターフェース",
  service: "サービス",
  relation: "関係",
};

function buildEntries(data: PortalDataV2): MemoEntry[] {
  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const interfaceById = new Map(data.interfaces.map((i) => [i.id, i]));
  const networkById = new Map(data.networks.map((n) => [n.id, n]));
  const deviceTitle = (id: string) => {
    const device = deviceById.get(id);
    return device ? device.petname || device.name : id;
  };
  const entries: MemoEntry[] = [];
  // The memo view is scoped to the first project. Other projects are
  // not visible here at all — a project is a separate partition
  // holding exactly one ouchi (its title and global memo).
  const scopeId = data.projects?.[0]?.id;
  const inScope = (projectId?: string) =>
    projectId === undefined || scopeId === undefined || projectId === scopeId;
  const projects =
    data.projects && data.projects.length > 0
      ? data.projects.filter((project) => project.id === scopeId)
      : [
          {
            id: "settings",
            name: "",
            title: data.settings?.title || "ouchi",
            properties: data.settings?.properties ?? {},
          },
        ];
  for (const project of projects) {
    entries.push({
      kind: "project",
      id: project.id,
      title: project.title || "ouchi",
      sub: project.name,
      meta: [project.name, project.title, data.settings?.domain ?? ""]
        .filter(Boolean)
        .join(" ・ "),
      properties: project.properties ?? {},
    });
  }
  for (const network of sortNetworksForDisplay(data.networks)) {
    if (!inScope(network.projectId)) {
      continue;
    }
    const deviceCount = new Set(
      data.interfaces
        .filter((i) => i.networkId === network.id)
        .map((i) => i.deviceId),
    ).size;
    entries.push({
      kind: "network",
      id: network.id,
      title: network.name,
      sub: network.cidr ?? "",
      meta: [network.name, network.cidr ?? "", `${deviceCount} デバイス`]
        .filter(Boolean)
        .join(" ・ "),
      properties: network.properties ?? {},
    });
  }
  for (const device of data.devices) {
    if (!inScope(device.projectId)) {
      continue;
    }
    const ifaces = data.interfaces.filter((i) => i.deviceId === device.id);
    const networks = [
      ...new Set(
        ifaces
          .map((i) =>
            i.networkId ? networkById.get(i.networkId)?.name : undefined,
          )
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const ips = ifaces.map((i) => i.ip).filter(Boolean);
    entries.push({
      kind: "device",
      id: device.id,
      title: device.petname || device.name,
      sub: device.petname ? device.name : "",
      meta: [
        device.name,
        ...networks,
        ...ips,
        DEVICE_CATEGORY_LABELS[device.category],
      ]
        .filter(Boolean)
        .join(" ・ "),
      properties: device.properties ?? {},
    });
  }
  for (const iface of data.interfaces) {
    if (!inScope(iface.projectId)) {
      continue;
    }
    const device = deviceById.get(iface.deviceId);
    const network = iface.networkId
      ? networkById.get(iface.networkId)
      : undefined;
    entries.push({
      kind: "interface",
      id: iface.id,
      title: `${device ? device.petname || device.name : iface.deviceId} / ${iface.name}`,
      sub: device ? device.name : "",
      meta: [
        device ? device.petname || device.name : "",
        iface.name,
        network?.name ?? "",
        iface.ip,
        iface.mac ?? "",
      ]
        .filter(Boolean)
        .join(" ・ "),
      properties: iface.properties ?? {},
    });
  }
  for (const service of data.services) {
    if (!inScope(service.projectId)) {
      continue;
    }
    const iface = interfaceById.get(service.interfaceId);
    const device = iface ? deviceById.get(iface.deviceId) : undefined;
    entries.push({
      kind: "service",
      id: service.id,
      title: service.petname || service.subdomain,
      sub: device ? device.petname || device.name : "",
      meta: [
        device
          ? `${device.petname || device.name}（${device.name} / ${iface?.name ?? ""}）`
          : "",
        service.url || service.serviceUrl || "",
        `${service.port}/${service.protocol}`,
      ]
        .filter(Boolean)
        .join(" ・ "),
      properties: service.properties ?? {},
    });
  }
  for (const relation of data.relations) {
    if (!inScope(relation.projectId)) {
      continue;
    }
    const side = (
      deviceId: string,
      interfaceId: string | null,
      serviceId: string | null,
      label?: string,
    ) => {
      if (serviceId) {
        const service = data.services.find(
          (candidate) => candidate.id === serviceId,
        );
        const serviceLabel = service
          ? service.petname || service.subdomain
          : "";
        return `${deviceTitle(deviceId)} / サービス: ${serviceLabel}${label ? `（${label}）` : ""}`;
      }
      const ifaceName = interfaceId
        ? interfaceById.get(interfaceId)?.name
        : undefined;
      return `${deviceTitle(deviceId)} / ${ifaceName ?? ""}${label ? `（${label}）` : ""}`;
    };
    entries.push({
      kind: "relation",
      id: relation.id,
      title: `${deviceTitle(relation.fromDeviceId)} → ${deviceTitle(relation.toDeviceId)}`,
      sub: relation.relationName,
      meta: `${relation.relationName} ・ ${side(relation.fromDeviceId, relation.fromInterfaceId, relation.fromServiceId, relation.fromLabel)} → ${side(relation.toDeviceId, relation.toInterfaceId, relation.toServiceId, relation.toLabel)}`,
      properties: relation.properties ?? {},
    });
  }
  return entries;
}

export interface MemoViewProps {
  data: PortalDataV2;
  saveDisabled?: boolean;
  onBack: () => void;
  onSaveMemo: (
    kind: MemoTargetKind,
    id: string,
    properties: PortalProperties,
  ) => Promise<boolean>;
}

export function MemoView({
  data,
  saveDisabled = false,
  onBack,
  onSaveMemo,
}: MemoViewProps) {
  const entries = useMemo(() => buildEntries(data), [data]);
  const [query, setQuery] = useState("");
  const [onlyMemo, setOnlyMemo] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<MemoTargetKind>>(new Set());
  const [selected, setSelected] = useState<{
    kind: MemoTargetKind;
    id: string;
  } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [addError, setAddError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  const defaultEntry =
    entries.find((e) => Object.keys(e.properties).length > 0) ?? entries[0];
  const selectedEntry =
    (selected &&
      entries.find((e) => e.kind === selected.kind && e.id === selected.id)) ||
    defaultEntry;
  const keys = selectedEntry ? Object.keys(selectedEntry.properties) : [];
  const activeKey =
    selectedKey && keys.includes(selectedKey) ? selectedKey : (keys[0] ?? null);
  const draftId = selectedEntry && activeKey
    ? `${selectedEntry.kind}:${selectedEntry.id}:${activeKey}`
    : null;
  const savedValue =
    selectedEntry && activeKey
      ? (selectedEntry.properties[activeKey] ?? "")
      : "";
  const draftValue = draftId ? (drafts[draftId] ?? savedValue) : "";
  const dirty = draftValue !== savedValue;

  function selectEntry(entry: MemoEntry) {
    setSelected({ kind: entry.kind, id: entry.id });
    setSelectedKey(Object.keys(entry.properties)[0] ?? null);
    setAdding(false);
    setAddError("");
    setConfirmDelete(false);
    setSavedNote("");
  }

  function selectKey(key: string) {
    setSelectedKey(key);
    setConfirmDelete(false);
    setSavedNote("");
  }

  async function saveProperties(next: PortalProperties): Promise<boolean> {
    if (!selectedEntry || saveDisabled) {
      return false;
    }
    return onSaveMemo(selectedEntry.kind, selectedEntry.id, next);
  }

  async function handleSaveValue() {
    if (!selectedEntry || !activeKey) {
      return;
    }
    const ok = await saveProperties({
      ...selectedEntry.properties,
      [activeKey]: draftValue,
    });
    if (ok) {
      if (draftId) {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[draftId];
          return next;
        });
      }
      setSavedNote("保存しました");
    }
  }

  async function handleDeleteKey() {
    if (!selectedEntry || !activeKey) {
      return;
    }
    const next = { ...selectedEntry.properties };
    delete next[activeKey];
    const ok = await saveProperties(next);
    if (ok) {
      if (draftId) {
        setDrafts((prev) => {
          const rest = { ...prev };
          delete rest[draftId];
          return rest;
        });
      }
      setConfirmDelete(false);
      setSelectedKey(null);
      setSavedNote("削除しました");
    }
  }

  async function handleAddKey() {
    if (!selectedEntry) {
      return;
    }
    const name = newKey.trim();
    if (!name) {
      setAddError("キーを入力してください。");
      return;
    }
    if (Object.hasOwn(selectedEntry.properties, name)) {
      setAddError("同じキーがすでにあります。");
      return;
    }
    const ok = await saveProperties({
      ...selectedEntry.properties,
      [name]: "",
    });
    if (ok) {
      setAdding(false);
      setNewKey("");
      setAddError("");
      setSelectedKey(name);
      setSavedNote("キーを追加しました");
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  function entryVisible(entry: MemoEntry): boolean {
    if (onlyMemo && Object.keys(entry.properties).length === 0) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      entry.title,
      entry.sub,
      ...Object.entries(entry.properties).flatMap(([k, v]) => [k, v]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  }

  return (
    <section
      aria-label="メモ"
      className="ouchi-memo-view"
      role="region"
    >
      <header className="ouchi-memo-view-header">
        <button
          aria-label="ポータルに戻る"
          className="ouchi-memo-back"
          onClick={onBack}
          type="button"
        >
          ← ポータルに戻る
        </button>
        <h1>メモ</h1>
        <span className="ouchi-memo-view-domain">
          {data.settings?.domain ?? "ouchi.local"}
        </span>
      </header>

      {saveDisabled && (
        <div className="ouchi-memo-demo-notice" role="note">
          デモモードでは保存されません。閲覧と画面操作は試せますが、メモの追加・編集・削除は無効です。
        </div>
      )}

      <div className="ouchi-memo-layout">
        <div className="ouchi-memo-side">
          <div className="ouchi-memo-search">
            <input
              aria-label="メモを検索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="メモを検索（名前・キー・値）"
              type="search"
              value={query}
            />
          </div>
          <div className="ouchi-memo-filter">
            <label>
              <input
                checked={onlyMemo}
                onChange={(event) => setOnlyMemo(event.target.checked)}
                type="checkbox"
              />{" "}
              メモがあるものだけ
            </label>
          </div>
          <div className="ouchi-memo-tree">
            {GROUPS.map((group) => {
              const groupEntries = entries.filter(
                (e) => e.kind === group.kind,
              );
              const memoCount = groupEntries.filter(
                (e) => Object.keys(e.properties).length > 0,
              ).length;
              const isCollapsed = collapsed.has(group.kind);
              return (
                <div key={group.kind}>
                  <div
                    className="ouchi-memo-group-head"
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.kind)) {
                          next.delete(group.kind);
                        } else {
                          next.add(group.kind);
                        }
                        return next;
                      })
                    }
                  >
                    <span className="ouchi-memo-caret">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    {group.label}
                    <span className="ouchi-memo-gcount">
                      {memoCount} 件のメモ
                    </span>
                  </div>
                  {!isCollapsed &&
                    groupEntries.filter(entryVisible).map((entry) => {
                      const count = Object.keys(entry.properties).length;
                      const isSelected =
                        selectedEntry?.kind === entry.kind &&
                        selectedEntry?.id === entry.id;
                      return (
                        <div
                          className={`ouchi-memo-item${isSelected ? " selected" : ""}`}
                          key={`${entry.kind}:${entry.id}`}
                          onClick={() => selectEntry(entry)}
                        >
                          <span className="ouchi-memo-iname">
                            {entry.title}
                          </span>
                          {entry.sub && (
                            <span className="ouchi-memo-isub">
                              {entry.sub}
                            </span>
                          )}
                          {count > 0 && (
                            <span className="ouchi-memo-badge">{count}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ouchi-memo-main">
          {selectedEntry ? (
            <>
              <div className="ouchi-memo-head">
                <div className="ouchi-memo-crumb">
                  メモ / {GROUP_LABELS[selectedEntry.kind]} /{" "}
                  {selectedEntry.title}
                </div>
                <h2 className="ouchi-memo-title">
                  {selectedEntry.title}
                  <span className="ouchi-memo-kind">
                    {GROUP_LABELS[selectedEntry.kind]}
                  </span>
                </h2>
                <div className="ouchi-memo-meta">{selectedEntry.meta}</div>
              </div>
              <div className="ouchi-memo-pane">
                <div className="ouchi-memo-keys">
                  {keys.length === 0 && (
                    <div className="ouchi-memo-keys-empty">
                      キーはまだありません
                    </div>
                  )}
                  {keys.map((key) => (
                    <div
                      className={`ouchi-memo-key${key === activeKey ? " selected" : ""}`}
                      key={key}
                      onClick={() => selectKey(key)}
                    >
                      <span className="ouchi-memo-key-name">{key}</span>
                      {selectedEntry.properties[key]?.startsWith("ENC[") && (
                        <span className="ouchi-memo-encdot">SOPS</span>
                      )}
                    </div>
                  ))}
                  {!saveDisabled &&
                    (adding ? (
                      <div className="ouchi-memo-keyadd-form">
                        <input
                          aria-label="新しいキー"
                          autoFocus
                          onChange={(event) => setNewKey(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleAddKey();
                            }
                          }}
                          placeholder="キーの名前"
                          type="text"
                          value={newKey}
                        />
                        {addError && (
                          <div className="ouchi-memo-add-error">
                            {addError}
                          </div>
                        )}
                        <div className="ouchi-memo-keyadd-actions">
                          <button
                            onClick={() => void handleAddKey()}
                            type="button"
                          >
                            追加
                          </button>
                          <button
                            onClick={() => {
                              setAdding(false);
                              setAddError("");
                            }}
                            type="button"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="ouchi-memo-keyadd"
                        onClick={() => setAdding(true)}
                      >
                        ＋ キーを追加
                      </div>
                    ))}
                </div>
                <div className="ouchi-memo-value">
                  {activeKey ? (
                    <>
                      <h3>{activeKey}</h3>
                      <textarea
                        aria-label={`${activeKey}の値`}
                        onChange={(event) => {
                          if (draftId) {
                            setDrafts((prev) => ({
                              ...prev,
                              [draftId]: event.target.value,
                            }));
                          }
                          setSavedNote("");
                        }}
                        readOnly={saveDisabled}
                        value={draftValue}
                      />
                      <div className="ouchi-memo-hint">
                        {savedValue.startsWith("ENC[")
                          ? "SOPS の暗号文です。平文は入れないこと。"
                          : "値は文字列です。改行できます。"}
                      </div>
                      {!saveDisabled && (
                        <div className="ouchi-memo-actions">
                          <button
                            className="ouchi-memo-save"
                            disabled={!dirty}
                            onClick={() => void handleSaveValue()}
                            type="button"
                          >
                            保存
                          </button>
                          <button
                            className="ouchi-memo-revert"
                            disabled={!dirty}
                            onClick={() => {
                              if (draftId) {
                                setDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[draftId];
                                  return next;
                                });
                              }
                            }}
                            type="button"
                          >
                            元に戻す
                          </button>
                          {savedNote && (
                            <span className="ouchi-memo-saved" role="status">
                              {savedNote}
                            </span>
                          )}
                          {confirmDelete ? (
                            <span className="ouchi-memo-del-confirm">
                              このキーを削除しますか？
                              <button
                                className="ouchi-memo-del-yes"
                                onClick={() => void handleDeleteKey()}
                                type="button"
                              >
                                削除する
                              </button>
                              <button
                                onClick={() => setConfirmDelete(false)}
                                type="button"
                              >
                                やめる
                              </button>
                            </span>
                          ) : (
                            <button
                              className="ouchi-memo-del"
                              onClick={() => setConfirmDelete(true)}
                              type="button"
                            >
                              このキーを削除
                            </button>
                          )}
                        </div>
                      )}
                      {saveDisabled && savedNote && (
                        <span className="ouchi-memo-saved" role="status">
                          {savedNote}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="ouchi-memo-vempty">
                      左のリストでキーを選ぶと、ここに値が出ます。
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="ouchi-memo-vempty">対象がありません。</p>
          )}
        </div>
      </div>
    </section>
  );
}
