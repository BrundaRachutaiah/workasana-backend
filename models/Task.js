const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true,
  },
  owners: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  tags: [String],
  timeToComplete: { type: Number, default: 0 }, // estimated days
  dueDate: { type: Date },                       // ← added: needed for UI and sorting
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
  status: {
    type: String,
    enum: ["To Do", "In Progress", "Completed", "Blocked"],
    default: "To Do",
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: ["To Do", "In Progress", "Completed", "Blocked"],
        required: true,
      },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // ← added: needed for last-week report
});

// Auto-update updatedAt on every save
taskSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Also update updatedAt on findByIdAndUpdate calls
taskSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: Date.now() });
});

module.exports = mongoose.model("Task", taskSchema);
