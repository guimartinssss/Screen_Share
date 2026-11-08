from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, emit
import os
import uuid, qrcode, io, base64

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-only-change-this')
socketio = SocketIO(app, cors_allowed_origins="*")

# simple rooms: <session>_pc and <session>_mobile
@app.route('/')
def index():
    session_id = str(uuid.uuid4())
    # Set HOST_IP to the address other devices should use to reach this server.
    # Example for Tailscale: HOST_IP=100.x.x.x
    host_ip = os.environ.get("HOST_IP", request.host.split(":")[0])
    mobile_url = f"http://{host_ip}:5000/session/{session_id}"

    # generate qr
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(mobile_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode()
    return render_template('index.html', session_id=session_id, qr_b64=qr_b64)

@app.route('/session/<session_id>')
def mobile(session_id):
    return render_template('mobile.html', session_id=session_id)

# Socket.IO signaling handlers
@socketio.on('join')
def handle_join(data):
    session_id = data.get('sessionId')
    is_pc = data.get('isPc')
    if not session_id:
        return
    room = f"{session_id}_pc" if is_pc else f"{session_id}_mobile"
    join_room(room)
    # notify presence
    emit('joined', {'sessionId': session_id, 'isPc': is_pc}, room=room)

@socketio.on('offer')
def handle_offer(data):
    session_id = data.get('sessionId')
    offer = data.get('offer')
    if not session_id or not offer:
        return
    # offer comes from mobile -> send to pc room
    emit('offer', {'offer': offer}, room=f"{session_id}_pc", include_self=False)

@socketio.on('answer')
def handle_answer(data):
    session_id = data.get('sessionId')
    answer = data.get('answer')
    if not session_id or not answer:
        return
    # answer comes from PC -> send to mobile room
    emit('answer', {'answer': answer}, room=f"{session_id}_mobile", include_self=False)

@socketio.on('iceCandidate')
def handle_ice(data):
    session_id = data.get('sessionId')
    candidate = data.get('candidate')
    is_from_pc = data.get('fromPc', False)
    if not session_id or not candidate:
        return
    # forward candidate to the other side
    target_room = f"{session_id}_mobile" if is_from_pc else f"{session_id}_pc"
    emit('iceCandidate', {'candidate': candidate}, room=target_room, include_self=False)

if __name__ == "__main__":
    # use eventlet for concurrency -- install eventlet in requirements.txt
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)