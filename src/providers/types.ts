export interface Provider {
  suggest(prompt: string, language?: string): Promise<string>;
}
