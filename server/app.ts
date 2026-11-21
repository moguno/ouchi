import { Hono, type Context } from "hono";
import type {
  PortalDeviceInput,
  PortalMembershipInput,
  PortalNetworkInput,
  PortalRelationInput,
  PortalServiceInput,
  ValidationIssue,
} from "../src/portal/types";
import {
  isIpWithinCidr,
  validateDevicePayload,
  validateMembershipPayload,
  validateNetworkPayload,
  validateRelationPayload,
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
      database: "sqlite-v0.4",
    }),
  );

  app.get("/api/portal", (context) =>
    context.json(database.getPortalData()),
  );

  app.get("/api/export", (context) => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    return context.body(exportLedgerYaml(database.database), 200, {
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

  app.get("/api/settings", (context) =>
    context.json(database.getSettings()),
  );

  app.put("/api/settings", async (context) => {
    const input = await jsonBody(context);
    const issues = validateSettingsPayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    return context.json(
      database.updateSettings((input as { title: string }).title),
    );
  });

  app.get("/api/networks", (context) =>
    context.json(database.listNetworks()),
  );

  app.post("/api/networks", async (context) => {
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
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

  app.put("/api/networks/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
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
    if (blockers.memberships > 0) {
      const failure = conflict(
        "紐づく所属が残っているためネットワークを削除できません",
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

  app.post("/api/devices", async (context) => {
    const input = await jsonBody(context);
    const issues = validateDevicePayload(input);
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
      existingDevice.memberships.some((membership) => membership.ip)
    ) {
      const failure = invalid([
        {
          path: "category",
          message:
            "サービスカテゴリーへ変更する前に所属IPを空にしてください",
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
    const blockers = database.deviceDeletionBlockers(id);
    if (blockers.services > 0 || blockers.relations > 0) {
      const failure = conflict(
        blockers.services > 0
          ? "紐づくサービスが残っているためデバイスを削除できません"
          : "紐づく関係が残っているためデバイスを削除できません",
        { blockers },
      );
      return context.json(failure.body, failure.status);
    }
    return database.deleteDevice(id)
      ? context.json({ ok: true })
      : context.json({ error: "デバイスが見つかりません" }, 404);
  });

  app.get("/api/memberships", (context) =>
    context.json(database.listMemberships()),
  );

  const membershipIssues = (
    input: unknown,
    existingId?: number,
  ): ValidationIssue[] => {
    const issues = validateMembershipPayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalMembershipInput;
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
        message: "サービスカテゴリーの所属IPはNULLにしてください",
      });
    }
    const network = database.getNetwork(value.networkId);
    if (!network) {
      issues.push({ path: "networkId", message: "ネットワークが存在しません" });
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
    if (
      existingId &&
      !database.getMembership(existingId)
    ) {
      issues.push({ path: "id", message: "所属が見つかりません" });
    }
    return issues;
  };

  app.post("/api/memberships", async (context) => {
    const input = await jsonBody(context);
    const issues = membershipIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database.createMembership(input as PortalMembershipInput),
        201,
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.put("/api/memberships/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = membershipIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const membership = database.updateMembership(
        id,
        input as PortalMembershipInput,
      );
      return membership
        ? context.json(membership)
        : context.json({ error: "所属が見つかりません" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });

  app.delete("/api/memberships/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const serviceCount = database.membershipServiceCount(id);
    if (serviceCount > 0) {
      const failure = conflict(
        "サービスが紐づいているため所属を削除できません",
        { blockers: { services: serviceCount } },
      );
      return context.json(failure.body, failure.status);
    }
    return database.deleteMembership(id)
      ? context.json({ ok: true })
      : context.json({ error: "所属が見つかりません" }, 404);
  });

  app.get("/api/services", (context) =>
    context.json(database.listServices()),
  );

  const serviceIssues = (
    input: unknown,
    existingId?: number,
  ): ValidationIssue[] => {
    const issues = validateServicePayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalServiceInput;
    if (!database.getMembership(value.deviceNetworkId)) {
      issues.push({
        path: "deviceNetworkId",
        message: "所属が見つかりません",
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

  const relationIssues = (input: unknown): ValidationIssue[] => {
    const issues = validateRelationPayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input as PortalRelationInput;
    if (!database.getDevice(value.fromDeviceId)) {
      issues.push({
        path: "fromDeviceId",
        message: "関係元デバイスが存在しません",
      });
    }
    if (!database.getDevice(value.toDeviceId)) {
      issues.push({
        path: "toDeviceId",
        message: "関係先デバイスが存在しません",
      });
    }
    const canonicalColor = database.canonicalTagColor(value.tag);
    if (canonicalColor && canonicalColor !== value.color.trim()) {
      issues.push({
        path: "color",
        message:
          `タグ「${value.tag.trim()}」の色は` +
          `「${canonicalColor}」に固定されています`,
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

  app.put("/api/relations/tags/:tag/color", async (context) => {
    const tag = context.req.param("tag").trim();
    if (!tag) {
      return context.json(
        { issues: [{ path: "tag", message: "タグ名は必須です" }] },
        400,
      );
    }
    const input = await jsonBody(context);
    if (
      typeof input !== "object" ||
      input === null ||
      !("color" in input) ||
      typeof input.color !== "string" ||
      input.color.trim() === "" ||
      [...input.color.trim()].length > 100
    ) {
      return context.json(
        {
          issues: [
            {
              path: "color",
              message: "関係色は1〜100文字で入力してください",
            },
          ],
        },
        400,
      );
    }
    const updated = database.recolorTag(tag, input.color);
    return updated.updated > 0
      ? context.json(updated)
      : context.json({ error: "タグを持つ関係が見つかりません" }, 404);
  });

  app.put("/api/relations/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const input = await jsonBody(context);
    const issues = relationIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    const relation = database.updateRelation(
      id,
      input as PortalRelationInput,
    );
    return relation
      ? context.json(relation)
      : context.json({ error: "関係が見つかりません" }, 404);
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

  app.get("/api/devices/:id/meters", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "IDが不正です" }, 400);
    }
    const device = database.getDevice(id);
    if (!device) {
      return context.json({ error: "デバイスが見つかりません" }, 404);
    }
    return context.json({
      deviceId: id,
      memoryPercent: null,
      diskPercent: null,
      collectedAt: null,
      available: false,
    });
  });

  app.notFound((context) =>
    context.json({ error: "APIエンドポイントが見つかりません" }, 404),
  );

  return app;
}
