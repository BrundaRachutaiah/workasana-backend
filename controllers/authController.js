const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ message: "Password is required" });
    }

    const userExists = await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
    });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword });

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Backward-compatible: handle older rows saved with different email casing
      user = await User.findOne({
        email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
      });
    }
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server misconfigured: missing JWT secret" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user (protected)
exports.getMe = async (req, res) => {
  try {
    // req.user.id is set by verifyToken middleware
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
