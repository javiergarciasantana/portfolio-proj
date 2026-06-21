import { Module } from '@nestjs/common';
import { HardwareController } from './hardware.controller';

@Module({
  controllers: [HardwareController],
  providers: [],
})
export class HardwareModule {}
