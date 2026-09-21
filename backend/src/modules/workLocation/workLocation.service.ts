import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';

const MAX_LEN = 40;

export type WorkLocationTermDto = {
  id: string;
  text: string;
  createdAt: string;
};

function normalizeText(raw: string): string {
  const text = Array.from(raw.replace(/\r?\n/g, '').trim())
    .slice(0, MAX_LEN)
    .join('');
  if (!text) {
    throw new AppError(400, 'VALIDATION_ERROR', '工作地點不可為空');
  }
  if (text.length > MAX_LEN) {
    throw new AppError(400, 'VALIDATION_ERROR', `工作地點最多 ${MAX_LEN} 字`);
  }
  return text;
}

function toDto(row: {
  id: string;
  text: string;
  createdAt: Date;
}): WorkLocationTermDto {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function searchWorkLocations(
  q: string,
  limit = 20,
): Promise<{ items: WorkLocationTermDto[] }> {
  const prefix = q.trim();
  if (!prefix) {
    throw new AppError(400, 'VALIDATION_ERROR', 'q 必填');
  }
  if (prefix.length > MAX_LEN) {
    throw new AppError(400, 'VALIDATION_ERROR', `q 最多 ${MAX_LEN} 字`);
  }
  const take = Math.min(Math.max(limit, 1), 50);
  const prefixLower = prefix.toLowerCase();

  // SQLite 不支援 Prisma mode: 'insensitive'；詞庫量小，應用層前綴比對
  const candidates = await prisma.workLocationTerm.findMany({
    orderBy: { text: 'asc' },
  });
  const rows = candidates
    .filter((row) => row.text.toLowerCase().startsWith(prefixLower))
    .slice(0, take);

  return { items: rows.map(toDto) };
}

/**
 * 冪等新增：已存在回傳既有列（HTTP 層區分 200／201）。
 */
export async function upsertWorkLocation(
  actor: AuthUser,
  rawText: string,
): Promise<{ term: WorkLocationTermDto; created: boolean }> {
  const text = normalizeText(rawText);
  const existing = await prisma.workLocationTerm.findUnique({
    where: { text },
  });
  if (existing) {
    return { term: toDto(existing), created: false };
  }

  const created = await prisma.workLocationTerm.create({
    data: {
      text,
      createdBy: actor.id,
    },
  });
  return { term: toDto(created), created: true };
}
