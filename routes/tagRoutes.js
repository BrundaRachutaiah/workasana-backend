const express = require("express");
const router = express.Router();
const Tag = require("../models/Tag");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);

// POST /tags — Create a tag
router.post("/", async (req, res) => {
  try {
    const tag = await Tag.create(req.body);
    res.status(201).json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /tags — Get all tags
router.get("/", async (req, res) => {
  try {
    const tags = await Tag.find();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;