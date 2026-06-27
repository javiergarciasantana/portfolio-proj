/**
 * Cloudflare Worker — fallback maintenance page
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → Create Worker → paste → Save & Deploy.
 * Route: Settings → Triggers → Add route matching jgsantana.dev/* (and optionally www.jgsantana.dev/*)
 *
 * How it works:
 *   1. Worker forwards every request to the Cloudflare Tunnel origin.
 *   2. If the tunnel is down (network error) OR returns 5xx, serves MAINTENANCE_HTML.
 *   3. Otherwise passes the response through unchanged.
 *
 * Uses ES module format (required for modern Cloudflare Workers).
 */

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Javier Garcia Santana — Server Offline</title>
<meta name="robots" content="noindex, nofollow">
<style>
:root {
  --bg: #2b2b2b;
  --gray: #aaaaaa;
  --dark-gray: #555555;
  --light: #ffffff;
  --black: #000000;
  --accent: #000080;
  --win-body: #bfbfbf;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 100vw; height: 100vh; overflow: hidden;
  background: var(--bg);
  background-image: radial-gradient(#444 15%, transparent 16%), radial-gradient(#444 15%, transparent 16%);
  background-size: 4px 4px;
  background-position: 0 0, 2px 2px;
  font-family: Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: none;
  display: flex; flex-direction: column;
}

/* ── Menubar ── */
#menubar {
  height: 28px;
  background: var(--gray);
  border-bottom: 2px solid var(--dark-gray);
  border-top: 2px solid var(--light);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
  user-select: none;
}
.bar-logo { font-size: 13px; font-weight: bold; color: var(--black); }
.bar-status { font-size: 12px; font-weight: bold; color: #aa0000; display: flex; align-items: center; gap: 6px; }
.bar-right { font-size: 13px; font-weight: bold; color: var(--black); }
.dot-red { width: 8px; height: 8px; background: #cc0000; border-radius: 50%; display: inline-block; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }

/* ── Desktop ── */
#desktop {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

/* ── Window ── */
.window {
  background: var(--win-body);
  border-top: 2px solid var(--light);
  border-left: 2px solid var(--light);
  border-right: 2px solid var(--black);
  border-bottom: 2px solid var(--black);
  box-shadow: 6px 6px 0 rgba(0,0,0,0.6);
  width: 820px; max-width: 96vw;
}
.titlebar {
  background: var(--black);
  color: var(--light);
  font-size: 13px; font-weight: bold;
  padding: 4px 8px;
  display: flex; align-items: center; justify-content: space-between;
  user-select: none;
}
.titlebar-btns { display: flex; gap: 4px; }
.tb-btn {
  width: 14px; height: 14px;
  background: var(--gray);
  border-top: 2px solid var(--light);
  border-left: 2px solid var(--light);
  border-right: 2px solid var(--dark-gray);
  border-bottom: 2px solid var(--dark-gray);
}

/* ── Window body: two-panel ── */
.win-body {
  display: flex;
  border: 2px solid var(--dark-gray);
  border-right: none; border-bottom: none;
  margin: 2px;
}

/* Left panel — offline alert */
.panel-left {
  flex: 1;
  padding: 22px 24px;
  border-right: 2px solid var(--dark-gray);
}
.panel-left h1 {
  font-size: 15px; font-weight: bold; margin-bottom: 10px; color: var(--black);
  border-bottom: 2px solid var(--dark-gray); padding-bottom: 6px;
}
.panel-left p {
  font-size: 12px; line-height: 1.7; color: #222; margin-bottom: 12px;
}
.links { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.retro-btn {
  display: inline-block;
  background: var(--gray);
  color: var(--black);
  font-size: 12px; font-weight: bold;
  padding: 5px 12px;
  border-top: 2px solid var(--light);
  border-left: 2px solid var(--light);
  border-right: 2px solid var(--dark-gray);
  border-bottom: 2px solid var(--dark-gray);
  text-decoration: none;
  cursor: pointer;
}
.retro-btn:hover {
  border-top: 2px solid var(--dark-gray);
  border-left: 2px solid var(--dark-gray);
  border-right: 2px solid var(--light);
  border-bottom: 2px solid var(--light);
}
.blink { animation: blink 1.2s step-end infinite; }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }

/* Right panel — profile sneak peek */
.panel-right {
  width: 280px;
  flex-shrink: 0;
  padding: 22px 20px;
  display: flex; flex-direction: column; align-items: center;
  background: #c8c8c8;
}
.panel-right h2 {
  font-size: 11px; font-weight: bold; color: var(--dark-gray);
  letter-spacing: 1px; text-transform: uppercase;
  border-bottom: 1px solid var(--dark-gray); padding-bottom: 4px;
  margin-bottom: 14px; width: 100%; text-align: center;
}
.face {
  width: 80px; height: 80px;
  image-rendering: pixelated;
  border-top: 3px solid var(--light);
  border-left: 3px solid var(--light);
  border-right: 3px solid var(--dark-gray);
  border-bottom: 3px solid var(--dark-gray);
  background: var(--black);
  margin-bottom: 12px;
}
.profile-name {
  font-size: 14px; font-weight: bold; color: var(--black);
  text-align: center; margin-bottom: 2px;
}
.profile-role {
  font-size: 11px; color: #444;
  text-align: center; margin-bottom: 14px;
  font-style: italic;
}
.tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 14px; }
.tag {
  background: var(--accent);
  color: var(--light);
  font-family: "Courier New", monospace;
  font-size: 10px; font-weight: bold;
  padding: 2px 5px;
  border: 1px outset var(--light);
}
.edu-line {
  font-size: 10px; color: #333; text-align: center;
  line-height: 1.6; margin-bottom: 12px;
}

/* ── Statusbar ── */
.statusbar {
  background: var(--gray);
  border-top: 1px solid var(--dark-gray);
  padding: 4px 10px;
  font-size: 11px; color: var(--black);
  display: flex; justify-content: space-between;
}

/* ── Mobile ── */
@media (max-width: 640px) {
  .win-body { flex-direction: column; }
  .panel-right { width: 100%; border-top: 2px solid var(--dark-gray); }
}
</style>
</head>
<body>

<div id="menubar">
  <div class="bar-logo">My Portfolio OS</div>
  <div class="bar-status"><span class="dot-red"></span> Server Offline</div>
  <div class="bar-right" id="clock"></div>
</div>

<div id="desktop">
  <div class="window">

    <div class="titlebar">
      <span>System Alert — jgsantana.dev</span>
      <div class="titlebar-btns">
        <div class="tb-btn"></div>
        <div class="tb-btn"></div>
        <div class="tb-btn"></div>
      </div>
    </div>

    <div class="win-body">

      <!-- Left: offline message -->
      <div class="panel-left">
        <h1>&#x1F534;&nbsp; Home Server Offline</h1>
        <p>
          This portfolio runs on a physical machine at home.
          The power probably went out, or I am doing maintenance.
          It should be back shortly.
        </p>
        <p>
          The live demos (Haskell TUI, N-Queens OpenMP solver, Polygon
          Triangulation visualizer, and more) will return once the server
          comes back online.
        </p>
        <p style="font-size:11px; color:#555; margin-top:16px;">
          <span class="blink">_</span>&nbsp; Trying to reconnect&hellip;
          refresh in a few minutes.
        </p>
        <div class="links">
          <a class="retro-btn" href="https://github.com/javiergarciasantana" target="_blank" rel="noopener">
            &#128279;&nbsp; View my GitHub Profile
          </a>
          <a class="retro-btn" href="https://www.linkedin.com/in/javier-garcia-santana-362691302" target="_blank" rel="noopener">
            &#128101;&nbsp; Connect on LinkedIn
          </a>
          <a class="retro-btn" href="mailto:javiergs0703@gmail.com">
            &#9993;&nbsp; Send an Email
          </a>
        </div>
      </div>

      <!-- Right: profile sneak peek -->
      <div class="panel-right">
        <h2>Who runs this?</h2>
        <img class="face" src="https://github.com/javiergarciasantana.png" alt="Javier" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23000%22/><text x=%2240%22 y=%2252%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22%23555%22>:)</text></svg>'"/>
        <div class="profile-name">Javier Garc&#237;a Santana</div>
        <div class="profile-role">Software Engineer<br>Parallel Computing &middot; Backend</div>
        <div class="tags">
          <span class="tag">C++</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Python</span>
          <span class="tag">Haskell</span>
          <span class="tag">NestJS</span>
          <span class="tag">OpenMP</span>
          <span class="tag">OpenGL</span>
          <span class="tag">Docker</span>
        </div>
        <div class="edu-line">
          &#127979; Univ. de La Laguna (2020&ndash;2026)<br>
          &#127758; Vilnius University (Erasmus)<br>
          &#128221; English C1 &mdash; Trinity College London
        </div>
      </div>

    </div><!-- win-body -->

    <div class="statusbar">
      <span>jgsantana.dev</span>
      <span id="status-clock"></span>
    </div>

  </div><!-- window -->
</div><!-- desktop -->

<script>
  function tick() {
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const d = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const str = d + '  ' + t;
    document.getElementById('clock').textContent = str;
    document.getElementById('status-clock').textContent = str;
  }
  tick(); setInterval(tick, 1000);
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    try {
      const response = await fetch(request);

      if (response.status >= 500) {
        return new Response(MAINTENANCE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return response;
    } catch (_) {
      return new Response(MAINTENANCE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  },
};
