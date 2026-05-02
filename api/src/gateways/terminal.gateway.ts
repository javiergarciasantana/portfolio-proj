import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseDockerGateway } from './base-docker.gateway';
import { DockerService } from 'src/docker/docker.service';


@WebSocketGateway({ cors: true })
export class TerminalGateway extends BaseDockerGateway {
  constructor(dockerService: DockerService) {
    super(dockerService);
  }

  // Cuando el usuario cierra específicamente la ventana de WinBox
  @SubscribeMessage('stop-haskell')
  async handleStopJavaFx(@ConnectedSocket() client: Socket) {
    await this.cleanupContainer(client, 'haskell-tui');
  }

  @SubscribeMessage('start-haskell')
  async handleStartHaskell(@ConnectedSocket() client: Socket) {
    await this.startTerminalApp(client, 'haskell-tui');
  }

  // Escuchamos lo que el usuario teclea en la web y lo metemos al contenedor
  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    this.writeToTerminal(client, data);
  }
}