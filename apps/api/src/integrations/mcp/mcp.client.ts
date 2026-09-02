export type ProviderLoginInput = { login: string; password: string }

export interface McpClient {
  discoverTools(): Promise<string[]>
  authenticate(input: ProviderLoginInput): Promise<unknown>
  reauthorize(input: { refreshToken: string }): Promise<unknown>
}
