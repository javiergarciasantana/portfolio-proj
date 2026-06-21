import { Controller, Get } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

@Controller('hardware')
export class HardwareController {
  
  @Get('fan-speed')
  async getFanSpeed() {
    try {
      // Executes the Linux 'sensors' command
      const { stdout } = await execAsync('sensors');
      
      // Uses a regular expression to find any number followed by "RPM"
      const match = stdout.match(/(\d+)\s*RPM/i);
      
      if (match && match[1]) {
        return { rpm: parseInt(match[1], 10), status: 'success' };
      }
      
      // Fallback if sensors are virtualized or missing
      return { rpm: 0, status: 'virtualized' };
      
    } catch (error) {
      return { rpm: 0, status: 'error' };
    }
  }

  @Get('cpu-load')
  async getCpuLoad() {
    const startCpus = os.cpus();
    
    // 2. Wait 100ms to calculate a delta (non-blocking)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 3. Take second reading
    const endCpus = os.cpus();
    
    const coreUsage = startCpus.map((startCore, index) => {
      const endCore = endCpus[index];
      
      // Sum all CPU states (user, nice, sys, idle, irq)
      const startTotal = Object.values(startCore.times).reduce((acc, val) => acc + val, 0);
      const endTotal = Object.values(endCore.times).reduce((acc, val) => acc + val, 0);
      
      const totalDelta = endTotal - startTotal;
      const idleDelta = endCore.times.idle - startCore.times.idle;
      
      if (totalDelta === 0) return 0;
      
      // Calculate usage percentage
      return Math.round(100 - (100 * idleDelta) / totalDelta);
    });

    return { cores: coreUsage, status: 'success' };
  
  }
}