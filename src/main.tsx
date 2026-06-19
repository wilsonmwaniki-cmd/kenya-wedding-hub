import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

startApp();
void bootstrapPricingCatalog();
