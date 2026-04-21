const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
connectDB();

const app = express();

// Middleware
app.use(cors());
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));