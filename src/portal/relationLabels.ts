/**
 * Display form of a relation endpoint label.
 *
 * Labels live on each relation as free text and may be empty; an empty
 * label is not displayed at all (no fallback to the relation name).
 */
export function displayRelationLabel(
  label: string | null | undefined,
): string {
  return label?.trim() ?? "";
}
