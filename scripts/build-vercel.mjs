import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outsideDir = path.join(root, "Tv outside");
const simulatorDistDir = path.join(root, "simulator-cesium-restore", "dist");
const outsidePublicExcludes = new Set(["node_modules", "outputs", "scripts", "prompts"]);

function copyDir(source, target, { exclude = () => false } = {}) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source directory: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (exclude(sourcePath, entry)) continue;

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath, { exclude });
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

copyDir(outsideDir, distDir, {
  exclude: (_sourcePath, entry) =>
    outsidePublicExcludes.has(entry.name) ||
    entry.name === "package-lock.json" ||
    entry.name === "package.json" ||
    entry.name.endsWith(".md"),
});

copyDir(outsideDir, path.join(distDir, "outside"), {
  exclude: (_sourcePath, entry) =>
    outsidePublicExcludes.has(entry.name) ||
    entry.name === "package-lock.json" ||
    entry.name === "package.json" ||
    entry.name.endsWith(".md"),
});

copyDir(simulatorDistDir, path.join(distDir, "simulator"));

console.log("Built Vercel dist with Tv outside at / and /outside, Mapbox simulator at /simulator.");
