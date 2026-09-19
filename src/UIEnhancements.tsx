import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BrandMark } from "./Brand";
import { daysInMonth, summarize, type Entry } from "./data";
function playIosChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {}
}

export interface IosToastData {
  title?: string;
  message: string;
  time?: string;
  type?: "info" | "success" | "warning" | "payment";
}

export function IosNotificationBanner({
  toast,
  onClose,
}: {
  toast: IosToastData;
  onClose: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    playIosChime();
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {}
    }
  }, []);

  const handleDismiss = () => {
    setDismissing(true);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`ios-banner ${dismissing ? "is-dismissing" : ""}`}
      role="status"
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (startY.current - e.touches[0].clientY > 25) {
          handleDismiss();
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".ios-banner-close")) return;
        handleDismiss();
      }}
    >
      <div className="ios-banner-header">
        <div className="ios-banner-app">
          <div className="ios-banner-icon">
            <BrandMark />
          </div>
          <span className="ios-banner-title">
            {toast.title || "CLARA · FINANZAS"}
          </span>
        </div>
        <div className="ios-banner-meta">
          <span className="ios-banner-time">{toast.time || "ahora"}</span>
          <button
            type="button"
            className="ios-banner-close"
            aria-label="Cerrar aviso"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="ios-banner-body">
        <p className="ios-banner-message">{toast.message}</p>
      </div>
      <div className="ios-banner-handle" />
    </div>
  );
}

export function DateStrip({
  month,
  date,
  entries,
  budget,
  onSelectDate,
  dateStripRef,
}: {
  month: string;
  date: string;
  entries: Entry[];
  budget: number;
  onSelectDate: (d: string) => void;
  dateStripRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const momentumRaf = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRaf.current !== null) {
      cancelAnimationFrame(momentumRaf.current);
      momentumRaf.current = null;
    }
  };

  // Auto-center selected date when date or month changes
  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    const selected = el.querySelector(
      `button[data-day="${date}"]`,
    ) as HTMLElement | null;
    if (selected) {
      const targetLeft =
        selected.offsetLeft -
        el.offsetLeft -
        el.clientWidth / 2 +
        selected.clientWidth / 2;
      el.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [date, month, dateStripRef]);

  // Convert mouse wheel vertically to horizontal scroll
  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) || e.deltaY !== 0) {
        e.preventDefault();
        stopMomentum();
        el.scrollBy({
          left: e.deltaY * 1.3,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [dateStripRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dateStripRef.current;
    if (!el) return;
    if (e.pointerType !== "mouse" || e.button !== 0) return;

    stopMomentum();
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocity.current = 0;
    scrollLeftStart.current = el.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dateStripRef.current;
    if (!isDragging.current || !el) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastTime.current);
    const dx = e.clientX - lastX.current;

    velocity.current = dx / dt;
    lastX.current = e.clientX;
    lastTime.current = now;

    const totalWalk = e.clientX - startX.current;
    if (Math.abs(totalWalk) > 5) {
      hasDragged.current = true;
      if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    }

    el.scrollLeft = scrollLeftStart.current - totalWalk;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = dateStripRef.current;
    if (!el) return;

    try {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    el.classList.remove("is-dragging");

    // Carousel inertia / momentum glide
    let v = velocity.current * 16;
    if (Math.abs(v) > 40) v = Math.sign(v) * 40;

    if (
      Math.abs(v) > 1.2 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const stepGlide = () => {
        if (!dateStripRef.current) return;
        dateStripRef.current.scrollLeft -= v;
        v *= 0.93; // carousel deceleration
        if (Math.abs(v) > 0.6) {
          momentumRaf.current = requestAnimationFrame(stepGlide);
        } else {
          momentumRaf.current = null;
        }
      };
      momentumRaf.current = requestAnimationFrame(stepGlide);
    }
  };

  useEffect(() => () => stopMomentum(), []);
  const daysCount = daysInMonth(month);

  return (
    <div
      ref={dateStripRef}
      className="date-strip"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {Array.from({ length: daysCount }, (_, i) => {
        const day = month + "-" + String(i + 1).padStart(2, "0");
        const ds = summarize(entries, month, day, budget);
        const isSelected = day === date;
        const dateFormatted = new Date(day + "T12:00:00").toLocaleDateString(
          "es-MX",
          { day: "numeric", month: "long" },
        );
        const hasExpenses = ds.dayTx.length > 0;
        const isOver = hasExpenses && ds.dayExpense > ds.allowance;
        const statusText = hasExpenses
          ? isOver
            ? `Sobre el límite: $${Math.round(ds.dayExpense)} gastados de $${Math.round(ds.allowance)} sugeridos`
            : `Dentro del presupuesto: $${Math.round(ds.dayExpense)} gastados`
          : "Sin gastos";

        return (
          <button
            type="button"
            data-day={day}
            aria-pressed={isSelected}
            aria-label={`${dateFormatted}. ${statusText}`}
            className={isSelected ? "selected" : ""}
            key={day}
            onClick={() => {
              if (!hasDragged.current) {
                onSelectDate(day);
              }
            }}
          >
            <span>
              {new Date(day + "T12:00:00").toLocaleDateString("es-MX", {
                weekday: "short",
              })}
            </span>
            <strong>{String(i + 1).padStart(2, "0")}</strong>
            <i
              className={
                hasExpenses
                  ? isOver
                    ? "red-dot has-warning"
                    : "green-dot"
                  : ""
              }
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
