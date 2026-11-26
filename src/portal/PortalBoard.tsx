import "./styles/portal-board.css";
import "./styles/portal-board-v2.css";
import type { CSSProperties } from "react";
import { ExternalLinkIcon } from "./icons";
import {
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  type PortalDataV2,
  type PortalInterface,
  type PortalNetwork,
  type PortalService,
} from "./types";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  DeviceCard,
  DeviceCategoryIcon,
} from "./DeviceCard";
import {
  deviceName,
  deviceVisual,
  serviceName,
} from "./portalPresentation";
import {
  RELATION_DISPLAY_MODE_LABELS,
  relationDisplayMode,
  type RelationDisplayModes,
} from "./relationDisplay";
import type { PortalRelationName } from "./types";

export function RelationFilterBar({
  modes,
  onCycle,
  relationNames,
}: {
  modes?: RelationDisplayModes;
  onCycle: (relationName: string) => void;
  relationNames: PortalRelationName[];
}) {
  if (relationNames.length === 0) {
    return null;
  }
  return (
    <div aria-label="関係フィルター" className="ouchi-relation-filter" role="group">
      {relationNames.map((relationName) => {
        const mode = relationDisplayMode(modes, relationName.name);
        return (
          <button
            aria-label={`関係フィルター ${relationName.name}（${RELATION_DISPLAY_MODE_LABELS[mode]}）`}
            className={`ouchi-relation-filter-chip ouchi-relation-filter-chip--${mode}`}
            key={relationName.id}
            onClick={() => onCycle(relationName.name)}
            style={
              {
                "--ouchi-relation-color": relationName.color,
              } as CSSProperties
            }
            title={`${relationName.name}: ${RELATION_DISPLAY_MODE_LABELS[mode]}（クリックで切り替え）`}
            type="button"
          >
            <span className="ouchi-relation-filter-dot" />
            {relationName.name}
          </button>
        );
      })}
    </div>
  );
}

function visibleData(
  data: PortalDataV2,
  relationModes?: RelationDisplayModes,
): PortalDataV2 {
  return {
    ...data,
    relations: data.relations.filter(
      (relation) =>
        relationDisplayMode(relationModes, relation.relationName) !==
        "hidden",
    ),
  };
}

function NetworkCard({
  network,
  data,
  selectedDeviceId,
  onSelect,
  selectedServiceId,
  onSelectService,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  network: PortalNetwork;
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  selectedServiceId?: string;
  onSelectService: (serviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  const interfaces = data.interfaces.filter(
    (iface) => iface.networkId === network.id,
  );
  const interfaceCounts = new Map<string, number>();
  for (const iface of data.interfaces) {
    if (iface.networkId === null) {
      continue;
    }
    interfaceCounts.set(
      iface.deviceId,
      (interfaceCounts.get(iface.deviceId) ?? 0) + 1,
    );
  }

  return (
    <article
      aria-labelledby={`network-${network.id}`}
      className="ouchi-network-card"
      style={
        {
          "--network-color": network.accent,
          "--network-bg": `color-mix(in srgb, ${network.accent} 8%, transparent)`,
          "--network-line": `color-mix(in srgb, ${network.accent} 50%, transparent)`,
        } as CSSProperties
      }
    >
      <header className="ouchi-network-header">
        <span className="ouchi-network-label">
          <span className="ouchi-network-glyph" aria-hidden="true">
            {network.name.slice(0, 1)}
          </span>
          <span id={`network-${network.id}`}>{network.name}</span>
        </span>
        <span className="ouchi-network-meta">
          {network.cidr && <code>{network.cidr}</code>}
          <small>
            {new Set(interfaces.map((item) => item.deviceId)).size}台 / I/F{" "}
            {interfaces.length}件
          </small>
        </span>
      </header>

      {interfaces.length > 0 && (
        <div className="ouchi-device-category-stack">
          {PORTAL_DEVICE_CATEGORIES.filter((category) =>
            interfaces.some(
              (iface) =>
                data.devices.find(
                  (device) => device.id === iface.deviceId,
                )?.category === category,
            ),
          ).map((category) => {
            const categoryInterfaces = interfaces.filter(
              (iface) =>
                data.devices.find(
                  (device) => device.id === iface.deviceId,
                )?.category === category,
            );
            return (
              <div
                className={`ouchi-device-category ouchi-device-category--${category}`}
                key={category}
              >
                <header className="ouchi-device-category-header">
                  <DeviceCategoryIcon category={category} />
                  <h3 id={`category-${network.id}-${category}`}>
                    {DEVICE_CATEGORY_LABELS[category]}
                  </h3>
                  <span>{categoryInterfaces.length}</span>
                </header>
                {categoryInterfaces.length === 0 ? (
                  <p className="ouchi-device-category-empty">登録なし</p>
                ) : (
                  <div className="ouchi-node-grid">
                    {categoryInterfaces.map((iface) => {
                      const device = data.devices.find(
                        (item) => item.id === iface.deviceId,
                      );
                      if (!device) {
                        return null;
                      }
                      const services = data.services.filter(
                        (service) =>
                          service.interfaceId === iface.id,
                      );
                      return (
                        <DeviceCard
                          key={iface.id}
                          demoMode={demoMode}
                          device={device}
                          allowRemoteIcons={allowRemoteIcons}
                          iconBaseUrl={iconBaseUrl}
                          iface={iface}
                          onDemoServiceClick={onDemoServiceClick}
                          onSelect={onSelect}
                          onSelectService={onSelectService}
                          sameDevice={
                            (interfaceCounts.get(device.id) ?? 0) > 1
                          }
                          selectedDeviceId={selectedDeviceId}
                          selectedServiceId={selectedServiceId}
                          services={services}
                          visual={deviceVisual(
                            device.id,
                            selectedDeviceId,
                            data.relations,
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export function IconBoard({
  data,
  relationModes,
  selectedDeviceId,
  onSelect,
  selectedServiceId,
  onSelectService,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  relationModes?: RelationDisplayModes;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  selectedServiceId?: string;
  onSelectService: (serviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  return (
    <div className="ouchi-network-stack">
      {sortNetworksForDisplay(data.networks).map((network) => (
        <NetworkCard
          data={visibleData(data, relationModes)}
          demoMode={demoMode}
          allowRemoteIcons={allowRemoteIcons}
          iconBaseUrl={iconBaseUrl}
          key={network.id}
          network={network}
          onDemoServiceClick={onDemoServiceClick}
          onSelect={onSelect}
          onSelectService={onSelectService}
          selectedDeviceId={selectedDeviceId}
          selectedServiceId={selectedServiceId}
        />
      ))}
    </div>
  );
}

function ListService({
  service,
  iface,
  demoMode,
  onDemoClick,
  selected,
  onSelect,
}: {
  service: PortalService;
  iface: PortalInterface;
  demoMode: boolean;
  onDemoClick: () => void;
  selected: boolean;
  onSelect: (serviceId: string) => void;
}) {
  const href = service.url ?? "";
  const name = serviceName(service);
  // The external-link mark is the jump target; the row itself
  // selects the service, mirroring the tile board's split.
  const jump = demoMode ? (
    <button
      aria-label={`${name}を開く`}
      className="ouchi-list-service-jump"
      onClick={(event) => {
        event.stopPropagation();
        onDemoClick();
      }}
      type="button"
    >
      <ExternalLinkIcon size={14} />
    </button>
  ) : href ? (
    <a
      aria-label={`${name}を開く`}
      className="ouchi-list-service-jump"
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLinkIcon size={14} />
    </a>
  ) : null;
  return (
    <div
      className={`ouchi-list-service${selected ? " ouchi-list-service--selected" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(service.id);
      }}
    >
      <span className="ouchi-list-service-name">{name}</span>
      <small>
        {service.port}/{service.protocol}
      </small>
      {jump}
    </div>
  );
}

export function ListBoard({
  data,
  relationModes,
  selectedDeviceId,
  onSelect,
  selectedServiceId,
  onSelectService,
  demoMode,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  relationModes?: RelationDisplayModes;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  selectedServiceId?: string;
  onSelectService: (serviceId: string) => void;
  demoMode: boolean;
  onDemoServiceClick: () => void;
}) {
  const interfaceCounts = new Map<string, number>();
  for (const iface of data.interfaces) {
    if (iface.networkId === null) {
      continue;
    }
    interfaceCounts.set(
      iface.deviceId,
      (interfaceCounts.get(iface.deviceId) ?? 0) + 1,
    );
  }

  return (
    <div className="ouchi-list-stack">
      {sortNetworksForDisplay(data.networks).map((network) => {
        const interfaces = data.interfaces.filter(
          (iface) => iface.networkId === network.id,
        );

        return (
          <section
            className="ouchi-list-network"
            key={network.id}
            style={
                    {
                      "--network-color": network.accent,
                      "--network-bg": `color-mix(in srgb, ${network.accent} 8%, transparent)`,
                      "--network-line": `color-mix(in srgb, ${network.accent} 50%, transparent)`,
                    } as CSSProperties
                  }
          >
            <header className="ouchi-list-network-header">
              <div>
                <span className="ouchi-network-label">
                  <span className="ouchi-network-glyph" aria-hidden="true">
                    {network.name.slice(0, 1)}
                  </span>
                  <strong>{network.name}</strong>
                </span>
                <p>{network.cidr || "CIDRなし"}</p>
              </div>
              <span className="ouchi-list-count">
                デバイス{" "}
                {new Set(interfaces.map((item) => item.deviceId)).size}台 / I/F{" "}
                {interfaces.length}件
              </span>
            </header>

            {interfaces.length > 0 && (
              <div className="ouchi-list-category-stack">
                {PORTAL_DEVICE_CATEGORIES.filter((category) =>
                  interfaces.some(
                    (iface) =>
                      data.devices.find(
                        (device) => device.id === iface.deviceId,
                      )?.category === category,
                  ),
                ).map((category) => {
                  const categoryInterfaces = interfaces.filter(
                    (iface) =>
                      data.devices.find(
                        (device) => device.id === iface.deviceId,
                      )?.category === category,
                  );
                  return (
                    <section
                      className={`ouchi-list-category ouchi-list-category--${category}`}
                      key={category}
                    >
                      <header className="ouchi-list-category-header">
                        <DeviceCategoryIcon category={category} />
                        <strong>{DEVICE_CATEGORY_LABELS[category]}</strong>
                        <span>{categoryInterfaces.length}</span>
                      </header>
                      {categoryInterfaces.length === 0 ? (
                        <p className="ouchi-list-category-empty">登録なし</p>
                      ) : (
                        <div className="ouchi-list-node-list">
                          {categoryInterfaces.map((iface) => {
                            const device = data.devices.find(
                              (item) => item.id === iface.deviceId,
                            );
                            if (!device) {
                              return null;
                            }
                            const visual = deviceVisual(
                              device.id,
                              selectedDeviceId,
                              visibleData(data, relationModes).relations,
                            );
                            const services = data.services.filter(
                              (service) =>
                                service.interfaceId === iface.id,
                            );
                            const selected =
                              device.id === selectedDeviceId;
                            const petname = device.petname?.trim();
                            const displayName = deviceName(device);
                            return (
                              <div
                                className={[
                                  "ouchi-list-node",
                                  device.category === "vm" ? "ouchi-list-node--vm" : "",
                                  `ouchi-list-node--${visual.mode}`,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-device-id={device.id}
                                data-interface-id={iface.id}
                                key={iface.id}
                                onClick={(event) => {
                                  if (
                                    event.target instanceof Element &&
                                    event.target.closest("a, button")
                                  ) {
                                    return;
                                  }
                                  onSelect(device.id);
                                }}
                                style={
                                  visual.mode === "related" &&
                                  visual.color
                                    ? ({
                                        "--ouchi-relation-color":
                                          visual.color,
                                      } as CSSProperties)
                                    : undefined
                                }
                              >
                                <div className="ouchi-list-node-summary">
                                  <div className="ouchi-list-node-meta">
                                    <button
                                      aria-label={`${displayName}を${selected ? "選択解除" : "選択"}`}
                                      aria-pressed={selected}
                                      className="ouchi-list-select-button"
                                      onClick={() => onSelect(device.id)}
                                      type="button"
                                    >
                                      <strong>{displayName}</strong>
                                    </button>
                                    {selected &&
                                      (interfaceCounts.get(device.id) ?? 0) >
                                        1 && (
                                        <span className="ouchi-same-device-badge">
                                          同一デバイス
                                        </span>
                                      )}
                                    <code>{iface.ip || "IP未登録"}</code>
                                    {petname && <small>{device.name}</small>}
                                    <small>{iface.name}</small>
                                  </div>
                                  <div className="ouchi-list-services">
                                    {services.length === 0 ? (
                                      <span className="ouchi-list-service-empty">
                                        サービス未登録
                                      </span>
                                    ) : (
                                      services.map((service) => (
                                        <ListService
                                          demoMode={demoMode}
                                          key={service.id}
                                          iface={iface}
                                          onDemoClick={onDemoServiceClick}
                                          onSelect={onSelectService}
                                          selected={
                                            service.id === selectedServiceId
                                          }
                                          service={service}
                                        />
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
