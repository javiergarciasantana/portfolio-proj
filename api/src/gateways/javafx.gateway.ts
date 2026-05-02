import { WebSocketGateway, SubscribeMessage, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DockerService } from 'src/docker/docker.service';
import { BaseDockerGateway } from './base-docker.gateway';

@WebSocketGateway({ cors: true })
export class JavaFxGateway extends BaseDockerGateway {

  constructor(dockerService: DockerService) {
    super(dockerService);
  }

  // Cuando el usuario cierra específicamente la ventana de WinBox
  @SubscribeMessage('stop-form-filler')
  async handleStopJavaFx(@ConnectedSocket() client: Socket) {
    await this.cleanupContainer(client, 'form-filler');
  }

  @SubscribeMessage('start-form-filler')
  async handleStartJavaFx(@ConnectedSocket() client: Socket) {
    await this.startGuiApp(client, {
      image: 'form-filler',
      eventName: 'form-filler-started',
      memoryMB: 1024, 
      nanoCpus: 500000000,
      delayMs: 3000
    });
  }
}