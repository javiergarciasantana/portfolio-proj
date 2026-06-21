# NestJS Systemd Configuration
Create the systemd service file on your Debian server at /etc/systemd/system/portfolio-api.service. I have mirrored the style you used for your other services.

```Ini, TOML
[Unit]
Description=Portfolio OS NestJS Backend
After=network.target

[Service]
Type=simple
User=jsantana
WorkingDirectory=/opt/portfolio/api
# We use node directly on the compiled dist/main.js for maximum performance
ExecStart=/usr/bin/node dist/main.js
Environment="NODE_ENV=production"
Environment="PORT=3000"
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Managing and Viewing Systemd Logs
Because StandardOutput=journal is set in the config, Debian captures every console.log natively.

* To view the live logs (tailing):

```Bash
journalctl -u portfolio-api.service -f
(Press Ctrl+C to exit the log view)
```
* To view the last 100 lines:

```Bash
journalctl -u portfolio-api.service -n 100 --no-pager
```
* To Start the app:

```Bash
sudo systemctl start portfolio-api
```
* To Stop the app:

```Bash
sudo systemctl stop portfolio-api
```
* To Restart the app (after uploading new code):

```Bash
sudo systemctl restart portfolio-api
```
* To make it start automatically when you turn on the MacBook:

```Bash
sudo systemctl enable portfolio-api
```

## Cloudflare commands

```Bash
# Tunnel config
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/
sudo cp ~/.cloudflared/*.json /etc/cloudflared/

# Systemd Commands
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Status check
sudo systemctl status cloudflared
```