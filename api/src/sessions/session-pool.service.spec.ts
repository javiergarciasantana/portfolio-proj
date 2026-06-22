import { Test, TestingModule } from '@nestjs/testing';
import { SessionPoolService, AppConfig } from './session-pool.service';

const mockCfg: AppConfig = {
  appId: 'test-app',
  width: 800,
  height: 600,
  launchCmd: () => ({ cmd: 'echo', args: ['hello'] }),
};

describe('SessionPoolService', () => {
  let service: SessionPoolService;
  let startSlotSpy: jest.SpyInstance;
  let killSlotSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionPoolService],
    }).compile();

    service = module.get<SessionPoolService>(SessionPoolService);

    startSlotSpy = jest.spyOn(service as any, 'startSlot').mockResolvedValue(undefined);
    killSlotSpy = jest.spyOn(service as any, 'killSlot').mockImplementation(async (slot: any) => {
      slot.status = 'free';
      slot.appId = null;
      slot.clientId = null;
      slot.startedAt = null;
    });

    service.onModuleInit();
  });

  afterEach(async () => {
    killSlotSpy.mockImplementation(async () => {});
    await service.onModuleDestroy();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getPoolStatus', () => {
    it('reports cap=4 and all 4 slots free initially', () => {
      const status = service.getPoolStatus();
      expect(status.cap).toBe(4);
      expect(status.free).toBe(4);
      expect(status.slots).toHaveLength(4);
    });

    it('assigns correct display/wsPort offsets per slot', () => {
      const { slots } = service.getPoolStatus();
      slots.forEach((s, i) => {
        expect(s.n).toBe(i);
        expect(s.wsPort).toBe(6090 + i);
        expect(s.display).toBe(10 + i);
      });
    });

    it('all slots start as free with null appId/clientId', () => {
      service.getPoolStatus().slots.forEach(s => {
        expect(s.status).toBe('free');
        expect(s.appId).toBeNull();
        expect(s.clientId).toBeNull();
        expect(s.startedAt).toBeNull();
      });
    });
  });

  describe('acquireSlot', () => {
    it('acquires a free slot and marks it running', async () => {
      const slot = await service.acquireSlot('test-app', 'client-1', mockCfg);
      expect(slot.status).toBe('running');
      expect(slot.appId).toBe('test-app');
      expect(slot.clientId).toBe('client-1');
      expect(slot.startedAt).not.toBeNull();
    });

    it('decrements free count by 1 after acquisition', async () => {
      await service.acquireSlot('test-app', 'client-1', mockCfg);
      expect(service.getPoolStatus().free).toBe(3);
    });

    it('calls startSlot with the slot and config', async () => {
      await service.acquireSlot('test-app', 'client-1', mockCfg);
      expect(startSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ appId: 'test-app', clientId: 'client-1' }),
        mockCfg,
      );
    });

    it('throws pool_full when all 4 slots are occupied', async () => {
      await service.acquireSlot('app', 'c1', mockCfg);
      await service.acquireSlot('app', 'c2', mockCfg);
      await service.acquireSlot('app', 'c3', mockCfg);
      await service.acquireSlot('app', 'c4', mockCfg);
      await expect(service.acquireSlot('app', 'c5', mockCfg)).rejects.toThrow('pool_full');
    });

    it('reuses existing running slot for same client+app', async () => {
      const slot1 = await service.acquireSlot('test-app', 'client-1', mockCfg);
      const slot2 = await service.acquireSlot('test-app', 'client-1', mockCfg);
      expect(slot1).toBe(slot2);
      expect(startSlotSpy).toHaveBeenCalledTimes(1);
    });

    it('frees the slot and rethrows when startSlot fails', async () => {
      startSlotSpy.mockRejectedValueOnce(new Error('xvfb crashed'));
      await expect(service.acquireSlot('test-app', 'c1', mockCfg)).rejects.toThrow('xvfb crashed');
      expect(service.getPoolStatus().free).toBe(4);
    });

    it('allocates slots sequentially (slot 0, then 1, etc.)', async () => {
      const s1 = await service.acquireSlot('app', 'c1', mockCfg);
      const s2 = await service.acquireSlot('app', 'c2', mockCfg);
      expect(s1.n).toBe(0);
      expect(s2.n).toBe(1);
    });
  });

  describe('releaseSlot', () => {
    it('frees the slot for a running clientId', async () => {
      await service.acquireSlot('test-app', 'client-1', mockCfg);
      await service.releaseSlot('client-1');
      expect(service.getPoolStatus().free).toBe(4);
    });

    it('calls killSlot when releasing', async () => {
      await service.acquireSlot('test-app', 'client-1', mockCfg);
      await service.releaseSlot('client-1');
      expect(killSlotSpy).toHaveBeenCalled();
    });

    it('is no-op for unknown clientId', async () => {
      await expect(service.releaseSlot('unknown')).resolves.toBeUndefined();
      expect(killSlotSpy).not.toHaveBeenCalled();
    });

    it('is no-op if slot is already free', async () => {
      const slot = (service as any).slots[0];
      slot.clientId = 'ghost-client';
      slot.status = 'free';
      await service.releaseSlot('ghost-client');
      expect(killSlotSpy).not.toHaveBeenCalled();
    });
  });

  describe('getSlotByClient', () => {
    it('returns the slot for a known clientId', async () => {
      await service.acquireSlot('test-app', 'client-99', mockCfg);
      const slot = service.getSlotByClient('client-99');
      expect(slot).toBeDefined();
      expect(slot!.clientId).toBe('client-99');
      expect(slot!.appId).toBe('test-app');
    });

    it('returns undefined for an unknown clientId', () => {
      expect(service.getSlotByClient('nope')).toBeUndefined();
    });
  });

  describe('checkTimeouts', () => {
    it('calls releaseSlot for sessions that exceeded sessionTimeoutMs', () => {
      const slot = (service as any).slots[0];
      slot.status = 'running';
      slot.clientId = 'client-timeout';
      slot.appId = 'test-app';
      const timeout = (service as any).sessionTimeoutMs as number;
      slot.startedAt = Date.now() - timeout - 1;

      const releaseSpy = jest.spyOn(service, 'releaseSlot').mockResolvedValue(undefined);
      (service as any).checkTimeouts();

      expect(releaseSpy).toHaveBeenCalledWith('client-timeout');
    });

    it('does not call releaseSlot for sessions within sessionTimeoutMs', () => {
      const slot = (service as any).slots[0];
      slot.status = 'running';
      slot.clientId = 'client-fresh';
      slot.appId = 'test-app';
      slot.startedAt = Date.now() - 1000; // only 1s old

      const releaseSpy = jest.spyOn(service, 'releaseSlot').mockResolvedValue(undefined);
      (service as any).checkTimeouts();

      expect(releaseSpy).not.toHaveBeenCalled();
    });

    it('ignores free slots', () => {
      const releaseSpy = jest.spyOn(service, 'releaseSlot').mockResolvedValue(undefined);
      (service as any).checkTimeouts();
      expect(releaseSpy).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('clears the timeout interval', async () => {
      const clearSpy = jest.spyOn(global, 'clearInterval');
      await service.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalled();
    });
  });
});
