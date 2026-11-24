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
    ? relation.fromLabel.trim()
    : relation.toLabel.trim();
}

export function relationTooltip(relation: PortalRelation): string {
  return relation.relationName;
}

export function deviceVisual(
  deviceId: string,
  selectedDeviceId: string | undefined,
  relations: PortalRelation[],
  interfaceId?: string,
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
    // Endpoint labels belong to one interface of this device: a card
    // shows only the tags of relations touching its own interface.
    const tagRelations =
      interfaceId === undefined
        ? related
        : related.filter(
            (relation) =>
              (relation.fromDeviceId === deviceId
                ? relation.fromInterfaceId
                : relation.toInterfaceId) === interfaceId,
          );
    return {
      mode: "related",
      tags: tagRelations
        .map((relation) => ({
          label: relationLabelFor(
            relation,
            relation.fromDeviceId !== selectedDeviceId,
          ),
          color: relation.color,
        }))
        .filter((tag) => tag.label),
      color: related[0].color,
    };
  }
  return { mode: "neutral", tags: [] };
}
