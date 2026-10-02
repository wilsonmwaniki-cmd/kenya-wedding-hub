import "./instrument";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installBundleRecovery } from "./lib/bundleRecovery";

function startApp() {
  createRoot(document.getElementById("root")!).render(<App />);
}

async function bootstrapPricingCatalog() {
  try {
    const { bootstrapPricingCatalogFromSupabase } = await import("./lib/pricingBootstrap");
    await bootstrapPricingCatalogFromSupabase();
  } catch (error) {
    console.warn("Could not bootstrap pricing catalog from Supabase. Continuing with local defaults.", error);
  }
}

if (typeof window !== "undefined") {
  installBundleRecovery();
}

startApp();

if (typeof window !== "undefined") {
  const scheduleBootstrap = () => {
    void bootstrapPricingCatalog();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(scheduleBootstrap, { timeout: 3000 });
  } else {
    window.setTimeout(scheduleBootstrap, 1200);
  }
}
