export type ProviderLoginInput = { login: string; password: string }

export interface McpClient {
  authenticate(input: ProviderLoginInput): Promise<unknown>
  reauthorize(input: { refreshToken: string }): Promise<unknown>
}
