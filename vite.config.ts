import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [react(), mkcert(), tailwindcss()],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
