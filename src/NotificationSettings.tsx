import { useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import { money, type Prefs } from "./data";
import {
  getDeviceNotificationStatus,
  requestDeviceNotificationPermission,
  showDeviceNotification,
  isIosDevice,
  isStandalonePwa,
} from "./notifications";
export function NotificationSettings({
  prefs,
  savePrefs,
  notify,
  profileName,
  profileId,
  fixedTotal,
  fixedCount,
}: {
  prefs: Prefs;
  savePrefs: (change: Partial<Prefs>) => Promise<unknown>;
  notify: (message: string) => void;
  profileName: string;
  profileId: string;
  fixedTotal: number;
  fixedCount: number;
}) {
  const [permission, setPermission] = useState(getDeviceNotificationStatus);
  const [busy, setBusy] = useState(false);
  const active = permission === "granted" && prefs.notificationsEnabled;
  const change = async () => {
    setBusy(true);
    try {
      if (active) {
        await savePrefs({ notificationsEnabled: false });
        return;
      }
      const result = await requestDeviceNotificationPermission();
      setPermission(result);
      if (result === "granted") {
        await savePrefs({ notificationsEnabled: true });
        notify("Avisos activados para este perfil.");
      } else
        notify(
          result === "unsupported"
            ? "Este navegador no admite avisos del sistema. Puedes seguir viendo los avisos dentro de Clara."
            : "Puedes revisar el permiso en los ajustes de notificaciones del navegador.",
        );
    } catch {
      notify("No se pudo guardar la preferencia. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  const showPayments = async () => {
    const message = fixedCount
        ? `Tienes ${fixedCount} compromisos este mes${prefs.hidden ? "." : ` por ${money(fixedTotal)}.`}`
        : "No tienes compromisos fijos registrados en este perfil.";
    notify(message);
    if (active)
      await showDeviceNotification(
        `Clara · ${profileName}`,
        prefs.hidden ? "Tienes un aviso en tu perfil de Clara." : message,
        { tag: `clara-${profileId}-payments` },
      );
  };
  return (
    <section className="settings-section notification-settings">
      <div className="section-row">
        <h3>
          <Bell size={18} /> Notificaciones
        </h3>
        <span className="quiet-badge">{active ? "Activas" : "En la app"}</span>
      </div>
      <p className="field-help">
        Activa los avisos del sistema para este perfil. Se generan al usar
        Clara; no son alarmas programadas con la app cerrada.
      </p>
      {isIosDevice() && !isStandalonePwa() && (
        <p className="inline-notice">
          En iPhone, añade Clara a la pantalla de inicio desde Safari para
          habilitar los avisos del sistema.
        </p>
      )}
      {permission === "denied" && (
        <p className="field-help">
          El permiso está bloqueado en los ajustes del navegador.
        </p>
      )}
      <button
        className="secondary full"
        disabled={busy || permission === "unsupported"}
        onClick={() => void change()}
      >
        <Bell size={16} />
        {active
          ? "Pausar avisos de este perfil"
          : "Activar avisos de este perfil"}
      </button>
      <div className="button-row">
        <button className="secondary" onClick={() => void showPayments()}>
          <CalendarDays size={16} /> Ver mis pagos
        </button>
      </div>
    </section>
  );
}
