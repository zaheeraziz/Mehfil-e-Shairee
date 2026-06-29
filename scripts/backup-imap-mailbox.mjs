import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pythonScript = join(__dirname, "backup_imap_mailbox.py");

const args = process.argv.slice(2);
const result = spawnSync("python3", [pythonScript, ...args], {
  stdio: "inherit"
});

process.exit(result.status ?? 1);
