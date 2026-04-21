const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Task = require("../models/Task");
const verifyToken = require("../middleware/authMiddleware");

// Protect all routes
router.use(verifyToken);

//
// 🚀 CREATE TASK
//
router.post("/", async (req, res) => {
  try {
    const { name, project, team, owners } = req.body;

    // ✅ Validation
    if (!name || !project || !team) {
      return res.status(400).json({
        message: "Name, project and team are required"
      });
    }

    if (!owners || owners.length === 0) {
      return res.status(400).json({
        message: "At least one owner is required"
      });
    }

    const task = await Task.create(req.body);

    const populated = await task.populate([
      "project",
      "team",
      "owners"
    ]);

    res.status(201).json(populated);

  } catch (error) {
    res.status(500).json({
      message: "Task creation failed",
      error: error.message
    });
  }
});

//
// 🚀 GET TASKS (with filters)
//
router.get("/", async (req, res) => {
  try {
    const { owner, team, project, status, tags } = req.query;

    const filter = {};

    if (owner)   filter.owners  = { $in: [owner] }; // ✅ FIX
    if (team)    filter.team    = team;
    if (project) filter.project = project;
    if (status)  filter.status  = status;

    if (tags) {
      const tagList = tags.split(",").map(t => t.trim());
      filter.tags = { $in: tagList };
    }

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 }) // ✅ FIX (latest first)
      .populate("project")
      .populate("team")
      .populate("owners");

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//
// 🚀 GET SINGLE TASK
//
router.get("/:id", async (req, res) => {
  try {
    // ✅ Prevent crash
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const task = await Task.findById(req.params.id)
      .populate("project")
      .populate("team")
      .populate("owners");

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//
// 🚀 UPDATE TASK
//
router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate("project")
      .populate("team")
      .populate("owners");

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//
// 🚀 DELETE TASK
//
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Task deleted" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;