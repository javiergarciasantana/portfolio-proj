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
    width: 600,   // 512 previous
    height: 700, // 640 previous
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
  'n-queens-omp': {
    appId: 'n-queens-omp',
    width: 1000,
    height: 600,
    launchCmd: () => ({
      cmd: '/opt/portfolio/n_queens_omp/build/NQueensVisualizer',
      args: [],
      env: { LIBGL_ALWAYS_SOFTWARE: '1' },
    }),
  },
};

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})
export class NativeAppGateway implements OnGatewayDisconnect {
  constructor(private readonly sessionPool: SessionPoolService) {}
  
  private activeIps = new Map<string, string>(); // Maps IP -> Client ID

  handleConnection(client: Socket) {
    // 1. Get the REAL IP from Cloudflare (fallback to standard IP if testing locally)
    const ip = (client.handshake.headers['cf-connecting-ip'] as string) || client.handshake.address;
    
    // 2. If the IP is already in the map (e.g. you refreshed the page), 
    // we let you in and just overwrite the old ghost session ID.
    if (this.activeIps.has(ip)) {
      console.log(`[Session] IP ${ip} reconnected (Page Refresh). Overwriting ghost session.`);
    } else {
      console.log(`[Session] New IP connected: ${ip}`);
    }
    
    // 3. Register the newly refreshed tab as the active owner of this IP
    this.activeIps.set(ip, client.id);
  }

  handleDisconnect(client: Socket) {
    const ip = (client.handshake.headers['cf-connecting-ip'] as string) || client.handshake.address;
    
    // ONLY delete the IP if the disconnecting client is the CURRENT active one.
    // This stops the old ghost session from deleting your newly refreshed session's IP!
    if (this.activeIps.get(ip) === client.id) {
      this.activeIps.delete(ip);
      console.log(`[Session] IP completely disconnected: ${ip}`);
    }

    // ... your existing PTY and SessionPool cleanup code below ...
    if (client.data.ptyProcess) {
      client.data.ptyProcess.kill();
      client.data.ptyProcess = null;
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

  @SubscribeMessage('start-n-queens-omp')
  handleStartNQueens(@ConnectedSocket() client: Socket) {
    return this.acquireGui(client, 'n-queens-omp', 'n-queens-omp-started');
  }

  @SubscribeMessage('stop-n-queens-omp')
  handleStopNQueens(@ConnectedSocket() client: Socket) {
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
        env: {
          HOME: process.env.HOME ?? '/root',
          PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
          TERM: 'xterm-256color',
          LANG: process.env.LANG ?? 'en_US.UTF-8',
        },
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

  //--------Getters-----------------------------------
  public getActiveSessions() {
    return Array.from(this.activeIps.entries()).map(([ip, clientId]) => ({
      ip,
      clientId
    }));
  }
}
