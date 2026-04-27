const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");
const mongoose = require("mongoose");

const app = express();
const BUILD_ID = "2026-04-27-cors-preflight-vercel";

// Middleware
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "https://workasana-frontend-six.vercel.app",
];

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (Postman/curl) with no Origin header
    if (!origin) return callback(null, true);

    // Merge env-provided origins with defaults (so a misconfigured env var
    // doesn't accidentally disable the known-good production origin).
    const originAllowList = Array.from(
      new Set([...defaultAllowedOrigins, ...allowedOrigins])
    );

    if (originAllowList.includes(origin)) return callback(null, true);

    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// On serverless (Vercel), avoid crashing the function during cold start.
// Initialize DB/env lazily for non-preflight, non-health requests.
const IS_VERCEL = Boolean(process.env.VERCEL);
let initPromise = null;
const initOnce = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in environment");
  }
  await connectDB();
};
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (req.path === "/" || req.path === "/__health") return next();

  try {
    if (!initPromise) initPromise = initOnce();
    await initPromise;
    return next();
  } catch (error) {
    return next(error);
  }
});

// Routes
app.use("/auth",     require("./routes/authRoutes"));
app.use("/projects", require("./routes/projectRoutes"));
app.use("/teams",    require("./routes/teamRoutes"));
app.use("/tasks",    require("./routes/taskRoutes"));
app.use("/tags",     require("./routes/tagRoutes"));
app.use("/report",   require("./routes/reportRoutes"));
app.use("/users",    require("./routes/userRoutes"));

// Health check
app.get("/", (req, res) => res.send("Workasana API is running..."));
app.get("/__health", (req, res) => {
  res.json({
    ok: true,
    buildId: BUILD_ID,
    timestamp: new Date().toISOString(),
    node: process.version,
    mongoose: mongoose.version,
    env: {
      nodeEnv: process.env.NODE_ENV || null,
      vercel: Boolean(process.env.VERCEL),
    },
  });
});

const PORT = process.env.PORT || 5000;

// Local development: initialize and listen.
if (!IS_VERCEL) {
  initOnce()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
}

// Error handler (keeps responses predictable; CORS headers are set by the
// earlier cors middleware for allowed origins).
app.use((err, req, res, next) => {
  const status = err?.message?.startsWith("CORS:") ? 403 : 500;
  res.status(status).json({
    ok: false,
    error: err?.message || "Internal Server Error",
  });
});

module.exports = app;
