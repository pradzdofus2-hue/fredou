import type { ErrorCode } from '../lib/contracts';
export class GameError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400) { super(message); this.name = 'GameError'; }
}
export function ensure(condition: unknown, code: ErrorCode, message: string, status = 400): asserts condition {
  if (!condition) throw new GameError(code, message, status);
}
