const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

const CODE_DIR = path.join(__dirname, "code");

// Ensure the `code` directory exists
if (!fs.existsSync(CODE_DIR)) {
  fs.mkdirSync(CODE_DIR, { recursive: true });
}

app.post("/execute", (req, res) => {
  const { language, code } = req.body;

  // Language to filename mapping
  const fileMap = {
    cpp: "main.cpp",
    java: "Main.java",
    js: "main.js",
    python: "main.py",
  };

  if (!fileMap[language]) {
    return res.status(400).json({ error: "Invalid language selected!" });
  }

  const fileName = fileMap[language];
  const filePath = path.join(CODE_DIR, fileName);

  try {
    // Save the provided code into a file
    fs.writeFileSync(filePath, code, "utf8");

    // Docker service name
    const dockerService = `${language}_executor`;

    // Run only the selected container and capture its raw stdout/stderr directly
    exec(`docker-compose run --rm --no-deps -T ${dockerService}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      let cleanOutput = stdout || "";
      let cleanError = stderr || "";

      // Remove ANSI escape sequences
      cleanOutput = cleanOutput.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");
      cleanError = cleanError.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");

      // Remove noisy Docker Compose lifecycle lines
      const removeComposeNoise = (text) =>
        text
          .split("\n")
          .filter((line) => {
            const trimmed = line.trim();

            if (!trimmed) return false;
            if (/^#\d+\s/.test(trimmed)) return false;
            if (/^\[\+\]\s/.test(trimmed)) return false;
            if (/^Container\s+.+\s+(Creating|Created|Starting|Started|Running|Recreate|Recreated)$/i.test(trimmed)) return false;
            if (/^Image\s+.+\s+(Building|Built)$/i.test(trimmed)) return false;
            if (/^(transferring|loading|exporting|extracting|resolving|naming to|unpacking to)\b/i.test(trimmed)) return false;

            return true;
          })
          .join("\n")
          .trim();

      cleanOutput = removeComposeNoise(cleanOutput);
      cleanError = removeComposeNoise(cleanError);

      if (error) {
        const errorDetails = cleanError || cleanOutput || error.message;

        if (
          /docker api|dockerdesktoplinuxengine|daemon is running|failed to connect/i.test(
            errorDetails
          )
        ) {
          return res.status(500).json({
            error: "Docker is not running",
            details:
              "Start Docker Desktop and wait until the Docker engine is running, then try again.",
          });
        }

        return res.status(500).json({
          error: "Execution Error",
          details: errorDetails,
        });
      }

      // Send the output (or stderr if produced by the program)
      res.json({
        output: cleanOutput || cleanError || "No output generated",
        error: cleanError || null,
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));
