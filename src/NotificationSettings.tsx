import { useState } from "react";
import { Bell, BellOff, CalendarDays } from "lucide-react";
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
  const active = permission === "granted" && Boolean(prefs.notificationsEnabled);

  const change = async () => {
    setBusy(true);
    try {
      if (active) {
        await savePrefs({ notificationsEnabled: false });
        notify("Avisos del sistema desactivados.");
        return;
      }
      const result = await requestDeviceNotificationPermission();
      setPermission(result);
      if (result === "granted") {
        await savePrefs({ notificationsEnabled: true });
        notify("¡Avisos del sistema activados!");
        await showDeviceNotification(
          `Clara · ${profileName}`,
          "¡Avisos activados en tu dispositivo! Te recordaremos tus próximos pagos y compromisos.",
          { tag: `clara-${profileId}-welcome` },
        );
      } else {
        notify(
          result === "unsupported"
            ? "Este navegador no admite avisos del sistema. Puedes seguir viendo los avisos dentro de Clara."
            : "Permiso bloqueado en el navegador. Actívalo en los ajustes de tu equipo para recibir avisos.",
        );
      }
    } catch {
      notify("No se pudo guardar la preferencia. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const showPayments = async () => {
    const message = fixedCount
      ? `Tienes ${fixedCount} compromiso(s) este mes${prefs.hidden ? "." : ` por ${money(fixedTotal)}.`}`
      : "No tienes compromisos fijos registrados en este perfil.";
    notify(message);
    if (active) {
      await showDeviceNotification(
        `Clara · ${profileName}`,
        prefs.hidden ? "Tienes un aviso en tu perfil de Clara." : message,
        { tag: `clara-${profileId}-payments` },
      );
    }
  };

  const badgeText = active
    ? "En el dispositivo"
    : permission === "denied"
      ? "Bloqueadas"
      : permission === "unsupported"
        ? "No disponible"
        : "Desactivadas";

  const badgeClass = active
    ? "quiet-badge active"
    : permission === "denied"
      ? "quiet-badge error"
      : "quiet-badge";

  return (
    <section className="settings-section notification-settings">
      <div className="section-row">
        <h3>
          <Bell size={18} /> Notificaciones
        </h3>
        <span className={badgeClass}>{badgeText}</span>
      </div>
      <p className="field-help">
        Recibe avisos del sistema en tu dispositivo para recordar tus pagos fijos y compromisos del mes de forma oportuna.
      </p>
      {isIosDevice() && !isStandalonePwa() && (
        <p className="inline-notice">
          En iPhone, añade Clara a la pantalla de inicio desde Safari para habilitar los avisos del sistema.
        </p>
      )}
      {permission === "denied" && (
        <p className="inline-notice" style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}>
          El permiso está bloqueado en los ajustes del navegador. Habilítalo para recibir avisos en este equipo.
        </p>
      )}

      <div className="notification-actions">
        <button
          className={active ? "secondary full" : "primary full"}
          disabled={busy || permission === "unsupported"}
          onClick={() => void change()}
        >
          {active ? <BellOff size={16} /> : <Bell size={16} />}
          {active
            ? "Desactivar avisos del sistema"
            : "Activar avisos del sistema"}
        </button>
        <button
          className="secondary full"
          disabled={busy}
          onClick={() => void showPayments()}
        >
          <CalendarDays size={16} /> Ver mis pagos y probar aviso
        </button>
      </div>
    </section>
  );
}
