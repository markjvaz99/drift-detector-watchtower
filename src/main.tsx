import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./pages/AppRoot";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
