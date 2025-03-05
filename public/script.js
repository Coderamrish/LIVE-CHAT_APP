const socket = io("https://live-chat-app-2ebs.onrender.com");

let username = "";
while (!username) {
  username = prompt("Enter your name:")?.trim();
  if (!username) {
    alert("A username is required to continue.");
    location.reload();
  }
}

let currentServer = "";
let localStream;
let peerConnection;

const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function joinServer(server) {
  if (currentServer) {
    socket.emit("leaveServer", { username, server: currentServer });
  }

  currentServer = server;
  socket.emit("joinServer", { username, server });

  document.getElementById("chat-messages").innerHTML = `<p><em>Joined ${server}</em></p>`;
}

// Sending Messages
function sendMessage() {
  let message = document.getElementById("message").value.trim();
  if (!message.length) return;

  if (!currentServer) {
    alert("You must join a server first!");
    return;
  }

  socket.emit("sendMessage", { server: currentServer, message });
  document.getElementById("message").value = "";
}

// Receiving Messages
socket.on("receiveMessage", ({ user, message }) => {
  document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> ${message}</div>`;
});

// Handling Voice Recording
let mediaRecorder;
let audioChunks = [];

document.getElementById("recordAudio").addEventListener("mousedown", async () => {
  let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
});

document.getElementById("recordAudio").addEventListener("mouseup", () => {
  mediaRecorder.stop();
  mediaRecorder.onstop = async () => {
    let audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    let formData = new FormData();
    formData.append("file", audioBlob);
    formData.append("username", username);
    formData.append("server", currentServer);

    let response = await fetch("/upload", { method: "POST", body: formData });
    let data = await response.json();
    socket.emit("sendAudio", { server: currentServer, fileUrl: data.fileUrl });

    audioChunks = [];
  };
});
socket.on("receiveFile", ({ user, fileUrl, fileType }) => {
    if (fileType === "image") {
      document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> <img src="${fileUrl}" width="200"/></div>`;
    } else {
      document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> <audio controls src="${fileUrl}"></audio></div>`;
    }
  });
  
// Receiving Voice Messages
socket.on("receiveAudio", ({ user, fileUrl }) => {
  document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> <audio controls src="${fileUrl}"></audio></div>`;
});

// Video Call Functions
document.getElementById("startCall").addEventListener("click", async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;

  socket.emit("callUser", { username, server: currentServer });
});

socket.on("incomingCall", async ({ from }) => {
  let accept = confirm(`${from} is calling. Accept?`);
  if (accept) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;

    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("answerCall", { to: from, offer });
  }
});

socket.on("callAccepted", async ({ answer }) => {
  await peerConnection.setRemoteDescription(answer);
});
https://live-chat-app-om6p.onrender.com
