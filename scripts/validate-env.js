const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const required = ["MONGO_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Env looks good.");
