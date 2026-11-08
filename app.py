from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, emit
import os
import uuid
import qrcode
import io
import base64

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-this")

# The browser connects to Socket.IO on the same origin as the page.
socketio = SocketIO(
    app,
    cors_allowed_origins=os.environ.get("CORS_ALLOWED_ORIGINS", "*"),
)

def get_public_base_url():
    """
    PUBLIC_URL should be the externally reachable origin, for example:
    https://screenshare.example.com
    or http://100.x.x.x:5000 for a private Tailscale/LAN setup.
    """
    public_url = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
    if public_url:
        return public_url

    host_ip = os.environ.get("HOST_IP")
    if host_ip:
        port = os.environ.get("HOST_PORT", "5000")
        scheme = request.headers.get("X-Forwarded-Proto", request.scheme)
        return f"{scheme}://{host_ip}:{port}"

    return request.host_url.rstrip("/")


@app.route("/")
def index():
    session_id = str(uuid.uuid4())
    mobile_url = f"{get_public_base_url()}/session/{session_id}"

    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(mobile_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")

    return render_template(
        "index.html",
        session_id=session_id,
        qr_b64=qr_b64,
        mobile_url=mobile_url,
    )


@app.route("/session/<session_id>")
def mobile(session_id):
    return render_template("mobile.html", session_id=session_id)


@socketio.on("join")
def handle_join(data):
    data = data or {}
    session_id = data.get("sessionId")
    is_pc = data.get("isPc")

    if not session_id or not isinstance(is_pc, bool):
        return {"ok": False, "error": "Dados de sessão inválidos."}

    room = f"{session_id}_{'pc' if is_pc else 'mobile'}"
    join_room(room)
    emit("joined", {"sessionId": session_id, "isPc": is_pc}, room=room)
    return {"ok": True, "sessionId": session_id, "isPc": is_pc}


@socketio.on("offer")
def handle_offer(data):
    data = data or {}
    session_id = data.get("sessionId")
    offer = data.get("offer")
    if session_id and offer:
        emit("offer", {"offer": offer}, room=f"{session_id}_pc", include_self=False)


@socketio.on("answer")
def handle_answer(data):
    data = data or {}
    session_id = data.get("sessionId")
    answer = data.get("answer")
    if session_id and answer:
        emit("answer", {"answer": answer}, room=f"{session_id}_mobile", include_self=False)


@socketio.on("iceCandidate")
def handle_ice(data):
    data = data or {}
    session_id = data.get("sessionId")
    candidate = data.get("candidate")
    is_from_pc = data.get("fromPc", False)
    if not session_id or not candidate:
        return
    target_room = f"{session_id}_mobile" if is_from_pc else f"{session_id}_pc"
    emit("iceCandidate", {"candidate": candidate}, room=target_room, include_self=False)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
