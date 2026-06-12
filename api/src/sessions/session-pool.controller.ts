import { Controller, Get } from '@nestjs/common';
import { SessionPoolService } from './session-pool.service';

@Controller('debug')
export class SessionPoolController {
  constructor(private readonly pool: SessionPoolService) {}

  @Get('pool')
  getPoolStatus() {
    return this.pool.getPoolStatus();
  }
}
