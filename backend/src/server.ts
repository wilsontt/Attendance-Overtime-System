import { buildApp } from './app.js';
import { getPort } from './config.js';
import { syncGovCalendarQuiet } from './modules/calendar/govCalendar.service.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const app = await buildApp();
  const port = getPort();
  await app.listen({ port, host: '0.0.0.0' });

  // 背景同步：失敗不阻斷主流程（仍可手勾補班）
  void syncGovCalendarQuiet(app.log);
  setInterval(() => {
    void syncGovCalendarQuiet(app.log);
  }, ONE_DAY_MS);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
