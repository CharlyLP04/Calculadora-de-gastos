import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("pwa-update"));
  },
  onRegisterError(error) {
    console.warn("No se pudo activar el modo sin conexión", error);
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.addEventListener("pwa-apply-update", () => void updateSW(true));
import "./clara.css";
