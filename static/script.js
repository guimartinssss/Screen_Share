// Socket.IO signaling + WebRTC helper.
const socket = io({
  // Polling is a reliable fallback when a proxy/network blocks WebSocket upgrades.
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: 8,
  timeout: 20000
});

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

let peerConnection = null;
let activeSessionId = null;
let isPcClient = false;
let joinStarted = false;
let pendingIceCandidates = [];
let remoteDescriptionReady = false;
let receivedStreams = new Map();
let streamRoles = {};
let metadataChannel = null;

function waitForSocketConnection() {
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Não foi possível ligar ao servidor. Confirma o endereço, a rede e se o servidor está ligado."));
    }, 15000);

    function onConnect() {
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("A ligação ao servidor foi recusada. Confirma se o PC e o telemóvel conseguem abrir o mesmo endereço."));
    }

    function cleanup() {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
}

function joinSession(sessionId, isPc) {
  return new Promise((resolve, reject) => {
    socket.timeout(10000).emit("join", { sessionId, isPc }, (err, response) => {
      if (err) {
        reject(new Error("O servidor não confirmou a entrada na sessão. Atualiza a página e tenta novamente."));
      } else if (!response || !response.ok) {
        reject(new Error(response?.error || "Não foi possível entrar na sessão."));
      } else {
        resolve(response);
      }
    });
  });
}

async function startConnection(isPc, sessionId) {
  if (joinStarted) return;
  joinStarted = true;
  activeSessionId = sessionId;
  isPcClient = isPc;

  try {
    await waitForSocketConnection();

    if (isPc) {
      // Register listeners before joining, so an offer cannot arrive too early.
      socket.on("offer", handleOffer);
      socket.on("iceCandidate", handleRemoteIceCandidate);
      await joinSession(sessionId, true);
      setStatus("À espera do telemóvel…");
    } else {
      socket.on("answer", handleAnswer);
      socket.on("iceCandidate", handleRemoteIceCandidate);
      await joinSession(sessionId, false);
      await startMobile(sessionId);
    }
  } catch (err) {
    joinStarted = false;
    console.error("Erro de ligação:", err);
    showError(err.message || String(err));
  }
}

async function handleOffer(data) {
  try {
    closePeerConnection();
    peerConnection = createPeer(true, activeSessionId);
    await peerConnection.setRemoteDescription(data.offer);
    remoteDescriptionReady = true;
    await flushPendingIceCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { sessionId: activeSessionId, answer: peerConnection.localDescription });
    setStatus("Ligado. A receber vídeo do telemóvel…");
  } catch (err) {
    console.error("Erro ao processar offer:", err);
    showError("Falha ao negociar a ligação WebRTC: " + err.message);
  }
}

async function handleAnswer(data) {
  try {
    if (!peerConnection) throw new Error("A ligação WebRTC ainda não foi criada.");
    await peerConnection.setRemoteDescription(data.answer);
    remoteDescriptionReady = true;
    await flushPendingIceCandidates();
    setStatus("Ligação estabelecida. A enviar vídeo…");
  } catch (err) {
    console.error("Erro ao processar answer:", err);
    showError("Falha ao concluir a ligação WebRTC: " + err.message);
  }
}

async function handleRemoteIceCandidate(data) {
  if (!data?.candidate) return;
  try {
    if (!peerConnection || !remoteDescriptionReady) {
      pendingIceCandidates.push(data.candidate);
      return;
    }
    await peerConnection.addIceCandidate(data.candidate);
  } catch (err) {
    console.warn("Não foi possível adicionar candidato ICE:", err);
  }
}

async function flushPendingIceCandidates() {
  const queued = pendingIceCandidates;
  pendingIceCandidates = [];
  for (const candidate of queued) {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (err) {
      console.warn("Candidato ICE ignorado:", err);
    }
  }
}

async function startMobile(sessionId) {
  try {
    peerConnection = createPeer(false, sessionId);

    // Mantém os métodos de captura originais; esta alteração não muda
    // a compatibilidade nem o comportamento dos pedidos de permissões.
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });

    screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));
    cameraStream.getTracks().forEach(track => peerConnection.addTrack(track, cameraStream));

    // Send an explicit stream-ID -> role map. The receiver no longer relies
    // on the order in which ontrack events happen to arrive.
    metadataChannel = peerConnection.createDataChannel("stream-metadata");
    metadataChannel.onopen = () => {
      metadataChannel.send(JSON.stringify({
        type: "stream-map",
        screen: screenStream.id,
        camera: cameraStream.id
      }));
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { sessionId, offer: peerConnection.localDescription });
    setStatus("Pedido de ligação enviado ao PC…");
  } catch (err) {
    console.error("Erro ao iniciar partilha:", err);
    showError("Erro ao capturar ecrã/câmara: " + (err.message || err));
    joinStarted = false;
    closePeerConnection();
  }
}

function createPeer(isPc, sessionId) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("iceCandidate", {
        candidate: event.candidate,
        sessionId,
        fromPc: isPc
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("WebRTC connection state:", pc.connectionState);
    if (pc.connectionState === "connected") {
      setStatus("Ligação estabelecida.");
    } else if (pc.connectionState === "failed") {
      showError("A ligação direta falhou. A rede pode exigir um servidor TURN; STUN sozinho não atravessa todas as redes.");
    } else if (pc.connectionState === "disconnected") {
      setStatus("Ligação interrompida. A tentar recuperar…");
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE state:", pc.iceConnectionState);
  };

  pc.ontrack = event => {
    const stream = event.streams && event.streams[0];
    if (!stream) return;
    receivedStreams.set(stream.id, stream);
    renderMappedStreams();
  };

  pc.ondatachannel = event => {
    const channel = event.channel;
    channel.onmessage = messageEvent => {
      try {
        const message = JSON.parse(messageEvent.data);
        if (message.type === "stream-map") {
          streamRoles = {
            [message.screen]: "screenVideo",
            [message.camera]: "cameraVideo"
          };
          renderMappedStreams();
        }
      } catch (err) {
        console.warn("Metadados de vídeo inválidos:", err);
      }
    };
  };

  return pc;
}

function renderMappedStreams() {
  for (const [streamId, elementId] of Object.entries(streamRoles)) {
    const stream = receivedStreams.get(streamId);
    const video = document.getElementById(elementId);
    if (stream && video && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  pendingIceCandidates = [];
  remoteDescriptionReady = false;
  receivedStreams.clear();
  streamRoles = {};
  metadataChannel = null;
}

function setStatus(message) {
  const status = document.getElementById("connectionStatus");
  if (status) status.textContent = message;
}

function showError(message) {
  setStatus("Erro: " + message);
  alert(message);
}
