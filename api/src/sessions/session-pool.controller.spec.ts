import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { SessionPoolController } from './session-pool.controller';
import { SessionPoolService } from './session-pool.service';
import { NativeAppGateway } from '../gateways/native-app.gateway';

const API_KEY = 'test-secret-key-abc123';

const mockPoolStatus = {
  cap: 4,
  free: 3,
  slots: [
    { n: 0, status: 'free', appId: null, clientId: null, startedAt: null, display: 10, wsPort: 6090, pids: { xvfb: null, app: null, vnc: null, ws: null } },
    { n: 1, status: 'running', appId: 'form-filler', clientId: 'socket-abc', startedAt: Date.now() - 5000, display: 11, wsPort: 6091, pids: { xvfb: 100, app: 101, vnc: 102, ws: 103 } },
  ],
};

const buildMockRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe('SessionPoolController', () => {
  let controller: SessionPoolController;
  let mockPool: jest.Mocked<Partial<SessionPoolService>>;
  let mockGateway: jest.Mocked<Partial<NativeAppGateway>>;

  beforeEach(async () => {
    process.env.API_KEY = API_KEY;

    mockPool = {
      getPoolStatus: jest.fn().mockReturnValue(mockPoolStatus),
    };

    mockGateway = {
      getActiveSessions: jest.fn().mockReturnValue([
        { ip: '1.2.3.4', clientId: 'socket-abc' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionPoolController],
      providers: [
        { provide: SessionPoolService, useValue: mockPool },
        { provide: NativeAppGateway, useValue: mockGateway },
      ],
    }).compile();

    controller = module.get<SessionPoolController>(SessionPoolController);
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  describe('GET /debug/pool', () => {
    it('throws 401 with no key', () => {
      expect(() => controller.getPoolStatus('')).toThrow(UnauthorizedException);
    });

    it('throws 401 with wrong key', () => {
      expect(() => controller.getPoolStatus('wrong-key')).toThrow(UnauthorizedException);
    });

    it('throws 401 when API_KEY env var is not set', () => {
      delete process.env.API_KEY;
      expect(() => controller.getPoolStatus('')).toThrow(UnauthorizedException);
    });

    it('returns pool status with valid key', () => {
      const result = controller.getPoolStatus(API_KEY);
      expect(result).toEqual(mockPoolStatus);
      expect(mockPool.getPoolStatus).toHaveBeenCalled();
    });

    it('uses timing-safe comparison (rejects near-match key)', () => {
      const nearMatch = API_KEY.slice(0, -1) + 'X';
      expect(() => controller.getPoolStatus(nearMatch)).toThrow(UnauthorizedException);
    });
  });

  describe('GET /debug/dashboard', () => {
    it('throws 401 with wrong key', () => {
      expect(() => controller.getDashboard('bad-key', buildMockRes() as any)).toThrow(UnauthorizedException);
    });

    it('throws 401 with no key', () => {
      expect(() => controller.getDashboard('', buildMockRes() as any)).toThrow(UnauthorizedException);
    });

    it('sets Content-Type to text/html with valid key', () => {
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    });

    it('sends an HTML document with valid key', () => {
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      expect(res.send).toHaveBeenCalled();
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('renders active session IP and clientId in the table', () => {
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('1.2.3.4');
      expect(html).toContain('socket-abc');
    });

    it('renders pool capacity metrics', () => {
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('4 Apps');
      expect(html).toContain('3 Slots');
    });

    it('escapes XSS in session IP', () => {
      mockGateway.getActiveSessions = jest.fn().mockReturnValue([
        { ip: '<script>alert(1)</script>', clientId: 'safe-id' },
      ]);
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes XSS in session clientId — no unescaped img tag', () => {
      mockGateway.getActiveSessions = jest.fn().mockReturnValue([
        { ip: '1.2.3.4', clientId: '"><img src=x onerror=alert(1)>' },
      ]);
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });

    it('shows "No active visitors" row when session list is empty', () => {
      mockGateway.getActiveSessions = jest.fn().mockReturnValue([]);
      const res = buildMockRes();
      controller.getDashboard(API_KEY, res as any);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('No active visitors');
    });
  });
});
