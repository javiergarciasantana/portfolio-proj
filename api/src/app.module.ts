import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DockerModule } from './docker/docker.module';
import { TerminalGateway } from './gateways/terminal.gateway';
import { JavaFxGateway } from './gateways/javafx.gateway';
import { JavaProcGateway } from './gateways/javaproc.gateway copy';
import { DockerService } from './docker/docker.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Aquí vivirá el frontend
    }),
    DockerModule,
  ],
  providers: [TerminalGateway, JavaFxGateway, JavaProcGateway, DockerService],
})
export class AppModule {}