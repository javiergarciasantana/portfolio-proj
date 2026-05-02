import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
import { Socket } from 'socket.io';

@Injectable()
export class DockerService {
  private docker: Docker;

  constructor() {
    // Esto conecta tu backend de Node directamente al motor de Docker de Debian
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async testConnection(): Promise<any> {
    try {
      // Pedimos a Docker la lista de contenedores
      const containers = await this.docker.listContainers({ all: true });
      return {
        status: 'Éxito',
        message: '¡NestJS se ha conectado a Docker correctamente!',
        total_containers: containers.length,
        containers: containers.map(c => ({ id: c.Id, names: c.Names, state: c.State }))
      };
    } catch (error) {
      return {
        status: 'Error',
        message: 'Fallo al conectar con Docker. ¿Estás en el grupo docker?',
        error: error.message
      };
    }
  }
  public async createContainer(options: Docker.ContainerCreateOptions) {
    return this.docker.createContainer(options);
  }
  // Función auxiliar para no repetir código
  public async killContainer(client: Socket, appName: String) {
    // In base-docker.gateway.ts
    console.log(`[Shutdown Request] Trying to stop container for: ${appName}`);
    
    const container = client.data.activeContainer;
    if (!container) {
      console.log(`[Warning] No active container found in memory for ${appName}.`);
      return;
    }

    try {
      console.log(`[Docker] Stopping container ${container.id}...`);
      // We call the dockerService directly, or use the container object directly
      await container.stop(); 
      console.log(`[Success] Container ${container.id} stopped and AutoRemoved.`);
      
      // Clear the memory
      client.data.activeContainer = null;
    } catch (error) {
      console.error(`[Error] Failed to stop container:`, error.message);
      // Fallback: If stop fails, force kill it
      try {
        await container.kill();
        console.log(`[Success] Container force-killed.`);
      } catch (killError) {
        console.error(`[Fatal] Could not kill container either.`, killError.message);
      }
    }
  }
 
}
