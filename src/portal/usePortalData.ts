import { useEffect, useRef, useState } from "react";
import type { PortalDataV2, PortalStatus } from "./types";
import { validatePortalData } from "./validation";

type PortalDataUpdater = (current: PortalDataV2) => PortalDataV2;

interface UsePortalDataOptions {
  seed: PortalDataV2;
  storageKey: string;
  onDataChange?: (data: PortalDataV2) => void;
}

interface UsePortalDataResult {
  data: PortalDataV2;
  storageWarning?: string;
  updateData: (updater: PortalDataUpdater) => void;
  resetData: () => void;
}

function safeClone(data: PortalDataV2): PortalDataV2 {
  return structuredClone(data);
}

function loadInitialData(
  seed: PortalDataV2,
  storageKey: string,
): { data: PortalDataV2; warning?: string } {
  if (typeof window === "undefined") {
    return { data: safeClone(seed) };
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return { data: safeClone(seed) };
    }

    const parsed = validatePortalData(JSON.parse(stored));
    if (parsed.value) {
      return { data: parsed.value };
    }

    return {
      data: safeClone(seed),
      warning:
        "保存データを読み込めなかったため、初期データへ戻しました。管理画面からデータを確認できます。",
    };
  } catch {
    return {
      data: safeClone(seed),
      warning:
        "保存データを読み込めなかったため、初期データへ戻しました。管理画面からデータを確認できます。",
    };
  }
}

function chooseNextStatus(previous: PortalStatus): PortalStatus {
  const roll = Math.random();
  let next: PortalStatus;

  if (roll < 0.79) {
    next = "up";
  } else if (roll < 0.94) {
    next = "down";
  } else {
    next = "maintenance";
  }

  if (next === previous) {
    return previous === "up" ? "down" : "up";
  }

  return next;
}

export function usePortalData({
  seed,
  storageKey,
  onDataChange,
}: UsePortalDataOptions): UsePortalDataResult {
  const initial = useRef(loadInitialData(seed, storageKey));
  const [data, setData] = useState<PortalDataV2>(initial.current.data);
  const [storageWarning, setStorageWarning] = useState<string | undefined>(
    initial.current.warning,
  );
  const onChangeRef = useRef(onDataChange);
  const hasPersistedOnce = useRef(false);

  useEffect(() => {
    onChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      onChangeRef.current?.(data);
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
      if (hasPersistedOnce.current) {
        setStorageWarning(undefined);
      }
    } catch {
      setStorageWarning("ブラウザへ保存できませんでした。編集内容は再読み込みで消えます。");
    }

    hasPersistedOnce.current = true;
    onChangeRef.current?.(data);
  }, [data, storageKey]);

  useEffect(() => {
    if (data.services.length === 0 || typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      setData((current) => {
        if (current.services.length === 0) {
          return current;
        }

        const index = Math.floor(Math.random() * current.services.length);
        const services = current.services.map((service, serviceIndex) =>
          serviceIndex === index
            ? {
                ...service,
                status: chooseNextStatus(service.status),
              }
            : service,
        );

        return { ...current, services };
      });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [data.services.length]);

  function updateData(updater: PortalDataUpdater) {
    setData((current) => updater(current));
  }

  function resetData() {
    setData(safeClone(seed));
    setStorageWarning(undefined);
  }

  return { data, storageWarning, updateData, resetData };
}
