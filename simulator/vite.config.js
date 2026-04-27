import { defineConfig } from "vite";
import { needlePlugins } from "@needle-tools/engine/plugins/vite";

export default defineConfig(async ({ command }) => ({
    root: ".",
    publicDir: "public",
    plugins: await needlePlugins(command),
    server: {
        port: 5173,
        strictPort: false,
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
}));
