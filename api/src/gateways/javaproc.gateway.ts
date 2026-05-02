import { WebSocketGateway, SubscribeMessage, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DockerService } from 'src/docker/docker.service';
import { BaseDockerGateway } from './base-docker.gateway';

@WebSocketGateway({ cors: true })
export class JavaProcGateway extends BaseDockerGateway {

  constructor(dockerService: DockerService) {
    super(dockerService);
  }

  // Cuando el usuario cierra específicamente la ventana de WinBox
  @SubscribeMessage('stop-labyrinth-madness')
  async handleStopJavaFx(@ConnectedSocket() client: Socket) {
    await this.cleanupContainer(client, 'labyrinth-madness');
  }

  @SubscribeMessage('start-labyrinth-madness')
  async handleStartJavaFx(@ConnectedSocket() client: Socket) {
    await this.startGuiApp(client, {
      image: 'labyrinth-madness',
      eventName: 'labyrinth-madness-started',
      memoryMB: 1024, 
      nanoCpus: 500000000,
      delayMs: 3000
    });
  }
}