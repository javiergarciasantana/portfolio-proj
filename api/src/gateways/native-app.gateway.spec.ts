import { Test, TestingModule } from '@nestjs/testing';
import { NativeAppGateway } from './native-app.gateway';
import { SessionPoolService } from '../sessions/session-pool.service';
import { Socket } from 'socket.io';

const createMockSocket = (ip: string, id: string, cfIp?: string): Partial<Socket> => ({
  id,
  handshake: {
    address: ip,
    headers: cfIp ? { 'cf-connecting-ip': cfIp } : {},
  } as any,
  emit: jest.fn(),
  disconnect: jest.fn(),
  data: {},
});

describe('NativeAppGateway', () => {
  let gateway: NativeAppGateway;
  let mockSessionPool: jest.Mocked<Partial<SessionPoolService>>;

  beforeEach(async () => {
    mockSessionPool = {
      releaseSlot: jest.fn().mockResolvedValue(undefined),
      acquireSlot: jest.fn().mockResolvedValue({ wsPort: 6090 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NativeAppGateway,
        { provide: SessionPoolService, useValue: mockSessionPool },
      ],
    }).compile();

    gateway = module.get<NativeAppGateway>(NativeAppGateway);
  });

  describe('handleConnection', () => {
    it('stores IP → clientId on first connection', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleConnection(client as Socket);
      expect((gateway as any).activeIps.get('1.2.3.4')).toBe('socket-1');
    });

    it('overwrites ghost session on reconnect from same IP', () => {
      const c1 = createMockSocket('1.2.3.4', 'socket-1');
      const c2 = createMockSocket('1.2.3.4', 'socket-2');
      gateway.handleConnection(c1 as Socket);
      gateway.handleConnection(c2 as Socket);
      expect((gateway as any).activeIps.get('1.2.3.4')).toBe('socket-2');
      expect(c2.disconnect).not.toHaveBeenCalled();
    });

    it('prefers cf-connecting-ip over handshake address', () => {
      const client = createMockSocket('127.0.0.1', 'socket-1', '5.6.7.8');
      gateway.handleConnection(client as Socket);
      expect((gateway as any).activeIps.get('5.6.7.8')).toBe('socket-1');
      expect((gateway as any).activeIps.has('127.0.0.1')).toBe(false);
    });

    it('allows different IPs concurrently', () => {
      gateway.handleConnection(createMockSocket('1.1.1.1', 'socket-a') as Socket);
      gateway.handleConnection(createMockSocket('2.2.2.2', 'socket-b') as Socket);
      expect((gateway as any).activeIps.size).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('removes IP when the active client disconnects', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleConnection(client as Socket);
      gateway.handleDisconnect(client as Socket);
      expect((gateway as any).activeIps.has('1.2.3.4')).toBe(false);
    });

    it('does not remove IP when a ghost/stale client disconnects', () => {
      const c1 = createMockSocket('1.2.3.4', 'socket-1');
      const c2 = createMockSocket('1.2.3.4', 'socket-2');
      gateway.handleConnection(c1 as Socket);
      gateway.handleConnection(c2 as Socket); // c2 overwrites
      gateway.handleDisconnect(c1 as Socket); // old ghost disconnects
      expect((gateway as any).activeIps.get('1.2.3.4')).toBe('socket-2');
    });

    it('kills PTY process on disconnect', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1') as any;
      client.data.ptyProcess = { kill: jest.fn() };
      gateway.handleConnection(client as Socket);
      gateway.handleDisconnect(client as Socket);
      expect(client.data.ptyProcess).toBeNull();
    });

    it('calls releaseSlot with clientId on disconnect', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleConnection(client as Socket);
      gateway.handleDisconnect(client as Socket);
      expect(mockSessionPool.releaseSlot).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('getActiveSessions', () => {
    it('returns empty array when no clients', () => {
      expect(gateway.getActiveSessions()).toEqual([]);
    });

    it('returns all connected sessions', () => {
      gateway.handleConnection(createMockSocket('1.1.1.1', 'socket-a') as Socket);
      gateway.handleConnection(createMockSocket('2.2.2.2', 'socket-b') as Socket);
      const sessions = gateway.getActiveSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContainEqual({ ip: '1.1.1.1', clientId: 'socket-a' });
      expect(sessions).toContainEqual({ ip: '2.2.2.2', clientId: 'socket-b' });
    });

    it('session disappears after disconnect', () => {
      const client = createMockSocket('1.1.1.1', 'socket-a');
      gateway.handleConnection(client as Socket);
      gateway.handleDisconnect(client as Socket);
      expect(gateway.getActiveSessions()).toEqual([]);
    });
  });

  describe('acquireGui — form-filler', () => {
    it('emits ready event with wsPort on success', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockResolvedValue({ wsPort: 6090 });
      await gateway.handleStartFormFiller(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('form-filler-started', { port: 6090 });
    });

    it('emits app-error with busy message when pool is full', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockRejectedValue(new Error('pool_full'));
      await gateway.handleStartFormFiller(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('app-error', {
        app: 'form-filler',
        message: 'All sessions busy. Try again shortly.',
      });
    });

    it('emits app-error with detail on arbitrary failure', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockRejectedValue(new Error('xvfb crashed'));
      await gateway.handleStartFormFiller(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('app-error', {
        app: 'form-filler',
        message: 'Failed to start form-filler: xvfb crashed',
      });
    });
  });

  describe('acquireGui — other apps', () => {
    it('emits labyrinth-madness-started on success', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockResolvedValue({ wsPort: 6091 });
      await gateway.handleStartLabyrinth(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('labyrinth-madness-started', { port: 6091 });
    });

    it('emits polygon-triangulation-started on success', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockResolvedValue({ wsPort: 6092 });
      await gateway.handleStartPolygon(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('polygon-triangulation-started', { port: 6092 });
    });

    it('emits n-queens-omp-started on success', async () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      mockSessionPool.acquireSlot = jest.fn().mockResolvedValue({ wsPort: 6093 });
      await gateway.handleStartNQueens(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('n-queens-omp-started', { port: 6093 });
    });
  });

  describe('handleStartDalui (static app)', () => {
    it('emits dalui-scrape-started immediately', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleStartDalui(client as Socket);
      expect(client.emit).toHaveBeenCalledWith('dalui-scrape-started', {});
    });
  });

  describe('terminal-input / terminal-resize', () => {
    it('writes data to ptyProcess', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1') as any;
      client.data.ptyProcess = { write: jest.fn(), resize: jest.fn() };
      gateway.handleInput(client as Socket, 'ls\n');
      expect(client.data.ptyProcess.write).toHaveBeenCalledWith('ls\n');
    });

    it('resizes ptyProcess', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1') as any;
      client.data.ptyProcess = { write: jest.fn(), resize: jest.fn() };
      gateway.handleResize(client as Socket, { cols: 120, rows: 40 });
      expect(client.data.ptyProcess.resize).toHaveBeenCalledWith(120, 40);
    });

    it('does not throw when ptyProcess is null', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1') as any;
      client.data.ptyProcess = null;
      expect(() => gateway.handleInput(client as Socket, 'test')).not.toThrow();
      expect(() => gateway.handleResize(client as Socket, { cols: 80, rows: 24 })).not.toThrow();
    });
  });

  describe('stop handlers', () => {
    it('stop-form-filler calls releaseSlot', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleStopFormFiller(client as Socket);
      expect(mockSessionPool.releaseSlot).toHaveBeenCalledWith('socket-1');
    });

    it('stop-labyrinth-madness calls releaseSlot', () => {
      const client = createMockSocket('1.2.3.4', 'socket-1');
      gateway.handleStopLabyrinth(client as Socket);
      expect(mockSessionPool.releaseSlot).toHaveBeenCalledWith('socket-1');
    });
  });
});
