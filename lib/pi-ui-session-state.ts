declare global {
  var __piUiSettingsGeneration: number | undefined;
  var __piUiSessionGenerations: Map<string, number> | undefined;
  var __piUiStartingSessionGenerations: Map<string, number> | undefined;
}

function sessionGenerations(): Map<string, number> {
  if (!globalThis.__piUiSessionGenerations) globalThis.__piUiSessionGenerations = new Map();
  return globalThis.__piUiSessionGenerations;
}

function startingSessionGenerations(): Map<string, number> {
  if (!globalThis.__piUiStartingSessionGenerations) globalThis.__piUiStartingSessionGenerations = new Map();
  return globalThis.__piUiStartingSessionGenerations;
}

export function getPiUiSettingsGeneration(): number {
  return globalThis.__piUiSettingsGeneration ?? 0;
}

export function advancePiUiSettingsGeneration(): number {
  const next = getPiUiSettingsGeneration() + 1;
  globalThis.__piUiSettingsGeneration = next;
  return next;
}

export function setPiUiSessionGeneration(sessionId: string, generation: number): void {
  sessionGenerations().set(sessionId, generation);
}

export function clearPiUiSessionGeneration(sessionId: string): void {
  sessionGenerations().delete(sessionId);
}

export function setPiUiStartingSessionGeneration(sessionId: string, generation: number): void {
  startingSessionGenerations().set(sessionId, generation);
}

export function clearPiUiStartingSessionGeneration(sessionId: string): void {
  startingSessionGenerations().delete(sessionId);
}

export function isPiUiSessionPromptStale(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const current = getPiUiSettingsGeneration();
  const applied = sessionGenerations().get(sessionId);
  const starting = startingSessionGenerations().get(sessionId);
  return (applied !== undefined && applied < current)
    || (starting !== undefined && starting < current);
}
