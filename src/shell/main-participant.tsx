import React from "react";
import ReactDOM from "react-dom/client";
import { SelfRunApp } from "./participant/SelfRun";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SelfRunApp />
  </React.StrictMode>,
);
