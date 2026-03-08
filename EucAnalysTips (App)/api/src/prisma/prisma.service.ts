import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private databaseAvailable = false;
  private lastReconnectAttemptAt = 0;
  private reconnectInFlight: Promise<boolean> | null = null;

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL missing, API running in degraded mode (no database).');
      this.databaseAvailable = false;
      return;
    }

    const available = await this.ensureDatabaseAvailable({ logStartupFailure: true });
    if (available) {
      this.logger.log('Database connection established');
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.databaseAvailable = false;
    } catch {
      // No-op on shutdown.
    }
  }

  isDatabaseAvailable(): boolean {
    return this.databaseAvailable;
  }

  async ensureDatabaseAvailable(options?: { logStartupFailure?: boolean }): Promise<boolean> {
    if (!process.env.DATABASE_URL) {
      this.databaseAvailable = false;
      return false;
    }

    if (this.databaseAvailable) {
      return true;
    }

    if (this.reconnectInFlight) {
      return this.reconnectInFlight;
    }

    // Avoid hammering prisma connect attempts when the database is down.
    const now = Date.now();
    const reconnectBackoffMs = 3000;
    if (now - this.lastReconnectAttemptAt < reconnectBackoffMs) {
      return false;
    }

    this.lastReconnectAttemptAt = now;
    this.reconnectInFlight = this.tryReconnect(options);
    try {
      return await this.reconnectInFlight;
    } finally {
      this.reconnectInFlight = null;
    }
  }

  private async tryReconnect(options?: { logStartupFailure?: boolean }): Promise<boolean> {
    try {
      await this.$connect();
      this.databaseAvailable = true;
      this.logger.log('Database connection re-established');
      return true;
    } catch (error) {
      this.databaseAvailable = false;
      if (options?.logStartupFailure) {
        const message = this.toSingleLineError(error);
        this.logger.warn(`Database unavailable at startup: ${message}`);
      }
      return false;
    }
  }

  private toSingleLineError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.split('\n')[0]?.trim() ?? 'Unknown error';
    }
    return String(error);
  }
}
