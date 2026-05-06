import type { Context } from 'hono'

/**
 * Inertia（Axios）は POST データを application/json で送信するため、
 * Content-Type に応じて JSON またはフォームデータをパースする。
 */
export async function parseBody(c: Context): Promise<Record<string, string>> {
  const contentType = c.req.header('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    const json = await c.req.json<Record<string, string>>()
    return json ?? {}
  }

  const body = await c.req.parseBody()
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}
