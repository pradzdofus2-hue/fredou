import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ErrorCode, ErrorResponse } from '../lib/contracts';

export class HttpError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400) { super(message); }
}
export const appOrigin = () => new URL(process.env.APP_URL || 'http://localhost:3000').origin;
export function isLocalDevelopment(): boolean {
  const local=['localhost','127.0.0.1','[::1]'].includes(new URL(appOrigin()).hostname);
  return local && (process.env.LOCAL_DEV_MODE === 'true' || (process.env.LOCAL_DEV_MODE === undefined && !process.env.DISCORD_CLIENT_ID));
}
export function validateOrigin(request: Request): void {
  const expected = new URL(appOrigin());
  const allowed = new Set([expected.origin]);
  if (isLocalDevelopment() && ['localhost','127.0.0.1','[::1]'].includes(expected.hostname)) {
    for (const host of ['localhost','127.0.0.1','[::1]']) allowed.add(`${expected.protocol}//${host}${expected.port ? ':'+expected.port : ''}`);
  }
  const origin = request.headers.get('origin');
  const actualUrl = new URL(request.url);
  const host = request.headers.get('host') || actualUrl.host;
  if (!origin || !allowed.has(origin) || !allowed.has(`${actualUrl.protocol}//${host}`)) {
    throw new HttpError('FORBIDDEN', 'Origine de la requête non autorisée.', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError('FORBIDDEN', 'Requête intersite refusée.', 403);
}
export function validateIdempotencyKey(value: string | null): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new HttpError('VALIDATION_ERROR', 'Une clé de requête UUID est nécessaire.', 400);
  return result.data;
}
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError('VALIDATION_ERROR','Le contenu doit être au format JSON.',400);
  }
  const maxBytes = 16_384;
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new HttpError('VALIDATION_ERROR','Requête trop volumineuse.',413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError('VALIDATION_ERROR','Corps de requête manquant.',400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError('VALIDATION_ERROR','Requête trop volumineuse.',413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new HttpError('VALIDATION_ERROR','JSON invalide.',400); }
}

const globalRate = globalThis as typeof globalThis & { fredouRateLimit?: Map<string,{count:number;until:number}> };
const buckets = globalRate.fredouRateLimit ??= new Map();
export function rateLimit(identity: string, limit = 60): void {
  const now=Date.now();
  for (const [key,bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const bucket = buckets.get(identity);
  if (bucket && bucket.count >= limit) throw new HttpError('RATE_LIMITED','Trop de requêtes. Patientez une minute.',429);
  if (bucket) bucket.count++;
  else {
    if (buckets.size > 10_000) throw new HttpError('RATE_LIMITED','Serveur occupé. Réessayez dans une minute.',429);
    buckets.set(identity,{count:1,until:now+60_000});
  }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
}
export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) return json({error:{code:'VALIDATION_ERROR',message:'Certains champs sont invalides.',fields:z.flattenError(error).fieldErrors}} satisfies ErrorResponse,422);
  if (error instanceof Error && 'code' in error && 'status' in error && typeof error.status === 'number') {
    const response=json({error:{code:error.code as ErrorCode,message:error.message}} satisfies ErrorResponse,error.status);
    if(error.status===429) response.headers.set('Retry-After','60');
    return response;
  }
  const incident=randomUUID();
  // No request bodies, cookies, tokens or stack traces in routine logs.
  console.error('[fredou]',incident,error instanceof Error? error.name:'UnknownError');
  return json({error:{code:'INTERNAL_ERROR',message:`Erreur interne. Référence ${incident.slice(0,8)}.`}} satisfies ErrorResponse,500);
}
