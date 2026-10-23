export const DEFAULT_OPENAI_KEY = (import.meta as any).env?.VITE_OPENAI_API_KEY || '';

export function getActiveOpenAIKey(customKey?: string): string {
  if (
    customKey &&
    customKey.trim().length > 15 &&
    !customKey.trim().startsWith('sk-proj-ttX9ZlL1') &&
    !customKey.trim().startsWith('AQ.')
  ) {
    return customKey.trim();
  }
  return DEFAULT_OPENAI_KEY;
}
