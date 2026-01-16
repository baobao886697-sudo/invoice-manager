import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
      root: "client",
      plugins: [react(), tailwindcss()],
      resolve: {
              alias: {
                        "@": path.resolve(__dirname, "./client/src"),
                        "@shared": path.resolve(__dirname, "./shared"),
              },
      },
      build: {
              outDir: "../dist/client",
              emptyOutDir: true,
      },
});
