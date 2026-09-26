import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Groww MF FAQ Assistant",
        short_name: "GrowwFAQ",
        start_url: ".",
        display: "standalone",
        background_color: "#f6f8f6",
        theme_color: "#0f6c3f",
        description: "Facts-only FAQ about Groww Mutual Fund schemes. No investment advice.",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: { cacheName: "faq-data" },
          },
        ],
      },
    }),
  ],
});
