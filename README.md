# My portfolio OS project 

![current-state-of-the-webapp](./docs/image.png)

The mere purpose of this repo, is to be able to display my assortment of projects that I have posted as repos in [GitHub](https://github.com/javiergarciasantana).

These range from simple terminal programs to full applications made with a purpose in mind, whether it is to showcase an algorithm or simply make something that uses a `cool` library.

The idea behind the repo comes from the difficulty of running all my programs, since they are all written in various languages — installing packages and configuring frameworks is extremely tedious and not too fun. Therefore I simulate a desktop environment using `TypeScript` and `NestJS` where all of my programs can be run like desktop applications that are already installed, served through a browser-native OS interface inspired by macOS.

---

## Table of Contents

* [Host machine used to run this project](./docs/host.md)
* [Inner workings](#inner-workings)
* [Managing Docker images](#managing-docker-images)

## My Showcased projects

* [Labyrinth Madness]() — Java / Processing. Real-time maze generation and pathfinding visualization.
* [Haskell Functions]() — Haskell. Purely functional programming demos: sorting, trees, and combinatorics.
* [FormFiller]() — Java / JavaFX. Desktop tool for automated form processing and data entry.
* [Polygon Triangulation]()
* [Product-E-Match]()

## Inner workings

### Used technologies
- [Debian 12]()
- [Node.js]()
- [NestJS]()
- [TypeScript]()
- [Docker]()
- [dockerode]()
- [node-pty]()
- [Socket.io]()
- [WebSockets]()
- [xpra]()
- [xterm.js]()

---

### Docker images and their greatness

GUI applications (JavaFX, Processing) run inside Docker containers. Each image bundles the full runtime — JVM, dependencies, virtual display server, and the `xpra` streaming server — so launching an app is just spinning up one self-contained container. No host dependency installation required.

Terminal applications take a lighter path: they run directly on the host via `node-pty`, skipping container overhead entirely for near-instant startup.

---

### Many programs, many ways of running

Having fully-fledged applications just a click away is no easy task, and that is exactly where `Docker` and `dockerode` come in handy. On my server, I can clone my repositories — which are already equipped with their own `Dockerfiles` — to build images that can be dynamically spun up by the backend.

This architecture allows us to start any GUI program without a hitch. Because the `Docker` image already contains the underlying OS, the environment variables, and all the necessary dependencies, it is perfectly isolated and just waiting to be executed. Every time an application is launched, a fresh, clean environment is born.

While `Docker` handles the heavy lifting of containerization, `dockerode` acts as the crucial bridge. It allows our NestJS backend to communicate directly with the `Debian` server's Docker engine via its internal socket (`/var/run/docker.sock`). Instead of relying on manual terminal commands, our `Node.js` code can programmatically create, start, attach to, and destroy these containers on the fly.

The backend exposes a typed app registry at `GET /api/apps` which drives the entire frontend dock — adding a new project is a single entry in `app-registry.controller.ts`.

---

### My program is running! But I can't see it :(

In order to see what is happening when running a program we need something called `WebSockets`, which I am a big fan of. A WebSocket is a protocol providing full-duplex, bidirectional communication over a single TCP connection — in practice, a direct two-way phone call between one specific browser tab and the server.

Because we use `Socket.io` (which sits on top of WebSockets), it introduces an event-based system (`socket.on('event')`). This lets you "tune in" to specific channels (like `terminal-output`) over that dedicated pipe.

```typescript
socket.on('terminal-output', data => {
  // Takes the raw PTY output and renders it in the xterm.js terminal UI
  term.write(data);
});
```

---

### Terminal sockets and other sockets that emit GUI

For text-based applications (like Haskell TUI), the `NestJS` backend spawns the program directly on the host using `node-pty` — a proper pseudo-terminal that supports full ANSI escape codes, colors, and interactive input. When you type in the browser, `Socket.io` sends a `terminal-input` event to NestJS, which writes keystrokes directly into the PTY:

```typescript
@SubscribeMessage('terminal-input')
handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
  client.data.ptyProcess?.write(data);
}
```

Terminal resize is also propagated so the PTY columns and rows always match the browser window:

```typescript
@SubscribeMessage('terminal-resize')
handleResize(@ConnectedSocket() client: Socket, @MessageBody() size: { cols: number; rows: number }) {
  this.resizePty(client, size.cols, size.rows);
}
```

#### The GUI approach: sockets as matchmakers

But what happens when the application isn't just text? What if it's a fully-fledged graphical interface, like a `JavaFX` application?

Piping live desktop video through Socket.io text events would be incredibly inefficient. Instead, the WebSocket acts purely as a matchmaker:

1. The frontend asks `NestJS` to start the JavaFX app.
2. `NestJS` tells `Docker` to spin up the container, mapping internal port `8080` to a dynamic external port.
3. `NestJS` waits a few seconds for `xpra` to bind its HTML5 server inside the container.
4. `NestJS` replies to the frontend: "Your container is ready. Connect your iframe directly to port `8081`."
5. From that point on, the browser loads `xpra`'s built-in HTML5 client in an `<iframe>`, handling the display stream directly — the backend is free from the heavy lifting.

```typescript
protected async startGuiApp(client: Socket, config: GuiAppConfig) {
  const container = await this.dockerService.createContainer({
    Image: config.image,
    ExposedPorts: { '8080/tcp': {} },
    HostConfig: { AutoRemove: true, PublishAllPorts: true },
  });

  client.data.activeContainer = container;
  await container.start();

  const info = await container.inspect();
  const port = info.NetworkSettings.Ports['8080/tcp'][0].HostPort;

  setTimeout(() => {
    client.emit(config.eventName, { message: 'Server Ready', port });
  }, config.delayMs ?? 4000);
}
```

Both gateway types share the same `DockerService` for container cleanup (`AutoRemove: true`), and `BaseDockerGateway` handles disconnect cleanup for both PTY processes and Docker containers automatically.

---

### The `xpra` virtual display

`xpra` replaces the old `Xvfb + x11vnc + noVNC + websockify` stack with a single tool. Inside each GUI container, `xpra` starts a virtual display, renders the Java application onto it, encodes the output (H.264 via libx264), and serves its own HTML5 client over WebSocket — all on port `8080`. The browser embeds this directly in an `<iframe>` inside the desktop window.

```bash
xpra start :0 \
  --bind-tcp=0.0.0.0:8080 \
  --html=on \
  --start="java -jar /app/App.jar" \
  --exit-with-children=yes \
  --daemon=no \
  --encoding=x264
```

This is significantly lighter than the previous VNC pipeline on the host CPU, especially important on the 2010-era Core 2 Duo server.

---

## Managing Docker images

- Creating a new image

```bash
docker build --no-cache -t [IMAGE-NAME] .
```

- Running a new image

```bash
docker run --rm -p 8080:8080 [IMAGE-NAME]
```

- Removing a running container

```bash
# By ancestor image name
docker rm -f $(docker ps -q --filter ancestor=[IMAGE-NAME])

# By container ID
docker rm -f bc592c2343fb
```

- Starting the NestJS backend

```bash
cd api && npm install && npm run start:dev
```
