

const socket = io();
const formattedTime = new Date(message.timestamp).toLocaleTimeString();



let username = "";
while (!username) {
    console.log("user not logged in")
  username = prompt("Enter your name:")?.trim();
  if (!username) {
    alert("A username is required to continue.");
    location.reload();
  }
}

let currentServer = "";
let localStream;
let peerConnection;
console.log(username)
const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Update Online Users
socket.on("updateUsers", (users) => {
  const userList = document.getElementById("user-list");
  userList.innerHTML = "";
  users.forEach(user => {
      const li = document.createElement("li");
      li.textContent = user;
      userList.appendChild(li);
  });
});

function joinServer(server) {
  if (currentServer) {
    socket.emit("leaveServer", { username, server: currentServer });
  }

  currentServer = server;
  socket.emit("joinServer", { username, server });

  document.getElementById("chat-messages").innerHTML = `<p><em>Joined ${server}</em></p>`;
  loadChatHistory();

}

// Sending Messages
function sendMessage() {
  let message = document.getElementById("message").value.trim();
  if (!message.length) return;

  if (!currentServer) {
    alert("You must join a server first!");
    return;
  }
  const timestamp = new Date().toLocaleTimeString(); // Get current time

  socket.emit("sendMessage", { server: currentServer, message });
  document.getElementById("message").value = "";
}

// Receiving Messages
socket.on("receiveMessage", ({ user, message, timestamp }) => {
  document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> ${message} <span class="timestamp">[${timestamp}]</span></div>`;
});
// Update Seen Messages
socket.on("updateSeenStatus", (user) => {
  document.getElementById("chat-messages").innerHTML += `<div><em>${user} has seen the message</em></div>`;
});
// Typing Indicator
document.getElementById("message").addEventListener("input", () => {
  socket.emit("typing", { server: currentServer, username });
});

socket.on("userTyping", (user) => {
  document.getElementById("typing-indicator").textContent = `${user} is typing...`;
  setTimeout(() => {
      document.getElementById("typing-indicator").textContent = "";
  }, 2000);
});
// Handling Voice Recording
let mediaRecorder;
let audioChunks = [];

document.getElementById("recordAudio").addEventListener("mouseup", () => {
  mediaRecorder.stop();
  mediaRecorder.onstop = async () => {
    let audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    let formData = new FormData();
    formData.append("file", audioBlob);
    formData.append("username", username);
    formData.append("server", currentServer);
    formData.append("recipient", "specific-username"); // Add recipient username

    let response = await fetch("/upload", { method: "POST", body: formData });
    let data = await response.json();
    socket.emit("sendAudio", { server: currentServer, fileUrl: data.fileUrl, recipient: "specific-username" });

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
// Load Chat History
function loadChatHistory() {
  socket.emit("loadChatHistory", { server: currentServer });
}

socket.on("chatHistory", (messages) => {
  const chatBox = document.getElementById("chat-messages");
  chatBox.innerHTML = messages.map(msg => `<div><strong>${msg.user}:</strong> ${msg.message} <span class="timestamp">[${msg.timestamp}]</span></div>`).join("");
});