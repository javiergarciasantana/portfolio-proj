import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseDockerGateway } from './base-docker.gateway';
import { DockerService } from 'src/docker/docker.service';
import { APPS } from 'src/app-registry.controller';

@WebSocketGateway({ cors: true })
export class TerminalGateway extends BaseDockerGateway {
  constructor(dockerService: DockerService) {
    super(dockerService);
  }

  @SubscribeMessage('start-haskell')
  handleStartHaskell(@ConnectedSocket() client: Socket) {
    const app = APPS.find(a => a.id === 'haskell-tui');
    if (app?.command) {
      this.startPtyApp(client, app.command);
    } else {
      // Docker fallback until binary is deployed on host
      this.startTerminalApp(client, 'haskell-tui');
    }
  }

  @SubscribeMessage('stop-haskell')
  handleStopHaskell(@ConnectedSocket() client: Socket) {
    this.killPty(client);
    // Also cleanup Docker container if somehow one is running
    if (client.data.activeContainer) {
      this.cleanupContainer(client, 'haskell-tui');
    }
  }

  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.write(data);
    } else {
      this.writeToTerminal(client, data);
    }
  }

  @SubscribeMessage('terminal-resize')
  handleResize(@ConnectedSocket() client: Socket, @MessageBody() size: { cols: number; rows: number }) {
    this.resizePty(client, size.cols, size.rows);
  }
}
