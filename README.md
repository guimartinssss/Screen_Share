# Screen Share

A small Flask + WebRTC project that lets you connect a phone to a PC and share the phone screen and camera in the PC browser.

The server uses **Flask-SocketIO** for signaling and **WebRTC** for the peer-to-peer media connection.

## Requirements

- Python 3.10 or newer
- A modern desktop browser (Chrome, Edge, or Firefox)
- A phone/browser that supports the required WebRTC APIs
- For devices on different networks, you may need additional network configuration. Tailscale is an easy option for a private network.

## 1. Download the project

```bash
git clone https://github.com/guimartinssss/Screen_Share
cd Screen_Share
```

## 2. Create a virtual environment (recommended)

### Windows

```powershell
python -m venv venv
venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

## 4. Configure the address used by the QR code

Set **one** of the following:

- `PUBLIC_URL`: complete public origin, including scheme and port if needed. Recommended when using HTTPS or a reverse proxy.
- `HOST_IP`: reachable LAN/Tailscale IP. The app will use `HOST_PORT` (default `5000`) and the incoming request scheme.

### Windows PowerShell — Tailscale/LAN HTTP

```powershell
$env:HOST_IP="100.x.x.x"
$env:HOST_PORT="5000"
python app.py
```

### HTTPS behind a reverse proxy

Run Flask-SocketIO on the private network as usual, configure a reverse proxy (for example Caddy or Nginx) with a valid TLS certificate, and set the public origin:

```powershell
$env:PUBLIC_URL="https://screenshare.example.com"
python app.py
```

The reverse proxy must forward normal HTTP requests and WebSocket upgrades to the Flask-SocketIO server on port 5000. Open the same HTTPS address on the PC. The QR code and mobile link will then use that HTTPS origin automatically.

**Important:** setting `PUBLIC_URL` only changes the QR/link. It does not create an HTTPS certificate or encrypt the Flask server by itself. The reverse proxy must actually provide HTTPS.

For local/private Tailscale use, Tailscale Serve can provide HTTPS for a Tailnet device when configured with a valid Serve hostname/certificate. In that case, set `PUBLIC_URL` to the exact HTTPS URL served by Tailscale.

## 5. Start the server

```bash
python app.py
```

The server listens on `0.0.0.0:5000` by default.

## 6. Connect your phone

1. Open the configured address on the PC.
2. Keep that page open; it joins the session and waits for the phone.
3. Scan the QR code with the phone. Make sure it opens the exact same reachable address.
4. Press **Começar** and accept the browser permission prompts.
5. The PC page should show the phone screen and camera in their respective video areas.

## Troubleshooting “Ligação recusada”

- Confirm the server is running and the PC page loads.
- Confirm the phone can open the exact URL shown below the QR code. If it cannot, the issue is network/address/firewall, not WebRTC.
- If using Tailscale, both devices must be connected to the same Tailnet and the PC must allow incoming connections on the selected port.
- If using HTTPS, open the PC and phone pages using the same HTTPS hostname. Do not scan an old QR code generated before changing `PUBLIC_URL`.
- The browser console and the status line on each page now show whether the failure is Socket.IO signaling or WebRTC negotiation.
- STUN is configured as a best-effort aid. Some networks require a TURN server; STUN alone cannot guarantee a direct peer-to-peer route.

## Browser notes

Screen sharing support on mobile browsers varies by browser and operating system. This project keeps the existing mobile screen/camera capture calls unchanged; the signaling and receiving side have been improved, but browser-level capture restrictions still apply.

## Project structure

```text
Screen_Share/
├── app.py
├── README.md
├── requirements.txt
├── static/
│   └── script.js
└── templates/
    ├── index.html
    └── mobile.html
```

## Security notes

This project is intended for local/private use and experimentation. It is **not designed as a production-ready public screen-sharing service**. Before exposing it publicly, add authentication, restrict CORS to your exact origin, validate session membership, and use HTTPS.

## License

Free to use, modify, and share for **non-commercial** purposes (personal, educational, hobby). You may **not sell** it or use it commercially without the author's written permission. Credit is not required. Shared copies must use the same license. See the [LICENSE](LICENSE) file.
