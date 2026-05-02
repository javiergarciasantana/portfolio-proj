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
  
  public async listContainers() {
    return await this.docker.listContainers();
  }

  // Pure Docker logic. No Sockets allowed here!
  public async removeContainer(container: Docker.Container): Promise<void> {
    try {
      await container.stop();
    } catch (error) {
      try {
        await container.kill();
      } catch (killError) {
        console.error(`[Fatal] Could not kill container:`, killError.message);
      }
    }
  }
}
