import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPortal } from "./apiClient";
import type { PortalDataV2 } from "./types";
import { fetchPortalFromYaml } from "./yamlDataSource";

interface UsePortalDataOptions {
  seed?: PortalDataV2;
  apiBaseUrl?: string;
  yamlUrl?: string;
  onDataChange?: (data: PortalDataV2) => void;
}

interface UsePortalDataResult {
  data: PortalDataV2 | undefined;
  loading: boolean;
  error?: string;
  reload: () => Promise<PortalDataV2 | undefined>;
  setLocalData: (data: PortalDataV2) => void;
}

export function usePortalData({
  seed,
  apiBaseUrl = "",
  yamlUrl,
  onDataChange,
}: UsePortalDataOptions): UsePortalDataResult {
  const [data, setData] = useState<PortalDataV2 | undefined>(seed);
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState<string>();
  const requestVersion = useRef(0);
  const onChangeRef = useRef(onDataChange);

  useEffect(() => {
    onChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    if (seed) {
      setData(seed);
      setLoading(false);
      setError(undefined);
      onChangeRef.current?.(seed);
    }
  }, [seed]);

  const reload = useCallback(async () => {
    if (seed) {
      return seed;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setError(undefined);
    try {
      const next = yamlUrl
        ? await fetchPortalFromYaml(yamlUrl)
        : await fetchPortal(apiBaseUrl);
      if (version === requestVersion.current) {
        setData(next);
        onChangeRef.current?.(next);
      }
      return next;
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(
          cause instanceof Error
            ? `${yamlUrl ? "YAML" : "API"}からデータを取得できませんでした: ${cause.message}`
            : `${yamlUrl ? "YAML" : "API"}からデータを取得できませんでした`,
        );
      }
      return undefined;
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }, [apiBaseUrl, seed, yamlUrl]);

  useEffect(() => {
    if (!seed) {
      void reload();
    }
  }, [reload, seed]);

  const setLocalData = useCallback((next: PortalDataV2) => {
    setData(next);
    setError(undefined);
    onChangeRef.current?.(next);
  }, []);

  return { data, loading, error, reload, setLocalData };
}
