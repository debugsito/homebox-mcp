/**
 * Arranca el bot en long polling. Se lanza desde el servidor junto a la API.
 *
 *   npm run bot
 */
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { buildBot } from './bot.js';

async function main() {
  const token = config.TELEGRAM_BOT_TOKEN;

  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN no está configurado');
    process.exit(1);
  }

  if (config.TELEGRAM_ALLOWED_CHAT_IDS.length === 0) {
    logger.error('TELEGRAM_ALLOWED_CHAT_IDS está vacío: el bot no respondería a nadie');
    process.exit(1);
  }

  const bot = buildBot(token);
  const yo = await bot.api.getMe();

  logger.info(
    { bot: yo.username, autorizados: config.TELEGRAM_ALLOWED_CHAT_IDS.length },
    'Bot de Telegram arrancando'
  );

  for (const senal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(senal, () => {
      logger.info({ senal }, 'Parando el bot');
      void bot.stop();
    });
  }

  await bot.start();
}

main().catch((err) => {
  logger.error({ error: err instanceof Error ? err.message : err }, 'El bot falló al arrancar');
  process.exit(1);
});
