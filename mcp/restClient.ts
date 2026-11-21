import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiMembership,
  PortalApiNetwork,
  PortalApiRelation,
  PortalApiService,
  PortalDeviceInput,
  PortalMembershipInput,
  PortalNetworkInput,
  PortalRelationInput,
  PortalServiceInput,
} from "../src/portal/types";

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class RestApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly path: string;

  constructor(path: string, status: number, body: unknown) {
    super(`REST API ${status}: ${path}`);
    this.name = "RestApiError";
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export class LedgerRestClient {
  readonly baseUrl: string;
  readonly fetchImpl: FetchImplementation;

  constructor(
    baseUrl: string,
    fetchImpl: FetchImplementation = globalThis.fetch,
  ) {
    this.baseUrl = withoutTrailingSlash(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json, application/yaml, text/yaml",
        ...init?.headers,
      },
    });
    const body = await responseBody(response);
    if (!response.ok) {
      throw new RestApiError(path, response.status, body);
    }
    return body as T;
  }

  private async write<T>(
    method: "POST" | "PUT",
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.request<T>(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  getPortalData(): Promise<PortalApiData> {
    return this.request<PortalApiData>("/api/portal");
  }

  listNetworks(): Promise<PortalApiNetwork[]> {
    return this.request<PortalApiNetwork[]>("/api/networks");
  }

  async getNetwork(id: number): Promise<PortalApiNetwork | undefined> {
    return (await this.listNetworks()).find((network) => network.id === id);
  }

  createNetwork(input: PortalNetworkInput): Promise<PortalApiNetwork> {
    return this.write("POST", "/api/networks", input);
  }

  updateNetwork(
    id: number,
    input: PortalNetworkInput,
  ): Promise<PortalApiNetwork> {
    return this.write("PUT", `/api/networks/${id}`, input);
  }

  deleteNetwork(id: number): Promise<{ ok: true }> {
    return this.request(`/api/networks/${id}`, { method: "DELETE" });
  }

  listDevices(): Promise<PortalApiDevice[]> {
    return this.request<PortalApiDevice[]>("/api/devices");
  }

  async getDevice(id: number): Promise<PortalApiDevice | undefined> {
    return (await this.listDevices()).find((device) => device.id === id);
  }

  createDevice(input: PortalDeviceInput): Promise<PortalApiDevice> {
    return this.write("POST", "/api/devices", input);
  }

  updateDevice(
    id: number,
    input: PortalDeviceInput,
  ): Promise<PortalApiDevice> {
    return this.write("PUT", `/api/devices/${id}`, input);
  }

  deleteDevice(id: number): Promise<{ ok: true }> {
    return this.request(`/api/devices/${id}`, { method: "DELETE" });
  }

  listMemberships(): Promise<PortalApiMembership[]> {
    return this.request<PortalApiMembership[]>("/api/memberships");
  }

  async getMembership(
    id: number,
  ): Promise<PortalApiMembership | undefined> {
    return (await this.listMemberships()).find(
      (membership) => membership.id === id,
    );
  }

  createMembership(
    input: PortalMembershipInput,
  ): Promise<PortalApiMembership> {
    return this.write("POST", "/api/memberships", input);
  }

  updateMembership(
    id: number,
    input: PortalMembershipInput,
  ): Promise<PortalApiMembership> {
    return this.write("PUT", `/api/memberships/${id}`, input);
  }

  deleteMembership(id: number): Promise<{ ok: true }> {
    return this.request(`/api/memberships/${id}`, { method: "DELETE" });
  }

  listServices(): Promise<PortalApiService[]> {
    return this.request<PortalApiService[]>("/api/services");
  }

  async getService(id: number): Promise<PortalApiService | undefined> {
    return (await this.listServices()).find((service) => service.id === id);
  }

  createService(input: PortalServiceInput): Promise<PortalApiService> {
    return this.write("POST", "/api/services", input);
  }

  updateService(
    id: number,
    input: PortalServiceInput,
  ): Promise<PortalApiService> {
    return this.write("PUT", `/api/services/${id}`, input);
  }

  deleteService(id: number): Promise<{ ok: true }> {
    return this.request(`/api/services/${id}`, { method: "DELETE" });
  }

  listRelations(): Promise<PortalApiRelation[]> {
    return this.request<PortalApiRelation[]>("/api/relations");
  }

  async getRelation(id: number): Promise<PortalApiRelation | undefined> {
    return (await this.listRelations()).find(
      (relation) => relation.id === id,
    );
  }

  createRelation(input: PortalRelationInput): Promise<PortalApiRelation> {
    return this.write("POST", "/api/relations", input);
  }

  updateRelation(
    id: number,
    input: PortalRelationInput,
  ): Promise<PortalApiRelation> {
    return this.write("PUT", `/api/relations/${id}`, input);
  }

  deleteRelation(id: number): Promise<{ ok: true }> {
    return this.request(`/api/relations/${id}`, { method: "DELETE" });
  }

  traverseDeviceRelations(
    id: number,
    depth: number,
  ): Promise<unknown> {
    return this.request(
      `/api/devices/${id}/relations?depth=${encodeURIComponent(depth)}`,
    );
  }

  exportYaml(): Promise<string> {
    return this.request<string>("/api/export");
  }

  importYaml(yaml: string): Promise<{
    ok: true;
    imported: Record<string, number>;
  }> {
    return this.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: yaml,
    });
  }
}
