import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  assetsInclude: ["**/*.glb"],
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js ecosystem isolado para cache e carregamento paralelo
          if (
            id.includes("node_modules/three/") ||
            id.includes("node_modules/@react-three/fiber") ||
            id.includes("node_modules/@react-three/drei") ||
            id.includes("node_modules/@react-three/rapier") ||
            id.includes("node_modules/@dimforge") ||
            id.includes("node_modules/meshline")
          ) {
            return "three-ecosystem";
          }
          if (id.includes("node_modules/framer-motion")) {
            return "framer-motion";
          }
          if (
            id.includes("node_modules/gsap") ||
            id.includes("node_modules/lenis")
          ) {
            return "gsap-lenis";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "radix-ui";
          }
        },
      },
    },
  },
}));
