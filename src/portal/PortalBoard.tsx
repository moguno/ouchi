import "./styles/portal-board.css";
import "./styles/portal-board-v2.css";
import type { CSSProperties } from "react";
import { ExternalLinkIcon } from "./icons";
import {
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  type PortalDataV2,
  type PortalDeviceNetwork,
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
  serviceDescription,
  serviceName,
} from "./portalPresentation";

function NetworkCard({
  network,
  data,
  selectedDeviceId,
  onSelect,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  network: PortalNetwork;
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  const memberships = data.deviceNetworks.filter(
    (membership) => membership.networkId === network.id,
  );
  const membershipCounts = new Map<string, number>();
  for (const membership of data.deviceNetworks) {
    membershipCounts.set(
      membership.deviceId,
      (membershipCounts.get(membership.deviceId) ?? 0) + 1,
    );
  }

  return (
    <article
      aria-labelledby={`network-${network.id}`}
      className={`ouchi-network-card ouchi-accent-scope--${network.accent}`}
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
            {new Set(memberships.map((item) => item.deviceId)).size}台 / IP{" "}
            {memberships.length}件
          </small>
        </span>
      </header>

      {memberships.length > 0 && (
        <div className="ouchi-device-category-stack">
          {PORTAL_DEVICE_CATEGORIES.filter((category) =>
            memberships.some(
              (membership) =>
                data.devices.find(
                  (device) => device.id === membership.deviceId,
                )?.category === category,
            ),
          ).map((category) => {
            const categoryMemberships = memberships.filter(
              (membership) =>
                data.devices.find(
                  (device) => device.id === membership.deviceId,
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
                  <span>{categoryMemberships.length}</span>
                </header>
                {categoryMemberships.length === 0 ? (
                  <p className="ouchi-device-category-empty">登録なし</p>
                ) : (
                  <div className="ouchi-node-grid">
                    {categoryMemberships.map((membership) => {
                      const device = data.devices.find(
                        (item) => item.id === membership.deviceId,
                      );
                      if (!device) {
                        return null;
                      }
                      const services = data.services.filter(
                        (service) =>
                          service.deviceNetworkId === membership.id,
                      );
                      return (
                        <DeviceCard
                          key={membership.id}
                          demoMode={demoMode}
                          device={device}
                          allowRemoteIcons={allowRemoteIcons}
                          iconBaseUrl={iconBaseUrl}
                          membership={membership}
                          onDemoServiceClick={onDemoServiceClick}
                          onSelect={onSelect}
                          sameDevice={
                            (membershipCounts.get(device.id) ?? 0) > 1
                          }
                          selectedDeviceId={selectedDeviceId}
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
  selectedDeviceId,
  onSelect,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  return (
    <div className="ouchi-network-stack">
      {sortNetworksForDisplay(data.networks).map((network) => (
        <NetworkCard
          data={data}
          demoMode={demoMode}
          allowRemoteIcons={allowRemoteIcons}
          iconBaseUrl={iconBaseUrl}
          key={network.id}
          network={network}
          onDemoServiceClick={onDemoServiceClick}
          onSelect={onSelect}
          selectedDeviceId={selectedDeviceId}
        />
      ))}
    </div>
  );
}

function ListService({
  service,
  membership,
  demoMode,
  onDemoClick,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
  demoMode: boolean;
  onDemoClick: () => void;
}) {
  const href = service.url ?? "";
  const content = (
    <>
      <span className="ouchi-list-service-name">{serviceName(service)}</span>
      <small>
        {serviceDescription(service) || membership.ip || "IP未登録"}
      </small>
      {href && <ExternalLinkIcon size={14} />}
    </>
  );
  if (demoMode) {
    return (
      <button
        className="ouchi-list-service ouchi-service-tile--demo"
        onClick={onDemoClick}
        type="button"
      >
        {content}
      </button>
    );
  }
  return href ? (
    <a
      className="ouchi-list-service"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <span className="ouchi-list-service ouchi-service-tile--disabled">
      {content}
    </span>
  );
}

export function ListBoard({
  data,
  selectedDeviceId,
  onSelect,
  demoMode,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  onDemoServiceClick: () => void;
}) {
  const membershipCounts = new Map<string, number>();
  for (const membership of data.deviceNetworks) {
    membershipCounts.set(
      membership.deviceId,
      (membershipCounts.get(membership.deviceId) ?? 0) + 1,
    );
  }

  return (
    <div className="ouchi-list-stack">
      {sortNetworksForDisplay(data.networks).map((network) => {
        const memberships = data.deviceNetworks.filter(
          (membership) => membership.networkId === network.id,
        );

        return (
          <section
            className={`ouchi-list-network ouchi-accent-scope--${network.accent}`}
            key={network.id}
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
                {new Set(memberships.map((item) => item.deviceId)).size}台 / IP{" "}
                {memberships.length}件
              </span>
            </header>

            {memberships.length > 0 && (
              <div className="ouchi-list-category-stack">
                {PORTAL_DEVICE_CATEGORIES.filter((category) =>
                  memberships.some(
                    (membership) =>
                      data.devices.find(
                        (device) => device.id === membership.deviceId,
                      )?.category === category,
                  ),
                ).map((category) => {
                  const categoryMemberships = memberships.filter(
                    (membership) =>
                      data.devices.find(
                        (device) => device.id === membership.deviceId,
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
                        <span>{categoryMemberships.length}</span>
                      </header>
                      {categoryMemberships.length === 0 ? (
                        <p className="ouchi-list-category-empty">登録なし</p>
                      ) : (
                        <div className="ouchi-list-node-list">
                          {categoryMemberships.map((membership) => {
                            const device = data.devices.find(
                              (item) => item.id === membership.deviceId,
                            );
                            if (!device) {
                              return null;
                            }
                            const visual = deviceVisual(
                              device.id,
                              selectedDeviceId,
                              data.relations,
                            );
                            const services = data.services.filter(
                              (service) =>
                                service.deviceNetworkId === membership.id,
                            );
                            const selected =
                              device.id === selectedDeviceId;
                            const petname = device.petname?.trim();
                            const displayName = deviceName(device);
                            return (
                              <div
                                className={[
                                  "ouchi-list-node",
                                  device.isVm ? "ouchi-list-node--vm" : "",
                                  `ouchi-list-node--${visual.mode}`,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-device-id={device.id}
                                key={membership.id}
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
                                    {device.isVm && (
                                      <span className="ouchi-vm-badge">
                                        VM
                                      </span>
                                    )}
                                    {selected &&
                                      (membershipCounts.get(device.id) ?? 0) >
                                        1 && (
                                        <span className="ouchi-same-device-badge">
                                          同一デバイス
                                        </span>
                                      )}
                                    <code>{membership.ip || "IP未登録"}</code>
                                    {petname && <small>{device.name}</small>}
                                    <small>
                                      {DEVICE_CATEGORY_LABELS[device.category]}
                                    </small>
                                    {visual.mode === "related" &&
                                      visual.tags.map((tag, index) => (
                                        <span
                                          className="ouchi-relation-badge"
                                          key={`${tag.label}-${index}`}
                                          style={
                                            {
                                              "--ouchi-relation-color":
                                                tag.color,
                                            } as CSSProperties
                                          }
                                        >
                                          {tag.label}
                                        </span>
                                      ))}
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
                                          membership={membership}
                                          onDemoClick={onDemoServiceClick}
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
