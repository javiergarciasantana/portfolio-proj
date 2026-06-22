import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SessionModule } from './sessions/session.module';
import { HardwareModule } from './hardware/hardware.module'

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    SessionModule,
    HardwareModule,
  ],
  providers: [],
})
export class AppModule {}
