import { buildApp } from './app.js';
import { getPort } from './config.js';

async function main(): Promise<void> {
  const app = await buildApp();
  const port = getPort();
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
