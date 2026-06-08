import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import * as net from 'net';

// Fixed noVNC websockify ports — each app runs permanently as a systemd service
const VNC_PORTS: Record<string, number> = {
  'form-filler':        6081,
  'labyrinth-madness':  6082,
};

let pty: typeof import('node-pty') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pty = require('node-pty');
} catch {
  console.warn('[PTY] node-pty unavailable — install it with npm install');
}

function tcpCheck(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error',   () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
}

@WebSocketGateway({ cors: true })
export class NativeAppGateway implements OnGatewayDisconnect {

  handleDisconnect(client: Socket) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
      console.log(`[PTY] killed on disconnect  client=${client.id}`);
    }
  }

  // ─── Haskell TUI — native PTY ────────────────────────────────────────────

  @SubscribeMessage('start-haskell')
  handleStartHaskell(@ConnectedSocket() client: Socket) {
    if (!pty) {
      client.emit('terminal-output', '\r\n[Error] node-pty not available on server.\r\n');
      return;
    }
    const binary = '/opt/portfolio/haskell-tui';
    console.log(`[PTY] spawn  binary=${binary}  client=${client.id}`);
    try {
      const proc = pty.spawn(binary, [], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: '/tmp',
        env: process.env as Record<string, string>,
      });
      client.data.ptyProcess = proc;
      proc.onData(data => client.emit('terminal-output', data));
      proc.onExit(({ exitCode }) => {
        console.log(`[PTY] exited  code=${exitCode}  client=${client.id}`);
        client.emit('terminal-output', `\r\n[Process exited with code ${exitCode}]\r\n`);
        client.data.ptyProcess = null;
      });
    } catch (err: any) {
      console.error(`[PTY] failed to spawn  ${err.message}`);
      client.emit('terminal-output', `\r\n[Failed to start]: ${err.message}\r\n`);
    }
  }

  @SubscribeMessage('stop-haskell')
  handleStopHaskell(@ConnectedSocket() client: Socket) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
      console.log(`[PTY] stopped  client=${client.id}`);
    }
  }

  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    client.data.ptyProcess?.write(data);
  }

  @SubscribeMessage('terminal-resize')
  handleResize(@ConnectedSocket() client: Socket, @MessageBody() size: { cols: number; rows: number }) {
    client.data.ptyProcess?.resize(size.cols, size.rows);
  }

  // ─── GUI apps — always-on noVNC ──────────────────────────────────────────

  @SubscribeMessage('start-form-filler')
  async handleStartFormFiller(@ConnectedSocket() client: Socket) {
    await this.checkAndEmit(client, 'form-filler', 'form-filler-started');
  }

  @SubscribeMessage('start-labyrinth-madness')
  async handleStartLabyrinth(@ConnectedSocket() client: Socket) {
    await this.checkAndEmit(client, 'labyrinth-madness', 'labyrinth-madness-started');
  }

  // Always-on: stop events are no-ops — service keeps running for all visitors
  @SubscribeMessage('stop-form-filler')
  handleStopFormFiller() { /* no-op */ }

  @SubscribeMessage('stop-labyrinth-madness')
  handleStopLabyrinth() { /* no-op */ }

  private async checkAndEmit(client: Socket, appId: string, readyEvent: string) {
    const port = VNC_PORTS[appId];
    console.log(`[VNC] health-check  app=${appId}  port=${port}  client=${client.id}`);
    const alive = await tcpCheck(port);
    if (alive) {
      console.log(`[VNC] service up  app=${appId}  port=${port}`);
      client.emit(readyEvent, { port });
    } else {
      console.error(`[VNC] service down  app=${appId}  port=${port}`);
      client.emit('app-error', {
        app: appId,
        message: `${appId} is not running. Run: sudo systemctl start ${appId}`,
      });
    }
  }
}
