import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*' },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(): void {
    this.realtimeService.stream().subscribe((event) => {
      this.server.emit(event.type, event);
    });
  }

  handleConnection(client: Socket): void {
    client.emit('connected', { ts: new Date().toISOString() });
  }
}
