import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";
class StorageBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="profile-gate">
          <section className="profile-panel glass-surface">
            <h1>No pudimos abrir tu espacio.</h1>
            <p className="profile-intro">
              Tus datos no se han borrado. Revisa los permisos de almacenamiento
              del navegador y vuelve a intentarlo.
            </p>
            <button
              className="primary full"
              onClick={() => window.location.reload()}
            >
              Volver a cargar
            </button>
            <button
              className="secondary full"
              onClick={() =>
                window.dispatchEvent(new Event("pwa-apply-update"))
              }
            >
              Aplicar actualización disponible
            </button>
          </section>
        </div>
      );
    return this.props.children;
  }
}
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
    <StorageBoundary>
      <App />
    </StorageBoundary>
  </React.StrictMode>,
);

window.addEventListener("pwa-apply-update", () => void updateSW(true));
import "./clara.css";
import "./profiles.css";
