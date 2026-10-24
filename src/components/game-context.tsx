'use client';
import { createContext, useContext } from 'react';
import type { Action, ActionResult, StateResponse } from '@/lib/contracts';
export interface GameContextValue { state: StateResponse; busy: boolean; act: (action: Action) => Promise<ActionResult | null>; login: () => void; notify: (message: string) => void; }
export const GameContext = createContext<GameContextValue | null>(null);
export function useGame() { const game = useContext(GameContext); if (!game) throw new Error('Game context missing'); return game; }
export const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
export const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
