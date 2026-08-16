import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/acces-services95/",
  plugins: [react()],
  build: { outDir: "dist-github", emptyOutDir: true },
});
