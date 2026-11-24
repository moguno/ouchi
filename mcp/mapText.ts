import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiInterface,
  PortalApiRelation,
  PortalApiService,
} from "../src/portal/types";

type RelationTraversal = {
  relation: PortalApiRelation;
  traversalDepth: number;
  viaDeviceId: number;
  direction: "outgoing" | "incoming";
  directionLabel: string;
};

function deviceLabel(device: PortalApiDevice): string {
  const petname = device.petname ? ` / ${device.petname}` : "";
  return (
    `${device.hostname}${petname} (id=${device.id}, ` +
    `category=${device.category}, ` +
    `properties=${JSON.stringify(device.properties ?? {})})`
  );
}

function networkLabel(
  network: PortalApiData["networks"][number],
): string {
  const cidr = network.cidr ? `, ${network.cidr}` : "";
  return `${network.name} (id=${network.id}, accent=${network.accent}${cidr})`;
}

function interfaceSuffix(iface: PortalApiInterface): string {
  const ip = iface.ip ? iface.ip : "(IPなし)";
  const mac = iface.mac ? `, mac=${iface.mac}` : "";
  return `${iface.name}: ${ip}${mac}, interfaceId=${iface.id}`;
}

function serviceLine(service: PortalApiService): string {
  const petname = service.petname ? ` / ${service.petname}` : "";
  const description = service.description ? ` — ${service.description}` : "";
  const url = service.url ?? "(URL未解決)";
  return (
    `${service.subdomain}${petname} (id=${service.id}, ` +
    `${service.scheme}:${service.port}${service.topPath ?? ""}, ` +
    `url=${url}, properties=${JSON.stringify(service.properties ?? {})})` +
    description
  );
}

function relationLine(
  data: PortalApiData,
  relation: PortalApiRelation,
): string {
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const from = deviceById.get(relation.fromDeviceId)?.hostname ?? "?";
  const to = deviceById.get(relation.toDeviceId)?.hostname ?? "?";
  const fromLabel = relation.fromLabel || relation.relationName;
  const toLabel = relation.toLabel || relation.relationName;
  return (
    `${from}:${relation.fromInterfaceName} --[${fromLabel}]--> ` +
    `${to}:${relation.toInterfaceName} ` +
    `[relationName=${relation.relationName}, color=${relation.color}, ` +
    `fromLabel=${fromLabel}, toLabel=${toLabel}, ` +
    `id=${relation.id}]`
  );
}

function relatedServiceMap(
  interfaces: PortalApiInterface[],
  services: PortalApiService[],
): Map<number, PortalApiService[]> {
  const servicesByInterface = new Map<number, PortalApiService[]>();
  for (const service of services) {
    const list =
      servicesByInterface.get(service.interfaceId) ?? [];
    list.push(service);
    servicesByInterface.set(service.interfaceId, list);
  }
  return servicesByInterface;
}

function hierarchyLines(data: PortalApiData): string[] {
  const interfacesByNetwork = new Map<number, PortalApiInterface[]>();
  const unnetworkedInterfaces: PortalApiInterface[] = [];
  for (const iface of data.devices.flatMap((device) => device.interfaces)) {
    if (iface.networkId === null) {
      unnetworkedInterfaces.push(iface);
      continue;
    }
    const list = interfacesByNetwork.get(iface.networkId) ?? [];
    list.push(iface);
    interfacesByNetwork.set(iface.networkId, list);
  }
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const servicesByInterface = relatedServiceMap(
    data.devices.flatMap((device) => device.interfaces),
    data.services,
  );
  const lines = ["networks:"];
  for (const network of data.networks) {
    lines.push(`- ${networkLabel(network)}`);
    const interfaces = interfacesByNetwork.get(network.id) ?? [];
    if (interfaces.length === 0) {
      lines.push("  devices: (なし)");
      continue;
    }
    lines.push("  devices:");
    for (const iface of interfaces) {
      const device = deviceById.get(iface.deviceId);
      if (!device) {
        continue;
      }
      lines.push(
        `  - ${deviceLabel(device)} ` +
          `[interface: ${interfaceSuffix(iface)}]`,
      );
      const services = servicesByInterface.get(iface.id) ?? [];
      if (services.length === 0) {
        lines.push("    services: (なし)");
      } else {
        lines.push("    services:");
        for (const service of services) {
          lines.push(`    - ${serviceLine(service)}`);
        }
      }
    }
  }
  if (unnetworkedInterfaces.length > 0) {
    lines.push("interfaces without network:");
    for (const iface of unnetworkedInterfaces) {
      const device = deviceById.get(iface.deviceId);
      if (!device) {
        continue;
      }
      lines.push(
        `- ${deviceLabel(device)} [interface: ${interfaceSuffix(iface)}]`,
      );
    }
  }
  return lines;
}

function collectRelationTraversal(
  data: PortalApiData,
  startDeviceId: number,
  depth: number,
): {
  deviceDepths: Map<number, number>;
  traversals: RelationTraversal[];
} {
  const normalizedDepth =
    Number.isInteger(depth) && depth >= 0 ? depth : 1;
  const relations = data.relations;
  const deviceDepths = new Map<number, number>([[startDeviceId, 0]]);
  const traversals = new Map<number, RelationTraversal>();
  const queue: Array<{ deviceId: number; currentDepth: number }> = [
    { deviceId: startDeviceId, currentDepth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.currentDepth >= normalizedDepth) {
      continue;
    }
    for (const relation of relations) {
      const isOutgoing = relation.fromDeviceId === current.deviceId;
      const isIncoming = relation.toDeviceId === current.deviceId;
      if (!isOutgoing && !isIncoming) {
        continue;
      }
      const relatedDeviceId = isOutgoing
        ? relation.toDeviceId
        : relation.fromDeviceId;
      const direction = isOutgoing ? "outgoing" : "incoming";
      const directionLabel = (isOutgoing
        ? relation.fromLabel
        : relation.toLabel) || relation.relationName;
      const existingTraversal = traversals.get(relation.id);
      const traversalDepth = current.currentDepth + 1;
      if (
        !existingTraversal ||
        traversalDepth < existingTraversal.traversalDepth
      ) {
        traversals.set(relation.id, {
          relation,
          traversalDepth,
          viaDeviceId: current.deviceId,
          direction,
          directionLabel,
        });
      }
      if (!deviceDepths.has(relatedDeviceId)) {
        deviceDepths.set(relatedDeviceId, traversalDepth);
        queue.push({
          deviceId: relatedDeviceId,
          currentDepth: traversalDepth,
        });
      }
    }
  }

  return {
    deviceDepths,
    traversals: [...traversals.values()].sort(
      (left, right) =>
        left.traversalDepth - right.traversalDepth ||
        left.relation.id - right.relation.id,
    ),
  };
}

function neighborhoodLines(
  data: PortalApiData,
  startDeviceId: number,
  depth: number,
): string[] {
  const startDevice = data.devices.find(
    (device) => device.id === startDeviceId,
  );
  if (!startDevice) {
    throw new Error(`デバイスID ${startDeviceId} が見つかりません`);
  }
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const traversal = collectRelationTraversal(data, startDeviceId, depth);
  const deviceServices = data.services.filter((service) => {
    const iface = data.devices
      .flatMap((device) => device.interfaces)
      .find((item) => item.id === service.interfaceId);
    return (
      iface !== undefined &&
      traversal.deviceDepths.has(iface.deviceId)
    );
  });
  const lines = [
    `device neighborhood: ${deviceLabel(startDevice)}`,
    `depth: ${depth}`,
    "devices:",
  ];
  for (const [deviceId, deviceDepth] of [...traversal.deviceDepths.entries()]
    .sort((left, right) => left[1] - right[1] || left[0] - right[0])) {
    const device = deviceById.get(deviceId);
    if (device) {
      lines.push(`- depth=${deviceDepth}: ${deviceLabel(device)}`);
    }
  }
  lines.push("services:");
  if (deviceServices.length === 0) {
    lines.push("- (なし)");
  } else {
    for (const service of deviceServices) {
      lines.push(`- ${serviceLine(service)}`);
    }
  }
  lines.push("traversed relations:");
  if (traversal.traversals.length === 0) {
    lines.push("- (なし)");
  } else {
    for (const item of traversal.traversals) {
      const via =
        deviceById.get(item.viaDeviceId)?.hostname ?? String(item.viaDeviceId);
      lines.push(
        `- depth=${item.traversalDepth} from=${via} ` +
          `direction=${item.direction} label=${item.directionLabel} ` +
          relationLine(data, item.relation),
      );
    }
  }
  return lines;
}

export function generateNetworkMapText(
  data: PortalApiData,
  focus?: { deviceId: number; depth: number },
): string {
  const lines = [
    `ouchi.local ledger: ${data.settings.title}`,
    `format-version: ${data.version}`,
    ...hierarchyLines(data),
    "relations:",
  ];
  if (data.relations.length === 0) {
    lines.push("- (なし)");
  } else {
    for (const relation of data.relations) {
      lines.push(`- ${relationLine(data, relation)}`);
    }
  }
  if (focus) {
    lines.push("", ...neighborhoodLines(data, focus.deviceId, focus.depth));
  }
  return lines.join("\n");
}

export function generateDeviceNeighborhoodText(
  data: PortalApiData,
  deviceId: number,
  depth: number,
): string {
  return neighborhoodLines(data, deviceId, depth).join("\n");
}

export function deviceRelationTags(
  relations: PortalApiRelation[],
  deviceId: number,
): string[] {
  return [
    ...new Set(
      relations
        .filter(
          (relation) =>
            relation.fromDeviceId === deviceId ||
            relation.toDeviceId === deviceId,
        )
        .map((relation) => relation.relationName),
    ),
  ];
}
