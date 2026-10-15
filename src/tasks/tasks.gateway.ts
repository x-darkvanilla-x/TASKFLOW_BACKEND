import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TasksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('TasksGateway');

  afterInit() {
    this.logger.log('Socket.IO TasksGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:workspace')
  handleJoinWorkspace(
    @MessageBody() workspaceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (workspaceId) {
      client.join(`workspace:${workspaceId}`);
      this.logger.log(`Client ${client.id} joined room workspace:${workspaceId}`);
    }
  }

  @SubscribeMessage('leave:workspace')
  handleLeaveWorkspace(
    @MessageBody() workspaceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (workspaceId) {
      client.leave(`workspace:${workspaceId}`);
      this.logger.log(`Client ${client.id} left room workspace:${workspaceId}`);
    }
  }

  emitTaskCreated(task: any) {
    if (!this.server) return;
    this.server.emit('task:created', task);
  }

  emitTaskUpdated(task: any) {
    if (!this.server) return;
    this.server.emit('task:updated', task);
  }

  emitTaskDeleted(id: string, userId?: string, workspaceId?: string) {
    if (!this.server) return;
    this.server.emit('task:deleted', { id, userId, workspaceId });
  }
}
