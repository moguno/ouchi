import type { RefObject } from "react";
import type { EntityKind } from "./managementTypes";
import type {
  PortalDataV2,
  PortalDevice,
  PortalInterface,
  PortalNetwork,
  PortalService,
} from "./types";

export interface DeviceMutation {
  device: PortalDevice;
  interfaces: PortalInterface[];
}

export type PortalEntity = PortalNetwork | PortalService | DeviceMutation;

export type EntitySaveHandler = (
  kind: EntityKind,
  entity: PortalEntity,
) => void;

export type FirstFieldRef =
  | RefObject<HTMLInputElement | HTMLSelectElement | null>
  | RefObject<HTMLSelectElement | null>;

export interface EntityFormProps<T> {
  data: PortalDataV2;
  editing?: T;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntitySaveHandler;
  saveDisabled?: boolean;
}

export interface PropertyDraft {
  id: string;
  key: string;
  value: string;
}
