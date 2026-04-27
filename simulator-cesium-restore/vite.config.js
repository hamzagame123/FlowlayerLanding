import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    root: ".",
    publicDir: "public",
    server: {
        port: 5173,
        strictPort: false,
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
});
