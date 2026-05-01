import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DockerService } from 'src/docker/docker.service';
@WebSocketGateway({ cors: true })
export class TerminalGateway implements OnGatewayDisconnect {
  constructor(private readonly dockerService: DockerService) {}

  // Cuando el usuario recarga la web o cierra la pestaña por completo
  handleDisconnect(client: Socket) {
    this.dockerService.killContainer(client);
  }

  // Cuando el usuario cierra específicamente la ventana de WinBox
  @SubscribeMessage('stop-haskell')
  handleStopJavaFx(@ConnectedSocket() client: Socket) {
    this.dockerService.killContainer(client);
  }

  @SubscribeMessage('start-haskell')
  async handleStartHaskell(@ConnectedSocket() client: Socket) {
    try {
      client.emit('terminal-output', 'Starting Haskell Container...\r\n');

      // 1. Creamos y arrancamos el contenedor con tu imagen
      const container = await this.dockerService.createContainer({
        Image: 'haskell-tui', // El nombre de la imagen que construimos
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        HostConfig: {
          AutoRemove: true // <--- CRUCIAL: Se auto-destruye al detenerse
        }
      });

      client.data.activeContainer = container; // Lo guardamos para poder matarlo luego
      
      // 2. Nos "enganchamos" a la terminal del contenedor
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
        stdin: true,
      });
      
      client.data.stream = stream;
      
      // 3. Enviamos todo lo que sale del contenedor a la web
      stream.on('data', (chunk) => {
        client.emit('terminal-output', chunk.toString('utf8'));
      });
      
      await container.start();
      
    } catch (error) {
      client.emit('terminal-output', `\r\nError al iniciar Docker: ${error.message}\r\n`);
    }
  }

  // Escuchamos lo que el usuario teclea en la web y lo metemos al contenedor
  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    const stream = client.data.stream;
    if (stream) {
      stream.write(data);
    }
  }
}