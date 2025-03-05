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

// Create 'uploads' folder if it doesn't exist
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

let users = {};
let servers = {
  "Server 1": [],
  "Server 2": [],
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("joinServer", ({ username, server }) => {
    if (!servers[server]) {
      socket.emit("joinError", `Server "${server}" does not exist.`);
      return;
    }

    // Remove user from previous server if they switch
    if (users[socket.id]) {
      let prevServer = users[socket.id].server;
      servers[prevServer] = servers[prevServer].filter(user => user !== users[socket.id].username);
      io.to(prevServer).emit("updateUsers", servers[prevServer]);
      socket.leave(prevServer);
    }

    // Check if username is taken
    if (servers[server].includes(username)) {
      socket.emit("joinError", "Username already taken in this server.");
      return;
    }

    users[socket.id] = { username, server };
    servers[server].push(username);
    socket.join(server);

    io.to(server).emit("updateUsers", servers[server]);
    io.to(server).emit("userJoined", { username, server });

    console.log(`✅ ${username} joined ${server}`);
  });

  socket.on("sendMessage", ({ server, message }) => {
    if (users[socket.id]) {
      io.to(server).emit("receiveMessage", {
        user: users[socket.id].username,
        message,
      });
    }
  });

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      let { username, server } = users[socket.id];

      servers[server] = servers[server].filter(user => user !== username);
      io.to(server).emit("updateUsers", servers[server]);
      io.to(server).emit("userLeft", { username, server });

      console.log(`🔴 ${username} disconnected from ${server}`);
      delete users[socket.id];
    }
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { server, username } = req.body;
  if (!server || !username) {
    return res.status(400).json({ error: "Missing server or username" });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  io.to(server).emit("receiveFile", {
    user: username,
    fileUrl,
    fileName: req.file.originalname,
  });

  res.json({ fileUrl });
});

server.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
