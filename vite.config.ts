import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the same build works in the app and under a GitHub Pages sub-path.
  base: "./",
  // Compile-time switch: only the web preview build may contain the sample-data mock.
  define: { __PREVIEW__: JSON.stringify(process.env.VITE_PREVIEW === "1") },
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  build: { target: "safari15", sourcemap: false },
});
