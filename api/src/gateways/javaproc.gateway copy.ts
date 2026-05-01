import { WebSocketGateway, SubscribeMessage, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DockerService } from 'src/docker/docker.service';

@WebSocketGateway({ cors: true })
export class JavaProcGateway implements OnGatewayDisconnect {

  constructor(private readonly dockerService: DockerService) {}
  
  // Cuando el usuario recarga la web o cierra la pestaña por completo
  handleDisconnect(client: Socket) {
    this.dockerService.killContainer(client);
  }

  // Cuando el usuario cierra específicamente la ventana de WinBox
  @SubscribeMessage('stop-labyrinth-madness')
  handleStopJavaFx(@ConnectedSocket() client: Socket) {
    this.dockerService.killContainer(client);
  }

  @SubscribeMessage('start-labyrinth-madness')
  async handleStartJavaFx(@ConnectedSocket() client: Socket) {
    try {
      // 1. Asignamos un puerto en tu servidor (8081).
      // Nota: Si vas a tener varios usuarios a la vez en el futuro, 
      // aquí generaríamos un puerto aleatorio libre. Para ti ahora, 8081 es perfecto.
      const hostPort = '8081'; 
      // 2. Creamos el contenedor mapeando el puerto interno (8080) al puerto de tu host (8081)
      const container = await this.dockerService.createContainer({
        Image: 'labyrinth-madness', // La imagen de Java 21
        HostConfig: {
          AutoRemove: true,  // <--- NUEVO: Docker destruye el contenedor al parar
          PortBindings: {
            '8080/tcp': [
              { HostPort: hostPort }
            ]
          }
        }
      });

      // Lo guardamos en la sesión para que handleDisconnect pueda limpiarlo luego
      client.data.activeContainer = container; 

      // 3. ¡Encendemos la máquina!
      await container.start();
      console.log(`Contenedor labyrinth-madness iniciado en el puerto ${hostPort}`);

      // 4. Le damos 3 segundos a Xvfb (la pantalla) y VNC para que arranquen dentro de Docker
      // antes de decirle al frontend que ya puede conectarse.
      setTimeout(() => {
        client.emit('labyrinth-madness-started', { 
          message: 'Java Processing Server Ready',
          port: hostPort 
        });
      }, 3000);

    } catch (error) {
      console.error('Error arrancando labyrinth-madness:', error);
      client.emit('error', `Error al iniciar labyrinth-madness: ${error.message}`);
    }
  }
}