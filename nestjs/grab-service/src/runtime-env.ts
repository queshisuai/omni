export function requireEnv(name: string, missingMessage: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(missingMessage);
  }
  return value;
}

export function requireIntegerEnv(name: string, missingMessage: string, invalidMessage: string): number {
  const rawValue = requireEnv(name, missingMessage);
  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    throw new Error(invalidMessage);
  }
  return value;
}
