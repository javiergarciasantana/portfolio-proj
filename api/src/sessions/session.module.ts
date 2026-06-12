import { Module } from '@nestjs/common';
import { SessionPoolService } from './session-pool.service';
import { SessionPoolController } from './session-pool.controller';

@Module({
  controllers: [SessionPoolController],
  providers: [SessionPoolService],
  exports: [SessionPoolService],
})
export class SessionModule {}
