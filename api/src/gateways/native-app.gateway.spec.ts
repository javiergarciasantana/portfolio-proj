import { Test, TestingModule } from '@nestjs/testing';
import { NativeAppGateway } from './native-app.gateway';
import { SessionPoolService } from '../sessions/session-pool.service';
import { Socket } from 'socket.io';

describe('NativeAppGateway - IP Connection Limiter', () => {
  let gateway: NativeAppGateway;
  let mockSessionPool: Partial<SessionPoolService>;

  beforeEach(async () => {
    mockSessionPool = {
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NativeAppGateway,
        { provide: SessionPoolService, useValue: mockSessionPool },
      ],
    }).compile();

    gateway = module.get<NativeAppGateway>(NativeAppGateway);
  });

  const createMockSocket = (ip: string, id: string): Partial<Socket> => ({
    id,
    handshake: { address: ip } as any,
    emit: jest.fn(),
    disconnect: jest.fn(),
    data: {},
  });

  it('should allow a new connection and store the IP', () => {
    const client = createMockSocket('192.168.1.100', 'socket-1');
    gateway.handleConnection(client as Socket);

    expect(client.disconnect).not.toHaveBeenCalled();
    // Access the private map for testing purposes
    expect((gateway as any).activeIps.get('192.168.1.100')).toBe('socket-1');
  });

  it('should reject a second connection from the same IP', () => {
    const client1 = createMockSocket('192.168.1.100', 'socket-1');
    const client2 = createMockSocket('192.168.1.100', 'socket-2');

    gateway.handleConnection(client1 as Socket);
    gateway.handleConnection(client2 as Socket);

    // Client 2 should receive an error and be disconnected
    expect(client2.emit).toHaveBeenCalledWith('error', 'You already have an active session.');
    expect(client2.disconnect).toHaveBeenCalled();
    
    // The map should still hold client 1
    expect((gateway as any).activeIps.get('192.168.1.100')).toBe('socket-1');
  });

  it('should remove IP from map on disconnect', () => {
    const client = createMockSocket('192.168.1.100', 'socket-1');
    gateway.handleConnection(client as Socket);
    gateway.handleDisconnect(client as Socket);

    expect((gateway as any).activeIps.has('192.168.1.100')).toBe(false);
  });
});