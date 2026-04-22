const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");

const app = express();

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

    // In dev, avoid confusing CORS issues during local testing
    if (process.env.NODE_ENV !== "production") return callback(null, true);

    const originAllowList =
      allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

    if (originAllowList.includes(origin)) return callback(null, true);

    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use("/auth",    require("./routes/authRoutes"));
app.use("/projects",require("./routes/projectRoutes"));
app.use("/teams",   require("./routes/teamRoutes"));
app.use("/tasks",   require("./routes/taskRoutes"));
app.use("/tags",    require("./routes/tagRoutes"));
app.use("/report",  require("./routes/reportRoutes"));
app.use("/users",   require("./routes/userRoutes"));

// Health check
app.get("/", (req, res) => res.send("Workasana API is running..."));

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
