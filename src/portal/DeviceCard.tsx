import "./styles/portal-board.css";
import "./styles/portal-board-v2.css";
import type { CSSProperties } from "react";
import { GenericServiceMark } from "./genericIcons";
import { ServiceIcon } from "./icons";
import {
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalInterface,
  type PortalGenericIconKey,
  type PortalService,
} from "./types";
import {
  deviceName,
  serviceName,
  type DeviceVisual,
} from "./portalPresentation";

const DEVICE_CATEGORY_ICON_KEYS: Record<
  PortalDeviceCategory,
  PortalGenericIconKey
> = {
  network: "switch",
  physical: "server",
  vm: "container",
  service: "applications",
};

export function DeviceCategoryIcon({
  category,
}: {
  category: PortalDeviceCategory;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ouchi-device-category-icon ouchi-device-category-icon--${category}`}
    >
      <GenericServiceMark kind={DEVICE_CATEGORY_ICON_KEYS[category]} />
    </span>
  );
}

function ServiceTile({
  service,
  iface,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoClick,
  selected,
  onSelect,
}: {
  service: PortalService;
  iface: PortalInterface;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoClick: () => void;
  selected: boolean;
  onSelect: (serviceId: string) => void;
}) {
  const href = service.url ?? "";
  const name = serviceName(service);
  const icon = (
    <span className="ouchi-service-icon-wrap">
      <ServiceIcon
        allowRemoteAssets={allowRemoteIcons}
        iconKey={service.iconKey}
        serviceUrl={href}
        size={42}
      />
    </span>
  );
  // The icon is the jump target: clicking it opens the service and
  // never touches the selection. The rest of the tile selects the
  // service (and shows its relations).
  const iconTarget = demoMode ? (
    <button
      aria-label={`${name}を開く`}
      className="ouchi-service-icon-link"
      onClick={(event) => {
        event.stopPropagation();
        onDemoClick();
      }}
      type="button"
    >
      {icon}
    </button>
  ) : href ? (
    <a
      aria-label={`${name}を開く`}
      className="ouchi-service-icon-link"
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      {icon}
    </a>
  ) : (
    icon
  );
  return (
    <div
      className={[
        "ouchi-service-tile",
        demoMode ? "ouchi-service-tile--demo" : "",
        !demoMode && !href ? "ouchi-service-tile--disabled" : "",
        selected ? "ouchi-service-tile--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-service-id={service.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(service.id);
      }}
    >
      {iconTarget}
      <span className="ouchi-service-copy">
        <strong>{name}</strong>
        <small>
          {service.port}/{service.protocol}
        </small>
      </span>
    </div>
  );
}

export function DeviceCard({
  iface,
  device,
  services,
  visual,
  sameDevice,
  selectedDeviceId,
  onSelect,
  selectedServiceId,
  onSelectService,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  iface: PortalInterface;
  device: PortalDevice;
  services: PortalService[];
  visual: DeviceVisual;
  sameDevice: boolean;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  selectedServiceId?: string;
  onSelectService: (serviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  const selected = device.id === selectedDeviceId;
  const petname = device.petname?.trim();
  const displayName = deviceName(device);
  const style =
    visual.mode === "related" && visual.color
      ? ({ "--ouchi-relation-color": visual.color } as CSSProperties)
      : undefined;

  return (
    <article
      aria-labelledby={`device-${iface.id}`}
      className={[
        "ouchi-node-card",
        device.category === "vm" ? "ouchi-device-card--vm" : "",
        `ouchi-device-card--${visual.mode}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-device-id={device.id}
      data-interface-id={iface.id}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("a, button")
        ) {
          return;
        }
        onSelect(device.id);
      }}
      style={style}
    >
      <header className="ouchi-node-header">
        <button
          aria-label={`${displayName}を${selected ? "選択解除" : "選択"}`}
          aria-pressed={selected}
          className="ouchi-node-select-button"
          onClick={() => onSelect(device.id)}
          type="button"
        >
          <span className="ouchi-node-radio" aria-hidden="true" />
          <span className="ouchi-device-title">
            <span id={`device-${iface.id}`}>{displayName}</span>
            {sameDevice && selected && (
              <span className="ouchi-same-device-badge">同一デバイス</span>
            )}
          </span>
          <span className="ouchi-node-address">
            {iface.ip || "IP未登録"}
            {petname ? ` / ${device.name}` : ""}
            {` / ${iface.name}`}
          </span>
        </button>
      </header>

      {services.length === 0 ? (
        <p className="ouchi-node-empty">サービス未登録</p>
      ) : (
        <div className="ouchi-service-grid">
          {services.map((service) => (
            <ServiceTile
              key={service.id}
              iface={iface}
              service={service}
              demoMode={demoMode}
              iconBaseUrl={iconBaseUrl}
              allowRemoteIcons={allowRemoteIcons}
              onDemoClick={onDemoServiceClick}
              onSelect={onSelectService}
              selected={service.id === selectedServiceId}
            />
          ))}
        </div>
      )}

    </article>
  );
}
