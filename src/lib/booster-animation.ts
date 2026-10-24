/** Presentation only. The server has already assigned all five cards before this state is created. */
export type OpeningPhase = 'pack' | 'tear' | 'fan' | 'reveal' | 'summary';
export interface OpeningAnimation {
  phase: OpeningPhase;
  revealed: number[];
  flipping: number | null;
  automatic: boolean;
}
export type OpeningAnimationAction =
  | { type: 'OPEN' }
  | { type: 'TEAR_DONE' }
  | { type: 'FAN_DONE' }
  | { type: 'REVEAL'; index: number }
  | { type: 'FLIP_DONE' }
  | { type: 'AUTOMATIC' }
  | { type: 'REDUCE' };

export function initialOpeningAnimation(reduced = false, replay = false): OpeningAnimation {
  return { phase: reduced || replay ? 'summary' : 'pack', revealed: reduced || replay ? [0, 1, 2, 3, 4] : [], flipping: null, automatic: false };
}

export function openingAnimationReducer(state: OpeningAnimation, action: OpeningAnimationAction): OpeningAnimation {
  switch (action.type) {
    case 'OPEN': return state.phase === 'pack' ? { ...state, phase: 'tear' } : state;
    case 'TEAR_DONE': return state.phase === 'tear' ? { ...state, phase: 'fan' } : state;
    case 'FAN_DONE': return state.phase === 'fan' ? { ...state, phase: 'reveal' } : state;
    case 'REVEAL':
      if (state.phase !== 'reveal' || state.flipping !== null || action.index !== state.revealed.length || action.index < 0 || action.index > 4) return state;
      return { ...state, revealed: [...state.revealed, action.index], flipping: action.index };
    case 'FLIP_DONE':
      if (state.phase !== 'reveal' || state.flipping === null) return state;
      return { ...state, flipping: null, phase: state.revealed.length === 5 ? 'summary' : 'reveal', automatic: state.revealed.length === 5 ? false : state.automatic };
    case 'AUTOMATIC': return state.phase === 'reveal' ? { ...state, automatic: true } : state;
    case 'REDUCE': return initialOpeningAnimation(true);
    default: return state;
  }
}
