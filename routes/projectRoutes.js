const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Task = require("../models/Task");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);

const computeProjectStatus = ({ totalTasks = 0, completedTasks = 0 } = {}) => {
  if (!totalTasks) return "Not Started";
  if (completedTasks >= totalTasks) return "Completed";
  return "In Progress";
};

// POST /projects — Create a project
router.post("/", async (req, res) => {
  try {
    const createdBy = req.user?.id;
    const { name, description } = req.body || {};

    const project = await Project.create({ name, description, createdBy });
    res.status(201).json({
      ...project.toObject(),
      status: computeProjectStatus({ totalTasks: 0, completedTasks: 0 }),
      totalTasks: 0,
      completedTasks: 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /projects — Get all projects
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    const ownedProjectIds = await Task.distinct("project", { owners: userId });

    const projects = await Project.find({
      $or: [{ createdBy: userId }, { _id: { $in: ownedProjectIds } }],
    }).sort({ createdAt: -1 });

    const projectIds = projects.map((p) => p._id);
    const stats = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: "$project",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
        },
      },
    ]);

    const statsByProjectId = new Map(
      stats.map((s) => [
        String(s._id),
        { totalTasks: s.totalTasks, completedTasks: s.completedTasks },
      ])
    );

    const withStatus = projects.map((p) => {
      const stat = statsByProjectId.get(String(p._id)) || {
        totalTasks: 0,
        completedTasks: 0,
      };

      return {
        ...p.toObject(),
        status: computeProjectStatus(stat),
        totalTasks: stat.totalTasks,
        completedTasks: stat.completedTasks,
      };
    });

    res.json(withStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /projects/:id — Get a single project
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const hasOwnedTask = await Task.exists({ project: project._id, owners: userId });
    if (String(project.createdBy) !== String(userId) && !hasOwnedTask) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [totalTasks, completedTasks] = await Promise.all([
      Task.countDocuments({ project: project._id }),
      Task.countDocuments({ project: project._id, status: "Completed" }),
    ]);

    res.json({
      ...project.toObject(),
      status: computeProjectStatus({ totalTasks, completedTasks }),
      totalTasks,
      completedTasks,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
