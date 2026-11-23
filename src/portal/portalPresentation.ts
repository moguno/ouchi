import type {
  PortalDevice,
  PortalRelation,
  PortalService,
} from "./types";

export interface DeviceVisual {
  mode: "neutral" | "selected" | "related";
  tags: Array<{ label: string; color: string }>;
  color?: string;
}

export function serviceName(service: PortalService): string {
  return service.petname?.trim() || service.subdomain;
}

export function deviceName(device: PortalDevice): string {
  return device.petname?.trim() || device.name;
}

export function serviceDescription(service: PortalService): string {
  return service.description?.trim() || "";
}

export function relationLabelFor(
  relation: PortalRelation,
  fromPerspective: boolean,
): string {
  return fromPerspective
    ? relation.fromLabel.trim() || relation.relationName
    : relation.toLabel.trim() || relation.relationName;
}

export function relationTooltip(relation: PortalRelation): string {
  return `${relationLabelFor(relation, true)}⇒${relationLabelFor(
    relation,
    false,
  )}`;
}

export function deviceVisual(
  deviceId: string,
  selectedDeviceId: string | undefined,
  relations: PortalRelation[],
): DeviceVisual {
  if (!selectedDeviceId) {
    return { mode: "neutral", tags: [] };
  }
  if (deviceId === selectedDeviceId) {
    return { mode: "selected", tags: [] };
  }

  const related = relations.filter(
    (relation) =>
      (relation.fromDeviceId === selectedDeviceId &&
        relation.toDeviceId === deviceId) ||
      (relation.toDeviceId === selectedDeviceId &&
        relation.fromDeviceId === deviceId),
  );
  if (related.length > 0) {
    return {
      mode: "related",
      tags: related.map((relation) => ({
        label: relationLabelFor(
          relation,
          relation.fromDeviceId !== selectedDeviceId,
        ),
        color: relation.color,
      })),
      color: related[0].color,
    };
  }
  return { mode: "neutral", tags: [] };
}
