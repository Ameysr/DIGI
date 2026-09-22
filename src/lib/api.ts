/** Small typed wrapper for the four serverless functions in /api. */
export async function postJson<TResponse>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as
    | (TResponse & { error?: string })
    | null

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
  }

  return payload as TResponse
}
