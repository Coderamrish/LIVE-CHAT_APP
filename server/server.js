const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "audio/webm"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

let users = {};
let servers = { "Server 1": [], "Server 2": [] };

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("joinServer", ({ username, server }) => {
    if (!servers[server]) {
      return socket.emit("joinError", `Server "${server}" does not exist.`);
    }

    if (users[socket.id]) {
      let prevServer = users[socket.id].server;
      servers[prevServer] = servers[prevServer].filter(user => user !== users[socket.id].username);
      io.to(prevServer).emit("updateUsers", servers[prevServer]);
      socket.leave(prevServer);
    }

    users[socket.id] = { username, server };
    servers[server].push(username);
    socket.join(server);
    io.to(server).emit("updateUsers", servers[server]);
  });

  socket.on("sendMessage", ({ server, message }) => {
    io.to(server).emit("receiveMessage", { user: users[socket.id].username, message });
  });

  socket.on("sendAudio", ({ server, fileUrl }) => {
    io.to(server).emit("receiveAudio", { user: users[socket.id].username, fileUrl });
  });

  socket.on("callUser", ({ username, server }) => {
    socket.to(server).emit("incomingCall", { from: username });
  });

  socket.on("answerCall", ({ to, offer }) => {
    io.to(to).emit("callAccepted", { answer: offer });
  });

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      let { username, server } = users[socket.id];
      servers[server] = servers[server].filter(user => user !== username);
      io.to(server).emit("updateUsers", servers[server]);
      delete users[socket.id];
    }
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { server, username } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;

  let fileType = req.file.mimetype.startsWith("image/") ? "image" : "audio";

  io.to(server).emit("receiveFile", { user: username, fileUrl, fileType });

  res.json({ fileUrl });
});

server.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
