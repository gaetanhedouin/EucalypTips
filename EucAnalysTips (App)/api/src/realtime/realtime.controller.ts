import { Controller, Sse } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

interface SseEvent {
  data: unknown;
  type?: string;
}

@Controller('public/stream')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('leaderboard')
  leaderboardStream(): Observable<SseEvent> {
    return this.realtimeService.stream().pipe(
      map((event) => ({
        type: event.type,
        data: event,
      })),
    );
  }
}
