import { Socket } from 'socket.io';
import { OnGatewayDisconnect } from '@nestjs/websockets';
import { DockerService } from 'src/docker/docker.service';

export interface GuiAppConfig {
  image: string;
  eventName: string;       // e.g., 'labyrinth-madness-started'
  memoryMB?: number;       // Defaults to 512
  nanoCpus?: number;       // Defaults to 0.5 CPU
  delayMs?: number;        // Defaults to 3000
}

export abstract class BaseDockerGateway implements OnGatewayDisconnect {

  private readonly MAX_CONCURRENT_CONTAINERS = 10;

  constructor(protected readonly dockerService: DockerService) {}

  // Automatically fires when a user closes the browser tab
  handleDisconnect(client: Socket) {
    this.cleanupContainer(client, 'Disconnected-Tab');
  }

  // PROTECTED: Only accessible by child gateways (FormFiller, Haskell, etc.)
  protected async cleanupContainer(client: Socket, appName: string) {
    const container = client.data.activeContainer;
    
    if (!container) {
      console.log(`[Warning] No active container to stop for ${appName}.`);
      return;
    }

    console.log(`[Shutdown] Stopping ${appName} (ID: ${container.id})...`);
    
    // Delegate the actual killing to the pure Docker service
    await this.dockerService.removeContainer(container);
    
    // Clear the WebSocket session memory
    client.data.activeContainer = null;
    console.log(`[Success] ${appName} memory cleared.`);
  }

  // 2. Centralized GUI App Logic
  protected async startGuiApp(client: Socket, config: GuiAppConfig) {
    try {
      const memory = (config.memoryMB || 512) * 1024 * 1024;
      const cpus = config.nanoCpus || 500000000;
      const delay = config.delayMs || 3000;

      const container = await this.dockerService.createContainer({
        Image: config.image,
        ExposedPorts: { '8080/tcp': {} },
        HostConfig: {
          AutoRemove: true,
          PublishAllPorts: true,
          Memory: memory,
          NanoCpus: cpus,
        },
      });

      client.data.activeContainer = container;
      await container.start();

      const containerInfo = await container.inspect();
      const dynamicPort = containerInfo.NetworkSettings.Ports['8080/tcp'][0].HostPort;
      
      console.log(`[GUI] ${config.image} started dynamically on port ${dynamicPort}`);

      setTimeout(() => {
        client.emit(config.eventName, { 
          message: 'Server Ready',
          port: dynamicPort 
        });
      }, delay);

    } catch (error) {
      console.error(`Error starting ${config.image}:`, error);
      client.emit('error', `Failed to start ${config.image}: ${error.message}`);
    }
  }

  // 3. Centralized Terminal App Logic
  protected async startTerminalApp(client: Socket, imageName: string) {
    try {
      client.emit('terminal-output', `Starting ${imageName}...\r\n`);

      const container = await this.dockerService.createContainer({
        Image: imageName,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        HostConfig: { AutoRemove: true },
      });

      client.data.activeContainer = container;

      const stream = await container.attach({
        stream: true, stdout: true, stderr: true, stdin: true,
      });
      
      client.data.stream = stream;
      
      stream.on('data', (chunk) => {
        client.emit('terminal-output', chunk.toString('utf8'));
      });
      
      await container.start();
      
    } catch (error) {
      client.emit('terminal-output', `\r\nError: ${error.message}\r\n`);
    }
  }

  protected writeToTerminal(client: Socket, data: string) {
    const stream = client.data.stream;
    if (stream) stream.write(data);
  }
}