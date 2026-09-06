import {
  Injectable,
  INestApplication,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Closes the Nest application (and therefore this client) on SIGINT/SIGTERM
   * so in-flight transactions finish before the pod goes away.
   *
   * Prisma 5 removed the `beforeExit` client event for the library engine, so
   * this hooks the process signals directly rather than `$on('beforeExit')` —
   * which now throws at startup.
   */
  enableShutdownHooks(app: INestApplication): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        void app.close();
      });
    }
  }
}
