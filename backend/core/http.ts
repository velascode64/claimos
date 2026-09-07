export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

export async function fetchJson<T>(
  provider: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "application/json", ...init?.headers },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ProviderError(provider, `${provider} network request failed: ${reason}`)
  }

  const body = await response.text()
  if (!response.ok) {
    throw new ProviderError(provider, `${provider} returned HTTP ${response.status}: ${body.slice(0, 300)}`, response.status)
  }

  try {
    return JSON.parse(body) as T
  } catch {
    throw new ProviderError(provider, `${provider} returned invalid JSON`, response.status)
  }
}
