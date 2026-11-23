import "./styles/portal-board.css";
import "./styles/portal-board-v2.css";
import type { CSSProperties } from "react";
import { GenericServiceMark } from "./genericIcons";
import { ServiceIcon } from "./icons";
import {
  DEVICE_CATEGORY_LABELS,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalDeviceNetwork,
  type PortalGenericIconKey,
  type PortalService,
} from "./types";
import {
  deviceName,
  serviceDescription,
  serviceName,
  type DeviceVisual,
} from "./portalPresentation";

const DEVICE_CATEGORY_ICON_KEYS: Record<
  PortalDeviceCategory,
  PortalGenericIconKey
> = {
  network: "globe",
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

function RelationBadges({ visual }: { visual: DeviceVisual }) {
  if (visual.mode === "related") {
    return (
      <div className="ouchi-relation-badges">
        {visual.tags.map((tag, index) => (
          <span
            className="ouchi-relation-badge"
            key={`${tag.label}-${index}`}
            style={
              {
                "--ouchi-relation-color": tag.color,
              } as CSSProperties
            }
          >
            {tag.label}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function ServiceTile({
  service,
  membership,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoClick,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoClick: () => void;
}) {
  const href = service.url ?? "";
  const content = (
    <>
      <span className="ouchi-service-icon-wrap">
        <ServiceIcon
          allowRemoteAssets={allowRemoteIcons}
          iconKey={service.iconKey}
          serviceUrl={href}
          size={50}
        />
      </span>
      <span className="ouchi-service-copy">
        <strong>{serviceName(service)}</strong>
        <small>
          {serviceDescription(service) || membership.ip || "IP未登録"}
        </small>
      </span>
    </>
  );
  if (demoMode) {
    return (
      <button
        className="ouchi-service-tile ouchi-service-tile--demo"
        onClick={onDemoClick}
        type="button"
      >
        {content}
      </button>
    );
  }
  return href ? (
    <a
      className="ouchi-service-tile"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <div className="ouchi-service-tile ouchi-service-tile--disabled">
      {content}
    </div>
  );
}

export function DeviceCard({
  membership,
  device,
  services,
  visual,
  sameDevice,
  selectedDeviceId,
  onSelect,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  membership: PortalDeviceNetwork;
  device: PortalDevice;
  services: PortalService[];
  visual: DeviceVisual;
  sameDevice: boolean;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
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
      aria-labelledby={`device-${membership.id}`}
      className={[
        "ouchi-node-card",
        device.isVm ? "ouchi-device-card--vm" : "",
        `ouchi-device-card--${visual.mode}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-device-id={device.id}
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
            <span id={`device-${membership.id}`}>{displayName}</span>
            {device.isVm && <span className="ouchi-vm-badge">VM</span>}
            {sameDevice && selected && (
              <span className="ouchi-same-device-badge">同一デバイス</span>
            )}
          </span>
          <span className="ouchi-node-address">
            {membership.ip || "IP未登録"}
            {petname ? ` / ${device.name}` : ""}
            {` / ${DEVICE_CATEGORY_LABELS[device.category]}`}
          </span>
        </button>
        <div className="ouchi-node-header-side">
          <RelationBadges visual={visual} />
        </div>
      </header>

      {services.length === 0 ? (
        <p className="ouchi-node-empty">サービス未登録</p>
      ) : (
        <div className="ouchi-service-grid">
          {services.map((service) => (
            <ServiceTile
              key={service.id}
              membership={membership}
              service={service}
              demoMode={demoMode}
              iconBaseUrl={iconBaseUrl}
              allowRemoteIcons={allowRemoteIcons}
              onDemoClick={onDemoServiceClick}
            />
          ))}
        </div>
      )}

    </article>
  );
}
