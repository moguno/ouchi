import type { PortalNetwork } from "./types";

/**
 * Networks display in their stored order (sortOrder, assigned by the
 * API from the networks table or by array position in a YAML ledger).
 * Entries without an order keep their relative input position.
 */
export function sortNetworksForDisplay(
  networks: PortalNetwork[],
): PortalNetwork[] {
  return networks
    .map((network, index) => ({ network, index }))
    .sort((a, b) => {
      const orderA = a.network.sortOrder ?? a.index * 10;
      const orderB = b.network.sortOrder ?? b.index * 10;
      return orderA - orderB || a.index - b.index;
    })
    .map(({ network }) => network);
}
