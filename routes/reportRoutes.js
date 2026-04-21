const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);

// GET /report/last-week
// Returns tasks completed in the last 7 days
router.get("/last-week", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tasks = await Task.find({
      status: "Completed",
      updatedAt: { $gte: sevenDaysAgo },
    })
      .populate("project", "name")
      .populate("team", "name")
      .populate("owners", "name");

    res.json({ count: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /report/pending
// Returns total days of work pending (sum of timeToComplete for non-completed tasks)
router.get("/pending", async (req, res) => {
  try {
    const tasks = await Task.find({
      status: { $ne: "Completed" },
    }).populate("project", "name").populate("team", "name");

    const totalDaysPending = tasks.reduce(
      (sum, t) => sum + (t.timeToComplete || 0),
      0
    );

    res.json({ totalDaysPending, taskCount: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /report/closed-tasks
// Returns count of completed tasks grouped by team and owner
router.get("/closed-tasks", async (req, res) => {
  try {
    // Group by team
    const byTeam = await Task.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: "$team", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "teams",
          localField: "_id",
          foreignField: "_id",
          as: "teamInfo",
        },
      },
      { $unwind: { path: "$teamInfo", preserveNullAndEmptyArrays: true } },
      { $project: { teamName: "$teamInfo.name", count: 1, _id: 0 } },
    ]);

    // Group by owner
    const byOwner = await Task.aggregate([
      { $match: { status: "Completed" } },
      { $unwind: "$owners" },
      { $group: { _id: "$owners", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "ownerInfo",
        },
      },
      { $unwind: { path: "$ownerInfo", preserveNullAndEmptyArrays: true } },
      { $project: { ownerName: "$ownerInfo.name", count: 1, _id: 0 } },
    ]);

    // Group by project
    const byProject = await Task.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: "$project", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "projectInfo",
        },
      },
      { $unwind: { path: "$projectInfo", preserveNullAndEmptyArrays: true } },
      { $project: { projectName: "$projectInfo.name", count: 1, _id: 0 } },
    ]);

    res.json({ byTeam, byOwner, byProject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;