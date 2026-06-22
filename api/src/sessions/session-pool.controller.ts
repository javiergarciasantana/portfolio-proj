import { Controller, Get, Query, UnauthorizedException, Res, forwardRef, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { SessionPoolService } from './session-pool.service';
import { NativeAppGateway } from '../gateways/native-app.gateway';

@Controller('debug')
export class SessionPoolController {
  constructor(private readonly pool: SessionPoolService,
              @Inject(forwardRef(() => NativeAppGateway))
              private readonly gateway: NativeAppGateway,
  ) {}

  @Get('pool')
  getPoolStatus() {
    return this.pool.getPoolStatus();
  }

  @Get('dashboard')
  getDashboard(@Query('key') key: string, @Res() res: Response) {
    // 🔒 SECURITY: Change this to a strong password!
    // Access this page via: https://portfolio.yourdomain.com/api/admin/dashboard?key=super_secret_admin_123
    const api_key = process.env.API_KEY;
    if (key !== api_key) {
      throw new UnauthorizedException('Access Denied: Invalid Security Key');
    }

    // 1. Gather all data
    const poolStatus = this.pool.getPoolStatus();
    const activeSessions = this.gateway.getActiveSessions();

    // 2. Generate the dynamic HTML
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <title>Portfolio OS - Admin Diagnostics</title>
        <meta name="author" content="Javier G. Santana">
        <meta name="description" content="Secure administrative dashboard for MacintoVPS Portfolio OS.">
        <meta name="robots" content="noindex, nofollow"> <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">

        <style>
            body { 
                background: #121212; 
                color: #0f0; 
                font-family: 'Courier New', Courier, monospace; 
                padding: 20px; 
                margin: 0;
            }
            .container { max-width: 1000px; margin: 0 auto; }
            .card { 
                background: #1e1e1e; 
                border: 2px solid #333; 
                padding: 20px; 
                margin-bottom: 25px; 
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            }
            h1, h2 { color: #fff; border-bottom: 1px solid #444; padding-bottom: 10px; margin-top: 0; }
            h1 span { font-size: 0.6em; color: #888; float: right; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            th, td { border: 1px solid #444; padding: 10px; text-align: left; }
            th { background: #2a2a2a; color: #ddd; }
            .highlight { color: #00ffff; font-weight: bold; }
            .status-running { color: #0f0; font-weight: bold; }
            .status-free { color: #888; font-style: italic; }
            .metric-box { display: inline-block; padding: 10px 20px; background: #000; border: 1px solid #0f0; margin-right: 15px; border-radius: 5px; }
            .metric-val { font-size: 24px; font-weight: bold; color: #fff; display: block; margin-top: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🖥️ MacintoVPS Diagnostics <span>${new Date().toLocaleString()}</span></h1>

            <div class="card">
                <h2>🌐 Active Website Visitors</h2>
                <div class="metric-box">
                    Active Tabs / Sockets
                    <span class="metric-val">${activeSessions.length}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Visitor IP Address</th>
                            <th>Socket Client ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activeSessions.length === 0 ? '<tr><td colspan="2" style="text-align:center; color:#888;">No active visitors</td></tr>' : ''}
                        ${activeSessions.map(session => `
                            <tr>
                                <td>${session.ip}</td>
                                <td><span class="highlight">${session.clientId}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="card">
                <h2>*VNC Session Pool Overview</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div class="metric-box">
                        Max Capacity
                        <span class="metric-val">${poolStatus.cap} Apps</span>
                    </div>
                    <div class="metric-box">
                        Currently Free
                        <span class="metric-val" style="color: #0f0;">${poolStatus.free} Slots</span>
                    </div>
                    <div class="metric-box">
                        Currently Used
                        <span class="metric-val" style="color: #ff4444;">${poolStatus.cap - poolStatus.free} Slots</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>🔍 Pool Slots Detail</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Slot #</th>
                            <th>Status</th>
                            <th>App ID</th>
                            <th>Owner (Client ID)</th>
                            <th>Websockify Port</th>
                            <th>Active PIDs (Linux)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${poolStatus.slots.map(slot => `
                            <tr>
                                <td><strong>Slot ${slot.n}</strong> (:Display ${slot.display})</td>
                                <td class="status-${slot.status}">${slot.status.toUpperCase()}</td>
                                <td>${slot.appId ? `<span class="highlight">${slot.appId}</span>` : '<span class="status-free">None</span>'}</td>
                                <td>${slot.clientId || '<span class="status-free">None</span>'}</td>
                                <td>${slot.wsPort}</td>
                                <td style="font-size: 12px; color: #aaa;">
                                    Xvfb: ${slot.pids.xvfb || '-'}<br>
                                    App:  ${slot.pids.app || '-'}<br>
                                    VNC:  ${slot.pids.vnc || '-'}<br>
                                    WS:   ${slot.pids.ws || '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;

    // 3. Send the HTML as the response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
