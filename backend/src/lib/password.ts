import bcrypt from 'bcryptjs';
import { BCRYPT_COST } from '../config.js';

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifySecret(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
