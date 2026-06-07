import { Socket } from 'socket.io';
import { OnGatewayDisconnect } from '@nestjs/websockets';
import { DockerService } from 'src/docker/docker.service';

// Lazy-load node-pty so the app boots even if native bindings aren't compiled yet
let pty: typeof import('node-pty') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pty = require('node-pty');
} catch {
  console.warn('[PTY] node-pty unavailable — run `npm install` to enable direct terminal spawning');
}

export interface GuiAppConfig {
  image: string;
  eventName: string;
  memoryMB?: number;
  nanoCpus?: number;
  delayMs?: number;
}

export abstract class BaseDockerGateway implements OnGatewayDisconnect {

  private readonly MAX_CONCURRENT_CONTAINERS = 10;

  constructor(protected readonly dockerService: DockerService) {}

  handleDisconnect(client: Socket) {
    this.killPty(client);
    if (client.data.activeContainer) {
      this.cleanupContainer(client, 'Disconnected-Tab');
    }
  }

  protected async cleanupContainer(client: Socket, appName: string) {
    const container = client.data.activeContainer;
    if (!container) {
      console.log(`[Warning] No active container to stop for ${appName}.`);
      return;
    }
    console.log(`[Shutdown] Stopping ${appName} (ID: ${container.id})...`);
    await this.dockerService.removeContainer(container);
    client.data.activeContainer = null;
    console.log(`[Success] ${appName} memory cleared.`);
  }

  // ─── PTY (direct process) ──────────────────────────────────────────────────

  protected startPtyApp(client: Socket, command: string, args: string[] = []) {
    if (!pty) {
      client.emit('terminal-output', '\r\n[Error] node-pty not available. Run `npm install` on the server.\r\n');
      return;
    }
    try {
      const ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: process.env.HOME || '/home',
        env: process.env as Record<string, string>,
      });

      client.data.ptyProcess = ptyProcess;

      ptyProcess.onData((data) => {
        client.emit('terminal-output', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        client.emit('terminal-output', `\r\n[Process exited with code ${exitCode}]\r\n`);
        client.data.ptyProcess = null;
      });
    } catch (error) {
      client.emit('terminal-output', `\r\n[Failed to start ${command}]: ${error.message}\r\n`);
    }
  }

  protected resizePty(client: Socket, cols: number, rows: number) {
    client.data.ptyProcess?.resize(cols, rows);
  }

  protected killPty(client: Socket) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
    }
  }

  // ─── Docker GUI apps ───────────────────────────────────────────────────────

  protected async startGuiApp(client: Socket, config: GuiAppConfig) {
    try {
      const memory = (config.memoryMB || 512) * 1024 * 1024;
      const cpus = config.nanoCpus || 500000000;
      const delay = config.delayMs || 4000; // 4s: xpra needs slightly longer than noVNC

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

      console.log(`[GUI] ${config.image} started on port ${dynamicPort}`);

      setTimeout(() => {
        client.emit(config.eventName, {
          message: 'Server Ready',
          port: dynamicPort,
        });
      }, delay);

    } catch (error) {
      console.error(`Error starting ${config.image}:`, error);
      client.emit('error', `Failed to start ${config.image}: ${error.message}`);
    }
  }

  // Kept for legacy terminal-via-Docker fallback
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
