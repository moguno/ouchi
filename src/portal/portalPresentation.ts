import type {
  PortalDevice,
  PortalRelation,
  PortalService,
} from "./types";

export interface DeviceVisual {
  mode: "neutral" | "selected" | "related";
  color?: string;
}

export function serviceName(service: PortalService): string {
  return service.petname?.trim() || service.subdomain;
}

export function deviceName(device: PortalDevice): string {
  return device.petname?.trim() || device.name;
}

export function relationTooltip(relation: PortalRelation): string {
  return relation.relationName;
}

export function deviceVisual(
  deviceId: string,
  selectedDeviceId: string | undefined,
  relations: PortalRelation[],
): DeviceVisual {
  if (!selectedDeviceId) {
    return { mode: "neutral" };
  }
  if (deviceId === selectedDeviceId) {
    return { mode: "selected" };
  }

  // Only interface relations relate devices on card selection;
  // tile relations stay invisible until the tile itself is chosen.
  const related = relations.filter(
    (relation) =>
      !relation.fromServiceId &&
      !relation.toServiceId &&
      ((relation.fromDeviceId === selectedDeviceId &&
        relation.toDeviceId === deviceId) ||
        (relation.toDeviceId === selectedDeviceId &&
          relation.fromDeviceId === deviceId)),
  );
  if (related.length > 0) {
    return {
      mode: "related",
      color: related[0].color,
    };
  }
  return { mode: "neutral" };
}
