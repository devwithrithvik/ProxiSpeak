import Header from "../components/Header";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "../App.css";
import officeFloor from "../assets/office-floor.png";

// Connect to the backend only when the Virtual Office is mounted.
const socket = io("http://localhost:5000", {
  autoConnect: false,
});

function VirtualOffice({ user, onNavigate, onLogout }) {
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function handleConnect() {
      setMyId(socket.id);
      setConnected(true);
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handlePlayersUpdate(updatedPlayers) {
      setPlayers(updatedPlayers);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("playersUpdate", handlePlayersUpdate);

    socket.connect();

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("playersUpdate", handlePlayersUpdate);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      const allowedKeys = [
        "w", "a", "s", "d",
        "arrowup", "arrowdown",
        "arrowleft", "arrowright",
      ];

      if (!allowedKeys.includes(key)) return;

      // Don't interfere with typing in input fields.
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(event.target.tagName)
      ) {
        return;
      }

      event.preventDefault();

      const currentPlayer = players.find(
        (player) => player.id === myId
      );

      if (!currentPlayer) return;

      const speed = 12;
      let { x, y } = currentPlayer;

      if (key === "w" || key === "arrowup") y -= speed;
      if (key === "s" || key === "arrowdown") y += speed;
      if (key === "a" || key === "arrowleft") x -= speed;
      if (key === "d" || key === "arrowright") x += speed;

      x = Math.max(20, Math.min(780, x));
      y = Math.max(20, Math.min(480, y));

      socket.emit("playerMove", { x, y });
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [players, myId]);

  return (
    <main className="app">
        <Header
            user={user}
            onNavigate={onNavigate}
            onLogout={onLogout}
        />
      <section className="office-stage">
        <img
          className="office-background"
          src={officeFloor}
          alt="ProxiSpeak virtual office floor plan"
          draggable="false"
        />

        {/* Live multiplayer avatars appear over the office image. */}
        <div className="player-layer">
          {players.map((player) => (
            <div
              key={player.id}
              className="player"
              style={{
                left: `${9.2 + (player.x / 800) * 81}%`,
                top: `${6.5 + (player.y / 500) * 86}%`,
              }}
            >
              <div
                className={`avatar ${
                  player.id === myId ? "my-avatar" : "other-avatar"
                }`}
              >
                {player.name.replace("Player ", "").slice(0, 2)}
              </div>

              <span className="player-name">
                {player.id === myId ? "You" : player.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="app-footer">
        <span
          className={
            connected ? "connection-online" : "connection-offline"
          }
        >
          ● {connected ? "Connected" : "Connecting..."}
        </span>

        <span>Players online: {players.length}</span>

        <span>Move: W A S D or arrow keys</span>
      </footer>
    </main>
  );
}

export default VirtualOffice;
