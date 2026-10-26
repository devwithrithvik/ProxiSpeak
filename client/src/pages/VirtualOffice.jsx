
import Header from "../components/Header";
import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import "../App.css";
import officeFloor from "../assets/office-floor.png";

// Connect only while the Virtual Office is mounted.
const socket = io("http://localhost:5000", {
  autoConnect: false,
});

// Public STUN server helps peers discover direct connection paths.
// Production deployments may also need a TURN server.
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

function VirtualOffice({ user, onNavigate, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [myEmployeeId, setMyEmployeeId] = useState("");
  const [connected, setConnected] = useState(false);
  const [nearbyEmployees, setNearbyEmployees] = useState([]);
  const [voiceRange, setVoiceRange] = useState(120);

  const [voiceJoined, setVoiceJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState({});

  // Refs keep the latest voice state available to Socket.IO handlers.
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const offerInProgressRef = useRef(new Set());
  const nearbyRef = useRef([]);
  const voiceEnabledRef = useRef(false);
  const announcedPeersRef = useRef(new Set());

  // ==========================================
  // CLOSE A PEER CONNECTION
  // ==========================================

  const closePeerConnection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();

      peerConnectionsRef.current.delete(peerId);
    }

    pendingCandidatesRef.current.delete(peerId);
    offerInProgressRef.current.delete(peerId);

    setRemoteStreams((previous) => {
      if (!previous[peerId]) return previous;

      const updated = { ...previous };
      delete updated[peerId];
      return updated;
    });
  }, []);

  // ==========================================
  // CREATE A WEBRTC PEER CONNECTION
  // ==========================================

  const createPeerConnection = useCallback((peerId) => {
    const existing = peerConnectionsRef.current.get(peerId);

    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.connected) {
        socket.emit("voiceSignal", {
          targetSocketId: peerId,
          signal: {
            type: "candidate",
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream =
        event.streams?.[0] ||
        new MediaStream([event.track]);

      setRemoteStreams((previous) => ({
        ...previous,
        [peerId]: stream,
      }));
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        closePeerConnection(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, pc);

    return pc;
  }, [closePeerConnection]);

  // ==========================================
  // START AN OUTGOING WEBRTC OFFER
  // Only the smaller socket ID initiates.
  // Prevent duplicate offers during rejoining.
  // ==========================================

  const startOffer = useCallback(async (peerId) => {
    if (
      !localStreamRef.current ||
      !voiceEnabledRef.current ||
      !socket.connected ||
      socket.id.localeCompare(peerId) >= 0 ||
      offerInProgressRef.current.has(peerId)
    ) {
      return;
    }

    const pc = createPeerConnection(peerId);

    if (pc.signalingState !== "stable") return;

    offerInProgressRef.current.add(peerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Do not send a stale offer if the user left voice
      // or the peer connection was closed while awaiting.
      if (
        !voiceEnabledRef.current ||
        !socket.connected ||
        peerConnectionsRef.current.get(peerId) !== pc
      ) {
        return;
      }

      socket.emit("voiceSignal", {
        targetSocketId: peerId,
        signal: {
          type: "offer",
          description: pc.localDescription,
        },
      });
    } catch (error) {
      console.error("Could not start voice connection:", error);
      setVoiceError("Could not connect to a nearby colleague.");
    } finally {
      offerInProgressRef.current.delete(peerId);
    }
  }, [createPeerConnection]);

  // ==========================================
  // HANDLE INCOMING WEBRTC SIGNALS
  // ==========================================

  useEffect(() => {
    async function handleVoiceSignal({
      fromSocketId,
      signal,
    } = {}) {
      if (!fromSocketId || !signal) return;

      // The other user has left voice.
      if (signal.type === "voice-left") {
        closePeerConnection(fromSocketId);
        announcedPeersRef.current.delete(fromSocketId);
        return;
      }

      // A nearby user is ready to establish voice.
      if (signal.type === "voice-ready") {
        if (
          voiceEnabledRef.current &&
          localStreamRef.current &&
          socket.connected
        ) {
          // Reply even if this user was already nearby.
          // This makes rejoining independent of avatar movement.
          socket.emit("voiceSignal", {
            targetSocketId: fromSocketId,
            signal: { type: "voice-ready-ack" },
          });

          // Only the smaller socket ID initiates the offer.
          if (socket.id.localeCompare(fromSocketId) < 0) {
            await startOffer(fromSocketId);
          }
        }

        return;
      }

      // The peer acknowledges our readiness message.
      if (signal.type === "voice-ready-ack") {
        if (
          voiceEnabledRef.current &&
          localStreamRef.current &&
          socket.connected &&
          socket.id.localeCompare(fromSocketId) < 0
        ) {
          await startOffer(fromSocketId);
        }

        return;
      }

      // Do not establish audio connections unless the local
      // user has explicitly joined voice.
      if (
        !voiceEnabledRef.current ||
        !localStreamRef.current
      ) {
        return;
      }

      try {
        const pc = createPeerConnection(fromSocketId);

        if (signal.type === "offer") {
          await pc.setRemoteDescription(signal.description);

          const queued =
            pendingCandidatesRef.current.get(fromSocketId) || [];

          for (const candidate of queued) {
            await pc.addIceCandidate(candidate);
          }

          pendingCandidatesRef.current.delete(fromSocketId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("voiceSignal", {
            targetSocketId: fromSocketId,
            signal: {
              type: "answer",
              description: pc.localDescription,
            },
          });
        } else if (signal.type === "answer") {
          if (pc.signalingState !== "have-local-offer") return;

          await pc.setRemoteDescription(signal.description);

          const queued =
            pendingCandidatesRef.current.get(fromSocketId) || [];

          for (const candidate of queued) {
            await pc.addIceCandidate(candidate);
          }

          pendingCandidatesRef.current.delete(fromSocketId);
        } else if (signal.type === "candidate") {
          const candidate = signal.candidate;

          if (!candidate) return;

          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            const queued =
              pendingCandidatesRef.current.get(fromSocketId) || [];

            queued.push(candidate);

            pendingCandidatesRef.current.set(
              fromSocketId,
              queued
            );
          }
        }
      } catch (error) {
        console.error("WebRTC signaling error:", error);
        setVoiceError(
          "A voice connection failed. Try leaving and rejoining voice."
        );
      }
    }

    socket.on("voiceSignal", handleVoiceSignal);

    return () => {
      socket.off("voiceSignal", handleVoiceSignal);
    };
  }, [closePeerConnection, createPeerConnection, startOffer]);

  // ==========================================
  // SOCKET.IO — OFFICE CONNECTION AND PROXIMITY
  // ==========================================

  useEffect(() => {
    function handleConnect() {
      setMyEmployeeId(socket.id);
      setConnected(true);
    }

    function handleDisconnect() {
      setConnected(false);
      setNearbyEmployees([]);
      nearbyRef.current = [];

      voiceEnabledRef.current = false;
      setVoiceJoined(false);
      setMuted(false);

      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;

      for (const peerId of peerConnectionsRef.current.keys()) {
        closePeerConnection(peerId);
      }

      announcedPeersRef.current.clear();
      pendingCandidatesRef.current.clear();
      offerInProgressRef.current.clear();
      setRemoteStreams({});
    }

    function handleEmployeesUpdate(updatedEmployees) {
      setEmployees(updatedEmployees);
    }

    function handleProximityUpdate(data) {
      const nearby = data.nearbyEmployees || [];

      setNearbyEmployees(nearby);
      nearbyRef.current = nearby;

      if (Number.isFinite(data.voiceRange)) {
        setVoiceRange(data.voiceRange);
      }

      const nearbyIds = new Set(
        nearby.map((employee) => employee.socketId)
      );

      // Close connections when colleagues move out of range.
      for (const peerId of peerConnectionsRef.current.keys()) {
        if (!nearbyIds.has(peerId)) {
          closePeerConnection(peerId);
        }
      }

      // Permit a fresh connection if someone returns later.
      for (const peerId of announcedPeersRef.current) {
        if (!nearbyIds.has(peerId)) {
          announcedPeersRef.current.delete(peerId);
        }
      }

      // Announce voice availability to newly nearby colleagues.
      if (voiceEnabledRef.current && socket.connected) {
        nearby.forEach((employee) => {
          const peerId = employee.socketId;

          if (
            !peerId ||
            peerId === socket.id ||
            announcedPeersRef.current.has(peerId)
          ) {
            return;
          }

          announcedPeersRef.current.add(peerId);

          socket.emit("voiceSignal", {
            targetSocketId: peerId,
            signal: { type: "voice-ready" },
          });
        });
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("employeesUpdate", handleEmployeesUpdate);
    socket.on("proximityUpdate", handleProximityUpdate);

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

      // Stop media and close connections when leaving the page.
      voiceEnabledRef.current = false;

      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;

      for (const pc of peerConnectionsRef.current.values()) {
        pc.close();
      }

      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current.clear();
      announcedPeersRef.current.clear();
      offerInProgressRef.current.clear();

      socket.disconnect();
    };
  }, [
    user?.name,
    user?.username,
    user?.userId,
    user?.id,
    closePeerConnection,
  ]);

  // ==========================================
  // JOIN VOICE
  // ==========================================

  async function joinVoice() {
    if (!socket.connected) {
      setVoiceError("Connect to the virtual office first.");
      return;
    }

    if (voiceEnabledRef.current) return;

    setVoiceError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is unavailable. Use localhost or HTTPS."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // The component may have unmounted or disconnected
      // while microphone permission was pending.
      if (!socket.connected) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      voiceEnabledRef.current = true;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      setMuted(false);
      setVoiceJoined(true);

      // Reset readiness tracking and announce again to everyone
      // currently nearby, even if neither avatar has moved.
      announcedPeersRef.current.clear();

      nearbyRef.current.forEach((employee) => {
        const peerId = employee.socketId;

        if (!peerId || peerId === socket.id) return;

        announcedPeersRef.current.add(peerId);

        socket.emit("voiceSignal", {
          targetSocketId: peerId,
          signal: { type: "voice-ready" },
        });
      });
    } catch (error) {
      console.error("Microphone access failed:", error);

      setVoiceError(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser."
          : error.message || "Could not access the microphone."
      );
    }
  }

  // ==========================================
  // LEAVE VOICE
  // ==========================================

  function leaveVoice() {
    voiceEnabledRef.current = false;

    // Notify peers before closing the current connections.
    for (const peerId of peerConnectionsRef.current.keys()) {
      if (socket.connected) {
        socket.emit("voiceSignal", {
          targetSocketId: peerId,
          signal: { type: "voice-left" },
        });
      }
    }

    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }

    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    announcedPeersRef.current.clear();
    offerInProgressRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    setRemoteStreams({});
    setVoiceJoined(false);
    setMuted(false);
    setVoiceError("");
  }

  // ==========================================
  // MUTE / UNMUTE
  // ==========================================

  function toggleMute() {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nextMuted = !muted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setMuted(nextMuted);
  }

  // ==========================================
  // KEYBOARD MOVEMENT
  // ==========================================

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

      if (
        event.target instanceof HTMLElement &&
        (
          ["INPUT", "TEXTAREA"].includes(event.target.tagName) ||
          event.target.isContentEditable
        )
      ) {
        return;
      }

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

      x = Math.max(20, Math.min(780, x));
      y = Math.max(20, Math.min(480, y));

      socket.emit("employeeMove", { x, y });
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [employees, myEmployeeId]);

  // ==========================================
  // VIRTUAL OFFICE UI
  // ==========================================

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

        <div className="player-layer">
          {employees.map((employee) => {
            const isMe = employee.socketId === myEmployeeId;

            const initials = (employee.name || "Guest")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const isNearby = nearbyEmployees.some(
              (nearby) => nearby.socketId === employee.socketId
            );

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
                  title={
                    isNearby
                      ? `${employee.name} — nearby`
                      : employee.name
                  }
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

      {/* Voice controls */}
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          padding: "14px",
        }}
      >
        {!voiceJoined ? (
          <button
            type="button"
            onClick={joinVoice}
            disabled={!connected}
            style={{
              padding: "10px 16px",
              cursor: connected ? "pointer" : "not-allowed",
            }}
          >
            🎙️ Join Voice
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              style={{ padding: "10px 16px", cursor: "pointer" }}
            >
              {muted ? "🔇 Unmute" : "🎙️ Mute"}
            </button>

            <button
              type="button"
              onClick={leaveVoice}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Leave Voice
            </button>
          </>
        )}

        <span>
          {voiceJoined
            ? muted
              ? "Microphone muted"
              : "Voice enabled"
            : "Not in voice chat"}
        </span>

        <span>
          Audio connections: {Object.keys(remoteStreams).length}
        </span>

        {voiceError && (
          <span
            role="alert"
            style={{ color: "crimson", flexBasis: "100%" }}
          >
            {voiceError}
          </span>
        )}

        {/* Remote audio elements */}
        {Object.entries(remoteStreams).map(([peerId, stream]) => (
          <audio
            key={peerId}
            autoPlay
            playsInline
            ref={(element) => {
              if (element && element.srcObject !== stream) {
                element.srcObject = stream;
                element.play().catch((error) => {
                  console.warn(
                    "Audio playback needs browser permission:",
                    error
                  );
                });
              }
            }}
          />
        ))}
      </section>

      {/* Existing connection and spatial status */}
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
