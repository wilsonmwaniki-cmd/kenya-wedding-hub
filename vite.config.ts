import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const hasSentryReleaseConfig = Boolean(
    process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
  );
  const sentryPlugin =
    hasSentryReleaseConfig
      ? sentryVitePlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN,
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          telemetry: false,
          sourcemaps: {
            assets: "./dist/**",
            filesToDeleteAfterUpload: "./dist/**/*.map",
          },
        })
      : null;

  const productionSourceMapSetting =
    mode === "production"
      ? hasSentryReleaseConfig
        ? "hidden"
        : false
      : true;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), sentryPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: productionSourceMapSetting,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/") || id.includes("node_modules/react-router/")) {
              return "react-core";
            }

            if (id.includes("node_modules/@supabase/supabase-js/") || id.includes("node_modules/@tanstack/react-query/")) {
              return "supabase-data";
            }

            if (id.includes("node_modules/framer-motion/") || id.includes("node_modules/lucide-react/")) {
              return "motion-icons";
            }

            if (id.includes("node_modules/recharts/")) {
              return "charts";
            }

            return undefined;
          },
        },
      },
    },
  };
});
