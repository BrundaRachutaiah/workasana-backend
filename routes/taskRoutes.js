const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Task = require("../models/Task");
const verifyToken = require("../middleware/authMiddleware");

// Protect all routes
router.use(verifyToken);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const coerceStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const parseDateInput = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const year = Number(m[3]);
    const date = new Date(Date.UTC(year, monthIndex, day));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const allowedStatuses = new Set(["To Do", "In Progress", "Completed", "Blocked"]);

const normalizeCreatePayload = (body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const project = body?.project ? String(body.project) : "";
  const team = body?.team ? String(body.team) : "";
  const priority = typeof body?.priority === "string" ? body.priority.trim() : undefined;
  const status =
    typeof body?.status === "string" && allowedStatuses.has(body.status.trim())
      ? body.status.trim()
      : undefined;
  const owners = coerceStringArray(body?.owners);
  const tags = coerceStringArray(body?.tags);
  const dueDate = parseDateInput(body?.dueDate);
  const timeToCompleteRaw = body?.timeToComplete;
  const timeToComplete =
    timeToCompleteRaw === "" || timeToCompleteRaw === undefined || timeToCompleteRaw === null
      ? undefined
      : Number(timeToCompleteRaw);

  return {
    name,
    project,
    team,
    priority,
    status,
    owners,
    tags,
    dueDate,
    timeToComplete: Number.isNaN(timeToComplete) ? undefined : timeToComplete,
  };
};

//
// 🚀 CREATE TASK
//
router.post("/", async (req, res) => {
  try {
    const payload = normalizeCreatePayload(req.body);
    const { name, project, team, owners } = payload;
    const createdBy = req.user?.id;

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

    if (!isValidObjectId(project)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    if (!isValidObjectId(team)) {
      return res.status(400).json({ message: "Invalid team id" });
    }

    const invalidOwner = owners.find((id) => !isValidObjectId(id));
    if (invalidOwner) {
      return res.status(400).json({ message: "Invalid owner id" });
    }

    const statusToUse = payload.status || "To Do";
    const task = await Task.create({
      ...payload,
      status: statusToUse,
      statusHistory: [
        {
          status: statusToUse,
          changedAt: new Date(),
          changedBy: createdBy,
        },
      ],
    });

    const populated = await task.populate([
      "project",
      "team",
      "owners",
      { path: "statusHistory.changedBy", select: "name email" },
    ]);

    res.status(201).json(populated);

  } catch (error) {
    const isCastError = error?.name === "CastError";
    const isValidationError = error?.name === "ValidationError";

    if (isCastError || isValidationError) {
      return res.status(400).json({
        message: "Invalid task data",
        error: error.message,
      });
    }

    res.status(500).json({ message: "Task creation failed", error: error.message });
  }
});

//
// 🚀 GET TASKS (with filters)
//
router.get("/", async (req, res) => {
  try {
    const { owner, team, project, status, tags, q, search } = req.query;

    const userId = req.user?.id;
    const filter = {};

    // Always scope results to the logged-in user (prevents leaking tasks
    // across accounts if the client forgets to pass filters).
    if (owner && String(owner) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    filter.owners = { $in: [userId] };
    if (team)    filter.team    = team;
    if (project) filter.project = project;
    if (status)  filter.status  = status;

    const term = (q || search || "").toString().trim();
    if (term) {
      filter.name = { $regex: term, $options: "i" };
    }

    if (tags) {
      const tagList = tags.split(",").map(t => t.trim());
      filter.tags = { $in: tagList };
    }

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 }) // ✅ FIX (latest first)
      .populate("project")
      .populate("team")
      .populate("owners")
      .populate({ path: "statusHistory.changedBy", select: "name email" });

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
      .populate("owners")
      .populate({ path: "statusHistory.changedBy", select: "name email" });

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

    const taskBefore = await Task.findById(req.params.id).select("status");
    if (!taskBefore) return res.status(404).json({ message: "Task not found" });

    const updates = { ...(req.body || {}) };
    delete updates.statusHistory;
    delete updates.updatedAt;
    delete updates.createdAt;

    if (updates.status !== undefined) {
      if (typeof updates.status !== "string" || !allowedStatuses.has(updates.status.trim())) {
        return res.status(400).json({ message: "Invalid status" });
      }
      updates.status = updates.status.trim();
    }

    const nextStatus = updates.status;
    const statusChanged = nextStatus && nextStatus !== taskBefore.status;

    const updateDoc = {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    };

    if (statusChanged) {
      updateDoc.$push = {
        statusHistory: {
          status: nextStatus,
          changedAt: new Date(),
          changedBy: req.user?.id,
        },
      };
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updateDoc, {
      new: true,
      runValidators: true,
    })
      .populate("project")
      .populate("team")
      .populate("owners")
      .populate({ path: "statusHistory.changedBy", select: "name email" });

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
