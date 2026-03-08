import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { RealtimeEvent } from '@nouveau/types';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly channel = 'nouveau.realtime.events';
  private readonly eventBus = new Subject<RealtimeEvent>();
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private redisEnabled = false;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    try {
      this.publisher = new Redis(redisUrl, { lazyConnect: true });
      this.subscriber = new Redis(redisUrl, { lazyConnect: true });
      // Prevent unhandled ioredis error events when Redis is down in local dev.
      this.publisher.on('error', () => undefined);
      this.subscriber.on('error', () => undefined);

      await this.publisher.connect();
      await this.subscriber.connect();
      await this.subscriber.subscribe(this.channel);

      this.subscriber.on('message', (_channel, message) => {
        try {
          const event = JSON.parse(message) as RealtimeEvent;
          this.eventBus.next(event);
        } catch {
          // Ignore malformed events to keep stream healthy.
        }
      });

      this.redisEnabled = true;
      this.logger.log('Redis pub/sub realtime enabled');
    } catch (error) {
      const message = this.toSingleLineError(error);
      this.logger.warn(`Redis init failed, using local realtime bus: ${message}`);
      this.redisEnabled = false;
      await this.safeDisconnectRedis();
      this.publisher = null;
      this.subscriber = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.safeDisconnectRedis();
  }

  emit<TPayload>(event: RealtimeEvent<TPayload>): void {
    if (this.redisEnabled && this.publisher) {
      void this.publisher.publish(this.channel, JSON.stringify(event)).catch(() => {
        this.eventBus.next(event as RealtimeEvent);
      });
      return;
    }

    this.eventBus.next(event as RealtimeEvent);
  }

  stream(): Observable<RealtimeEvent> {
    return this.eventBus.asObservable();
  }

  private async safeDisconnectRedis(): Promise<void> {
    try {
      await this.publisher?.quit();
    } catch {
      // Ignore shutdown errors.
    }
    try {
      await this.subscriber?.quit();
    } catch {
      // Ignore shutdown errors.
    }
  }

  private toSingleLineError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.split('\n')[0]?.trim() ?? 'Unknown error';
    }
    return String(error);
  }
}
