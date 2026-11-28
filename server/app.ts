import { Hono, type Context } from "hono";
import type {
  PortalDeviceInput,
  PortalInterfaceInput,
  PortalNetworkInput,
  PortalProjectInput,
  PortalProperties,
  PortalRelationInput,
  PortalRelationNameInput,
  PortalServiceInput,
  ValidationIssue,
} from "../src/portal/types";
import {
  isIpWithinCidr,
  validateDevicePayload,
  validateInterfacePayload,
  validateNetworkPayload,
  validateProjectPayload,
  validateRelationPayload,
  validateRelationNamePayload,
  validateServicePayload,
  validateSettingsPayload,
} from "../src/portal/validation";
import { PortalDatabase } from "./db";
import {
  exportLedgerYaml,
  importLedgerYaml,
  LedgerValidationError,
} from "./ledgerTransfer";

function parseId(value: string): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

async function jsonBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function invalid(issues: ValidationIssue[]) {
  return {
    status: 400 as const,
    body: { issues },
  };
}

function conflict(message: string, details?: Record<string, unknown>) {
  return {
    status: 409 as const,
    body: { error: message, ...details },
  };
}

function databaseConflict(error: unknown): {
  status: 409;
  body: { error: string; detail?: string };
} {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) {
    return {
      status: 409,
      body: { error: "一意制約に違反しています", detail: message },
    };
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return {
      status: 409,
      body: { error: "参照中のデータがあるため変更できません" },
    };
  }
  return {
    status: 409,
    body: { error: "データベース制約により保存できません" },
  };
}

export function createApp(
  database: PortalDatabase,
) {
  const app = new Hono();

  app.get("/api/health", (context) =>
    context.json({
      ok: true,
      service: "ouchi.local",
    }),
  );

  app.get("/api/portal", (context) =>
    context.json(database.getPortalData()),
  );

  app.get("/api/export", (context) => {
    // Exports are per project: ?project=<id> picks the project,
    // omitted exports the first project.
    const projectParam = context.req.query("project");
    let projectId: number | undefined;
    if (projectParam !== undefined) {
      const parsed = Number(projectParam);
      if (!Number.isInteger(parsed) || !database.getProject(parsed)) {
        return context.json(
          {
            issues: [
              {
                path: "project",
                message: "プロジェクトが存在しません",
              },
            ],
          },
          404,
        );
      }
      projectId = parsed;
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    return context.body(
      exportLedgerYaml(database.database, new Date(), projectId),
      200,
      {
      "Content-Type": "application/yaml; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="ouchi-ledger-${timestamp}.yaml"`,
      "Cache-Control": "no-store",
    });
  });

  app.post("/api/import", async (context) => {
    const yaml = await context.req.text();
    try {
      const imported = importLedgerYaml(database.database, yaml);
      return context.json({ ok: true, imported });
    } catch (error) {
      if (error instanceof LedgerValidationError) {
        return context.json({ issues: error.issues }, 400);
      }
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  // A well-formed projectId must name an existing project. Malformed
  // values (non-integer etc.) are already flagged by the shared
  // payload validators; this adds the existence check.
  const projectExistenceIssues = (input: unknown): ValidationIssue[] => {
    if (typeof input !== "object" || input === null) {
      return [];
    }
    const projectId = (input as { projectId?: unknown }).projectId;
    if (
      typeof projectId === "number" &&
      Number.isInteger(projectId) &&
      projectId > 0 &&
      !database.getProject(projectId)
    ) {
      return [
        { path: "projectId", message: "プロジェクトが存在しません" },
      ];
    }
    return [];
  };

  app.get("/api/settings", (context) =>
    context.json(database.getSettings()),
  );

  app.get("/api/projects", (context) =>
    context.json(database.listProjects()),
  );

  app.get("/api/projects/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const project = database.getProject(id);
    return project
      ? context.json(project)
      : context.json({ error: "プロジェクトが見つかりません" }, 404);
  });

  const projectIssues = (
    input: unknown,
    editingId?: number,
  ): ValidationIssue[] => {
    const issues = validateProjectPayload(input);
    if (
      issues.length > 0 ||
      typeof input !== "object" ||
      input === null
    ) {
      return issues;
    }
    const value = input as PortalProjectInput;
    const duplicate = database.findProject(value.name);
    if (duplicate && duplicate.id !== editingId) {
      issues.push({
        path: "name",
        message: "同じプロジェクト名が登録されています",
      });
    }
    if (editingId && !database.getProject(editingId)) {
      issues.push({ path: "id", message: "プロジェクトが見つかりません" });
    }
    return issues;
  };

  app.post("/api/projects", async (context) => {
    const input = await jsonBody(context);
    const issues = projectIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createProject(input as PortalProjectInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/projects/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = projectIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const project = database.updateProject(
        id,
        input as PortalProjectInput,
      );
      return project
        ? context.json(project)
        : context.json({ error: "プロジェクトが見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/projects/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    return database.deleteProject(id)
      ? context.json({ ok: true })
      : context.json({ error: "プロジェクトが見つかりません" }, 404);
  });

  app.put("/api/settings", async (context) => {
    const input = await jsonBody(context);
    const issues = validateSettingsPayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    const settingsInput = input as {
      title: string;
      properties?: PortalProperties;
    };
    return context.json(
      Object.hasOwn(settingsInput, "properties")
        ? database.updateSettings(
            settingsInput.title,
            settingsInput.properties,
          )
        : database.updateSettings(settingsInput.title),
    );
  });

  app.get("/api/networks", (context) =>
    context.json(database.listNetworks()),
  );

  app.post("/api/networks", async (context) => {
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createNetwork(input as PortalNetworkInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/networks/order", async (context) => {
    const input = await jsonBody(context);
    const ids = (input as { ids?: unknown })?.ids;
    if (
      !Array.isArray(ids) ||
      !ids.every(
        (id) => typeof id === "number" && Number.isInteger(id) && id > 0,
      )
    ) {
      return context.json(
        { error: "並び順の指定が不正です" },
        400,
      );
    }
    const networks = database.reorderNetworks(ids as number[]);
    return networks
      ? context.json(networks)
      : context.json(
          { error: "並び順には全ネットワークを指定してください" },
          400,
        );
  });

  app.put("/api/networks/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const network = database.updateNetwork(id, input as PortalNetworkInput);
      return network
        ? context.json(network)
        : context.json({ error: "ネットワークが見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/networks/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const blockers = database.networkDeletionBlockers(id);
    if (blockers.interfaces > 0) {
      const failure = conflict(
        "紐づくインターフェースが残っているためネットワークを削除できません",
        { blockers },
      );
      return context.json(failure.body, failure.status);
    }
    return database.deleteNetwork(id)
      ? context.json({ ok: true })
      : context.json({ error: "ネットワークが見つかりません" }, 404);
  });

  app.get("/api/devices", (context) =>
    context.json(database.listDevices()),
  );

  app.get("/api/devices/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const device = database.getDevice(id);
    return device
      ? context.json(device)
      : context.json({ error: "デバイスが見つかりません" }, 404);
  });

  app.post("/api/devices", async (context) => {
    const input = await jsonBody(context);
    const issues = validateDevicePayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createDevice(input as PortalDeviceInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/devices/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = validateDevicePayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    const existingDevice = database.getDevice(id);
    if (!existingDevice) {
      return context.json({ error: "デバイスが見つかりません" }, 404);
    }
    if (
      (input as PortalDeviceInput).category === "service" &&
      existingDevice.interfaces.some((iface) => iface.ip)
    ) {
      const failure = invalid([
        {
          path: "category",
          message:
            "サービスカテゴリーへ変更する前にインターフェースのIPを空にしてください",
        },
      ]);
      return context.json(failure.body, failure.status);
    }
    try {
      const device = database.updateDevice(id, input as PortalDeviceInput);
      return device
        ? context.json(device)
        : context.json({ error: "デバイスが見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/devices/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    return database.deleteDevice(id)
      ? context.json({ ok: true })
      : context.json({ error: "デバイスが見つかりません" }, 404);
  });

  app.get("/api/interfaces", (context) =>
    context.json(database.listInterfaces()),
  );

  const interfaceIssues = (
    input: unknown,
    existingId?: number,
  ): ValidationIssue[] => {
    const issues = validateInterfacePayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalInterfaceInput;
    const device = database.getDevice(value.deviceId);
    if (!device) {
      issues.push({ path: "deviceId", message: "デバイスが存在しません" });
    } else if (
      device.category === "service" &&
      typeof value.ip === "string" &&
      value.ip.trim() !== ""
    ) {
      issues.push({
        path: "ip",
        message: "サービスカテゴリーのインターフェースIPはNULLにしてください",
      });
    }
    if (value.networkId !== null && value.networkId !== undefined) {
      const network = database.getNetwork(value.networkId);
      if (!network) {
        issues.push({
          path: "networkId",
          message: "ネットワークが存在しません",
        });
      } else if (
        network.cidr &&
        value.ip?.trim() &&
        !isIpWithinCidr(value.ip.trim(), network.cidr)
      ) {
        issues.push({
          path: "ip",
          message: `IPは ${network.cidr} の範囲内で入力してください`,
        });
      }
    }
    if (
      existingId &&
      !database.getInterface(existingId)
    ) {
      issues.push({ path: "id", message: "インターフェースが見つかりません" });
    }
    return issues;
  };

  app.post("/api/interfaces", async (context) => {
    const input = await jsonBody(context);
    const issues = interfaceIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createInterface(input as PortalInterfaceInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/interfaces/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = interfaceIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const iface = database.updateInterface(
        id,
        input as PortalInterfaceInput,
      );
      return iface
        ? context.json(iface)
        : context.json({ error: "インターフェースが見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/interfaces/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const serviceCount = database.interfaceServiceCount(id);
    const relationCount = database.interfaceRelationCount(id);
    if (serviceCount > 0 || relationCount > 0) {
      const failure = conflict(
        "サービスや関係が紐づいているためインターフェースを削除できません",
        { blockers: { services: serviceCount, relations: relationCount } },
      );
      return context.json(failure.body, failure.status);
    }
    return database.deleteInterface(id)
      ? context.json({ ok: true })
      : context.json({ error: "インターフェースが見つかりません" }, 404);
  });

  app.get("/api/services", (context) =>
    context.json(database.listServices()),
  );

  app.get("/api/services/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const service = database.getService(id);
    return service
      ? context.json(service)
      : context.json({ error: "サービスが見つかりません" }, 404);
  });

  const serviceIssues = (
    input: unknown,
    existingId?: number,
  ): ValidationIssue[] => {
    const issues = validateServicePayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalServiceInput;
    if (!database.getInterface(value.interfaceId)) {
      issues.push({
        path: "interfaceId",
        message: "インターフェースが見つかりません",
      });
    }
    if (
      existingId &&
      !database.getService(existingId)
    ) {
      issues.push({ path: "id", message: "サービスが見つかりません" });
    }
    return issues;
  };

  app.post("/api/services", async (context) => {
    const input = await jsonBody(context);
    const issues = serviceIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createService(input as PortalServiceInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/services/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = serviceIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const service = database.updateService(id, input as PortalServiceInput);
      return service
        ? context.json(service)
        : context.json({ error: "サービスが見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/services/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    return database.deleteService(id)
      ? context.json({ ok: true })
      : context.json({ error: "サービスが見つかりません" }, 404);
  });

  app.get("/api/relations", (context) =>
    context.json(database.listRelations()),
  );

  app.get("/api/relation-names", (context) =>
    context.json(database.listRelationNames()),
  );

  app.get("/api/relation-names/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const relationName = database.getRelationName(id);
    return relationName
      ? context.json(relationName)
      : context.json({ error: "関係名が見つかりません" }, 404);
  });

  const relationNameIssues = (
    input: unknown,
    editingId?: number,
  ): ValidationIssue[] => {
    const issues = validateRelationNamePayload(input);
    issues.push(...projectExistenceIssues(input));
    if (
      issues.length > 0 ||
      typeof input !== "object" ||
      input === null
    ) {
      return issues;
    }
    const value = input as PortalRelationNameInput;
    const duplicate = database
      .listRelationNames()
      .find(
        (relationName) =>
          relationName.id !== editingId &&
          relationName.name === value.name.trim(),
      );
    if (duplicate) {
      issues.push({ path: "name", message: "同じ関係名が登録されています" });
    }
    if (editingId && !database.getRelationName(editingId)) {
      issues.push({ path: "id", message: "関係名が見つかりません" });
    }
    return issues;
  };

  app.post("/api/relation-names", async (context) => {
    const input = await jsonBody(context);
    const issues = relationNameIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createRelationName(input as PortalRelationNameInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/relation-names/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = relationNameIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const relationName = database.updateRelationName(
        id,
        input as PortalRelationNameInput,
      );
      return relationName
        ? context.json(relationName)
        : context.json({ error: "関係名が見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/relation-names/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    if (!database.getRelationName(id)) {
      return context.json({ error: "関係名が見つかりません" }, 404);
    }
    const blockers = database.relationNameDeletionBlocker(id);
    if (blockers.relationCount > 0) {
      const failure = conflict(
        "使用中の関係名は削除できません",
        { blockers },
      );
      return context.json(failure.body, failure.status);
    }
    return database.deleteRelationName(id)
      ? context.json({ ok: true })
      : context.json({ error: "関係名が見つかりません" }, 404);
  });

  const relationIssues = (
    input: unknown,
    editingId?: number,
  ): ValidationIssue[] => {
    const issues = validateRelationPayload(input);
    issues.push(...projectExistenceIssues(input));
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalRelationInput;
    const fromInterface = value.fromInterfaceId
      ? database.getInterface(value.fromInterfaceId)
      : undefined;
    if (value.fromInterfaceId && !fromInterface) {
      issues.push({
        path: "fromInterfaceId",
        message: "関係元のインターフェースが存在しません",
      });
    }
    if (value.fromServiceId && !database.getService(value.fromServiceId)) {
      issues.push({
        path: "fromServiceId",
        message: "関係元のサービスが存在しません",
      });
    }
    const toInterface = value.toInterfaceId
      ? database.getInterface(value.toInterfaceId)
      : undefined;
    if (value.toInterfaceId && !toInterface) {
      issues.push({
        path: "toInterfaceId",
        message: "関係先のインターフェースが存在しません",
      });
    }
    if (value.toServiceId && !database.getService(value.toServiceId)) {
      issues.push({
        path: "toServiceId",
        message: "関係先のサービスが存在しません",
      });
    }
    if (
      fromInterface &&
      toInterface &&
      fromInterface.deviceId === toInterface.deviceId
    ) {
      issues.push({
        path: "toInterfaceId",
        message: "同じデバイスのインターフェース同士は結べません",
      });
    }
    const relationName = database.findRelationName(value.relationName);
    if (!relationName) {
      issues.push({
        path: "relationName",
        message: "関係名が存在しません",
      });
    } else if (
      database.relationDuplicate(
        relationName.id,
        value.fromInterfaceId ?? null,
        value.fromServiceId ?? null,
        value.toInterfaceId ?? null,
        value.toServiceId ?? null,
        value.fromLabel?.trim() ?? "",
        value.toLabel?.trim() ?? "",
        value.port ?? null,
        value.protocol ?? null,
        editingId,
      )
    ) {
      issues.push({
        path: "relationName",
        message:
          "同じ関係名・始点・終点・ラベル・ポートの関係はすでに登録されています",
      });
    }
    return issues;
  };

  app.post("/api/relations", async (context) => {
    const input = await jsonBody(context);
    const issues = relationIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createRelation(input as PortalRelationInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.get("/api/relations/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const relation = database.getRelation(id);
    return relation
      ? context.json(relation)
      : context.json({ error: "関係が見つかりません" }, 404);
  });

  app.put("/api/relations/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = relationIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const relation = database.updateRelation(
        id,
        input as PortalRelationInput,
      );
      return relation
        ? context.json(relation)
        : context.json({ error: "関係が見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/relations/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    return database.deleteRelation(id)
      ? context.json({ ok: true })
      : context.json({ error: "関係が見つかりません" }, 404);
  });

  app.get("/api/devices/:id/relations", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const depth = Number(context.req.query("depth") ?? "1");
    if (!Number.isInteger(depth) || depth < 1) {
      return context.json(
        { issues: [{ path: "depth", message: "depthは1以上です" }] },
        400,
      );
    }
    const result = database.traverseRelations(id, depth);
    return result
      ? context.json(result)
      : context.json({ error: "デバイスが見つかりません" }, 404);
  });

  app.notFound((context) =>
    context.json({ error: "APIエンドポイントが見つかりません" }, 404),
  );

  return app;
}
