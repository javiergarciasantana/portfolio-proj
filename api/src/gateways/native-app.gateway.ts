import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SessionPoolService, AppConfig } from '../sessions/session-pool.service';

let pty: typeof import('node-pty') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pty = require('node-pty');
} catch {
  console.warn('[PTY] node-pty unavailable');
}

const GUI_CONFIGS: Record<string, AppConfig> = {
  'form-filler': {
    appId: 'form-filler',
    width: 512,
    height: 640,
    launchCmd: () => ({
      cmd: 'mvn',
      args: ['javafx:run'],
      cwd: '/opt/portfolio/form-filler',
    }),
  },
  'labyrinth-madness': {
    appId: 'labyrinth-madness',
    width: 608,
    height: 740,
    launchCmd: () => ({
      cmd: 'java',
      args: [
        '-cp',
        '/opt/portfolio/labyrinth/LabyrinthApp.jar:/opt/portfolio/labyrinth/core.jar',
        'labyrinth_madness.src.Main',
      ],
    }),
  },
  'polygon-triangulation': {
    appId: 'polygon-triangulation',
    width: 800,
    height: 600,
    launchCmd: () => ({
      cmd: '/opt/portfolio/polygon_triangulation/build/PolygonTriangulation',
      args: ['/opt/portfolio/polygon_triangulation/sample.txt'],
      env: { LIBGL_ALWAYS_SOFTWARE: '1' },
    }),
  },
};

@WebSocketGateway({ cors: true })
export class NativeAppGateway implements OnGatewayDisconnect {
  constructor(private readonly sessionPool: SessionPoolService) {}

  handleDisconnect(client: Socket) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
      console.log(`[PTY] killed on disconnect  client=${client.id}`);
    }
    this.sessionPool.releaseSlot(client.id).catch(err =>
      console.error(`[Pool] releaseSlot error  client=${client.id}  ${err.message}`),
    );
  }

  // ─── Haskell TUI ────────────────────────────────────────────────────────────

  @SubscribeMessage('start-haskell')
  handleStartHaskell(@ConnectedSocket() client: Socket) {
    this.spawnPty(client, '/opt/portfolio/haskell-tui', []);
  }

  @SubscribeMessage('stop-haskell')
  handleStopHaskell(@ConnectedSocket() client: Socket) {
    this.killPty(client);
  }

  // ─── N-Queens OpenMP ─────────────────────────────────────────────────────────

  @SubscribeMessage('start-n-queens-omp')
  handleStartNQueens(@ConnectedSocket() client: Socket) {
    this.spawnPty(client, '/opt/portfolio/n_queens_omp/n_queens_omp', []);
  }

  @SubscribeMessage('stop-n-queens-omp')
  handleStopNQueens(@ConnectedSocket() client: Socket) {
    this.killPty(client);
  }

  // ─── PTY input / resize ─────────────────────────────────────────────────────

  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    client.data.ptyProcess?.write(data);
  }

  @SubscribeMessage('terminal-resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() size: { cols: number; rows: number },
  ) {
    client.data.ptyProcess?.resize(size.cols, size.rows);
  }

  // ─── GUI apps — session pool ─────────────────────────────────────────────────

  @SubscribeMessage('start-form-filler')
  handleStartFormFiller(@ConnectedSocket() client: Socket) {
    return this.acquireGui(client, 'form-filler', 'form-filler-started');
  }

  @SubscribeMessage('stop-form-filler')
  handleStopFormFiller(@ConnectedSocket() client: Socket) {
    this.sessionPool.releaseSlot(client.id);
  }

  @SubscribeMessage('start-labyrinth-madness')
  handleStartLabyrinth(@ConnectedSocket() client: Socket) {
    return this.acquireGui(client, 'labyrinth-madness', 'labyrinth-madness-started');
  }

  @SubscribeMessage('stop-labyrinth-madness')
  handleStopLabyrinth(@ConnectedSocket() client: Socket) {
    this.sessionPool.releaseSlot(client.id);
  }

  @SubscribeMessage('start-polygon-triangulation')
  handleStartPolygon(@ConnectedSocket() client: Socket) {
    return this.acquireGui(client, 'polygon-triangulation', 'polygon-triangulation-started');
  }

  @SubscribeMessage('stop-polygon-triangulation')
  handleStopPolygon(@ConnectedSocket() client: Socket) {
    this.sessionPool.releaseSlot(client.id);
  }

  // ─── Chrome extension — static info card, no backend needed ─────────────────

  @SubscribeMessage('start-dalui-scrape')
  handleStartDalui(@ConnectedSocket() client: Socket) {
    client.emit('dalui-scrape-started', {});
  }

  @SubscribeMessage('stop-dalui-scrape')
  handleStopDalui() { /* static — nothing to stop */ }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async acquireGui(client: Socket, appId: string, readyEvent: string) {
    const cfg = GUI_CONFIGS[appId];
    console.log(`[Pool] acquire  app=${appId}  client=${client.id}`);
    try {
      const slot = await this.sessionPool.acquireSlot(appId, client.id, cfg);
      console.log(`[Pool] ready  app=${appId}  ws=${slot.wsPort}  client=${client.id}`);
      client.emit(readyEvent, { port: slot.wsPort });
    } catch (err: any) {
      const message = err.message === 'pool_full'
        ? 'All sessions busy. Try again shortly.'
        : `Failed to start ${appId}: ${err.message}`;
      console.error(`[Pool] error  app=${appId}  ${err.message}`);
      client.emit('app-error', { app: appId, message });
    }
  }

  private spawnPty(client: Socket, binary: string, args: string[]) {
    if (!pty) {
      client.emit('terminal-output', '\r\n[Error] node-pty not available on server.\r\n');
      return;
    }
    console.log(`[PTY] spawn  binary=${binary}  client=${client.id}`);
    try {
      const proc = pty.spawn(binary, args, {
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
      console.error(`[PTY] spawn failed  ${err.message}`);
      client.emit('terminal-output', `\r\n[Failed to start]: ${err.message}\r\n`);
    }
  }

  private killPty(client: Socket) {
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
      console.log(`[PTY] stopped  client=${client.id}`);
    }
  }
}
