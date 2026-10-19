
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Store connected players in server memory.
const players = {};

app.get("/", (req, res) => {
  res.send("ProxiSpeak multiplayer server is running!");
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Give each new player a starting position.
  const count = Object.keys(players).length;

  players[socket.id] = {
    id: socket.id,
    name: `Player ${count + 1}`,
    x: 100 + (count * 100) % 600,
    y: 100 + (count * 60) % 300,
  };

  // Send the current list of players to everyone.
  io.emit("playersUpdate", Object.values(players));

  // Receive and broadcast movement.
  socket.on("playerMove", (position) => {
    if (!players[socket.id]) return;

    if (
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return;
    }

    players[socket.id].x = Math.max(
      20,
      Math.min(780, position.x)
    );

    players[socket.id].y = Math.max(
      20,
      Math.min(480, position.y)
    );

    io.emit("playersUpdate", Object.values(players));
  });

  // Remove disconnected players.
  socket.on("disconnect", () => {
    delete players[socket.id];

    console.log("Player disconnected:", socket.id);

    io.emit("playersUpdate", Object.values(players));
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`ProxiSpeak server running on http://localhost:${PORT}`);
});
