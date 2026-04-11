const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const os = require("os");
const path = require("path");
const fs = require("fs");
const https = require("https");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

// Load env vars
dotenv.config();

const connectDB = require("./config/db");
const memoryMonitor = require("./utils/memoryMonitor");
const { cleanupBlacklist } = require("./utils/tokenBlacklist");
const seedAdmin = require("./scripts/seedAdmin");
const {
  syncUserFavouriteIndexes,
} = require("./utils/syncUserFavouriteIndexes");

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// ── BassInsight domain routes ──────────────────────────────────────────────
const lakeRoutes = require("./routes/lakeRoutes");
const bassPornRoutes = require("./routes/bassPornRoutes");
const fishingReportRoutes = require("./routes/fishingReportRoutes");
const commentRoutes = require("./routes/commentRoutes");
const contactRoutes = require("./routes/contactRoutes");

// ── Connect DB & seed ──────────────────────────────────────────────────────
connectDB()
  .then(async () => {
    await syncUserFavouriteIndexes();
    await seedAdmin();
    // Start memory monitoring
    memoryMonitor.start();
  })
  .catch((error) => {
    console.error("Startup DB init failed:", error.message);
  });

const app = express();

app.set("trust proxy", 1);

// ── Body / Cookie parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(cookieParser());

// ── Static file serving ────────────────────────────────────────────────────
// Serves: /uploads/users/…  /uploads/lakes/…  /uploads/catches/…
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(path.join(uploadsDir, "users"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "lakes"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "catches"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "fishingReport"), { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000,http://localhost:3001,https://bassinsight.vercel.app"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Memory monitoring middleware ────────────────────────────────────────────
app.use(memoryMonitor.middleware());

// ── HTTP logger ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount API routes
// ─────────────────────────────────────────────────────────────────────────────

// Auth & user management
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/settings", settingsRoutes);

// Admin dashboard
app.use("/api/dashboard", dashboardRoutes);

// BassInsight domain
app.use("/api/lakes", lakeRoutes);
app.use("/api/bassporn", bassPornRoutes);
app.use("/api/reports", fishingReportRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/contact", contactRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "BassInsight API is running",
    version: "2.0.0",
    // endpoints: {
    //   auth: "/api/auth",
    //   users: "/api/users",
    //   lakes: "/api/lakes",
    //   bassporn: "/api/bassporn",
    //   reports: "/api/reports",
    //   comments: "/api/comments",
    //   contact: "/api/contact",
    //   dashboard: "/api/dashboard",
    // },
  });
});

app.get("/api/health", (_req, res) => {
  const dbStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const dbState = dbStates[mongoose.connection.readyState] || "unknown";
  const payload = {
    status: dbState === "connected" ? "ok" : "degraded",
    service: "BassInsight API",
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    db: {
      status: dbState,
      // host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    },
  };

  const statusCode = dbState === "connected" ? 200 : 503;
  return res.status(statusCode).json(payload);
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[GlobalError]", err);
  const status = err.status || 500;
  res
    .status(status)
    .json({ success: false, message: err.message || "Internal server error" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Track intervals and resources for graceful shutdown
let blacklistInterval;
let keepAliveInterval;
let keepAliveRequest;

const server = app.listen(PORT, () => {
  const runBlacklistCleanup = async () => {
    try {
      const result = await cleanupBlacklist();
      if (result?.skipped && result.reason === "transient_mongo_error") {
        console.warn(
          "Blacklist cleanup skipped due to transient Mongo connectivity issue.",
        );
      }
      if (result?.skipped && result.reason === "db_not_connected") {
        console.warn(
          "Blacklist cleanup skipped because database is not connected.",
        );
      }
    } catch (e) {
      console.error("Blacklist cleanup failed:", e.message || e);
    }
  };

  // Scheduled blacklist cleanup (every hour)
  runBlacklistCleanup();
  blacklistInterval = setInterval(
    () => {
      runBlacklistCleanup();
    },
    60 * 60 * 1000,
  );
  blacklistInterval.unref(); // Allow process to exit even if interval is pending

  // Print network info
  const ifaces = os.networkInterfaces();
  let localIp = "localhost";
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }

  console.log(`\n🎣 BassInsight API v2.0`);
  console.log(`   Mode:    ${process.env.NODE_ENV || "development"}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIp}:${PORT}\n`);

  // Keep-Alive Ping for Render.com free tier
  if (
    process.env.NODE_ENV === "production" &&
    process.env.RENDER_EXTERNAL_URL
  ) {
    keepAliveInterval = setInterval(
      () => {
        // Destroy previous request if it's still hanging
        if (keepAliveRequest) {
          try {
            keepAliveRequest.destroy();
          } catch (e) {
            console.debug("Error destroying previous request:", e.message);
          }
        }
        
        keepAliveRequest = https
          .get(process.env.RENDER_EXTERNAL_URL, (res) => {
            console.log(`Keep-alive ping: ${res.statusCode}`);
            res.resume();
            res.on('end', () => {
              if (keepAliveRequest) {
                try {
                  keepAliveRequest.destroy();
                } catch (e) {
                  // Socket already destroyed
                }
              }
            });
          })
          .on("error", (err) =>
            console.error("Keep-alive failed:", err.message),
          )
          .on('socket', (socket) => {
            socket.setKeepAlive(true, 60000);
          });
        keepAliveRequest.setTimeout(5000, () => {
          console.warn("Keep-alive request timeout, destroying");
          keepAliveRequest.destroy();
        });
      },
      14 * 60 * 1000,
    );
    keepAliveInterval.unref();
  }
  
  console.log(`Server running. PID: ${process.pid}`);
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Clear intervals
  if (blacklistInterval) {
    clearInterval(blacklistInterval);
    console.log('✓ Blacklist cleanup interval cleared');
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    console.log('✓ Keep-alive ping interval cleared');
  }
  
  // Destroy any pending HTTPS requests
  if (keepAliveRequest) {
    try {
      keepAliveRequest.destroy();
      console.log('✓ Keep-alive request destroyed');
    } catch (e) {
      console.debug('Error destroying keep-alive request:', e.message);
    }
  }
  
  // Close the server
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    // Close database connection (Mongoose 9.3.2+ returns Promise)
    try {
      await mongoose.connection.close();
      console.log('✓ Database connection closed');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database:', err.message);
      process.exit(1);
    }
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
