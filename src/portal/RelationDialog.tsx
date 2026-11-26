import { useState, type FormEvent } from "react";
import { FormActions } from "./EntityFormParts";
import { ManageDialog } from "./ManageDialog";
import {
  RelationEditor,
  type RelationEditableField,
  type RelationEndpointKind,
} from "./RelationEditor";
import type {
  PortalDataV2,
  PortalRelation,
  ValidationIssue,
} from "./types";
import {
  generateId,
  validateRelationInput,
} from "./validation";

interface RelationDialogProps {
  data: PortalDataV2;
  editing?: PortalRelation;
  onClose: () => void;
  onSave: (relation: PortalRelation) => Promise<void>;
  saveDisabled?: boolean;
}

export function RelationDialog({
  data,
  editing,
  onClose,
  onSave,
  saveDisabled = false,
}: RelationDialogProps) {
  const firstRelationName = data.relationNames[0];
  const firstInterface = data.interfaces[0];
  const firstOtherInterface = data.interfaces.find(
    (iface) => iface.deviceId !== firstInterface?.deviceId,
  );
  const [relation, setRelation] = useState<PortalRelation>(() =>
    editing
      ? { ...editing }
      : {
          id: generateId("relation"),
          relationNameId: firstRelationName?.id ?? "",
          relationName: firstRelationName?.name ?? "",
          fromDeviceId: firstInterface?.deviceId ?? "",
          toDeviceId:
            firstOtherInterface?.deviceId ?? firstInterface?.deviceId ?? "",
          fromInterfaceId: firstInterface?.id ?? "",
          toInterfaceId:
            firstOtherInterface?.id ?? firstInterface?.id ?? "",
          fromServiceId: null,
          toServiceId: null,
          fromLabel: "",
          toLabel: "",
          port: null,
          protocol: null,
          color: firstRelationName?.color ?? "#d5a22b",
          lineStart: firstRelationName?.lineStart ?? "circle",
          lineEnd: firstRelationName?.lineEnd ?? "circle",
        },
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  function updateRelation(field: RelationEditableField, value: string) {
    const definition = data.relationNames.find(
      (candidate) => candidate.name === value,
    );
    setRelation((current) => ({
      ...current,
      [field]:
        field === "port"
          ? value === ""
            ? null
            : Number(value)
          : field === "protocol"
            ? value === ""
              ? null
              : value
            : value,
          ...(field === "relationName" && definition
            ? {
                relationNameId: definition.id,
                color: definition.color,
                lineStart: definition.lineStart,
                lineEnd: definition.lineEnd,
          }
        : {}),
    }));
  }

  function changeEndpointKind(
    side: "from" | "to",
    kind: RelationEndpointKind,
  ) {
    setRelation((current) => {
      if (kind === "service") {
        const firstService = data.services[0];
        return side === "from"
          ? { ...current, fromServiceId: firstService?.id ?? "", fromInterfaceId: null }
          : { ...current, toServiceId: firstService?.id ?? "", toInterfaceId: null };
      }
      const firstInterface = data.interfaces[0];
      return side === "from"
        ? { ...current, fromInterfaceId: firstInterface?.id ?? "", fromServiceId: null }
        : { ...current, toInterfaceId: firstInterface?.id ?? "", toServiceId: null };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const endpointDeviceId = (
      interfaceId: string | null,
      serviceId: string | null,
    ): string | undefined => {
      if (serviceId) {
        const service = data.services.find(
          (candidate) => candidate.id === serviceId,
        );
        return data.interfaces.find(
          (iface) => iface.id === service?.interfaceId,
        )?.deviceId;
      }
      return data.interfaces.find((iface) => iface.id === interfaceId)
        ?.deviceId;
    };
    const normalized: PortalRelation = {
      ...relation,
      relationName: relation.relationName.trim(),
      fromDeviceId:
        endpointDeviceId(relation.fromInterfaceId, relation.fromServiceId) ??
        relation.fromDeviceId,
      toDeviceId:
        endpointDeviceId(relation.toInterfaceId, relation.toServiceId) ??
        relation.toDeviceId,
      fromLabel: relation.fromLabel.trim(),
      toLabel: relation.toLabel.trim(),
    };
    const nextIssues = validateRelationInput(
      normalized,
      data,
      editing?.id,
    );
    setIssues(nextIssues);
    if (nextIssues.length > 0) {
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManageDialog
      onClose={onClose}
      title={`関係を${editing ? "編集" : "追加"}`}
    >
      <form className="ouchi-manage-form" onSubmit={handleSubmit}>
        {issues.length > 0 && (
          <div className="ouchi-form-notice" role="alert">
            <strong>入力内容を確認してください</strong>
            <ul>
              {issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <RelationEditor
          devices={data.devices}
          index={0}
          interfaces={data.interfaces}
          services={data.services}
          onChange={updateRelation}
          onKindChange={changeEndpointKind}
          onDelete={onClose}
          relation={relation}
          relationNames={data.relationNames}
          showFromInterface
        />
        <FormActions
          disabled={saveDisabled}
          disabledReason="デモモードでは保存されません。"
          onClose={onClose}
          saving={saving}
          submitLabel={editing ? "保存" : "追加する"}
        />
      </form>
    </ManageDialog>
  );
}
