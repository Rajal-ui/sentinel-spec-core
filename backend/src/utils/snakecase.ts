/**
 * Converts a camelCase key to snake_case.
 */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/**
 * Shallow-converts all object keys from camelCase to snake_case.
 * Handles plain objects only; nested objects and arrays pass through unchanged.
 */
export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}
