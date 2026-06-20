import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SessionModule } from './sessions/session.module';
import { HardwareModule } from './hardware/hardware.module'
import { NativeAppGateway } from './gateways/native-app.gateway';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    SessionModule,
    HardwareModule,
  ],
  providers: [NativeAppGateway],
})
export class AppModule {}
