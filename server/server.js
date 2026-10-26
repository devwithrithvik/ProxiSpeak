
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { performance } = require("node:perf_hooks");

const UserLocation = require("./models/UserLocation");

dotenv.config();
mongoose.set("autoIndex", false);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ==========================================
// VIRTUAL OFFICE SETTINGS
// ==========================================

const PORT = process.env.PORT || 5000;

const OFFICE_WIDTH = 800;
const OFFICE_HEIGHT = 500;

const VOICE_RANGE = 120;
const TARGET_QUERY_TIME_MS = 20;
const CLUSTER_DISTANCE_PIXELS = 100;

// Current positions of connected Socket.IO sessions.
const employees = new Map();

// ==========================================
// DISTANCE HELPERS
// ==========================================

function distanceInPixels(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function distanceBetweenEmployees(employee1, employee2) {
  return distanceInPixels(
    employee1.x,
    employee1.y,
    employee2.x,
    employee2.y
  );
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ProxiSpeak backend is running.",
    coordinateSystem: "Virtual office pixels (x, y)",
    office: {
      width: OFFICE_WIDTH,
      height: OFFICE_HEIGHT,
    },
    voiceRangePixels: VOICE_RANGE,
    connectedEmployees: employees.size,
  });
});

// ==========================================
// DEMO DATA FOR DATABASE TESTING ONLY
// ==========================================

app.post("/api/spatial-audit/demo-data", async (req, res) => {
  try {
    const demoEmployees = [
      {
        userId: "rajdip",
        name: "Rajdip Jana",
        location: [400, 250],
      },
      {
        userId: "dona",
        name: "Dona Mondal",
        location: [450, 270],
      },
      {
        userId: "rithvik",
        name: "Rithvik",
        location: [650, 250],
      },
      {
        userId: "abdul",
        name: "Abdul",
        location: [690, 270],
      },
    ];

    await UserLocation.deleteMany({
      userId: {
        $in: demoEmployees.map((employee) => employee.userId),
      },
    });

    await UserLocation.insertMany(demoEmployees);

    res.json({
      success: true,
      message: "Virtual-office demo data inserted successfully.",
      note: "These are fixed database test records, not live positions.",
      coordinateSystem: "Virtual office pixels (x, y)",
      employees: demoEmployees.map((employee) => ({
        userId: employee.userId,
        name: employee.name,
        x: employee.location[0],
        y: employee.location[1],
      })),
    });
  } catch (error) {
    console.error("Demo data error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to insert demo data.",
      error: error.message,
    });
  }
});

// ==========================================
// SPATIAL AUDIT — LIVE POSITIONS
// ==========================================

app.get("/api/spatial-audit", (req, res) => {
  const requestStart = performance.now();

  try {
    const x = Number(req.query.x ?? 400);
    const y = Number(req.query.y ?? 250);
    const radius = Number(req.query.radius ?? 500);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(radius) ||
      x < 0 ||
      x > OFFICE_WIDTH ||
      y < 0 ||
      y > OFFICE_HEIGHT ||
      radius <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide valid x and y coordinates inside the virtual office and a positive radius.",
        office: {
          width: OFFICE_WIDTH,
          height: OFFICE_HEIGHT,
        },
      });
    }

    const queryStart = performance.now();

    const liveEmployees = Array.from(employees.values()).map(
      (employee) => ({
        userId: employee.userId,
        name: employee.name,
        socketId: employee.socketId,
        x: employee.x,
        y: employee.y,
      })
    );

    const queryTimeMs = Number(
      (performance.now() - queryStart).toFixed(3)
    );

    const nearbyEmployees = liveEmployees
      .map((employee) => {
        const exactDistance = distanceInPixels(
          x,
          y,
          employee.x,
          employee.y
        );

        return {
          ...employee,
          distancePixels: Number(exactDistance.toFixed(2)),
          exactDistance,
        };
      })
      .filter((employee) => employee.exactDistance <= radius)
      .sort((a, b) => a.exactDistance - b.exactDistance)
      .map(({ exactDistance, ...employee }) => employee);

    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < nearbyEmployees.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = [];
      const queue = [i];

      assigned.add(i);

      while (queue.length > 0) {
        const currentIndex = queue.shift();
        const currentEmployee = nearbyEmployees[currentIndex];

        cluster.push(currentEmployee);

        for (let j = 0; j < nearbyEmployees.length; j++) {
          if (assigned.has(j)) continue;

          const candidate = nearbyEmployees[j];

          const distance = distanceBetweenEmployees(
            currentEmployee,
            candidate
          );

          if (distance <= CLUSTER_DISTANCE_PIXELS) {
            assigned.add(j);
            queue.push(j);
          }
        }
      }

      clusters.push(cluster);
    }

    const totalProcessingMs = Number(
      (performance.now() - requestStart).toFixed(3)
    );

    return res.json({
      success: true,
      dataSource: "Live Socket.IO virtual-office positions",
      coordinateSystem: "Virtual office pixels (x, y)",
      searchCenter: { x, y },
      radiusPixels: radius,
      clusterDistancePixels: CLUSTER_DISTANCE_PIXELS,
      totalConnectedEmployees: liveEmployees.length,
      nearbyCount: nearbyEmployees.length,
      nearbyEmployees,
      clusterCount: clusters.length,
      clusters: clusters.map((cluster, index) => ({
        clusterId: index + 1,
        employeeCount: cluster.length,
        employees: cluster,
      })),
      performance: {
        queryTimeMs,
        totalProcessingMs,
        targetMs: TARGET_QUERY_TIME_MS,
        queryWithinTarget: queryTimeMs < TARGET_QUERY_TIME_MS,
        totalWithinTarget: totalProcessingMs < TARGET_QUERY_TIME_MS,
      },
    });
  } catch (error) {
    console.error("Live spatial audit error:", error);

    return res.status(500).json({
      success: false,
      message: "Live spatial audit failed.",
      error: error.message,
    });
  }
});

// ==========================================
// LIVE VIRTUAL OFFICE — BROADCAST STATE
// ==========================================

function broadcastEmployeeState() {
  const employeeList = Array.from(employees.values());

  io.emit("employeesUpdate", employeeList);

  for (const socket of io.sockets.sockets.values()) {
    const currentEmployee = employees.get(socket.id);

    if (!currentEmployee) continue;

    const nearbyEmployees = employeeList
      .filter((employee) => employee.socketId !== socket.id)
      .map((employee) => ({
        ...employee,
        distance: Number(
          distanceBetweenEmployees(
            currentEmployee,
            employee
          ).toFixed(2)
        ),
      }))
      .filter((employee) => employee.distance <= VOICE_RANGE);

    socket.emit("proximityUpdate", {
      nearbyEmployees,
      voiceRange: VOICE_RANGE,
    });
  }
}

// ==========================================
// LIVE VIRTUAL OFFICE — SOCKET CONNECTIONS
// ==========================================

io.on("connection", (socket) => {
  const auth = socket.handshake.auth || {};

  const userId =
    typeof auth.userId === "string" && auth.userId.trim()
      ? auth.userId.trim()
      : `guest-${socket.id}`;

  const name =
    typeof auth.name === "string" && auth.name.trim()
      ? auth.name.trim()
      : "Guest";

  const employee = {
    socketId: socket.id,
    userId,
    name,
    x: 400,
    y: 250,
  };

  employees.set(socket.id, employee);

  console.log(`${name} connected (${socket.id})`);

  broadcastEmployeeState();

  // ========================================
  // EMPLOYEE MOVEMENT
  // ========================================

  socket.on("employeeMove", (movement) => {
    const currentEmployee = employees.get(socket.id);

    if (!currentEmployee || !movement) return;

    const nextX = Number(movement.x);
    const nextY = Number(movement.y);

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      return;
    }

    currentEmployee.x = Math.max(
      0,
      Math.min(OFFICE_WIDTH, nextX)
    );

    currentEmployee.y = Math.max(
      0,
      Math.min(OFFICE_HEIGHT, nextY)
    );

    employees.set(socket.id, currentEmployee);

    broadcastEmployeeState();
  });

  // ========================================
  // WEBRTC VOICE SIGNALING
  // Forwards offers, answers, and ICE candidates.
  // Audio itself travels peer-to-peer.
  // ========================================

  socket.on("voiceSignal", (payload = {}) => {
    const { targetSocketId, signal } = payload;

    if (
      typeof targetSocketId !== "string" ||
      !signal ||
      targetSocketId === socket.id ||
      !employees.has(targetSocketId)
    ) {
      return;
    }

    // Only relay signaling messages, not audio streams.
    io.to(targetSocketId).emit("voiceSignal", {
      fromSocketId: socket.id,
      signal,
    });
  });

  // ========================================
  // DISCONNECT CLEANUP
  // ========================================

  socket.on("disconnect", () => {
    const disconnectedEmployee = employees.get(socket.id);

    employees.delete(socket.id);

    console.log(
      `${disconnectedEmployee?.name || "Employee"} disconnected`
    );

    broadcastEmployeeState();
  });
});

// ==========================================
// START BACKEND SERVER
// ==========================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing from server/.env"
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Atlas connected successfully!");

    const indexes = await UserLocation.collection.indexes();

    for (const index of indexes) {
      if (
        index.name !== "_id_" &&
        index.key &&
        index.key.location
      ) {
        await UserLocation.collection.dropIndex(index.name);
        console.log(`Removed old location index: ${index.name}`);
      }
    }

    await UserLocation.collection.createIndex(
      { userId: 1 },
      { unique: true }
    );

    console.log("Virtual-office location model ready.");

    server.listen(PORT, () => {
      console.log(
        `ProxiSpeak server running on http://localhost:${PORT}`
      );

      console.log(
        `Virtual office: ${OFFICE_WIDTH} x ${OFFICE_HEIGHT} pixels`
      );

      console.log(`Voice range: ${VOICE_RANGE} pixels`);
      console.log("Spatial audit source: live connected employees");
      console.log("WebRTC signaling: enabled");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  }
}

startServer();
