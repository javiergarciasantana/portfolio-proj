import { Controller, Get } from '@nestjs/common';
import { DockerService } from './docker.service';

@Controller('api/docker')
export class DockerController {
  constructor(private readonly dockerService: DockerService) {}

  @Get('status')
  async getStatus() {
    return await this.dockerService.testConnection();
  }
}