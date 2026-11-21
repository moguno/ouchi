import { writeFile } from "node:fs/promises";

const PACKAGE_API =
  "https://data.jsdelivr.com/v1/package/gh/homarr-labs/dashboard-icons";
const METADATA_URL =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/metadata.json";
const OUTPUT = new URL(
  "../src/data/dashboard-icons-index.json",
  import.meta.url,
);

const FALLBACK_SLUGS = [
  "actual-budget",
  "adguard-home",
  "alist",
  "alltube",
  "amazon",
  "ansible",
  "apache",
  "apprise",
  "argocd",
  "audiobookshelf",
  "authentik",
  "authelia",
  "bazarr",
  "bitwarden",
  "bookstack",
  "caddy",
  "calibre",
  "calibre-web",
  "changedetection",
  "cloudflare",
  "cloudflare-pages",
  "cloudflare-workers",
  "code-server",
  "collabora-online",
  "couchdb",
  "crowdsec",
  "deluge",
  "discord",
  "docker",
  "dokuwiki",
  "duplicati",
  "element",
  "emby",
  "esphome",
  "filebrowser",
  "firefly-iii",
  "flaresolverr",
  "freshrss",
  "frp",
  "gitea",
  "github",
  "gitlab",
  "glances",
  "grafana",
  "grocy",
  "guacamole",
  "hass",
  "headscale",
  "heimdall",
  "home-assistant",
  "homebridge",
  "homer",
  "immich",
  "influxdb",
  "jdownloader",
  "jellyfin",
  "jellyseerr",
  "kavita",
  "komga",
  "kuma",
  "lazylibrarian",
  "lidarr",
  "linkding",
  "linuxserver",
  "mariadb",
  "mastodon",
  "mealie",
  "memcached",
  "minecraft",
  "minio",
  "mongodb",
  "mosquitto",
  "mysql",
  "n8n",
  "navidrome",
  "netdata",
  "netbox",
  "nextcloud",
  "nginx",
  "nginx-proxy-manager",
  "node-red",
  "notion",
  "ntfy",
  "ombi",
  "omv",
  "onlyoffice",
  "open-webui",
  "openhab",
  "opnsense",
  "overseerr",
  "paperless-ngx",
  "phpmyadmin",
  "photoprism",
  "pihole",
  "plex",
  "portainer",
  "postgresql",
  "prometheus",
  "proxmox",
  "prowlarr",
  "radarr",
  "redis",
  "rocketchat",
  "romm",
  "rsshub",
  "rustdesk",
  "sabnzbd",
  "scrutiny",
  "searxng",
  "sonarr",
  "speedtest-tracker",
  "syncthing",
  "tailscale",
  "tautulli",
  "technitium",
  "traefik",
  "transmission",
  "truenas",
  "unifi",
  "unraid",
  "uptime-kuma",
  "vaultwarden",
  "vikunja",
  "watchtower",
  "wg-easy",
  "wiki-js",
  "wireshark",
  "wordpress",
  "xteve",
  "youtube",
  "zabbix",
  "zerotier",
  "zigbee2mqtt",
  "zulip",
  "zwave-js-ui",
  "2fauth",
  "3cx",
  "a-self-hosted-service",
  "a11y",
  "adblock",
  "adminer",
  "affine",
  "airsonic",
  "alpine-linux",
  "amazon-s3",
  "android",
  "apollo",
  "apple",
  "archivebox",
  "arduino",
  "ariang",
  "awx",
  "backrest",
  "bash",
  "blueiris",
  "booksonic",
  "bt",
  "casaos",
  "chrome",
  "cups",
  "dashy",
  "debian",
  "directus",
  "dnsmasq",
  "drawio",
  "drone",
  "elasticsearch",
  "emulatorjs",
  "esxi",
  "f-droid",
  "fastapi",
  "firefox",
  "flame",
  "frigate",
  "gitea-actions",
  "gotify",
  "greenlight",
  "haproxy",
  "harbor",
  "healthchecks",
  "hugo",
  "it-tools",
  "jackett",
  "jenkins",
  "kasm",
  "keycloak",
  "kibana",
  "kodbox",
  "libreoffice",
  "librespeed",
  "mattermost",
  "mikrotik",
  "motioneye",
  "mumble",
  "nagios",
  "nextdns",
  "nvidia",
  "octoprint",
  "openvpn",
  "pfsense",
  "prowlarr",
  "proxtainer",
  "python",
  "qnap",
  "raspberry-pi",
  "rclone",
  "restic",
  "samba",
  "script-server",
  "semaphore",
  "shlink",
  "slack",
  "spotify",
  "stirling-pdf",
  "storj",
  "streamlit",
  "synology",
  "systemd",
  "teamcity",
  "telegram",
  "the-lounge",
  "tinyauth",
  "trello",
  "ubiquiti",
  "ubuntu",
  "umami",
  "vscode",
  "webmin",
  "windows",
  "wger",
  "xen-orchestra",
  "yaml",
  "zammad",
];

const NAME_OVERRIDES = {
  "2fauth": "2FAuth",
  "adguard-home": "AdGuard Home",
  "actual-budget": "Actual Budget",
  "code-server": "code-server",
  "home-assistant": "Home Assistant",
  "nginx-proxy-manager": "Nginx Proxy Manager",
  "node-red": "Node-RED",
  "open-webui": "Open WebUI",
  "paperless-ngx": "Paperless-ngx",
  "pihole": "Pi-hole",
  "raspberry-pi": "Raspberry Pi",
  "searxng": "SearXNG",
  "uptime-kuma": "Uptime Kuma",
  "vaultwarden": "Vaultwarden",
  "wg-easy": "wg-easy",
  "wiki-js": "Wiki.js",
  "zwave-js-ui": "Z-Wave JS UI",
};

function displayName(slug) {
  if (NAME_OVERRIDES[slug]) {
    return NAME_OVERRIDES[slug];
  }
  return slug
    .replace(/[-_.]+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function iconFromSlug(value, suppliedName) {
  const raw = String(value ?? "")
    .replace(/^\/?svg\//, "")
    .replace(/\.svg$/i, "")
    .trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(raw)) {
    return undefined;
  }
  const slug = raw.toLowerCase();
  return {
    slug,
    name:
      typeof suppliedName === "string" && suppliedName.trim()
        ? suppliedName.trim()
        : displayName(slug),
  };
}

function parseMetadata(payload) {
  const found = new Map();
  const visit = (entry, key) => {
    if (typeof entry === "string") {
      const icon = iconFromSlug(entry, entry);
      if (icon) {
        found.set(icon.slug, icon);
      }
      return;
    }
    if (!entry || typeof entry !== "object") {
      return;
    }
    const slug =
      entry.slug ??
      entry.base ??
      entry.file ??
      entry.id ??
      entry.name ??
      key;
    const icon = iconFromSlug(slug, entry.displayName ?? entry.label ?? entry.title);
    if (icon) {
      found.set(icon.slug, icon);
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach((entry) => visit(entry));
  } else if (payload && Array.isArray(payload.icons)) {
    payload.icons.forEach((entry) => visit(entry));
  } else if (payload && typeof payload.icons === "object") {
    Object.entries(payload.icons).forEach(([key, entry]) => visit(entry, key));
  } else if (payload && typeof payload === "object") {
    Object.entries(payload).forEach(([key, entry]) => visit(entry, key));
  }
  return Array.from(found.values());
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ouchi-local-portal-icon-index/1",
    },
  });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function onlineIndex() {
  const packageInfo = await fetchJson(PACKAGE_API);
  const version = packageInfo.tags?.latest ?? packageInfo.version;
  if (!version) {
    throw new Error("jsDelivr package version was not found");
  }

  let icons = [];
  try {
    icons = parseMetadata(await fetchJson(METADATA_URL));
  } catch {
    const flat = await fetchJson(
      `${PACKAGE_API}@${encodeURIComponent(version)}/flat`,
    );
    icons = (flat.files ?? [])
      .filter((file) => /^\/svg\/[^/]+\.svg$/i.test(file.name))
      .map((file) => iconFromSlug(file.name))
      .filter(Boolean);
  }
  if (icons.length === 0) {
    throw new Error("dashboard-icons entries were not found");
  }
  return {
    packageVersion: version,
    snapshotMode: "jsdelivr",
    complete: true,
    icons,
  };
}

function bootstrapIndex() {
  const icons = Array.from(
    new Set(FALLBACK_SLUGS.map((slug) => slug.toLowerCase())),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((slug) => iconFromSlug(slug))
    .filter(Boolean);
  return {
    packageVersion: "offline-bootstrap-2026-11-21",
    snapshotMode: "offline-bootstrap",
    complete: false,
    icons,
  };
}

const bootstrap = process.argv.includes("--bootstrap");
let index;
try {
  index = await onlineIndex();
} catch (error) {
  if (!bootstrap) {
    throw error;
  }
  console.warn(`jsDelivr unavailable; writing bootstrap index: ${error.message}`);
  index = bootstrapIndex();
}

const document = {
  format: "ouchi-dashboard-icons-index/1",
  source: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/",
  metadataApi: PACKAGE_API,
  generatedAt: new Date().toISOString(),
  ...index,
  icons: index.icons.sort((left, right) => left.slug.localeCompare(right.slug)),
};

await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${document.icons.length} icons (${document.snapshotMode}) to ${OUTPUT.pathname}`,
);
