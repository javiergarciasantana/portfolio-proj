import { Module } from '@nestjs/common';
import { SessionPoolService } from './session-pool.service';
import { SessionPoolController } from './session-pool.controller';
import { NativeAppGateway } from 'src/gateways/native-app.gateway';
@Module({
  controllers: [SessionPoolController],
  providers: [SessionPoolService, NativeAppGateway],
  exports: [SessionPoolService],
})
export class SessionModule {}
