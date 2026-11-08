# Screen Share

A small Flask + WebRTC project that lets you connect a phone to a PC and share the phone screen and camera in the PC browser.

The server uses **Flask-SocketIO** for signaling and **WebRTC** for the peer-to-peer media connection.

## Requirements

- Python 3.10 or newer
- A modern desktop browser (Chrome, Edge, or Firefox)
- A phone/browser that supports the required WebRTC APIs
- For devices on different networks, you may need additional network configuration. Tailscale is an easy option for a private network.

## 1. Download the project

Clone the repository or download it as a ZIP, then open a terminal inside the project folder.

```bash
git clone https://github.com/guimartinssss/Screen_Share
cd Screen_Share
```

If you downloaded the ZIP, just extract it and open a terminal in the extracted `Screen_Share` folder.

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

## 4. Choose the address used by the QR code

If the phone and PC can reach each other using the PC's local network address, set `HOST_IP` to that address.

### Windows PowerShell

```powershell
$env:HOST_IP="192.168.1.100"
```

### macOS / Linux

```bash
export HOST_IP="192.168.1.100"
```

Replace `192.168.1.100` with your PC's reachable IP address.

### Using Tailscale

If both devices are connected to the same Tailscale network, use your PC's Tailscale IP instead:

```powershell
$env:HOST_IP="100.x.x.x"
```

or on macOS/Linux:

```bash
export HOST_IP="100.x.x.x"
```

Do **not** put your personal IP address directly into the source code.

## 5. Start the server

```bash
python app.py
```

You should see the Flask-SocketIO server start on port `5000`.

## 6. Connect your phone

1. On the PC, open `http://127.0.0.1:5000`.
2. A QR code will be displayed.
3. Scan the QR code with your phone.
4. Allow screen-sharing and camera permissions when asked.
5. The phone screen and camera should appear in the PC page.

If the QR code does not work, make sure `HOST_IP` is set to an address that the phone can actually reach.

## Browser notes

- Screen sharing support on mobile browsers varies by browser and operating system.
- Android browsers generally provide better support for this type of WebRTC screen capture.
- iOS/Safari may restrict `getDisplayMedia` depending on the device and browser version.
- Camera and screen capture normally require user permission and a secure context. For local development, browser support may vary depending on the exact URL and platform.

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

This project is intended for local/private use and experimentation. It is **not designed as a production-ready public screen-sharing service**.

For a public deployment, add authentication, restrict CORS, use HTTPS, and add stronger session validation before exposing the server to the Internet.

## License

Free to use, modify, and share for **non-commercial** purposes (personal, educational, hobby). You may **not sell** it or use it commercially without the author's written permission. Credit is not required. Shared copies must use the same license. See the [LICENSE](LICENSE) file.
