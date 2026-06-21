import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as net from 'net';

const GUI_CAP = 4;
const BASE_DISPLAY = 10;
const BASE_VNC = 5910;
const BASE_WS = 6090;

export interface AppConfig {
  appId: string;
  width: number;
  height: number;
  launchCmd: (display: number) => {
    cmd: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
}

interface SlotProcs {
  xvfb: ChildProcess | null;
  app:  ChildProcess | null;
  vnc:  ChildProcess | null;
  ws:   ChildProcess | null;
}

export interface Slot {
  n: number;
  display: number;
  vncPort: number;
  wsPort: number;
  status: 'free' | 'starting' | 'running' | 'stopping';
  appId: string | null;
  clientId: string | null;
  procs: SlotProcs;
}

export interface PoolStatus {
  cap: number;
  free: number;
  slots: Array<{
    n: number;
    status: string;
    appId: string | null;
    clientId: string | null;
    display: number;
    wsPort: number;
    pids: { xvfb: number | null; app: number | null; vnc: number | null; ws: number | null };
  }>;
}

@Injectable()
export class SessionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionPoolService.name);

  private slots: Slot[] = Array.from({ length: GUI_CAP }, (_, n) => ({
    n,
    display: BASE_DISPLAY + n,
    vncPort: BASE_VNC + n,
    wsPort:  BASE_WS + n,
    status: 'free' as const,
    appId: null,
    clientId: null,
    procs: { xvfb: null, app: null, vnc: null, ws: null },
  }));

  async acquireSlot(appId: string, clientId: string, cfg: AppConfig): Promise<Slot> {
    const existing = this.slots.find(
      s => s.clientId === clientId && s.appId === appId && s.status === 'running',
    );
    if (existing) {
      this.logger.log(`slot ${existing.n} reused  app=${appId}  client=${clientId}`);
      return existing;
    }

    const free = this.slots.filter(s => s.status === 'free').length;
    this.logger.log(`acquire  app=${appId}  client=${clientId}  free=${free}/${GUI_CAP}`);

    const slot = this.slots.find(s => s.status === 'free');
    if (!slot) {
      this.logger.warn(`pool full  app=${appId}  client=${clientId}`);
      throw new Error('pool_full');
    }

    slot.status = 'starting';
    slot.appId = appId;
    slot.clientId = clientId;

    try {
      await this.startSlot(slot, cfg);
      slot.status = 'running';
      this.logPoolState();
      return slot;
    } catch (err) {
      this.logger.error(`startSlot failed  slot=${slot.n}  app=${appId}  err=${(err as Error).message}`);
      await this.killSlot(slot);
      throw err;
    }
  }

  async releaseSlot(clientId: string): Promise<void> {
    const slot = this.slots.find(s => s.clientId === clientId);
    if (!slot || slot.status === 'free') return;
    this.logger.log(`release  slot=${slot.n}  app=${slot.appId}  client=${clientId}`);
    slot.status = 'stopping';
    await this.killSlot(slot);
    this.logPoolState();
  }

  getSlotByClient(clientId: string): Slot | undefined {
    return this.slots.find(s => s.clientId === clientId);
  }

  getPoolStatus(): PoolStatus {
    return {
      cap: GUI_CAP,
      free: this.slots.filter(s => s.status === 'free').length,
      slots: this.slots.map(s => ({
        n: s.n,
        status: s.status,
        appId: s.appId,
        clientId: s.clientId,
        display: s.display,
        wsPort: s.wsPort,
        pids: {
          xvfb: s.procs.xvfb?.pid ?? null,
          app:  s.procs.app?.pid  ?? null,
          vnc:  s.procs.vnc?.pid  ?? null,
          ws:   s.procs.ws?.pid   ?? null,
        },
      })),
    };
  }

  async onModuleDestroy() {
    this.logger.log('shutting down — releasing all slots');
    await Promise.all(this.slots.map(s => this.killSlot(s)));
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async startSlot(slot: Slot, cfg: AppConfig): Promise<void> {
    const { display, vncPort, wsPort, n } = slot;
    const dispStr = `:${display}`;
    this.logger.log(`startSlot  n=${n}  display=${dispStr}  vnc=${vncPort}  ws=${wsPort}  app=${cfg.appId}`);

    // --- AGGRESSIVE ZOMBIE CLEANUP ---
    try {
      // 1. Hunt down and kill any orphaned processes holding this exact display slot
      // We use `|| true` so execSync doesn't throw an error if no process is found
      execSync(`pkill -9 -f "Xvfb :${display}" || true`);
      execSync(`pkill -9 -f "x11vnc -display :${display}" || true`);
      
      // 2. Nuke the stale lock files and UNIX sockets
      execSync(`rm -f /tmp/.X${display}-lock /tmp/.X11-unix/X${display}`);
    } catch (err) {
      this.logger.warn(`Cleanup for display ${display} encountered a minor issue, proceeding anyway.`);
    }
    // ---------------------------------

    // Xvfb
    slot.procs.xvfb = this.spawnLogged('xvfb', slot, 'Xvfb', [
      dispStr, '-screen', '0', `${cfg.width}x${cfg.height}x24`,
    ]);
    await this.sleep(800);

    // App
    const { cmd, args, env = {}, cwd } = cfg.launchCmd(display);
    slot.procs.app = this.spawnLogged('app', slot, cmd, args, {
      env: { ...process.env, DISPLAY: dispStr, ...env } as Record<string, string>,
      cwd,
    });

    // x11vnc
    slot.procs.vnc = this.spawnLogged('vnc', slot, 'x11vnc', [
      '-display', dispStr,
      '-forever', '-nopw', '-shared',
      '-rfbport', String(vncPort),
      '-noipv6',
      '-o', `/tmp/x11vnc-slot${n}.log`,
    ]);
    await this.sleep(600);

    // websockify
    slot.procs.ws = this.spawnLogged('ws', slot, 'websockify', [
      `0.0.0.0:${wsPort}`, `localhost:${vncPort}`, '--web', '/usr/share/novnc/',
    ]);

    this.logger.log(`waiting for ws port ${wsPort}  slot=${n}`);
    await this.waitForPort(wsPort, 15_000);
    this.logger.log(`slot ${n} READY  app=${slot.appId}  ws=${wsPort}`);
  }

  private spawnLogged(
    role: string,
    slot: Slot,
    cmd: string,
    args: string[],
    opts: { env?: Record<string, string>; cwd?: string } = {},
  ): ChildProcess {
    // app role: capture stdout too — mvn/java write build output to stdout
    const stdioMode = role === 'app' ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'];
    const proc = spawn(cmd, args, {
      ...opts,
      detached: false,
      stdio: stdioMode as any,
    });

    this.logger.log(`spawn  role=${role}  slot=${slot.n}  cmd=${cmd}  pid=${proc.pid}`);

    if (role === 'app' && proc.stdout) {
      (proc.stdout as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line) this.logger.debug(`[slot${slot.n}/${role}/out] ${line}`);
      });
    }

    (proc.stderr as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) this.logger.warn(`[slot${slot.n}/${role}] ${line}`);
    });

    proc.on('exit', (code, signal) => {
      if (slot.status !== 'stopping' && slot.status !== 'free') {
        this.logger.error(
          `unexpected exit  role=${role}  slot=${slot.n}  app=${slot.appId}  code=${code}  signal=${signal}`,
        );
      } else {
        this.logger.log(`exit  role=${role}  slot=${slot.n}  code=${code}`);
      }
    });

    return proc;
  }

  private async killSlot(slot: Slot): Promise<void> {
    const order: (keyof SlotProcs)[] = ['ws', 'vnc', 'app', 'xvfb'];
    for (const key of order) {
      const proc = slot.procs[key];
      if (proc && !proc.killed) {
        this.logger.log(`kill  role=${key}  slot=${slot.n}  pid=${proc.pid}`);
        proc.kill('SIGTERM');
        await this.sleep(300);
        if (!proc.killed) {
          this.logger.warn(`SIGKILL  role=${key}  slot=${slot.n}  pid=${proc.pid}`);
          proc.kill('SIGKILL');
        }
      }
      slot.procs[key] = null;
    }
    try {
      execSync(`rm -f /tmp/.X${slot.display}-lock /tmp/.X11-unix/X${slot.display}`);
    } catch {}
    slot.status = 'free';
    slot.appId = null;
    slot.clientId = null;
    this.logger.log(`slot ${slot.n} freed`);
  }

  private waitForPort(port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      let attempts = 0;
      const check = () => {
        attempts++;
        const sock = new net.Socket();
        sock.setTimeout(500);
        sock.on('connect', () => { sock.destroy(); resolve(); });
        sock.on('error', () => {
          sock.destroy();
          if (Date.now() < deadline) setTimeout(check, 300);
          else reject(new Error(`port ${port} timed out after ${attempts} attempts`));
        });
        sock.on('timeout', () => {
          sock.destroy();
          if (Date.now() < deadline) setTimeout(check, 300);
          else reject(new Error(`port ${port} timed out after ${attempts} attempts`));
        });
        sock.connect(port, '127.0.0.1');
      };
      check();
    });
  }

  private logPoolState() {
    const summary = this.slots
      .map(s => `[${s.n}:${s.status}${s.appId ? '/' + s.appId : ''}]`)
      .join(' ');
    this.logger.log(`pool  ${summary}`);
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}
