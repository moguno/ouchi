/**
 * Resolve a directional relation label from its relation-name template.
 *
 * Every `{}` in the template receives the relation edge's placeholder value.
 * An empty value is rendered as `-`. An empty template falls back to the
 * relation name and deliberately ignores the placeholder.
 */
export function resolveRelationLabel(
  template: string | null | undefined,
  placeholder: string | null | undefined,
  relationName: string,
): string {
  const normalizedTemplate = template?.trim() ?? "";
  if (!normalizedTemplate) {
    return relationName;
  }
  const value = placeholder?.trim() || "-";
  return normalizedTemplate.split("{}").join(value);
}

export function hasRelationPlaceholder(
  template: string | null | undefined,
): boolean {
  return template?.includes("{}") ?? false;
}
