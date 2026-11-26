import type {
  PortalDevice,
  PortalDeviceInput,
  PortalProperties,
  PortalRelation,
  PortalRelationInput,
  PortalService,
  PortalServiceInput,
} from "./types";

export function toDeviceInput(device: PortalDevice): PortalDeviceInput {
  return {
    hostname: device.name.trim(),
    petname: device.petname?.trim() || null,
    properties: device.properties ?? {},
    category: device.category,
    sshUser: device.ssh?.user || null,
    sshPort: device.ssh?.port ?? null,
    meterEnabled: device.meterEnabled ?? false,
    note: device.note || null,
  };
}

export function toRelationInput(
  relation: PortalRelation,
  properties?: PortalProperties,
): PortalRelationInput {
  const endpointId = (value: string | null) =>
    value === null ? null : Number(value);
  return {
    fromInterfaceId: endpointId(relation.fromInterfaceId),
    toInterfaceId: endpointId(relation.toInterfaceId),
    fromServiceId: endpointId(relation.fromServiceId),
    toServiceId: endpointId(relation.toServiceId),
    relationName: relation.relationName.trim(),
    fromLabel: relation.fromLabel?.trim() ?? "",
    toLabel: relation.toLabel?.trim() ?? "",
    port: relation.port,
    protocol: relation.protocol,
    ...(properties !== undefined ? { properties } : {}),
  };
}

export function toServiceInput(service: PortalService): PortalServiceInput {
  return {
    interfaceId: Number(service.interfaceId),
    subdomain: service.subdomain.trim().toLowerCase(),
    petname: service.petname || null,
    description: service.description || null,
    properties: service.properties ?? {},
    port: service.port,
    protocol: service.protocol,
    scheme: service.scheme,
    topPath: service.topPath || null,
    monitorPath: service.monitorPath || null,
    serviceUrl: service.serviceUrl || null,
    iconKey: service.iconKey,
    enabled: service.enabled,
  };
}
