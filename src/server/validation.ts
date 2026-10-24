import { z } from 'zod';
import type { Action } from '../lib/contracts';
import { GameError } from './errors';
const entity = z.string().min(1).max(100);
const quantity = z.number().int().min(1).max(50);
const tradeItem = z.object({cardId:entity,quantity}).strict();
const schema = z.discriminatedUnion('type', [
  z.object({type:z.literal('login-dev'),userId:entity}).strict(),
  z.object({type:z.literal('logout')}).strict(),
  z.object({type:z.literal('open'),boosterId:entity}).strict(),
  z.object({type:z.literal('buy-booster'),boosterId:entity,quantity:z.number().int().min(1).max(20)}).strict(),
  z.object({type:z.literal('recycle'),cardId:entity.optional()}).strict(),
  z.object({type:z.literal('favorite'),cardId:entity}).strict(),
  z.object({type:z.literal('listing-create'),cardId:entity,quantity,price:z.number().int().min(1).max(1000000)}).strict(),
  z.object({type:z.literal('listing-buy'),listingId:entity}).strict(),
  z.object({type:z.literal('listing-cancel'),listingId:entity}).strict(),
  z.object({type:z.literal('trade-create'),recipientId:entity,offered:z.array(tradeItem).min(1).max(20),requested:z.array(tradeItem).min(1).max(20)}).strict(),
  z.object({type:z.literal('trade-respond'),tradeId:entity,decision:z.enum(['accept','reject','cancel'])}).strict(),
  z.object({type:z.literal('preferences'),reducedMotion:z.boolean()}).strict(),
  z.object({type:z.literal('event-save'),id:entity.optional(),name:z.string().trim().min(3).max(100),description:z.string().trim().min(3).max(2000),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),active:z.boolean(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),reward:z.number().int().min(0).max(1000)}).strict(),
  z.object({type:z.literal('account-delete'),confirmation:z.string().min(1).max(100)}).strict(),
  z.object({type:z.literal('referral'),code:z.string().trim().min(3).max(40)}).strict(),
]);
export function parseAction(input: unknown): Action {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.issues.map(issue => `${issue.path.join('.')} : ${issue.message}`).join('; '), 422);
  return parsed.data;
}
