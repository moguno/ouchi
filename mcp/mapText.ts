import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiMembership,
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
  return `${device.hostname}${petname} (id=${device.id}, category=${device.category})`;
}

function networkLabel(
  network: PortalApiData["networks"][number],
): string {
  const cidr = network.cidr ? `, ${network.cidr}` : "";
  return `${network.name} (id=${network.id}, accent=${network.accent}${cidr})`;
}

function membershipSuffix(membership: PortalApiMembership): string {
  const ip = membership.ip ? membership.ip : "(IPなし)";
  const label = membership.label ? `, label=${membership.label}` : "";
  return `${ip}${label}, membershipId=${membership.id}`;
}

function serviceLine(service: PortalApiService): string {
  const petname = service.petname ? ` / ${service.petname}` : "";
  const description = service.description ? ` — ${service.description}` : "";
  const url = service.url ?? "(URL未解決)";
  return (
    `${service.subdomain}${petname} (id=${service.id}, ` +
    `${service.scheme}:${service.port}${service.topPath ?? ""}, ` +
    `url=${url})${description}`
  );
}

function relationLine(
  data: PortalApiData,
  relation: PortalApiRelation,
): string {
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const from = deviceById.get(relation.fromDeviceId)?.hostname ?? "?";
  const to = deviceById.get(relation.toDeviceId)?.hostname ?? "?";
  const fromLabel = relation.fromLabel ?? relation.tag;
  const toLabel = relation.toLabel ?? relation.tag;
  return (
    `${from} --[${fromLabel}]--> ${to} ` +
    `[tag=${relation.tag}, color=${relation.color}, ` +
    `fromLabel=${fromLabel}, toLabel=${toLabel}, id=${relation.id}]`
  );
}

function relatedServiceMap(
  memberships: PortalApiMembership[],
  services: PortalApiService[],
): Map<number, PortalApiService[]> {
  const servicesByMembership = new Map<number, PortalApiService[]>();
  for (const service of services) {
    const list =
      servicesByMembership.get(service.deviceNetworkId) ?? [];
    list.push(service);
    servicesByMembership.set(service.deviceNetworkId, list);
  }
  return servicesByMembership;
}

function hierarchyLines(data: PortalApiData): string[] {
  const membershipsByNetwork = new Map<number, PortalApiMembership[]>();
  for (const membership of data.devices.flatMap(
    (device) => device.memberships,
  )) {
    const list = membershipsByNetwork.get(membership.networkId) ?? [];
    list.push(membership);
    membershipsByNetwork.set(membership.networkId, list);
  }
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const servicesByMembership = relatedServiceMap(
    data.devices.flatMap((device) => device.memberships),
    data.services,
  );
  const lines = ["networks:"];
  for (const network of data.networks) {
    lines.push(`- ${networkLabel(network)}`);
    const memberships = membershipsByNetwork.get(network.id) ?? [];
    if (memberships.length === 0) {
      lines.push("  devices: (なし)");
      continue;
    }
    lines.push("  devices:");
    for (const membership of memberships) {
      const device = deviceById.get(membership.deviceId);
      if (!device) {
        continue;
      }
      lines.push(
        `  - ${deviceLabel(device)} ` +
          `[interface: ${membershipSuffix(membership)}]`,
      );
      const services = servicesByMembership.get(membership.id) ?? [];
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
      const directionLabel = isOutgoing
        ? (relation.fromLabel ?? relation.tag)
        : (relation.toLabel ?? relation.tag);
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
    const membership = data.devices
      .flatMap((device) => device.memberships)
      .find((item) => item.id === service.deviceNetworkId);
    return (
      membership !== undefined &&
      traversal.deviceDepths.has(membership.deviceId)
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
        .map((relation) => relation.tag),
    ),
  ];
}
