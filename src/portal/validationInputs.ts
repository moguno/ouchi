import type {
  PortalDataV2,
  PortalDevice,
  PortalInterface,
  PortalNetwork,
  PortalRelation,
  PortalRelationNameInput,
  PortalService,
  ValidationIssue,
} from "./types";
import {
  isIconKey,
  isPort,
  isProtocol,
  isScheme,
  relationPortIssues,
} from "./validationCore";
import {
  accentColorIssue,
  isCidr,
  isHttpPath,
  isHttpUrl,
  isIpWithinCidr,
  isIpv4,
  lineEndpointShapeIssue,
  relationColorIssue,
  relationLabelIssues,
} from "./validationFormats";
import { validatePropertiesPayload } from "./validationProperties";
import { validateDevice } from "./validationEntities";

export function validateNetworkInput(
  input: Pick<PortalNetwork, "name" | "cidr" | "accent">,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "ネットワーク名を入力してください" });
  }

  const accentIssue = accentColorIssue(input.accent, "accent");
  if (accentIssue) {
    issues.push(accentIssue);
  }

  const cidr = input.cidr?.trim();
  if (cidr && !isCidr(cidr)) {
    issues.push({ path: "cidr", message: "CIDRの形式が不正です" });
  }

  if (
    data.networks.some(
      (network) =>
        network.id !== editingId &&
        cidr &&
        network.cidr?.trim() === cidr,
    )
  ) {
    issues.push({ path: "cidr", message: "同じCIDRが登録されています" });
  }

  if (cidr && isCidr(cidr)) {
    const invalidInterface = data.interfaces.find(
      (iface) =>
        iface.networkId === editingId &&
        !isIpWithinCidr(iface.ip, cidr),
    );
    if (invalidInterface) {
      issues.push({
        path: "cidr",
        message: `既存IP ${invalidInterface.ip} が範囲外になります`,
      });
    }
  }

  return issues;
}

export function validateDeviceInput(
  input: Pick<
    PortalDevice,
    | "name"
    | "petname"
    | "category"
    | "ssh"
    | "resources"
    | "meterEnabled"
    | "properties"
  >,
  editingId: string | undefined,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "デバイス名を入力してください" });
  }

  const candidate = {
    id: editingId ?? "__candidate__",
    ...input,
  };
  issues.push(...validateDevice(candidate, 0).filter((issue) =>
    !issue.message.includes("ID"),
  ));
  if (input.category === "service" && input.meterEnabled) {
    issues.push({
      path: "meterEnabled",
      message: "サービスカテゴリーではSSHメーターを有効にできません",
    });
  }

  if (
    data.devices.some(
      (device) =>
        device.id !== editingId &&
        device.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    )
  ) {
    issues.push({
      path: "name",
      message: "同じ名前のデバイスが登録されています",
    });
  }
  return issues;
}

export function validateInterfaceInput(
  input: Pick<PortalInterface, "name" | "networkId" | "ip">,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({
      path: "name",
      message: "インターフェース名を入力してください",
    });
  }
  const network =
    input.networkId === null || input.networkId === undefined
      ? undefined
      : data.networks.find((item) => item.id === input.networkId);
  if (
    input.networkId !== null &&
    input.networkId !== undefined &&
    !network
  ) {
    issues.push({
      path: "networkId",
      message: "所属ネットワークを選択してください",
    });
  }
  const normalizedIp = input.ip.trim();
  if (normalizedIp && !isIpv4(normalizedIp)) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }
  if (
    normalizedIp &&
    data.interfaces.some(
      (iface) => iface.id !== editingId && iface.ip === normalizedIp,
    )
  ) {
    issues.push({ path: "ip", message: "同じIPが登録されています" });
  }
  if (
    network?.cidr &&
    normalizedIp &&
    isIpv4(normalizedIp) &&
    !isIpWithinCidr(normalizedIp, network.cidr)
  ) {
    issues.push({
      path: "ip",
      message: `IPは ${network.cidr} の範囲内で入力してください`,
    });
  }
  return issues;
}

export function validateRelationInput(
  input: Pick<
    PortalRelation,
    | "relationName"
    | "fromInterfaceId"
    | "toInterfaceId"
    | "fromServiceId"
    | "toServiceId"
    | "fromLabel"
    | "toLabel"
  > &
    Partial<Pick<PortalRelation, "port" | "protocol">>,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const resolve = (side: "from" | "to") => {
    const sideLabel = side === "from" ? "関係元" : "関係先";
    const serviceId = input[`${side}ServiceId`];
    if (serviceId) {
      const service = data.services.find(
        (candidate) => candidate.id === serviceId,
      );
      if (!service) {
        issues.push({
          path: `${side}ServiceId`,
          message: `${sideLabel}サービスを選択してください`,
        });
        return undefined;
      }
      const host = data.interfaces.find(
        (iface) => iface.id === service.interfaceId,
      );
      return { kind: "service" as const, id: service.id, deviceId: host?.deviceId };
    }
    const interfaceId = input[`${side}InterfaceId`];
    const iface = interfaceId
      ? data.interfaces.find((candidate) => candidate.id === interfaceId)
      : undefined;
    if (!iface) {
      issues.push({
        path: `${side}InterfaceId`,
        message: `${sideLabel}インターフェースを選択してください`,
      });
      return undefined;
    }
    return { kind: "interface" as const, id: iface.id, deviceId: iface.deviceId };
  };
  const fromEndpoint = resolve("from");
  const toEndpoint = resolve("to");
  if (fromEndpoint && toEndpoint) {
    if (
      fromEndpoint.kind === toEndpoint.kind &&
      fromEndpoint.id === toEndpoint.id
    ) {
      issues.push({
        path:
          fromEndpoint.kind === "service" ? "toServiceId" : "toInterfaceId",
        message:
          fromEndpoint.kind === "service"
            ? "同じサービス自身へ関係は定義できません"
            : "同じインターフェース自身へ関係は定義できません",
      });
    } else if (
      fromEndpoint.kind === "interface" &&
      toEndpoint.kind === "interface" &&
      fromEndpoint.deviceId === toEndpoint.deviceId
    ) {
      issues.push({
        path: "toInterfaceId",
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
  }
  if (!input.relationName.trim()) {
    issues.push({
      path: "relationName",
      message: "関係名を選択してください",
    });
  }
  const relationName = data.relationNames.find(
    (candidate) => candidate.name === input.relationName.trim(),
  );
  if (input.relationName.trim() && !relationName) {
    issues.push({
      path: "relationName",
      message: "選択した関係名が存在しません",
    });
  }
  issues.push(...relationLabelIssues(input));
  issues.push(
    ...relationPortIssues(input.port, input.protocol, "port", "protocol"),
  );
  const fromLabel = (input.fromLabel ?? "").trim();
  const toLabel = (input.toLabel ?? "").trim();
  const duplicate = data.relations.find(
    (relation) =>
      relation.id !== editingId &&
      relation.relationNameId === relationName?.id &&
      relation.fromInterfaceId === (input.fromInterfaceId ?? null) &&
      relation.toInterfaceId === (input.toInterfaceId ?? null) &&
      relation.fromServiceId === (input.fromServiceId ?? null) &&
      relation.toServiceId === (input.toServiceId ?? null) &&
      (relation.fromLabel ?? "").trim() === fromLabel &&
      (relation.toLabel ?? "").trim() === toLabel &&
      (relation.port ?? null) === (input.port ?? null) &&
      (relation.protocol ?? null) === (input.protocol ?? null),
  );
  if (duplicate) {
    issues.push({
      path: "relationName",
      message:
        "同じ関係名・始点・終点・ラベル・ポートの関係はすでに登録されています",
    });
  }
  return issues;
}

export function validateRelationNameInput(
  input: Pick<
    PortalRelationNameInput,
    "name" | "color" | "lineStart" | "lineEnd"
  >,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = input.name.trim();
  if (!name) {
    issues.push({ path: "name", message: "関係名を入力してください" });
  } else if (
    data.relationNames.some(
      (relationName) =>
        relationName.id !== editingId && relationName.name === name,
    )
  ) {
    issues.push({ path: "name", message: "同じ関係名が登録されています" });
  }
  const colorIssue = relationColorIssue(input.color, "color");
  if (colorIssue) issues.push(colorIssue);
  const lineStartIssue = lineEndpointShapeIssue(
    input.lineStart,
    "lineStart",
    "始点の形",
  );
  if (lineStartIssue) issues.push(lineStartIssue);
  const lineEndIssue = lineEndpointShapeIssue(
    input.lineEnd,
    "lineEnd",
    "終点の形",
  );
  if (lineEndIssue) issues.push(lineEndIssue);
  return issues;
}

export function validateServiceInput(
  input: Pick<
    PortalService,
    | "subdomain"
    | "petname"
    | "description"
    | "interfaceId"
    | "scheme"
    | "port"
    | "protocol"
    | "topPath"
    | "monitorPath"
    | "serviceUrl"
    | "iconKey"
    | "enabled"
    | "properties"
  >,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.subdomain.trim()) {
    issues.push({
      path: "subdomain",
      message: "サブドメインを入力してください",
    });
  } else if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      input.subdomain.trim(),
    )
  ) {
    issues.push({
      path: "subdomain",
      message: "サブドメインは英数字とハイフンで入力してください",
    });
  }
  if (
    !data.interfaces.some((iface) => iface.id === input.interfaceId)
  ) {
    issues.push({
      path: "interfaceId",
      message: "配置先のインターフェースを選択してください",
    });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: "scheme", message: "スキームを選択してください" });
  }
  if (!isPort(input.port)) {
    issues.push({
      path: "port",
      message: "ポートは1〜65535で入力してください",
    });
  }
  if (!isProtocol(input.protocol)) {
    issues.push({ path: "protocol", message: "プロトコルを選択してください" });
  }
  // 空文字は「/」扱い（データモデルの既定）。ペイロード検証と揃える。
  if (input.topPath.trim() !== "" && !isHttpPath(input.topPath)) {
    issues.push({
      path: "topPath",
      message: "トップパスは / から入力してください",
    });
  }
  if (input.monitorPath.trim() !== "" && !isHttpPath(input.monitorPath)) {
    issues.push({
      path: "monitorPath",
      message: "監視パスは / から入力してください",
    });
  }
  if (input.serviceUrl && !isHttpUrl(input.serviceUrl)) {
    issues.push({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  }
  if (!isIconKey(input.iconKey)) {
    issues.push({ path: "iconKey", message: "アイコンを選択してください" });
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: "enabled", message: "有効状態が不正です" });
  }
  if (input.properties !== undefined) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}
