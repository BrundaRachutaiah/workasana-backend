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
  status: {
    type: String,
    enum: ["To Do", "In Progress", "Completed", "Blocked"],
    default: "To Do",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // ← added: needed for last-week report
});

// Auto-update updatedAt on every save
taskSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Also update updatedAt on findByIdAndUpdate calls
taskSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model("Task", taskSchema);