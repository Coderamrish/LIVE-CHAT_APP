const socket = io();

let username = "";
while (!username) {
  username = prompt("Enter your name:")?.trim();
  if (!username) {
    alert("A username is required to continue.");
    location.reload();
  }
}

let currentServer = "";

function joinServer(server) {
  if (currentServer) {
    socket.emit("leaveServer", { username, server: currentServer });
  }

  currentServer = server;
  socket.emit("joinServer", { username, server });

  document.getElementById("chat-messages").innerHTML = `<p><em>Joined ${server}</em></p>`;
}

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

// Display received messages
socket.on("receiveMessage", ({ user, message }) => {
  document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> ${message}</div>`;
});

// Display uploaded files
socket.on("receiveFile", ({ user, fileUrl, fileName }) => {
  document.getElementById("chat-messages").innerHTML += `<div><strong>${user}:</strong> <a href="${fileUrl}" target="_blank">${fileName}</a></div>`;
});

// Update user list
socket.on("updateUsers", (users) => {
  const userList = document.getElementById("user-list");
  userList.innerHTML = users.map(user => `<li>${user}</li>`).join("");
});

// Typing indicator
socket.on("userTyping", ({ user, isTyping }) => {
  const typingIndicator = document.getElementById("typing-indicator");
  typingIndicator.innerText = isTyping ? `${user} is typing...` : "";
});

// Handle file upload
document.getElementById("fileInput").addEventListener("change", function (event) {
  let file = event.target.files[0];
  if (!file) return;

  let formData = new FormData();
  formData.append("file", file);
  formData.append("username", username);
  formData.append("server", currentServer);

  fetch("/upload", { method: "POST", body: formData })
    .then(response => response.json())
    .then(data => console.log("File uploaded:", data.fileUrl))
    .catch(error => console.error("Upload error:", error));

  event.target.value = "";
});
https://live-chat-app-om6p.onrender.com
