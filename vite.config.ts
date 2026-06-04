import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/fiip-water-operations-dst/",
  plugins: [react()],
  server: {
    allowedHosts: ["localhost", "tacocat"],
  },
});
