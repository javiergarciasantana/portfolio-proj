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
    console.log(`[WS] client disconnected  id=${client.id}  hasPty=${!!client.data.ptyProcess}  hasContainer=${!!client.data.activeContainer}`);
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

  private async waitForXpraHttp(
    port: string,
    image: string,
    timeoutMs = 30000,
    intervalMs = 800,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require('http') as typeof import('http');
    const ts = () => new Date().toISOString();
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt++;
      const ok = await new Promise<boolean>(resolve => {
        const req = http.get(
          { hostname: 'localhost', port: Number(port), path: '/', timeout: 2000 },
          res => {
            console.log(`[GUI][${ts()}] health-check attempt=${attempt}  port=${port}  status=${res.statusCode}`);
            res.destroy();
            resolve(res.statusCode < 500);
          },
        );
        req.on('error', err => {
          console.log(`[GUI][${ts()}] health-check attempt=${attempt}  port=${port}  err=${err.message}`);
          resolve(false);
        });
        req.on('timeout', () => {
          console.log(`[GUI][${ts()}] health-check attempt=${attempt}  port=${port}  timeout`);
          req.destroy();
          resolve(false);
        });
      });

      if (ok) {
        console.log(`[GUI][${ts()}] xpra ready  image=${image}  port=${port}  attempts=${attempt}`);
        return;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error(`xpra on localhost:${port} not ready after ${timeoutMs}ms (${attempt} attempts)`);
  }

  protected async startGuiApp(client: Socket, config: GuiAppConfig) {
    const ts = () => new Date().toISOString();
    console.log(`[GUI][${ts()}] START  image=${config.image}  client=${client.id}`);
    try {
      const memory = (config.memoryMB || 512) * 1024 * 1024;
      const cpus = config.nanoCpus || 500000000;

      console.log(`[GUI][${ts()}] createContainer  image=${config.image}  mem=${config.memoryMB}MB`);
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
      console.log(`[GUI][${ts()}] container created  id=${container.id}`);

      client.data.activeContainer = container;
      await container.start();
      console.log(`[GUI][${ts()}] container started  id=${container.id}`);

      const containerInfo = await container.inspect();
      const portBinding = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (!portBinding || !portBinding[0]) {
        throw new Error(`No port binding for 8080/tcp on container ${container.id}`);
      }
      const dynamicPort = portBinding[0].HostPort;
      console.log(`[GUI][${ts()}] port mapped  image=${config.image}  hostPort=${dynamicPort}`);

      await this.waitForXpraHttp(dynamicPort, config.image);

      console.log(`[GUI][${ts()}] emit '${config.eventName}'  port=${dynamicPort}  client=${client.id}`);
      client.emit(config.eventName, { message: 'Server Ready', port: dynamicPort });

    } catch (error) {
      console.error(`[GUI][${ts()}] ERROR starting ${config.image}:`, error.message);
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
