const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");
const mongoose = require("mongoose");

const app = express();
const BUILD_ID = "2026-04-23-task-next-fix";

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

    // ✅ FIXED: Removed NODE_ENV check — it was preventing CORS from working
    // on Vercel even when the origin was in the allowlist
    const originAllowList =
      allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

    if (originAllowList.includes(origin)) return callback(null, true);

    // ✅ FIXED: Return a proper error instead of callback(null, false)
    // which was silently blocking without sending correct CORS headers
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

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

const start = async () => {
  await connectDB();

  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in environment");
  }

  // On Vercel, we should export the app (no explicit listen).
  if (process.env.VERCEL) return;

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

module.exports = app;