import type { PortalNetwork } from "./types";

function isInternetNetwork(network: PortalNetwork) {
  return network.id === "internet" || network.name.trim() === "インターネット";
}

export function sortNetworksForDisplay(
  networks: PortalNetwork[],
): PortalNetwork[] {
  return [
    ...networks.filter((network) => !isInternetNetwork(network)),
    ...networks.filter(isInternetNetwork),
  ];
}
