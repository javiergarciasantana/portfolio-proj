import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import Docker from 'dockerode';

@WebSocketGateway({ cors: true })
export class TerminalGateway implements OnGatewayDisconnect {
  private docker = new Docker({ socketPath: '/var/run/docker.sock' });

  // Cuando el usuario cierra la web, matamos su contenedor
  handleDisconnect(client: Socket) {
    const container = client.data.container;
    if (container) {
      container.kill().catch(() => {});
    }
  }

  @SubscribeMessage('start-haskell')
  async handleStartHaskell(@ConnectedSocket() client: Socket) {
    try {
      client.emit('terminal-output', 'Starting Haskell Container...\r\n');

      // 1. Creamos y arrancamos el contenedor con tu imagen
      const container = await this.docker.createContainer({
        Image: 'haskell-tui', // El nombre de la imagen que construimos
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
      });

      client.data.container = container; // Lo guardamos para poder matarlo luego
      
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