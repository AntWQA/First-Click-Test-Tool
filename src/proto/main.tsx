import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@doterra-it/design-system-ui-base/styles";
import "@doterra-it/design-system-ui-ecommerce/styles";
import "@doterra-it/design-system-ui-carousel/styles";
// Theme CSS must come after every package /styles import (Pure rule). Figma tokens match the elevated theme.
import "@doterra-it/design-system-ui-base/theme/elevated";
import App from "./App";
import { installRecorder, onShellReset } from "./recorder/recorder.ts";
import { RecorderBridge } from "./recorder/RecorderBridge.tsx";

installRecorder();

// Test tool copy: a MemoryRouter, because the document lives in an iframe srcdoc where there is no URL to route on.
// "Reset" from the shell remounts the whole app (router, search state, open menus) instead of reloading a 3 MB document.
function Boot() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => onShellReset(() => { setGeneration((g) => g + 1); window.scrollTo({ top: 0 }); }), []);
  return (
    <MemoryRouter key={generation} initialEntries={["/"]}>
      <RecorderBridge />
      <App />
    </MemoryRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>,
);
