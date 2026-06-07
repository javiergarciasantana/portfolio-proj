import { Controller, Get } from '@nestjs/common';

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  type: 'terminal' | 'xpra';
  command?: string;
  dockerImage?: string;
  icon: string;
  gradientStart: string;
  gradientEnd: string;
  language: string;
  startEvent: string;
  stopEvent: string;
  readyEvent?: string;
  window: { width: number; height: number };
}

export const APPS: AppConfig[] = [
  {
    id: 'haskell-tui',
    name: 'Haskell Functions',
    description: 'Purely functional programming demos: sorting, trees, and combinatorics',
    type: 'terminal',
    command: '/opt/portfolio/haskell-tui',
    icon: 'λ',
    gradientStart: '#1a1a2e',
    gradientEnd: '#4e4376',
    language: 'Haskell',
    startEvent: 'start-haskell',
    stopEvent: 'stop-haskell',
    window: { width: 800, height: 500 },
  },
  {
    id: 'form-filler',
    name: 'FormFiller',
    description: 'JavaFX desktop app for automated form processing and data entry',
    type: 'xpra',
    dockerImage: 'form-filler',
    icon: '📋',
    gradientStart: '#0f4c75',
    gradientEnd: '#1b262c',
    language: 'Java / JavaFX',
    startEvent: 'start-form-filler',
    stopEvent: 'stop-form-filler',
    readyEvent: 'form-filler-started',
    window: { width: 512, height: 640 },
  },
  {
    id: 'labyrinth-madness',
    name: 'Labyrinth Madness',
    description: 'Real-time maze generation and pathfinding visualization',
    type: 'xpra',
    dockerImage: 'labyrinth-madness',
    icon: '🌀',
    gradientStart: '#0f0c29',
    gradientEnd: '#302b63',
    language: 'Java / Processing',
    startEvent: 'start-labyrinth-madness',
    stopEvent: 'stop-labyrinth-madness',
    readyEvent: 'labyrinth-madness-started',
    window: { width: 608, height: 740 },
  },
];

@Controller('api')
export class AppRegistryController {
  @Get('apps')
  getApps(): AppConfig[] {
    return APPS;
  }
}
