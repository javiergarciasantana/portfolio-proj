# My portfolio OS project 

The mere purpose of this repo, is to be able to display my assorment of projects that I have posted as repos in GitHub.

These range from simple terminal programs to full applications made with a purpose in mind wether it is to showcase an algorithm or simply make something that uses a `cool`
library.

The idea behind the repo comes from the difficultness to run all my programs, since they are all written in various languages, installing packages and configuring frameworks is extremely tedious and not too fun, therefore i intend to simulate a desktop environment using `TypeScript` and `NextJS` where all of my programs can be ran like desktop applications that are already installed.

---

## Index

* [Host machine used to run this project](./docs/host.md)
* [Inner workings](#inner-workings)
* [Managing Docker images](#managing-docker-images)


## Inner workings

### Used technologies
- [Debian 12]()
- [Node.js]()
- [NestJS]()
- [NextJS]()
- [TypeScript]()
- [Docker]()
- [dockerode]()
- [Socket.io]()
- [Websockets]()
- [VNC]()
- [noVNC]()
- [Xvfb]()

### Many programs, many ways of running
Having fully-fledged applications just a click away is no easy task, and that is exactly where `Docker` and dockerode come in handy. On my server, I can clone my repositories, which are already equipped with their own `Dockerfiles`, to build images that can be dynamically spun up by the backend.

This architecture allows us to start any program without a hitch. Because the `Docker` image already contains the underlying OS, the environment variables, and all the necessary dependencies, it is perfectly isolated and just waiting to be executed. Every time an application is launched, a fresh, clean environment is born.

While `Docker` handles the heavy lifting of containerization, dockerode acts as the crucial bridge. It allows our NestJS backend to communicate directly with the `Debian` server's `Docker` engine via its internal socket `(/var/run/docker.sock)`. Instead of relying on manual terminal commands, our `Node.js` code can programmatically create, start, attach to, and securely destroy these containers on the fly.

### My program is running! But I can't see it :(

Indeed, even if the program is running, we can just see what we have programmed in the `HTML` code (yes I use `tsx` files i know, but they return spiced up `HTML` ready for the browser to consume).

In order to see what is happening when running a program we need something called `WebSockets`, which i am a big fan of. The internet says that a `Websocket` is a protocol providing full-duplex, bidirectional communication channels over a single TCP connection. And that's all good and dandy really, but in practice it's actually more like a direct, two-way phone call between one specific browser tab and the server. It's a persistent, dedicated pipe.

However, because we are using `Socket.io` (which sits on top of WebSockets), `Socket.io` introduces an event-based system (socket.on('event')). This is what makes it feel like tuning into a TV or radio station! Socket.io's event system lets you "tune in" to specific channels (like 'terminal-output') over that dedicated WebSocket phone line.

```js
    socket.on('terminal-output', data => {
      // Takes the raw text (and hidden color codes) from Docker and renders it in the xterm.js UI
        term.write(data);
    });

```

### Terminal sockets and other sockets that emit GUI

While receiving text is great, communication is a two-way street. A terminal isn't much use if you can't type into it!

As mentioned earlier, a raw `WebSocket` is actually more like a direct, persistent phone call between the browser and the server. `Socket.io` sits on top of this phone line and acts like a switchboard, letting us send and receive specific "events".

For a text-based application (like our Haskell TUI), the `NestJS` backend acts as a middleman. It "attaches" to the `Docker` container's standard input and output streams. When you type in the browser, `Socket.io` sends a terminal-input event to NestJS, which literally writes those keystrokes directly into the Docker container's brain:

```TypeScript

  // 4. Listen for user keystrokes from the web and push them INTO the container
  @SubscribeMessage('terminal-input')
  handleInput(@ConnectedSocket() client: Socket, @MessageBody() data: string) {
    const stream = client.data.stream;
    if (stream) {
      stream.write(data);
    }
  }
```
#### The GUI Approach: Sockets as Matchmakers
But what happens when the application isn't just text? What if it's a fully-fledged graphical interface, like a `JavaFX` application?

Streaming live desktop video (VNC) through Socket.io text events would be incredibly inefficient. This requires a completely different architectural approach. Instead of acting as a middleman carrying the data, the WebSocket simply acts as a matchmaker.

1. The frontend asks `NestJS` to start the `JavaFX` app.

3. `NestJS` tells `Docker` to spin up the container, but instead of hooking into text streams, it maps an internal port to an external one (e.g., 8080 to 8081).

4. `NestJS` waits a few seconds for the virtual monitor (`Xvfb`) to boot up.

5. `NestJS` replies to the frontend: "Your container is ready. Connect your `noVNC` canvas directly to port 8081."

6. From that point on, the frontend handles the heavy video streaming directly via raw `WebSockets`, leaving our backend free from the heavy lifting.

```TypeScript

  @SubscribeMessage('start-javafx')
  async handleStartJavaFx(@ConnectedSocket() client: Socket) {
    try {
      // 1. Assign an external port (8081)
      const hostPort = '8081'; 
      
      // 2. Create the container mapping internal 8080 to external 8081
      const container = await this.dockerService.createContainer({
        Image: 'form-filler', 
        HostConfig: {
          AutoRemove: true,  
          PortBindings: {
            '8080/tcp': [
              { HostPort: hostPort }
            ]
          }
        }
      });

      client.data.activeContainer = container; 

      // 3. Power on the machine!
      await container.start();
      console.log(`Contenedor JavaFX iniciado en el puerto ${hostPort}`);

      // 4. Give Xvfb and VNC 3 seconds to boot inside Docker 
      // before telling the frontend it's ready to connect.
      setTimeout(() => {
        client.emit('javafx-started', { 
          message: 'JavaFX Server Ready',
          port: hostPort 
        });
      }, 3000);

    } catch (error) {
      console.error('Error arrancando FormFiller:', error);
      client.emit('error', `Error al iniciar FormFiller: ${error.message}`);
    }
  }
```

Both Gateways share the exact same `DockerService` to handle container cleanup (AutoRemove: true), ensuring that no matter what kind of app you open, closing the window leaves the server memory spotless and pristine.

## Managing Docker images

- Creating new image
```bash
docker build --nocache -t [IMAGE-NAME] .
```
- Running new image

```bash
docker run -p 8080:8080 [IMAGE-NAME]
```

- Removing a running image

```sh
// By exact name
docker rm -f $(docker ps -q --filter ancestor=[IMAGE-NAME])

// By container id
docker rm -f bc592c2343fb 
```