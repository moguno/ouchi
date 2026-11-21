// server/index.ts
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolve as resolve2 } from "node:path";

// server/app.ts
import { Hono } from "hono";

// src/portal/types.ts
var PORTAL_SERVICE_SCHEMES = [
  "http",
  "https"
];
var PORTAL_DEVICE_CATEGORIES = [
  "network",
  "physical",
  "vm",
  "service"
];

// src/portal/validation.ts
var MAX_PORTAL_TITLE_LENGTH = 100;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function validateSettingsTitle(title) {
  const normalized = title.trim();
  const issues = [];
  if (!normalized) {
    issues.push({ path: "title", message: "\u30DD\u30FC\u30BF\u30EB\u30BF\u30A4\u30C8\u30EB\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" });
  }
  if (/[\r\n]/.test(title)) {
    issues.push({
      path: "title",
      message: "\u30DD\u30FC\u30BF\u30EB\u30BF\u30A4\u30C8\u30EB\u306B\u6539\u884C\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093"
    });
  }
  if ([...normalized].length > MAX_PORTAL_TITLE_LENGTH) {
    issues.push({
      path: "title",
      message: `\u30DD\u30FC\u30BF\u30EB\u30BF\u30A4\u30C8\u30EB\u306F${MAX_PORTAL_TITLE_LENGTH}\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`
    });
  }
  return issues;
}
function validateSettingsPayload(input) {
  if (!isRecord(input) || typeof input.title !== "string") {
    return [
      {
        path: "title",
        message: "\u30DD\u30FC\u30BF\u30EB\u30BF\u30A4\u30C8\u30EB\u3092\u6587\u5B57\u5217\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044"
      }
    ];
  }
  return validateSettingsTitle(input.title);
}
function parseIpv4(value) {
  const parts = value.trim().split(".");
  if (parts.length !== 4) {
    return void 0;
  }
  const octets = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return void 0;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return void 0;
    }
    octets.push(octet);
  }
  const typedOctets = octets;
  const valueAsNumber = (typedOctets[0] << 24 >>> 0) + (typedOctets[1] << 16) + (typedOctets[2] << 8) + typedOctets[3] >>> 0;
  return { octets: typedOctets, value: valueAsNumber };
}
function isIpv4(value) {
  return parseIpv4(value) !== void 0;
}
function parseCidr(value) {
  const [addressText, prefixText, ...rest] = value.trim().split("/");
  if (rest.length > 0 || !addressText || !prefixText) {
    return void 0;
  }
  if (!/^\d{1,2}$/.test(prefixText)) {
    return void 0;
  }
  const prefix = Number(prefixText);
  const address = parseIpv4(addressText);
  if (!address || prefix < 0 || prefix > 32) {
    return void 0;
  }
  const mask = prefix === 0 ? 0 : 4294967295 << 32 - prefix >>> 0;
  const networkValue = (address.value & mask) >>> 0;
  return { address, prefix, networkValue };
}
function isCidr(value) {
  return parseCidr(value) !== void 0;
}
function isIpWithinCidr(ip, cidr) {
  const ipAddress = parseIpv4(ip);
  const parsedCidr = parseCidr(cidr);
  if (!ipAddress || !parsedCidr) {
    return false;
  }
  const mask = parsedCidr.prefix === 0 ? 0 : 4294967295 << 32 - parsedCidr.prefix >>> 0;
  return (ipAddress.value & mask) >>> 0 === parsedCidr.networkValue;
}
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function isHttpPath(value) {
  return value.trim().startsWith("/");
}
function isDeviceCategory(value) {
  return typeof value === "string" && PORTAL_DEVICE_CATEGORIES.includes(value);
}
function isScheme(value) {
  return typeof value === "string" && PORTAL_SERVICE_SCHEMES.includes(value);
}
function isPort(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;
}
function isProtocol(value) {
  return value === "tcp" || value === "udp";
}
function isNullableString(value) {
  return value === null || typeof value === "string";
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function validateNetworkPayload(input) {
  if (!isRecord(input)) {
    return [{ path: "root", message: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }];
  }
  const issues = [];
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u540D\u306F\u5FC5\u9808\u3067\u3059" });
  }
  if (input.cidr !== void 0 && input.cidr !== null && input.cidr !== "" && (!isNonEmptyString(input.cidr) || !isCidr(input.cidr))) {
    issues.push({ path: "cidr", message: "CIDR\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (!isNonEmptyString(input.accent)) {
    issues.push({ path: "accent", message: "\u30A2\u30AF\u30BB\u30F3\u30C8\u8272\u306F\u5FC5\u9808\u3067\u3059" });
  }
  if (input.note !== void 0 && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "\u30E1\u30E2\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  return issues;
}
function validateDevicePayload(input) {
  if (!isRecord(input)) {
    return [{ path: "root", message: "\u30C7\u30D0\u30A4\u30B9\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }];
  }
  const issues = [];
  if (!isNonEmptyString(input.hostname)) {
    issues.push({ path: "hostname", message: "\u30DB\u30B9\u30C8\u540D\u306F\u5FC5\u9808\u3067\u3059" });
  }
  if (!isDeviceCategory(input.category)) {
    issues.push({ path: "category", message: "\u30C7\u30D0\u30A4\u30B9\u30AB\u30C6\u30B4\u30EA\u30FC\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (typeof input.isVm !== "boolean") {
    issues.push({ path: "isVm", message: "VM\u30D5\u30E9\u30B0\u304C\u4E0D\u6B63\u3067\u3059" });
  } else if (isDeviceCategory(input.category) && input.isVm !== (input.category === "vm")) {
    issues.push({
      path: "category",
      message: "\u30AB\u30C6\u30B4\u30EA\u30FC\u3068VM\u30D5\u30E9\u30B0\u304C\u4E00\u81F4\u3057\u3066\u3044\u307E\u305B\u3093"
    });
  }
  if (input.sshUser !== void 0 && !isNullableString(input.sshUser)) {
    issues.push({ path: "sshUser", message: "SSH\u30E6\u30FC\u30B6\u30FC\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (input.sshPort !== void 0 && input.sshPort !== null && !isPort(input.sshPort)) {
    issues.push({ path: "sshPort", message: "SSH\u30DD\u30FC\u30C8\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (typeof input.meterEnabled !== "boolean") {
    issues.push({ path: "meterEnabled", message: "\u30E1\u30FC\u30BF\u30FC\u8A2D\u5B9A\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (input.note !== void 0 && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "\u30E1\u30E2\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (input.category === "service" && (input.isVm === true || input.meterEnabled === true)) {
    issues.push({
      path: "category",
      message: "\u30B5\u30FC\u30D3\u30B9\u30AB\u30C6\u30B4\u30EA\u30FC\u306FVM\u30FB\u30E1\u30FC\u30BF\u30FC\u3092\u6709\u52B9\u306B\u3067\u304D\u307E\u305B\u3093"
    });
  }
  return issues;
}
function validateMembershipPayload(input) {
  if (!isRecord(input)) {
    return [{ path: "root", message: "\u6240\u5C5E\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }];
  }
  const issues = [];
  if (!isPositiveInteger(input.deviceId)) {
    issues.push({ path: "deviceId", message: "\u30C7\u30D0\u30A4\u30B9ID\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (!isPositiveInteger(input.networkId)) {
    issues.push({ path: "networkId", message: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AFID\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (input.ip !== void 0 && input.ip !== null && input.ip !== "" && (!isNonEmptyString(input.ip) || !isIpv4(input.ip))) {
    issues.push({ path: "ip", message: "IPv4\u30A2\u30C9\u30EC\u30B9\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (input.label !== void 0 && !isNullableString(input.label)) {
    issues.push({ path: "label", message: "\u6240\u5C5E\u30E9\u30D9\u30EB\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  return issues;
}
function validateRelationPayload(input) {
  if (!isRecord(input)) {
    return [{ path: "root", message: "\u95A2\u4FC2\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }];
  }
  const issues = [];
  if (!isPositiveInteger(input.fromDeviceId)) {
    issues.push({ path: "fromDeviceId", message: "\u95A2\u4FC2\u5143ID\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (!isPositiveInteger(input.toDeviceId)) {
    issues.push({ path: "toDeviceId", message: "\u95A2\u4FC2\u5148ID\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (isPositiveInteger(input.fromDeviceId) && input.fromDeviceId === input.toDeviceId) {
    issues.push({
      path: "toDeviceId",
      message: "\u540C\u3058\u30C7\u30D0\u30A4\u30B9\u81EA\u8EAB\u3078\u95A2\u4FC2\u306F\u5B9A\u7FA9\u3067\u304D\u307E\u305B\u3093"
    });
  }
  for (const field of ["tag", "fromLabel", "toLabel"]) {
    if (input[field] !== void 0 && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}\u304C\u4E0D\u6B63\u3067\u3059` });
    }
  }
  if (!isNonEmptyString(input.color)) {
    issues.push({ path: "color", message: "\u95A2\u4FC2\u8272\u306F\u5FC5\u9808\u3067\u3059" });
  }
  return issues;
}
function validateServicePayload(input) {
  if (!isRecord(input)) {
    return [{ path: "root", message: "\u30B5\u30FC\u30D3\u30B9\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }];
  }
  const issues = [];
  if (!isPositiveInteger(input.deviceNetworkId)) {
    issues.push({
      path: "deviceNetworkId",
      message: "\u6240\u5C5EID\u304C\u4E0D\u6B63\u3067\u3059"
    });
  }
  if (!isNonEmptyString(input.subdomain)) {
    issues.push({ path: "subdomain", message: "\u30B5\u30D6\u30C9\u30E1\u30A4\u30F3\u306F\u5FC5\u9808\u3067\u3059" });
  } else if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(input.subdomain.trim())) {
    issues.push({
      path: "subdomain",
      message: "\u30B5\u30D6\u30C9\u30E1\u30A4\u30F3\u306F\u82F1\u6570\u5B57\u3068\u30CF\u30A4\u30D5\u30F3\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044"
    });
  }
  for (const field of ["petname", "description", "iconKey"]) {
    if (input[field] !== void 0 && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}\u304C\u4E0D\u6B63\u3067\u3059` });
    }
  }
  for (const field of ["topPath", "monitorPath", "serviceUrl"]) {
    if (input[field] !== void 0 && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}\u304C\u4E0D\u6B63\u3067\u3059` });
    }
  }
  if (!isPort(input.port)) {
    issues.push({ path: "port", message: "\u30DD\u30FC\u30C8\u306F1\u301C65535\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" });
  }
  if (!isProtocol(input.protocol)) {
    issues.push({ path: "protocol", message: "\u30D7\u30ED\u30C8\u30B3\u30EB\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: "scheme", message: "\u30B9\u30AD\u30FC\u30E0\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  for (const field of ["topPath", "monitorPath"]) {
    const value = input[field];
    if (typeof value === "string" && value.trim() !== "" && !isHttpPath(value)) {
      issues.push({ path: field, message: `${field}\u306F / \u304B\u3089\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044` });
    }
  }
  if (typeof input.serviceUrl === "string" && input.serviceUrl.trim() !== "" && !isHttpUrl(input.serviceUrl)) {
    issues.push({
      path: "serviceUrl",
      message: "\u30B5\u30FC\u30D3\u30B9URL\u306FHTTP\u307E\u305F\u306FHTTPS\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044"
    });
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: "enabled", message: "\u6709\u52B9\u30D5\u30E9\u30B0\u304C\u4E0D\u6B63\u3067\u3059" });
  }
  return issues;
}

// server/ledgerTransfer.ts
import { parse, stringify } from "yaml";
var LEDGER_FORMAT = "ouchi-ledger/1";
var LedgerValidationError = class extends Error {
  issues;
  constructor(issues) {
    super("YAML\u306E\u691C\u8A3C\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    this.name = "LedgerValidationError";
    this.issues = issues;
  }
};
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}
function nullableText(value) {
  if (value === null || value === void 0) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? "" : normalized;
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function uniqueMap(items, keyOf, pathOf, collectionLabel, issues) {
  const result = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) {
      continue;
    }
    if (result.has(key)) {
      issues.push({
        path: pathOf(item),
        message: `${collectionLabel}\u300C${key}\u300D\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059`
      });
      continue;
    }
    result.set(key, item);
  }
  return result;
}
function parseYamlRoot(text) {
  if (text.trim() === "") {
    throw new LedgerValidationError([
      { path: "root", message: "YAML\u304C\u7A7A\u3067\u3059" }
    ]);
  }
  let parsed;
  try {
    parsed = parse(text, {
      maxAliasCount: 100,
      uniqueKeys: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LedgerValidationError([
      {
        path: "root",
        message: `YAML\u3092\u89E3\u6790\u3067\u304D\u307E\u305B\u3093: ${message}`
      }
    ]);
  }
  if (!isRecord2(parsed)) {
    throw new LedgerValidationError([
      {
        path: "root",
        message: "YAML\u306E\u30EB\u30FC\u30C8\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
      }
    ]);
  }
  return parsed;
}
function validateSshKey(input, index) {
  const path = `sshKeys[${index}]`;
  if (!isRecord2(input)) {
    throw new LedgerValidationError([
      { path, message: "SSH\u516C\u958B\u9375\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" }
    ]);
  }
  const issues = [];
  for (const field of ["owner", "purpose", "keyType", "publicKey"]) {
    if (!textValue(input[field])) {
      issues.push({ path: `${path}.${field}`, message: `${field}\u306F\u5FC5\u9808\u3067\u3059` });
    }
  }
  for (const field of ["fingerprint", "expiresAt", "note"]) {
    if (input[field] !== void 0 && input[field] !== null && typeof input[field] !== "string") {
      issues.push({ path: `${path}.${field}`, message: `${field}\u304C\u4E0D\u6B63\u3067\u3059` });
    }
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({
      path: `${path}.enabled`,
      message: "enabled\u304C\u4E0D\u6B63\u3067\u3059"
    });
  }
  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }
  return {
    owner: textValue(input.owner),
    purpose: textValue(input.purpose),
    keyType: textValue(input.keyType),
    publicKey: textValue(input.publicKey),
    fingerprint: nullableText(input.fingerprint),
    expiresAt: nullableText(input.expiresAt),
    enabled: input.enabled,
    note: nullableText(input.note)
  };
}
function validateDocument(root) {
  const issues = [];
  if (root.format !== LEDGER_FORMAT) {
    issues.push({
      path: "format",
      message: `format\u306F\u300C${LEDGER_FORMAT}\u300D\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`
    });
  }
  if (typeof root.exportedAt !== "string" || root.exportedAt.trim() === "" || Number.isNaN(Date.parse(root.exportedAt))) {
    issues.push({
      path: "exportedAt",
      message: "exportedAt\u306FISO\u65E5\u6642\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
    });
  }
  for (const field of [
    "networks",
    "devices",
    "relations",
    "services",
    "sshKeys",
    "deviceKeys"
  ]) {
    if (!Array.isArray(root[field])) {
      issues.push({
        path: field,
        message: `${field}\u306F\u914D\u5217\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`
      });
    }
  }
  if (!isRecord2(root.settings)) {
    issues.push({ path: "settings", message: "settings\u306F\u5FC5\u9808\u3067\u3059" });
  } else if (!textValue(root.settings.domain)) {
    issues.push({
      path: "settings.domain",
      message: "domain\u306F\u5FC5\u9808\u3067\u3059"
    });
  } else {
    issues.push(
      ...validateSettingsPayload(root.settings).map((issue) => ({
        ...issue,
        path: `settings.${issue.path}`
      }))
    );
  }
  const networks = [];
  arrayValue(root.networks).forEach((item, index) => {
    issues.push(...validateNetworkPayload(item).map((issue) => ({
      ...issue,
      path: `networks[${index}]${issue.path === "root" ? "" : `.${issue.path}`}`
    })));
    if (!isRecord2(item)) {
      return;
    }
    networks.push({
      name: textValue(item.name),
      cidr: nullableText(item.cidr),
      accent: textValue(item.accent),
      note: nullableText(item.note)
    });
  });
  const devices = [];
  arrayValue(root.devices).forEach((item, index) => {
    if (!isRecord2(item)) {
      issues.push({
        path: `devices[${index}]`,
        message: "\u30C7\u30D0\u30A4\u30B9\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059"
      });
      return;
    }
    issues.push(...validateDevicePayload(item).map((issue) => ({
      ...issue,
      path: `devices[${index}]${issue.path === "root" ? "" : `.${issue.path}`}`
    })));
    if (!Array.isArray(item.memberships)) {
      issues.push({
        path: `devices[${index}].memberships`,
        message: "memberships\u306F\u914D\u5217\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
      });
    }
    const memberships = [];
    arrayValue(item.memberships).forEach((membership, membershipIndex) => {
      const membershipPath = `devices[${index}].memberships[${membershipIndex}]`;
      if (!isRecord2(membership)) {
        issues.push({
          path: membershipPath,
          message: "\u6240\u5C5E\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059"
        });
        return;
      }
      const synthetic = {
        deviceId: index + 1,
        networkId: membershipIndex + 1,
        ip: nullableText(membership.ip),
        label: nullableText(membership.label)
      };
      issues.push(...validateMembershipPayload(synthetic).map((issue) => ({
        ...issue,
        path: `${membershipPath}.${issue.path}`
      })));
      if (!textValue(membership.network)) {
        issues.push({
          path: `${membershipPath}.network`,
          message: "\u6240\u5C5E\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u540D\u306F\u5FC5\u9808\u3067\u3059"
        });
      }
      memberships.push({
        network: textValue(membership.network),
        ip: nullableText(membership.ip),
        label: nullableText(membership.label)
      });
    });
    devices.push({
      hostname: textValue(item.hostname),
      category: item.category,
      isVm: item.isVm,
      sshUser: nullableText(item.sshUser),
      sshPort: typeof item.sshPort === "number" ? item.sshPort : null,
      meterEnabled: item.meterEnabled,
      note: nullableText(item.note),
      memberships
    });
  });
  const relations = [];
  arrayValue(root.relations).forEach((item, index) => {
    if (!isRecord2(item)) {
      issues.push({
        path: `relations[${index}]`,
        message: "\u95A2\u4FC2\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059"
      });
      return;
    }
    const synthetic = {
      fromDeviceId: index + 1,
      toDeviceId: index + 2,
      tag: nullableText(item.tag),
      fromLabel: nullableText(item.fromLabel),
      toLabel: nullableText(item.toLabel),
      color: textValue(item.color)
    };
    issues.push(...validateRelationPayload(synthetic).map((issue) => ({
      ...issue,
      path: `relations[${index}].${issue.path}`
    })));
    for (const field of ["from", "to"]) {
      if (!textValue(item[field])) {
        issues.push({
          path: `relations[${index}].${field}`,
          message: `${field}\u306E\u30DB\u30B9\u30C8\u540D\u306F\u5FC5\u9808\u3067\u3059`
        });
      }
    }
    relations.push({
      from: textValue(item.from),
      to: textValue(item.to),
      tag: nullableText(item.tag),
      fromLabel: nullableText(item.fromLabel),
      toLabel: nullableText(item.toLabel),
      color: textValue(item.color)
    });
  });
  const services = [];
  arrayValue(root.services).forEach((item, index) => {
    if (!isRecord2(item)) {
      issues.push({
        path: `services[${index}]`,
        message: "\u30B5\u30FC\u30D3\u30B9\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059"
      });
      return;
    }
    const synthetic = {
      deviceNetworkId: index + 1,
      subdomain: textValue(item.subdomain),
      petname: nullableText(item.petname),
      description: nullableText(item.description),
      port: item.port,
      protocol: item.protocol,
      scheme: item.scheme,
      topPath: nullableText(item.topPath),
      monitorPath: nullableText(item.monitorPath),
      serviceUrl: nullableText(item.serviceUrl),
      iconKey: nullableText(item.iconKey),
      enabled: item.enabled
    };
    issues.push(...validateServicePayload(synthetic).map((issue) => ({
      ...issue,
      path: `services[${index}].${issue.path}`
    })));
    for (const field of ["device", "network"]) {
      if (!textValue(item[field])) {
        issues.push({
          path: `services[${index}].${field}`,
          message: `${field}\u306E\u81EA\u7136\u30AD\u30FC\u306F\u5FC5\u9808\u3067\u3059`
        });
      }
    }
    if (item.faviconUrl !== void 0 && item.faviconUrl !== null && typeof item.faviconUrl !== "string") {
      issues.push({
        path: `services[${index}].faviconUrl`,
        message: "faviconUrl\u304C\u4E0D\u6B63\u3067\u3059"
      });
    }
    services.push({
      subdomain: textValue(item.subdomain).toLowerCase(),
      device: textValue(item.device),
      network: textValue(item.network),
      petname: nullableText(item.petname),
      description: nullableText(item.description),
      port: item.port,
      protocol: item.protocol,
      scheme: item.scheme,
      topPath: nullableText(item.topPath),
      monitorPath: nullableText(item.monitorPath),
      serviceUrl: nullableText(item.serviceUrl),
      iconKey: nullableText(item.iconKey),
      faviconUrl: nullableText(item.faviconUrl),
      enabled: item.enabled
    });
  });
  const sshKeys = [];
  arrayValue(root.sshKeys).forEach((item, index) => {
    try {
      const key = validateSshKey(item, index);
      if (key) {
        sshKeys.push(key);
      }
    } catch (error) {
      if (error instanceof LedgerValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  });
  const deviceKeys = [];
  arrayValue(root.deviceKeys).forEach((item, index) => {
    const path = `deviceKeys[${index}]`;
    if (!isRecord2(item)) {
      issues.push({ path, message: "\u30C7\u30D0\u30A4\u30B9\u9375\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059" });
      return;
    }
    if (!textValue(item.device)) {
      issues.push({
        path: `${path}.device`,
        message: "device\u306E\u30DB\u30B9\u30C8\u540D\u306F\u5FC5\u9808\u3067\u3059"
      });
    }
    if (!textValue(item.publicKey)) {
      issues.push({
        path: `${path}.publicKey`,
        message: "publicKey\u306F\u5FC5\u9808\u3067\u3059"
      });
    }
    deviceKeys.push({
      device: textValue(item.device),
      publicKey: textValue(item.publicKey)
    });
  });
  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }
  const networkByName = uniqueMap(
    networks,
    (network) => network.name,
    (network) => "networks",
    "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u540D",
    issues
  );
  const deviceByName = uniqueMap(
    devices,
    (device) => device.hostname,
    (device) => "devices",
    "\u30DB\u30B9\u30C8\u540D",
    issues
  );
  uniqueMap(
    services,
    (service) => service.subdomain,
    (service) => "services",
    "\u30B5\u30D6\u30C9\u30E1\u30A4\u30F3",
    issues
  );
  const sshKeyByPublicKey = uniqueMap(
    sshKeys,
    (key) => key.publicKey,
    (key) => "sshKeys",
    "\u516C\u958B\u9375",
    issues
  );
  const cidrs = /* @__PURE__ */ new Set();
  networks.forEach((network, index) => {
    if (!network.cidr) {
      return;
    }
    if (!isCidr(network.cidr)) {
      issues.push({
        path: `networks[${index}].cidr`,
        message: "CIDR\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059"
      });
    } else if (cidrs.has(network.cidr)) {
      issues.push({
        path: `networks[${index}].cidr`,
        message: `CIDR ${network.cidr} \u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059`
      });
    }
    cidrs.add(network.cidr);
  });
  const membershipKeys = /* @__PURE__ */ new Set();
  const ipOwners = /* @__PURE__ */ new Map();
  devices.forEach((device, deviceIndex) => {
    device.memberships.forEach((membership, membershipIndex) => {
      const path = `devices[${deviceIndex}].memberships[${membershipIndex}]`;
      const network = networkByName.get(membership.network);
      if (!network) {
        issues.push({
          path: `${path}.network`,
          message: `\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u300C${membership.network}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
        });
      } else if (membership.ip && network.cidr && !isIpWithinCidr(membership.ip, network.cidr)) {
        issues.push({
          path: `${path}.ip`,
          message: `IP ${membership.ip} \u306F ${network.cidr} \u306E\u7BC4\u56F2\u5916\u3067\u3059`
        });
      }
      if (device.category === "service" && membership.ip) {
        issues.push({
          path: `${path}.ip`,
          message: "\u30B5\u30FC\u30D3\u30B9\u30AB\u30C6\u30B4\u30EA\u30FC\u306E\u6240\u5C5EIP\u306Fnull\u306B\u3057\u3066\u304F\u3060\u3055\u3044"
        });
      }
      const membershipKey = `${device.hostname}\0${membership.network}`;
      if (membershipKeys.has(membershipKey)) {
        issues.push({
          path,
          message: `${device.hostname} \u306E ${membership.network} \u6240\u5C5E\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059`
        });
      }
      membershipKeys.add(membershipKey);
      if (membership.ip) {
        const owner = ipOwners.get(membership.ip);
        if (owner) {
          issues.push({
            path: `${path}.ip`,
            message: `IP ${membership.ip} \u306F ${owner} \u3068\u91CD\u8907\u3057\u3066\u3044\u307E\u3059`
          });
        } else {
          ipOwners.set(membership.ip, device.hostname);
        }
      }
    });
  });
  relations.forEach((relation, index) => {
    if (!deviceByName.has(relation.from)) {
      issues.push({
        path: `relations[${index}].from`,
        message: `\u30C7\u30D0\u30A4\u30B9\u300C${relation.from}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
    if (!deviceByName.has(relation.to)) {
      issues.push({
        path: `relations[${index}].to`,
        message: `\u30C7\u30D0\u30A4\u30B9\u300C${relation.to}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
    if (relation.from === relation.to) {
      issues.push({
        path: `relations[${index}].to`,
        message: "\u540C\u3058\u30C7\u30D0\u30A4\u30B9\u81EA\u8EAB\u3078\u95A2\u4FC2\u306F\u5B9A\u7FA9\u3067\u304D\u307E\u305B\u3093"
      });
    }
  });
  services.forEach((service, index) => {
    if (!deviceByName.has(service.device)) {
      issues.push({
        path: `services[${index}].device`,
        message: `\u30C7\u30D0\u30A4\u30B9\u300C${service.device}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
    if (!networkByName.has(service.network)) {
      issues.push({
        path: `services[${index}].network`,
        message: `\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u300C${service.network}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
    if (!membershipKeys.has(
      `${service.device}\0${service.network}`
    )) {
      issues.push({
        path: `services[${index}]`,
        message: `${service.device} \u306E ${service.network} \u6240\u5C5E\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
  });
  const deviceKeyPairs = /* @__PURE__ */ new Set();
  deviceKeys.forEach((deviceKey, index) => {
    if (!deviceByName.has(deviceKey.device)) {
      issues.push({
        path: `deviceKeys[${index}].device`,
        message: `\u30C7\u30D0\u30A4\u30B9\u300C${deviceKey.device}\u300D\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
      });
    }
    if (!sshKeyByPublicKey.has(deviceKey.publicKey)) {
      issues.push({
        path: `deviceKeys[${index}].publicKey`,
        message: "sshKeys\u306B\u5B58\u5728\u3057\u306A\u3044\u516C\u958B\u9375\u3067\u3059"
      });
    }
    const pair = `${deviceKey.device}\0${deviceKey.publicKey}`;
    if (deviceKeyPairs.has(pair)) {
      issues.push({
        path: `deviceKeys[${index}]`,
        message: "\u540C\u3058\u30C7\u30D0\u30A4\u30B9\u3068\u516C\u958B\u9375\u306E\u7D10\u4ED8\u3051\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059"
      });
    }
    deviceKeyPairs.add(pair);
  });
  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }
  return {
    format: LEDGER_FORMAT,
    exportedAt: root.exportedAt,
    settings: {
      domain: textValue(root.settings.domain),
      title: textValue(root.settings.title)
    },
    networks,
    devices,
    relations,
    services,
    sshKeys,
    deviceKeys
  };
}
function parseLedgerYaml(input) {
  return validateDocument(parseYamlRoot(input));
}
function createLedgerDocument(database2, exportedAt = /* @__PURE__ */ new Date()) {
  const settings = database2.prepare("SELECT domain, title FROM settings WHERE id = 1").get();
  const networks = database2.prepare(
    "SELECT name, cidr, accent, note FROM networks ORDER BY id"
  ).all();
  const devices = database2.prepare(
    `SELECT id, hostname, category, is_vm, ssh_user, ssh_port,
              meter_enabled, note
       FROM devices ORDER BY id`
  ).all();
  const memberships = database2.prepare(
    `SELECT dn.device_id, n.name AS network_name, dn.ip, dn.label
       FROM device_networks dn
       JOIN networks n ON n.id = dn.network_id
       ORDER BY dn.id`
  ).all();
  const relations = database2.prepare(
    `SELECT fd.hostname AS from_hostname, td.hostname AS to_hostname,
              r.tag, r.from_label, r.to_label, r.color
       FROM relations r
       JOIN devices fd ON fd.id = r.from_device_id
       JOIN devices td ON td.id = r.to_device_id
       ORDER BY r.id`
  ).all();
  const services = database2.prepare(
    `SELECT s.subdomain, d.hostname, n.name AS network_name,
              s.petname, s.description, s.port, s.protocol, s.scheme,
              s.top_path, s.monitor_path, s.service_url, s.icon_key,
              s.favicon_url, s.enabled
       FROM services s
       JOIN device_networks dn ON dn.id = s.device_network_id
       JOIN devices d ON d.id = dn.device_id
       JOIN networks n ON n.id = dn.network_id
       ORDER BY s.id`
  ).all();
  const sshKeys = database2.prepare(
    `SELECT owner, purpose, key_type, public_key, fingerprint,
              expires_at, enabled, note
       FROM ssh_keys ORDER BY id`
  ).all();
  const deviceKeys = database2.prepare(
    `SELECT d.hostname, k.public_key
       FROM device_keys dk
       JOIN devices d ON d.id = dk.device_id
       JOIN ssh_keys k ON k.id = dk.key_id
       ORDER BY dk.device_id, dk.key_id`
  ).all();
  const membershipsByDevice = /* @__PURE__ */ new Map();
  for (const membership of memberships) {
    const list = membershipsByDevice.get(membership.device_id) ?? [];
    list.push({
      network: membership.network_name,
      ip: membership.ip,
      label: membership.label
    });
    membershipsByDevice.set(membership.device_id, list);
  }
  return {
    format: LEDGER_FORMAT,
    exportedAt: exportedAt.toISOString(),
    settings: {
      domain: settings?.domain ?? "ouchi.local",
      title: settings?.title ?? "\u3042\u306A\u305F\u306E\u30DB\u30FC\u30E0\u30E9\u30DC"
    },
    networks: networks.map((network) => ({
      name: network.name,
      cidr: network.cidr,
      accent: network.accent ?? "",
      note: network.note
    })),
    devices: devices.map((device) => ({
      hostname: device.hostname,
      category: device.category,
      isVm: Boolean(device.is_vm),
      sshUser: device.ssh_user,
      sshPort: device.ssh_port,
      meterEnabled: Boolean(device.meter_enabled),
      note: device.note,
      memberships: membershipsByDevice.get(device.id) ?? []
    })),
    relations: relations.map((relation) => ({
      from: relation.from_hostname,
      to: relation.to_hostname,
      tag: relation.tag,
      fromLabel: relation.from_label,
      toLabel: relation.to_label,
      color: relation.color
    })),
    services: services.map((service) => ({
      subdomain: service.subdomain,
      device: service.hostname,
      network: service.network_name,
      petname: service.petname,
      description: service.description,
      port: service.port,
      protocol: service.protocol,
      scheme: service.scheme,
      topPath: service.top_path,
      monitorPath: service.monitor_path,
      serviceUrl: service.service_url,
      iconKey: service.icon_key,
      faviconUrl: service.favicon_url,
      enabled: Boolean(service.enabled)
    })),
    sshKeys: sshKeys.map((key) => ({
      owner: key.owner,
      purpose: key.purpose,
      keyType: key.key_type,
      publicKey: key.public_key,
      fingerprint: key.fingerprint,
      expiresAt: key.expires_at,
      enabled: Boolean(key.enabled),
      note: key.note
    })),
    deviceKeys: deviceKeys.map((deviceKey) => ({
      device: deviceKey.hostname,
      publicKey: deviceKey.public_key
    }))
  };
}
function serializeLedgerDocument(document) {
  return stringify(document, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN"
  });
}
function exportLedgerYaml(database2, exportedAt = /* @__PURE__ */ new Date()) {
  return serializeLedgerDocument(
    createLedgerDocument(database2, exportedAt)
  );
}
function asNumber(value) {
  return typeof value === "bigint" ? Number(value) : value;
}
function importLedgerYaml(database2, yaml) {
  const document = parseLedgerYaml(yaml);
  const counts = {
    networks: document.networks.length,
    devices: document.devices.length,
    memberships: document.devices.reduce(
      (count, device) => count + device.memberships.length,
      0
    ),
    relations: document.relations.length,
    services: document.services.length,
    sshKeys: document.sshKeys.length,
    deviceKeys: document.deviceKeys.length
  };
  database2.exec("BEGIN IMMEDIATE");
  try {
    database2.exec(`
      DELETE FROM device_keys;
      DELETE FROM ssh_keys;
      DELETE FROM services;
      DELETE FROM relations;
      DELETE FROM device_networks;
      DELETE FROM devices;
      DELETE FROM networks;
      DELETE FROM settings;
    `);
    database2.prepare("INSERT INTO settings (id, domain, title) VALUES (1, ?, ?)").run(document.settings.domain, document.settings.title);
    const networkIds = /* @__PURE__ */ new Map();
    const insertNetwork = database2.prepare(
      `INSERT INTO networks (name, cidr, accent, note)
       VALUES (?, ?, ?, ?)`
    );
    for (const network of document.networks) {
      const result = insertNetwork.run(
        network.name,
        network.cidr,
        network.accent,
        network.note
      );
      networkIds.set(network.name, asNumber(result.lastInsertRowid));
    }
    const deviceIds = /* @__PURE__ */ new Map();
    const insertDevice = database2.prepare(
      `INSERT INTO devices
        (hostname, category, is_vm, ssh_user, ssh_port, meter_enabled, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const device of document.devices) {
      const result = insertDevice.run(
        device.hostname,
        device.category,
        device.isVm ? 1 : 0,
        device.sshUser,
        device.sshPort,
        device.meterEnabled ? 1 : 0,
        device.note
      );
      deviceIds.set(device.hostname, asNumber(result.lastInsertRowid));
    }
    const membershipIds = /* @__PURE__ */ new Map();
    const insertMembership = database2.prepare(
      `INSERT INTO device_networks (device_id, network_id, ip, label)
       VALUES (?, ?, ?, ?)`
    );
    for (const device of document.devices) {
      for (const membership of device.memberships) {
        const result = insertMembership.run(
          deviceIds.get(device.hostname),
          networkIds.get(membership.network),
          membership.ip,
          membership.label
        );
        membershipIds.set(
          `${device.hostname}\0${membership.network}`,
          asNumber(result.lastInsertRowid)
        );
      }
    }
    const insertRelation = database2.prepare(
      `INSERT INTO relations
        (from_device_id, to_device_id, tag, from_label, to_label, color)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const relation of document.relations) {
      insertRelation.run(
        deviceIds.get(relation.from),
        deviceIds.get(relation.to),
        relation.tag,
        relation.fromLabel,
        relation.toLabel,
        relation.color
      );
    }
    const insertService = database2.prepare(
      `INSERT INTO services
        (device_network_id, subdomain, petname, description, port, protocol,
         scheme, top_path, monitor_path, service_url, icon_key, favicon_url,
         enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const service of document.services) {
      insertService.run(
        membershipIds.get(
          `${service.device}\0${service.network}`
        ),
        service.subdomain,
        service.petname,
        service.description,
        service.port,
        service.protocol,
        service.scheme,
        service.topPath,
        service.monitorPath,
        service.serviceUrl,
        service.iconKey,
        service.faviconUrl,
        service.enabled ? 1 : 0
      );
    }
    const sshKeyIds = /* @__PURE__ */ new Map();
    const insertSshKey = database2.prepare(
      `INSERT INTO ssh_keys
        (owner, purpose, key_type, public_key, fingerprint, expires_at,
         enabled, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const key of document.sshKeys) {
      const result = insertSshKey.run(
        key.owner,
        key.purpose,
        key.keyType,
        key.publicKey,
        key.fingerprint,
        key.expiresAt,
        key.enabled ? 1 : 0,
        key.note
      );
      sshKeyIds.set(key.publicKey, asNumber(result.lastInsertRowid));
    }
    const insertDeviceKey = database2.prepare(
      "INSERT INTO device_keys (device_id, key_id) VALUES (?, ?)"
    );
    for (const deviceKey of document.deviceKeys) {
      insertDeviceKey.run(
        deviceIds.get(deviceKey.device),
        sshKeyIds.get(deviceKey.publicKey)
      );
    }
    database2.exec("COMMIT");
    return counts;
  } catch (error) {
    try {
      database2.exec("ROLLBACK");
    } catch {
    }
    throw error;
  }
}

// server/app.ts
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : void 0;
}
async function jsonBody(context) {
  try {
    return await context.req.json();
  } catch {
    return void 0;
  }
}
function invalid(issues) {
  return {
    status: 400,
    body: { issues }
  };
}
function conflict(message, details) {
  return {
    status: 409,
    body: { error: message, ...details }
  };
}
function databaseConflict(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) {
    return {
      status: 409,
      body: { error: "\u4E00\u610F\u5236\u7D04\u306B\u9055\u53CD\u3057\u3066\u3044\u307E\u3059", detail: message }
    };
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return {
      status: 409,
      body: { error: "\u53C2\u7167\u4E2D\u306E\u30C7\u30FC\u30BF\u304C\u3042\u308B\u305F\u3081\u5909\u66F4\u3067\u304D\u307E\u305B\u3093" }
    };
  }
  return {
    status: 409,
    body: { error: "\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u5236\u7D04\u306B\u3088\u308A\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093" }
  };
}
function createApp(database2) {
  const app2 = new Hono();
  app2.get(
    "/api/health",
    (context) => context.json({
      ok: true,
      service: "ouchi.local",
      database: "sqlite-v0.4"
    })
  );
  app2.get(
    "/api/portal",
    (context) => context.json(database2.getPortalData())
  );
  app2.get("/api/export", (context) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return context.body(exportLedgerYaml(database2.database), 200, {
      "Content-Type": "application/yaml; charset=utf-8",
      "Content-Disposition": `attachment; filename="ouchi-ledger-${timestamp}.yaml"`,
      "Cache-Control": "no-store"
    });
  });
  app2.post("/api/import", async (context) => {
    const yaml = await context.req.text();
    try {
      const imported = importLedgerYaml(database2.database, yaml);
      return context.json({ ok: true, imported });
    } catch (error) {
      if (error instanceof LedgerValidationError) {
        return context.json({ issues: error.issues }, 400);
      }
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.get(
    "/api/settings",
    (context) => context.json(database2.getSettings())
  );
  app2.put("/api/settings", async (context) => {
    const input = await jsonBody(context);
    const issues = validateSettingsPayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    return context.json(
      database2.updateSettings(input.title)
    );
  });
  app2.get(
    "/api/networks",
    (context) => context.json(database2.listNetworks())
  );
  app2.post("/api/networks", async (context) => {
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database2.createNetwork(input),
        201
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.put("/api/networks/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const input = await jsonBody(context);
    const issues = validateNetworkPayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const network = database2.updateNetwork(id, input);
      return network ? context.json(network) : context.json({ error: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.delete("/api/networks/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const blockers = database2.networkDeletionBlockers(id);
    if (blockers.memberships > 0) {
      const failure = conflict(
        "\u7D10\u3065\u304F\u6240\u5C5E\u304C\u6B8B\u3063\u3066\u3044\u308B\u305F\u3081\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093",
        { blockers }
      );
      return context.json(failure.body, failure.status);
    }
    return database2.deleteNetwork(id) ? context.json({ ok: true }) : context.json({ error: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get(
    "/api/devices",
    (context) => context.json(database2.listDevices())
  );
  app2.post("/api/devices", async (context) => {
    const input = await jsonBody(context);
    const issues = validateDevicePayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database2.createDevice(input),
        201
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.put("/api/devices/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const input = await jsonBody(context);
    const issues = validateDevicePayload(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    const existingDevice = database2.getDevice(id);
    if (!existingDevice) {
      return context.json({ error: "\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    }
    if (input.category === "service" && existingDevice.memberships.some((membership) => membership.ip)) {
      const failure = invalid([
        {
          path: "category",
          message: "\u30B5\u30FC\u30D3\u30B9\u30AB\u30C6\u30B4\u30EA\u30FC\u3078\u5909\u66F4\u3059\u308B\u524D\u306B\u6240\u5C5EIP\u3092\u7A7A\u306B\u3057\u3066\u304F\u3060\u3055\u3044"
        }
      ]);
      return context.json(failure.body, failure.status);
    }
    try {
      const device = database2.updateDevice(id, input);
      return device ? context.json(device) : context.json({ error: "\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.delete("/api/devices/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const blockers = database2.deviceDeletionBlockers(id);
    if (blockers.services > 0 || blockers.relations > 0) {
      const failure = conflict(
        blockers.services > 0 ? "\u7D10\u3065\u304F\u30B5\u30FC\u30D3\u30B9\u304C\u6B8B\u3063\u3066\u3044\u308B\u305F\u3081\u30C7\u30D0\u30A4\u30B9\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093" : "\u7D10\u3065\u304F\u95A2\u4FC2\u304C\u6B8B\u3063\u3066\u3044\u308B\u305F\u3081\u30C7\u30D0\u30A4\u30B9\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093",
        { blockers }
      );
      return context.json(failure.body, failure.status);
    }
    return database2.deleteDevice(id) ? context.json({ ok: true }) : context.json({ error: "\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get(
    "/api/memberships",
    (context) => context.json(database2.listMemberships())
  );
  const membershipIssues = (input, existingId) => {
    const issues = validateMembershipPayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input;
    const device = database2.getDevice(value.deviceId);
    if (!device) {
      issues.push({ path: "deviceId", message: "\u30C7\u30D0\u30A4\u30B9\u304C\u5B58\u5728\u3057\u307E\u305B\u3093" });
    } else if (device.category === "service" && typeof value.ip === "string" && value.ip.trim() !== "") {
      issues.push({
        path: "ip",
        message: "\u30B5\u30FC\u30D3\u30B9\u30AB\u30C6\u30B4\u30EA\u30FC\u306E\u6240\u5C5EIP\u306FNULL\u306B\u3057\u3066\u304F\u3060\u3055\u3044"
      });
    }
    const network = database2.getNetwork(value.networkId);
    if (!network) {
      issues.push({ path: "networkId", message: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093" });
    } else if (network.cidr && value.ip?.trim() && !isIpWithinCidr(value.ip.trim(), network.cidr)) {
      issues.push({
        path: "ip",
        message: `IP\u306F ${network.cidr} \u306E\u7BC4\u56F2\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`
      });
    }
    if (existingId && !database2.getMembership(existingId)) {
      issues.push({ path: "id", message: "\u6240\u5C5E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    }
    return issues;
  };
  app2.post("/api/memberships", async (context) => {
    const input = await jsonBody(context);
    const issues = membershipIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database2.createMembership(input),
        201
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.put("/api/memberships/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const input = await jsonBody(context);
    const issues = membershipIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const membership = database2.updateMembership(
        id,
        input
      );
      return membership ? context.json(membership) : context.json({ error: "\u6240\u5C5E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.delete("/api/memberships/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const serviceCount = database2.membershipServiceCount(id);
    if (serviceCount > 0) {
      const failure = conflict(
        "\u30B5\u30FC\u30D3\u30B9\u304C\u7D10\u3065\u3044\u3066\u3044\u308B\u305F\u3081\u6240\u5C5E\u3092\u524A\u9664\u3067\u304D\u307E\u305B\u3093",
        { blockers: { services: serviceCount } }
      );
      return context.json(failure.body, failure.status);
    }
    return database2.deleteMembership(id) ? context.json({ ok: true }) : context.json({ error: "\u6240\u5C5E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get(
    "/api/services",
    (context) => context.json(database2.listServices())
  );
  const serviceIssues = (input, existingId) => {
    const issues = validateServicePayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input;
    if (!database2.getMembership(value.deviceNetworkId)) {
      issues.push({
        path: "deviceNetworkId",
        message: "\u6240\u5C5E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      });
    }
    if (existingId && !database2.getService(existingId)) {
      issues.push({ path: "id", message: "\u30B5\u30FC\u30D3\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    }
    return issues;
  };
  app2.post("/api/services", async (context) => {
    const input = await jsonBody(context);
    const issues = serviceIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database2.createService(input),
        201
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.put("/api/services/:id", async (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const input = await jsonBody(context);
    const issues = serviceIssues(input, id);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      const service = database2.updateService(id, input);
      return service ? context.json(service) : context.json({ error: "\u30B5\u30FC\u30D3\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.delete("/api/services/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    return database2.deleteService(id) ? context.json({ ok: true }) : context.json({ error: "\u30B5\u30FC\u30D3\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get(
    "/api/relations",
    (context) => context.json(database2.listRelations())
  );
  const relationIssues = (input) => {
    const issues = validateRelationPayload(input);
    if (issues.length > 0 || typeof input !== "object" || input === null) {
      return issues;
    }
    const value = input;
    if (!database2.getDevice(value.fromDeviceId)) {
      issues.push({
        path: "fromDeviceId",
        message: "\u95A2\u4FC2\u5143\u30C7\u30D0\u30A4\u30B9\u304C\u5B58\u5728\u3057\u307E\u305B\u3093"
      });
    }
    if (!database2.getDevice(value.toDeviceId)) {
      issues.push({
        path: "toDeviceId",
        message: "\u95A2\u4FC2\u5148\u30C7\u30D0\u30A4\u30B9\u304C\u5B58\u5728\u3057\u307E\u305B\u3093"
      });
    }
    return issues;
  };
  app2.post("/api/relations", async (context) => {
    const input = await jsonBody(context);
    const issues = relationIssues(input);
    if (issues.length > 0) {
      const failure = invalid(issues);
      return context.json(failure.body, failure.status);
    }
    try {
      return context.json(
        database2.createRelation(input),
        201
      );
    } catch (error) {
      const failure = databaseConflict(error);
      return context.json(failure.body, failure.status);
    }
  });
  app2.delete("/api/relations/:id", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    return database2.deleteRelation(id) ? context.json({ ok: true }) : context.json({ error: "\u95A2\u4FC2\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get("/api/devices/:id/relations", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const depth = Number(context.req.query("depth") ?? "1");
    if (!Number.isInteger(depth) || depth < 1) {
      return context.json(
        { issues: [{ path: "depth", message: "depth\u306F1\u4EE5\u4E0A\u3067\u3059" }] },
        400
      );
    }
    const result = database2.traverseRelations(id, depth);
    return result ? context.json(result) : context.json({ error: "\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
  });
  app2.get("/api/devices/:id/meters", (context) => {
    const id = parseId(context.req.param("id"));
    if (!id) {
      return context.json({ error: "ID\u304C\u4E0D\u6B63\u3067\u3059" }, 400);
    }
    const device = database2.getDevice(id);
    if (!device) {
      return context.json({ error: "\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    }
    return context.json({
      deviceId: id,
      memoryPercent: null,
      diskPercent: null,
      collectedAt: null,
      available: false
    });
  });
  app2.notFound(
    (context) => context.json({ error: "API\u30A8\u30F3\u30C9\u30DD\u30A4\u30F3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404)
  );
  return app2;
}

// server/db.ts
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/portal/urls.ts
function normalizePath(path) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
}
function buildServiceUrl(service, deviceNetwork) {
  const explicitUrl = service.serviceUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }
  const ip = deviceNetwork.ip.trim();
  if (!ip) {
    return null;
  }
  return `${service.scheme}://${ip}:${service.port}${normalizePath(
    service.topPath
  )}`;
}
function buildMonitorUrl(service, deviceNetwork) {
  const explicitUrl = service.serviceUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }
  const ip = deviceNetwork.ip.trim();
  if (!ip) {
    return null;
  }
  const monitorPath = service.monitorPath.trim() || service.topPath;
  return `${service.scheme}://${ip}:${service.port}${normalizePath(
    monitorPath
  )}`;
}

// server/db.ts
function asNumber2(value) {
  return typeof value === "bigint" ? Number(value) : value;
}
function nullableText2(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function toApiNetwork(row) {
  return {
    id: asNumber2(row.id),
    name: row.name,
    cidr: row.cidr,
    accent: row.accent,
    note: row.note
  };
}
function toApiMembership(row) {
  return {
    id: asNumber2(row.id),
    deviceId: asNumber2(row.device_id),
    networkId: asNumber2(row.network_id),
    ip: row.ip,
    label: row.label
  };
}
function toApiDevice(row, memberships) {
  return {
    id: asNumber2(row.id),
    hostname: row.hostname,
    category: row.category,
    isVm: Boolean(row.is_vm),
    sshUser: row.ssh_user,
    sshPort: row.ssh_port === null ? null : asNumber2(row.ssh_port),
    meterEnabled: Boolean(row.meter_enabled),
    note: row.note,
    memberships
  };
}
function toApiService(row) {
  const base = {
    scheme: row.scheme,
    port: row.port,
    topPath: row.top_path ?? "",
    monitorPath: row.monitor_path ?? "",
    serviceUrl: row.service_url ?? ""
  };
  return {
    id: asNumber2(row.id),
    deviceNetworkId: asNumber2(row.device_network_id),
    subdomain: row.subdomain,
    petname: row.petname,
    description: row.description,
    port: row.port,
    protocol: row.protocol,
    scheme: row.scheme,
    topPath: row.top_path,
    monitorPath: row.monitor_path,
    serviceUrl: row.service_url,
    iconKey: row.icon_key,
    enabled: Boolean(row.enabled),
    url: buildServiceUrl(base, { ip: row.ip ?? "" }),
    monitorUrl: buildMonitorUrl(base, { ip: row.ip ?? "" })
  };
}
function toApiRelation(row) {
  return {
    id: asNumber2(row.id),
    fromDeviceId: asNumber2(row.from_device_id),
    toDeviceId: asNumber2(row.to_device_id),
    tag: row.tag,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    color: row.color
  };
}
var PortalDatabase = class {
  database;
  constructor(options = {}) {
    const root = process.cwd();
    const filename = options.filename ?? resolve(root, "data", "ouchi.sqlite");
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.database = new DatabaseSync(filename);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    if (filename !== ":memory:") {
      this.database.exec("PRAGMA journal_mode = WAL");
      this.database.exec("PRAGMA synchronous = NORMAL");
    }
    const schemaPath = options.schemaPath ?? resolve(root, "contract-v1", "schema.sql");
    const seedPath = options.seedPath ?? resolve(root, "contract-v1", "seed.sql");
    this.database.exec(readFileSync(schemaPath, "utf8"));
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM networks").get();
    if (row.count === 0) {
      this.database.exec(readFileSync(seedPath, "utf8"));
    }
  }
  close() {
    this.database.close();
  }
  listNetworks() {
    return this.database.prepare(
      "SELECT id, name, cidr, accent, note FROM networks ORDER BY id"
    ).all().map(toApiNetwork);
  }
  getNetwork(id) {
    const row = this.database.prepare(
      "SELECT id, name, cidr, accent, note FROM networks WHERE id = ?"
    ).get(id);
    return row ? toApiNetwork(row) : void 0;
  }
  createNetwork(input) {
    const result = this.database.prepare(
      "INSERT INTO networks (name, cidr, accent, note) VALUES (?, ?, ?, ?)"
    ).run(
      input.name.trim(),
      nullableText2(input.cidr),
      input.accent.trim(),
      nullableText2(input.note)
    );
    return this.getNetwork(asNumber2(result.lastInsertRowid));
  }
  updateNetwork(id, input) {
    if (!this.getNetwork(id)) {
      return void 0;
    }
    this.database.prepare(
      "UPDATE networks SET name = ?, cidr = ?, accent = ?, note = ? WHERE id = ?"
    ).run(
      input.name.trim(),
      nullableText2(input.cidr),
      input.accent.trim(),
      nullableText2(input.note),
      id
    );
    return this.getNetwork(id);
  }
  networkDeletionBlockers(id) {
    const row = this.database.prepare(
      "SELECT COUNT(*) AS count FROM device_networks WHERE network_id = ?"
    ).get(id);
    return { memberships: row.count };
  }
  deleteNetwork(id) {
    return asNumber2(
      this.database.prepare("DELETE FROM networks WHERE id = ?").run(id).changes
    ) > 0;
  }
  listDevices() {
    const rows = this.database.prepare(
      `SELECT id, hostname, category, is_vm, ssh_user, ssh_port,
                meter_enabled, note
         FROM devices ORDER BY id`
    ).all();
    const memberships = this.database.prepare(
      `SELECT id, device_id, network_id, ip, label
         FROM device_networks ORDER BY id`
    ).all();
    const byDevice = /* @__PURE__ */ new Map();
    for (const row of memberships) {
      const list = byDevice.get(asNumber2(row.device_id)) ?? [];
      list.push(toApiMembership(row));
      byDevice.set(asNumber2(row.device_id), list);
    }
    return rows.map(
      (row) => toApiDevice(row, byDevice.get(asNumber2(row.id)) ?? [])
    );
  }
  getDevice(id) {
    return this.listDevices().find((device) => device.id === id);
  }
  createDevice(input) {
    const result = this.database.prepare(
      `INSERT INTO devices
          (hostname, category, is_vm, ssh_user, ssh_port, meter_enabled, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.hostname.trim(),
      input.category,
      input.isVm ? 1 : 0,
      nullableText2(input.sshUser),
      input.sshPort ?? null,
      input.meterEnabled ? 1 : 0,
      nullableText2(input.note)
    );
    return this.getDevice(asNumber2(result.lastInsertRowid));
  }
  updateDevice(id, input) {
    if (!this.getDevice(id)) {
      return void 0;
    }
    this.database.prepare(
      `UPDATE devices
         SET hostname = ?, category = ?, is_vm = ?, ssh_user = ?,
             ssh_port = ?, meter_enabled = ?, note = ?
         WHERE id = ?`
    ).run(
      input.hostname.trim(),
      input.category,
      input.isVm ? 1 : 0,
      nullableText2(input.sshUser),
      input.sshPort ?? null,
      input.meterEnabled ? 1 : 0,
      nullableText2(input.note),
      id
    );
    return this.getDevice(id);
  }
  deviceDeletionBlockers(id) {
    const serviceRow = this.database.prepare(
      `SELECT COUNT(*) AS count
         FROM services s
         JOIN device_networks dn ON dn.id = s.device_network_id
         WHERE dn.device_id = ?`
    ).get(id);
    const relationRow = this.database.prepare(
      `SELECT COUNT(*) AS count FROM relations
         WHERE from_device_id = ? OR to_device_id = ?`
    ).get(id, id);
    return {
      services: serviceRow.count,
      relations: relationRow.count
    };
  }
  deleteDevice(id) {
    return asNumber2(
      this.database.prepare("DELETE FROM devices WHERE id = ?").run(id).changes
    ) > 0;
  }
  listMemberships() {
    return this.database.prepare(
      `SELECT id, device_id, network_id, ip, label
           FROM device_networks ORDER BY id`
    ).all().map(toApiMembership);
  }
  getMembership(id) {
    const row = this.database.prepare(
      `SELECT id, device_id, network_id, ip, label
         FROM device_networks WHERE id = ?`
    ).get(id);
    return row ? toApiMembership(row) : void 0;
  }
  createMembership(input) {
    const result = this.database.prepare(
      `INSERT INTO device_networks (device_id, network_id, ip, label)
         VALUES (?, ?, ?, ?)`
    ).run(
      input.deviceId,
      input.networkId,
      nullableText2(input.ip),
      nullableText2(input.label)
    );
    return this.getMembership(asNumber2(result.lastInsertRowid));
  }
  updateMembership(id, input) {
    if (!this.getMembership(id)) {
      return void 0;
    }
    this.database.prepare(
      `UPDATE device_networks
         SET device_id = ?, network_id = ?, ip = ?, label = ?
         WHERE id = ?`
    ).run(
      input.deviceId,
      input.networkId,
      nullableText2(input.ip),
      nullableText2(input.label),
      id
    );
    return this.getMembership(id);
  }
  membershipServiceCount(id) {
    return this.database.prepare(
      "SELECT COUNT(*) AS count FROM services WHERE device_network_id = ?"
    ).get(id).count;
  }
  deleteMembership(id) {
    return asNumber2(
      this.database.prepare("DELETE FROM device_networks WHERE id = ?").run(id).changes
    ) > 0;
  }
  listServices() {
    return this.database.prepare(
      `SELECT s.id, s.device_network_id, s.subdomain, s.petname,
                  s.description, s.port, s.protocol, s.scheme, s.top_path,
                  s.monitor_path, s.service_url, s.icon_key, s.enabled,
                  dn.ip
           FROM services s
           JOIN device_networks dn ON dn.id = s.device_network_id
           ORDER BY s.id`
    ).all().map(toApiService);
  }
  getService(id) {
    return this.listServices().find((service) => service.id === id);
  }
  createService(input) {
    const result = this.database.prepare(
      `INSERT INTO services
          (device_network_id, subdomain, petname, description, port, protocol,
           scheme, top_path, monitor_path, service_url, icon_key, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.deviceNetworkId,
      input.subdomain.trim().toLowerCase(),
      nullableText2(input.petname),
      nullableText2(input.description),
      input.port,
      input.protocol,
      input.scheme,
      nullableText2(input.topPath),
      nullableText2(input.monitorPath),
      nullableText2(input.serviceUrl),
      nullableText2(input.iconKey),
      input.enabled ? 1 : 0
    );
    return this.getService(asNumber2(result.lastInsertRowid));
  }
  updateService(id, input) {
    if (!this.getService(id)) {
      return void 0;
    }
    this.database.prepare(
      `UPDATE services
         SET device_network_id = ?, subdomain = ?, petname = ?,
             description = ?, port = ?, protocol = ?, scheme = ?,
             top_path = ?, monitor_path = ?, service_url = ?, icon_key = ?,
             enabled = ?
         WHERE id = ?`
    ).run(
      input.deviceNetworkId,
      input.subdomain.trim().toLowerCase(),
      nullableText2(input.petname),
      nullableText2(input.description),
      input.port,
      input.protocol,
      input.scheme,
      nullableText2(input.topPath),
      nullableText2(input.monitorPath),
      nullableText2(input.serviceUrl),
      nullableText2(input.iconKey),
      input.enabled ? 1 : 0,
      id
    );
    return this.getService(id);
  }
  deleteService(id) {
    return asNumber2(
      this.database.prepare("DELETE FROM services WHERE id = ?").run(id).changes
    ) > 0;
  }
  listRelations() {
    return this.database.prepare(
      `SELECT id, from_device_id, to_device_id, tag, from_label, to_label,
                  color
           FROM relations ORDER BY id`
    ).all().map(toApiRelation);
  }
  createRelation(input) {
    const result = this.database.prepare(
      `INSERT INTO relations
          (from_device_id, to_device_id, tag, from_label, to_label, color)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      input.fromDeviceId,
      input.toDeviceId,
      nullableText2(input.tag),
      nullableText2(input.fromLabel),
      nullableText2(input.toLabel),
      input.color.trim()
    );
    const row = this.database.prepare(
      `SELECT id, from_device_id, to_device_id, tag, from_label, to_label,
                color
         FROM relations WHERE id = ?`
    ).get(asNumber2(result.lastInsertRowid));
    return toApiRelation(row);
  }
  deleteRelation(id) {
    return asNumber2(
      this.database.prepare("DELETE FROM relations WHERE id = ?").run(id).changes
    ) > 0;
  }
  traverseRelations(deviceId, depth) {
    const device = this.getDevice(deviceId);
    if (!device) {
      return void 0;
    }
    const rows = this.database.prepare(
      `SELECT r.id, r.from_device_id, r.to_device_id, r.tag,
                r.from_label, r.to_label, r.color
         FROM relations r
         WHERE r.from_device_id = ? OR r.to_device_id = ?
         ORDER BY r.id`
    ).all(deviceId, deviceId);
    const devices = this.listDevices();
    return {
      deviceId,
      depth,
      relations: rows.map((row) => {
        const relation = toApiRelation(row);
        const direction = relation.fromDeviceId === deviceId ? "outgoing" : "incoming";
        const relatedDeviceId = direction === "outgoing" ? relation.toDeviceId : relation.fromDeviceId;
        const label = direction === "outgoing" ? relation.fromLabel ?? relation.tag : relation.toLabel ?? relation.tag;
        return {
          ...relation,
          direction,
          label,
          relatedDevice: devices.find((candidate) => candidate.id === relatedDeviceId) ?? null
        };
      })
    };
  }
  getSettings() {
    const row = this.database.prepare("SELECT domain, title FROM settings WHERE id = 1").get();
    return {
      domain: row?.domain ?? "ouchi.local",
      title: row?.title ?? "\u3042\u306A\u305F\u306E\u30DB\u30FC\u30E0\u30E9\u30DC"
    };
  }
  updateSettings(title) {
    this.database.prepare(
      `INSERT INTO settings (id, domain, title)
         VALUES (1, 'ouchi.local', ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title`
    ).run(title.trim());
    return this.getSettings();
  }
  getPortalData() {
    return {
      version: 2,
      networks: this.listNetworks(),
      devices: this.listDevices(),
      services: this.listServices(),
      relations: this.listRelations(),
      settings: this.getSettings()
    };
  }
};

// server/index.ts
var port = Number(process.env.PORT ?? 3e3);
var hostname = process.env.HOST ?? "0.0.0.0";
var database = new PortalDatabase({
  filename: process.env.OUCHI_DB_PATH ? resolve2(process.env.OUCHI_DB_PATH) : void 0
});
var app = createApp(database);
app.get(
  "/api/*",
  (context) => context.json({ error: "API\u30A8\u30F3\u30C9\u30DD\u30A4\u30F3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404)
);
app.use(
  "/*",
  serveStatic({
    root: "./demo-dist"
  })
);
app.get(
  "*",
  serveStatic({
    path: "./index.html",
    root: "./demo-dist"
  })
);
var server = serve(
  {
    fetch: app.fetch,
    hostname,
    port
  },
  (info) => {
    console.log(
      `ouchi.local v1 listening on http://${hostname}:${info.port}`
    );
    console.log(
      `SQLite ledger: ${process.env.OUCHI_DB_PATH ? resolve2(process.env.OUCHI_DB_PATH) : resolve2(process.cwd(), "data", "ouchi.sqlite")}`
    );
  }
);
function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
