import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DockerModule } from './docker/docker.module';
import { TerminalGateway } from './terminal/terminal.gateway';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Aquí vivirá tu frontend
    }),
    DockerModule,
  ],
  providers: [TerminalGateway],
})
export class AppModule {}