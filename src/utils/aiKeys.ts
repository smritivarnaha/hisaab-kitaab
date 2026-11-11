export const DEFAULT_OPENAI_KEY = (import.meta as any).env?.VITE_OPENAI_API_KEY || '';

export function isValidGeminiKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (trimmed.startsWith('AIza') || trimmed.startsWith('AQ.')) && trimmed.length >= 25;
}

export function getActiveOpenAIKey(customKey?: string): string {
  if (
    customKey &&
    customKey.trim().length > 15 &&
    customKey.trim().startsWith('sk-') &&
    !customKey.trim().startsWith('sk-proj-ttX9ZlL1')
  ) {
    return customKey.trim();
  }
  return DEFAULT_OPENAI_KEY;
}
