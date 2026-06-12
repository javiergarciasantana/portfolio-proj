# Portfolio OS

![current-state-of-the-webapp](./docs/image.png)

A macOS-style web desktop that runs my programming projects as live, interactive windows in the browser — no installation required for visitors. Each project launches in its own floating window with native controls (PTY terminal, VNC stream, or static card).

Deployed on a MacBook 2010 (Core 2 Duo 2.4 GHz, 10 GB RAM, Debian 12 headless).

---

## Projects

| App | Language | Type | How it runs |
|---|---|---|---|
| Haskell Functions | Haskell | Terminal | node-pty → xterm.js |
| FormFiller | Java / JavaFX | VNC | Xvfb + x11vnc + noVNC |
| Labyrinth Madness | Java / Processing | VNC | Xvfb + x11vnc + noVNC |
| N-Queens Parallel | C++ / OpenMP | Terminal | node-pty → xterm.js |
| Polygon Triangulation | C++ / GLFW / OpenGL | VNC | Xvfb + Mesa SW GL + noVNC |
| WP Web Snatcher | Chrome Extension (MV3) | Info card | Static — no server process |

---

## Architecture

```
Browser
  └── Socket.IO ──────────────────► NestJS (port 3000)
  └── noVNC WebSocket ─────────────► websockify (port 609x)
                                          └── x11vnc (port 591x)
                                                └── Xvfb (:1x)
                                                      └── App process
```

### Session pool

GUI apps (VNC type) use a pool of 4 slots. Each slot owns:
- A dedicated Xvfb virtual display (`:10` – `:13`)
- A VNC server (ports `5910` – `5913`)
- A websockify WS proxy (ports `6090` – `6093`)
- The app process itself

On connect → claim free slot → spawn all 4 processes → emit port to browser.  
On disconnect → SIGTERM chain (ws → vnc → app → Xvfb) → slot freed.  
Pool full → `app-error` emitted, visitor shown "try again" message.

Terminal apps (PTY type) bypass the pool — they spawn a `node-pty` process directly per client, unlimited concurrency.

### Why not Docker?

Docker adds ~3–5 s cold-start overhead per container plus significant RAM per instance. Native processes on Xvfb start in ~1.5 s and share the host OS libraries. On a 2010 MacBook this is the difference between usable and unusable.

---

## Stack

- **Runtime**: Node.js + NestJS (TypeScript)
- **Transport**: Socket.IO WebSockets
- **GUI streaming**: Xvfb → x11vnc → websockify → noVNC (browser-side RFB)
- **Terminal**: node-pty → xterm.js
- **Frontend**: Vanilla JS + WinBox.js (floating windows) + xterm.js
- **Server**: Debian 12, headless

---

## Debugging

### Pool status (HTTP)

```bash
curl http://localhost:3000/debug/pool
```

Returns JSON:
```json
{
  "cap": 4,
  "free": 3,
  "slots": [
    { "n": 0, "status": "running", "appId": "form-filler", "clientId": "abc123",
      "display": 10, "wsPort": 6090,
      "pids": { "xvfb": 1234, "app": 1235, "vnc": 1236, "ws": 1237 } },
    { "n": 1, "status": "free", ... },
    ...
  ]
}
```

### Server logs

```bash
# Follow API logs
journalctl -u portfolio-api -f

# x11vnc logs per slot
tail -f /tmp/x11vnc-slot0.log
tail -f /tmp/x11vnc-slot1.log

# Check VNC ports are listening
ss -tlnp | grep -E '591[0-3]'

# Check websockify ports
ss -tlnp | grep -E '609[0-3]'
```

### Browser console

The frontend has a colour-coded debug logger. Open DevTools → Console. Each event is tagged:

| Tag | Colour | Covers |
|---|---|---|
| `[ws]` | blue | Socket.IO connect/disconnect |
| `[app]` | green | Window open/close events |
| `[vnc]` | orange | noVNC RFB connection lifecycle |
| `[err]` | red | Errors from backend or RFB |

---

## Deploy

### 1. Install dependencies (run once on server)

```bash
cd deploy
bash install.sh
```

Installs: `xvfb x11vnc novnc websockify openjdk-17 maven cmake libglfw3-dev libgl1-mesa-dev g++ libomp-dev`  
Builds: `PolygonTriangulation`, `n_queens_omp`

### 2. Deploy app binaries manually

| App | Path on server |
|---|---|
| FormFiller (Maven project) | `/opt/portfolio/form-filler/` (pom.xml + src/) |
| Labyrinth Madness (jars) | `/opt/portfolio/labyrinth/LabyrinthApp.jar` + `core.jar` |
| Haskell binary | `/opt/portfolio/haskell-tui` |
| N-Queens binary | built by `install.sh` → `/opt/portfolio/n_queens_omp/n_queens_omp` |
| Polygon binary | built by `install.sh` → `/opt/portfolio/polygon_triangulation/build/PolygonTriangulation` |

### 3. Start the API

```bash
cd /opt/portfolio/api
npm ci --omit=dev
npm run build
npm run start:prod
```

---

## Local development

GUI apps (VNC) won't work on macOS — no Xvfb/x11vnc. Terminal apps (Haskell, N-Queens) work if binaries are present.

To fake a VNC port for frontend testing:

```bash
# Terminal 1 — dummy TCP listener on slot 0 ws port
nc -l 6090

# Terminal 2 — start API
cd api && npm run start:dev
```

The frontend will connect and attempt RFB negotiation (which will fail gracefully — enough to test the pool/WS flow).

---

## Repo layout

```
portfolio-proj/
├── api/
│   ├── src/
│   │   ├── gateways/
│   │   │   └── native-app.gateway.ts   # WS events for all 6 apps
│   │   ├── sessions/
│   │   │   ├── session-pool.service.ts # 4-slot process pool
│   │   │   ├── session-pool.controller.ts # GET /debug/pool
│   │   │   └── session.module.ts
│   │   └── app.module.ts
│   └── public/
│       └── index.html                  # Frontend — macOS-style desktop
├── deploy/
│   ├── install.sh                      # One-time server setup
│   ├── polygon-triangulation.sh        # cmake build
│   └── n-queens-omp.sh                 # g++ -fopenmp build
└── docs/
```
