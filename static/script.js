// signaling + WebRTC helper
const socket = io();
let peerConnection;

function startConnection(isPc, sessionId) {
  socket.emit("join", { sessionId, isPc });

  if (isPc) {
    // PC waits for offer from mobile
    socket.on("offer", async (data) => {
      const offer = data.offer;
      peerConnection = createPeer(true, sessionId);
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("answer", { sessionId, answer });
    });

    socket.on("iceCandidate", async (data) => {
      try {
        if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
      } catch (e) { console.warn("PC addIceCandidate err", e); }
    });
  } else {
    // mobile: capture screen + camera, create offer and send
    startMobile(sessionId);
    socket.on("answer", async (data) => {
      const answer = data.answer;
      if (!peerConnection) peerConnection = createPeer(false, sessionId);
      await peerConnection.setRemoteDescription(answer);
    });

    socket.on("iceCandidate", async (data) => {
      try {
        if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
      } catch (e) { console.warn("Mobile addIceCandidate err", e); }
    });
  }
}

async function startMobile(sessionId) {
  try {
    peerConnection = createPeer(false, sessionId);
    // getDisplayMedia for screen (will ask user). Some browsers on mobile may not support getDisplayMedia.
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    // getUserMedia for camera
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });

    // add tracks separately so remote can differentiate
    screenStream.getTracks().forEach(t => peerConnection.addTrack(t, screenStream));
    cameraStream.getTracks().forEach(t => peerConnection.addTrack(t, cameraStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { sessionId, offer });
  } catch (err) {
    alert("Erro ao capturar ecrã/câmara: " + err);
    console.error(err);
  }
}

function createPeer(isPc, sessionId) {
  const pc = new RTCPeerConnection();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("iceCandidate", { candidate: event.candidate, sessionId, fromPc: isPc });
    }
  };

  // handle remote incoming tracks
  pc.ontrack = (event) => {
    const stream = event.streams[0];
    // assign first incoming stream to screenVideo, second to cameraVideo
    if (!document.getElementById('screenVideo').srcObject) {
      document.getElementById('screenVideo').srcObject = stream;
    } else if (!document.getElementById('cameraVideo').srcObject) {
      document.getElementById('cameraVideo').srcObject = stream;
    } else {
      // if both already set, create a new video element (not usually needed)
      const v = document.createElement('video');
      v.autoplay = true;
      v.playsInline = true;
      v.style.width = '200px';
      document.body.appendChild(v);
      v.srcObject = stream;
    }
  };

  return pc;
}
