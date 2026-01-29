import config from './config/index.js';
import { startServer } from './server.js';

async function bootstrap() {
  try {
    const server = await startServer();
    console.info('\n✅ Servidor iniciado correctamente');
    console.info(`📍 Base URL: ${config.baseURL}`);
    console.info(`💼 Wallet UUID: ${config.walletUuid}`);
    console.info(`\n📚 Documentación disponible en: http://localhost:${config.port}/api/docs`);
    console.info(`\n🔗 Endpoints disponibles:`);
    console.info(`   GET  http://localhost:${config.port}/health`);
    console.info(`   GET  http://localhost:${config.port}/api/docs`);
    console.info(`   GET  http://localhost:${config.port}/api/withdrawal-rules`);
    console.info(`   GET  http://localhost:${config.port}/api/withdrawal-rules/:country`);
    console.info(`   POST http://localhost:${config.port}/api/transactions`);
    console.info(`   POST http://localhost:${config.port}/api/withdraw`);
    console.info(`   GET  http://localhost:${config.port}/api/transactions`);
    console.info(`   GET  http://localhost:${config.port}/api/transactions/:id`);
    console.info(`   POST http://localhost:${config.port}/api/webhook`);
    console.info(`   POST http://localhost:${config.port}/api/ipn/verify`);
    console.info(`   GET  http://localhost:${config.port}/api/assets`);
    console.info(`   GET  http://localhost:${config.port}/api/payment-methods/:country`);
    console.info(`\n💡 Usa Postman para probar los endpoints\n`);

    // Manejo de cierre graceful
    process.on('SIGTERM', () => {
      console.info('\n🛑 Cerrando servidor...');
      server.close(() => {
        console.info('✅ Servidor cerrado');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.info('\n🛑 Cerrando servidor...');
      server.close(() => {
        console.info('✅ Servidor cerrado');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', (error as Error).message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap();
}

