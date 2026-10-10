/** Returns a user-facing error if any required field is blank, else null. */
export function missingRequired(
  body: Record<string, unknown>,
  required: [key: string, label: string][]
): string | null {
  const missing = required
    .filter(([key]) => !String(body[key] ?? "").trim())
    .map(([, label]) => label);

  return missing.length
    ? "Please fill in the required fields: " + missing.join(", ") + "."
    : null;
}
