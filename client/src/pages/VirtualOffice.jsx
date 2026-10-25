import Header from "../components/Header";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "../App.css";
import officeFloor from "../assets/office-floor.png";

// Connect only while the Virtual Office is mounted.
const socket = io("http://localhost:5000", {
  autoConnect: false,
});

function VirtualOffice({ user, onNavigate, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [myEmployeeId, setMyEmployeeId] = useState("");
  const [connected, setConnected] = useState(false);
  const [nearbyEmployees, setNearbyEmployees] = useState([]);
  const [voiceRange, setVoiceRange] = useState(120);

  // Connect with the actual logged-in user's identity.
  useEffect(() => {
    function handleConnect() {
      setMyEmployeeId(socket.id);
      setConnected(true);
    }

    function handleDisconnect() {
      setConnected(false);
      setNearbyEmployees([]);
    }

    function handleEmployeesUpdate(updatedEmployees) {
      setEmployees(updatedEmployees);
    }

    function handleProximityUpdate(data) {
      setNearbyEmployees(data.nearbyEmployees || []);

      if (Number.isFinite(data.voiceRange)) {
        setVoiceRange(data.voiceRange);
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("employeesUpdate", handleEmployeesUpdate);
    socket.on("proximityUpdate", handleProximityUpdate);

    // The backend expects userId and name directly inside socket.auth.
    socket.auth = {
      userId:
        user?.username ||
        user?.userId ||
        user?.id ||
        user?.name ||
        "guest",
      name: user?.name || user?.username || "Guest",
    };

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("employeesUpdate", handleEmployeesUpdate);
      socket.off("proximityUpdate", handleProximityUpdate);

      socket.disconnect();
    };
  }, [user?.name, user?.username, user?.userId, user?.id]);

  // Keyboard movement for the currently logged-in employee.
  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      const allowedKeys = [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ];

      if (!allowedKeys.includes(key)) return;

      // Don't move the avatar while typing into a form field.
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA"].includes(event.target.tagName) ||
          event.target.isContentEditable)
      ) {
        return;
      }

      // Don't interfere with browser shortcuts such as Ctrl+R.
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const currentEmployee = employees.find(
        (employee) => employee.socketId === myEmployeeId
      );

      if (!currentEmployee || !socket.connected) return;

      event.preventDefault();

      const speed = 12;
      let { x, y } = currentEmployee;

      if (key === "w" || key === "arrowup") y -= speed;
      if (key === "s" || key === "arrowdown") y += speed;
      if (key === "a" || key === "arrowleft") x -= speed;
      if (key === "d" || key === "arrowright") x += speed;

      // Keep the avatar inside the 800 x 500 virtual office.
      x = Math.max(20, Math.min(780, x));
      y = Math.max(20, Math.min(480, y));

      // This event name matches the current backend.
      socket.emit("employeeMove", { x, y });
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [employees, myEmployeeId]);

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

        {/* Live employee avatars. */}
        <div className="player-layer">
          {employees.map((employee) => {
            const isMe = employee.socketId === myEmployeeId;

            const initials = (employee.name || "Guest")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={employee.socketId || employee.userId}
                className="player"
                style={{
                  left: `${9.2 + (employee.x / 800) * 81}%`,
                  top: `${6.5 + (employee.y / 500) * 86}%`,
                }}
              >
                <div
                  className={`avatar ${
                    isMe ? "my-avatar" : "other-avatar"
                  }`}
                >
                  {initials}
                </div>

                <span className="player-name">
                  {isMe ? "You" : employee.name}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Connection, employee count and proximity status. */}
      <footer className="app-footer">
        <span
          className={
            connected ? "connection-online" : "connection-offline"
          }
        >
          ● {connected ? "Connected" : "Connecting..."}
        </span>

        <span>Employees online: {employees.length}</span>

        <span>Nearby: {nearbyEmployees.length}</span>

        <span>
          {nearbyEmployees.length > 0
            ? nearbyEmployees
                .map(
                  (employee) =>
                    `${employee.name} (${employee.distance}px)`
                )
                .join(", ")
            : "No nearby employees"}
        </span>

        <span>Voice range: {voiceRange}px</span>

        <span>Move: W A S D or arrow keys</span>
      </footer>
    </main>
  );
}

export default VirtualOffice;