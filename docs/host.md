# MacintoVPS Server Details

> Breathing new life into a classic. Turning a vintage 2010 MacBook White Unibody into a modern, headless, containerized Debian server.

> [!IMPORTANT]
> This project is running on an old Mac using Debian 12, so therefore, in order for me not to forget everything and how its setup here are the machine details

```text
                                                                                                                                       
                 #%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%#                 
                #@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@% %%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                
                %%%@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@%                
                %@@@@## %=-:**=#+-#+=*+=#-==+#==##########################################-#=*+#-+=+:-+-+=++-##+#%@@@@%                         
                %@@@@=                                                                                           #@@@@%                
                %%%%%=                           .   .  .    . ... ..  ..  .                                     #@@@@%
                %%%%%=                                    .  . .-+#########*+-.:.     ..                         #@@@@%
                %%%%%=                                    ..=###################*-.  . .                         #@@@@%
                %%%%%=                                  .:*#####*-..    .  .:+#####=.. .                         #@@@@%
                %%%%%=                                ..=####*:        ..  .  .=####*...                         #@@@@%
                %%%%%=                              .:.+###:.  .  .         .   .*####:                          #@@@@%
                %%%%%=                                .*##-...   .     ....     . .*#+.:.                        #%%%%%
                %%%%%=                              ..*##:.         .-*+:..--....  -##=..                        #%%%%%
                %%%%%=                              .=##-...    .. :+.    .. .     .*#+..                        #%%%%%
                %%%%%=                              .+#+.      ...:*  .   . .. .    *##.                         #%%%%%
                %%%%%=                              .+#=         .=:     ..        .##-..                        #%%%%%
                %%%%%=                              .+#=..       .=*    .   ....   -#=..                         #%%%%%
                %%%%%=                             .+#=   .    ..:*= .  .:.   ...-#=.. .                         #%%%%%
                %%%%%=                              .=#*.   .    .-.*+    .. .  :**: .                           #%%%%%
                %%%%%=                              -#*:.   ..   ..:-+*=-.:-=*#+:. .  .                          #%%%%%
                %%%%%=                              ..*#+:.    .   . ..=::::..  . . . . .                        #%%%%%
                %%%%%=                               .*##=...              .                                     #%%%%%
                %%%%%=                                :*#*.. .   .     .  .    .                                 #%%%%%
                %%%%%=                              .   .##*. .  ..       . .   .                                #%%%%%
                %%%%%=                                  ..=#*-.         .   .  . . ..   .                        #%%%%%
                %%%%%=                                  .  :*#=:. .         .       .                            #%%%%%
                %%%%%=                                    ....*#*   ...   ..      .   .                          #%%%%%
                %%%%%=                                ...      .:+*+:.        ..        .                        #%%%%%
                %%%%%=                              ..             .:-:.    ..                                   #%%%%%                
                %%%%%=                                                                                           #%%%%% 
                %%%%%=          .*     . : ..  #+  += =-= --.        -    .      :  ..   =++-+++:  .  .          #%%%%%                
                %%%%%=        .   ..  :::-- ..:::- ..::..:=.::  ::- -   ....  ....:.:.:.:........---:  .:        #%%%%%                
                %%%%%*.......++++++=+=++++++++++++++++++++++=++=++++++++++++++++=+=+++++++++++++++++=+++++   ....%%%%%%                
                %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%  MacBook %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%            
                %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#                
               @*#%%%%%%%%%%%%#%%%%%%%%%%%%%%%%%%%#%%%%%#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%###@               
          @@%@@@##**###*********#*#***####*****##****##****###****###########*######*##%##***####*#####################@@%%%@          
     @%%%%%%@@@@#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*******************************##******%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@@@@%%%%%%      
   %@@@@@@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@%#%%%%%%%%%%%%%%%%%%%@@@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%   
   %@@%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%@@@@@@@%   
    @%#################################%###%#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#%%%%%%####%%#%%%###%%#   
     +=------------------------------------------------------------------------------------------------:-:::--:--::--:::::::::::-+     
                                                                                                                                    
```

                                                                                                                                       
---

## ⚙️ Specifications

This server leverages the durable hardware of the late polycarbonate era, upgraded with modern storage and memory to handle server workloads efficiently.

* 💻 **Machine:** Apple MacBook "White Unibody" (Mid-2010)
* 🧠 **Processor:** Intel® Core™ 2 Duo (2.4 GHz)
* 🐏 **Memory:** 10 GB DDR3 RAM
* 💾 **Storage:** 240 GB Solid State Drive (SSD)
* 🐧 **Operating System:** Debian 12 (Bookworm)
* 🐳 **Containerization Engine:** Docker (Optimized for extensive `/var` storage)
* 🌐 **Networking:** Tailscale (Mesh VPN) + Wake-on-LAN capability

---

## 💽 Partition Schema

To ensure Docker has plenty of room to operate, the storage has been specifically partitioned. 

```bash
Filesystem                       Size  Used Avail Use% Mounted on
/dev/mapper/macintovps--vg-root   43G  6.3G   35G  16% /
/dev/mapper/macintovps--vg-var   108G   28G   76G  27% /var
/dev/mapper/macintovps--vg-tmp   1.8G  2.5M  1.7G   1% /tmp
/dev/sda2                        456M  108M  323M  26% /boot
/dev/mapper/macintovps--vg-home   49G  2.2G   44G   5% /home
/dev/sda1                        511M  5.9M  506M   2% /boot/efi
```

💡 **Why is `/var` so large?**
In Docker, all images, containers, and volumes are stored by default in `/var/lib/docker`. Allocating **108GB** specifically to the `/var` partition prevents Docker from filling up the root filesystem, ensuring the host OS remains stable and responsive.

---

## 🛠️ Server Configuration Guide

Below is the step-by-step breakdown of the commands used to configure the MacintoVPS from a fresh Debian install to a headless home server.

### 1. Initial Setup & Drivers
First, ensure the system is up to date and install the proprietary Broadcom drivers required for the MacBook's Wi-Fi card.
```bash
# Update and upgrade packages
sudo apt update && sudo apt upgrade -y

# Install MacBook Wi-Fi drivers
sudo apt install broadcom-sta-dkms -y
```

### 2. User Management & Essential Tools
Install basic networking and monitoring tools, and ensure your user has the correct `sudo` privileges.
```bash
# Enter as superuser
su -

# Install sudo and essential tools
apt update && apt install sudo curl wget git htop tmux -y

# Add your user to the sudo group (replace 'ur_user' with your actual username)
usermod -aG sudo ur_user

# Exit root session
exit
```

### 3. Docker Installation
Install the Docker engine using the official convenience script.
```bash
# Download and execute the Docker install script
curl -fsSL [https://get.docker.com](https://get.docker.com) -o get-docker.sh
sudo sh get-docker.sh
```

### 4. Headless Laptop Tweaks (Power & Lid Management)
Since this is a laptop acting as a server, it needs to stay awake when the lid is closed and turn off the screen to save power and prevent burn-in.

**Lid Closing Behavior:**
```bash
# Edit logind configuration
sudo nano /etc/systemd/logind.conf

# ✏️ ACTION: Find '#HandleLidSwitch=suspend' and change it to:
# HandleLidSwitch=ignore

# Restart the service to apply changes
sudo systemctl restart systemd-logind
```

**Screen Blanking & Power Saver:**
```bash
# Edit console setup
sudo nano /etc/default/console-setup

# ✏️ ACTION: Add the following variables at the bottom:
# SCREEN_BLANK=1
# POWERDOWN_TIME=2

# Edit GRUB configuration
sudo nano /etc/default/grub

# ✏️ ACTION: Modify the CMDLINE default variable to:
# GRUB_CMDLINE_LINUX_DEFAULT="quiet consoleblank=60"

# Update GRUB bootloader
sudo update-grub

# Save changes and perform a final reboot
sudo systemctl restart console-setup 
sudo apt update && sudo apt full-upgrade -y 
sudo reboot
```

### 5. Remote Access & Networking
Set up a secure mesh VPN to access the server from anywhere, and enable Wake-on-LAN to turn the server on remotely.

**Tailscale VPN:**
```bash
# Install and authenticate Tailscale
curl -fsSL [https://tailscale.com/install.sh](https://tailscale.com/install.sh) | sh
sudo tailscale up
```

**Wake-on-LAN (WoL):**
```bash
# Install ethtool
sudo apt update && sudo apt install ethtool -y

# Enable WoL on the ethernet card (enp0s9)
sudo ethtool -s enp0s9 wol g

# Make WoL persistent across reboots by creating a systemd service
sudo nano /etc/systemd/system/wol.service
```

*Add the following configuration to the `wol.service` file:*
```ini
[Unit]
Description=Enable Wake-on-LAN
Requires=network.target
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/ethtool -s enp0s9 wol g

[Install]
WantedBy=multi-user.target
```

*Activate the service:*
```bash
# Enable and start the WoL service
sudo systemctl enable wol.service
sudo systemctl start wol.service
```
## Commands

### Docker

- Creating new image
```bash
docker build --no-cache -t [IMAGE-NAME] .
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