/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTAL_DATA_SOURCE?: "api" | "yaml";
  readonly VITE_SAMPLE_LEDGER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
