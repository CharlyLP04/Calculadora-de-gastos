# Clara · Finanzas Personales

> **Tu dinero, con claridad.** PWA de finanzas personales en español y MXN con diseño inspirado en iOS (Liquid Glass, micro-interacciones táctiles, tarjetas suaves y modo oscuro en azul marino).

---

## Novedades y Arquitectura Híbrida

Clara combina lo mejor de dos mundos:
1. **Offline-First (Máxima Privacidad):** Utiliza **IndexedDB (Dexie)** en el navegador. La aplicación es 100% funcional sin internet y puedes usarla en **Modo Local / Invitado** sin registrarte ni enviar ningún dato a la red.
2. **Nube Gratuita con Google Firebase:**
   - **Google Cloud Firestore:** Base de datos en tiempo real 24/7 sin costo de servidor. Sincroniza tus finanzas entre tu teléfono, tablet y computadora instantáneamente.
   - **Google Sign-In:** Inicio de sesión seguro con tu cuenta de Google para vincular tus finanzas a tu perfil.
   - **Firebase Hosting:** Alojamiento gratuito con certificado SSL (HTTPS) listo para instalarse como aplicación móvil (PWA).
3. **Visualización y Gráficas Interactivas estilo iOS:**
   - **Gráfica Donut animada:** Distribución de gastos por categoría con selección táctil y visualización en tiempo real de porcentajes y montos.
   - **Comparativa de Flujo:** Barra visual de Ingresos vs Gastos con tasa de ahorro del mes.
4. **Experiencia Móvil Pulida:**
   - Diálogos tipo **Bottom Sheet estilo iOS** con bloqueo de desplazamiento del fondo (`scroll-lock`).
   - Cabecera y monto `$ 0.00` siempre visibles al capturar gastos.
   - Micro-interacciones de presión táctil (`active:scale`) y transiciones de pantalla con curvas Bézier fluidas.

---

## Inicio Rápido (Local)

Requiere Node.js 20+ (recomendado Node 24 LTS) y npm.

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo local
npm run dev
```

Abre en tu navegador la dirección indicada (por defecto `http://localhost:5173`).  
Para abrirlo desde tu teléfono en la misma red Wi-Fi, usa la IP de red mostrada en la terminal (ej. `http://192.168.100.X:5173`).

---

## Cómo Publicar Gratis en Google Firebase Hosting

El proyecto ya incluye la configuración lista en `firebase.json` y `.firebaserc`.

1. **Iniciar sesión en Firebase CLI:**
   ```bash
   npx firebase-tools login
   ```
   *(Se abrirá una ventana en tu navegador para autorizar con tu cuenta de Google)*.

2. **Compilar y publicar:**
   ```bash
   npm run deploy
   ```
   Google compilará tu aplicación y te entregará tu enlace web público y seguro (por ejemplo: `https://mis-finanzas-af0aa.web.app`).

### Instalar como App en tu Teléfono:
- **iPhone / iPad (Safari):** Abre tu enlace web → Botón Compartir → **"Añadir a pantalla de inicio"**.
- **Android (Chrome):** Abre tu enlace web → Menú (3 puntos) → **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.

---

## Funciones Principales

- **Inicio:** Balance neto del mes, presupuesto, límite variable diario, cuentas y movimientos recientes.
- **Diario:** Selección de mes y día, calendario interactivo, filtros y buscador instantáneo de transacciones.
- **Movimientos:** Alta y edición rápida de ingresos y gastos con teclado numérico ergonómico y categorías con iconos.
- **Cuentas:** Registro y actualización de saldos en efectivo, débito, crédito y ahorros.
- **Fijos y Compromisos:** Planificación mensual prorrateada por día de renta, servicios, suscripciones, etc.
- **Deudas y Simulador:** Seguimiento de saldo original, abonos vinculados, cuota mensual y simulación de pagos anticipados sin intereses.
- **Balances y Reportes:** Gráfica Donut animada, desglose por categoría, flujo de ingresos vs gastos y exportación en un clic a **Excel (.xlsx de 3 pestañas)**, **PDF ejecutivo** y **CSV**.
- **Respaldos Atómicos:** Descarga y restauración completa de tus registros en archivo JSON.
- **Seguridad Biométrica:** Bloqueo opcional mediante WebAuthn (Face ID, Touch ID o PIN del dispositivo).

---

## Variables de Entorno (.env)

Puedes configurar tu proyecto de Firebase mediante variables de entorno en un archivo `.env`:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

*(Consulta `.env.example` para más detalles).*

---

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo local con recarga rápida (HMR).
- `npm run build`: Compila TypeScript y genera los archivos estáticos optimizados en `dist/`.
- `npm run preview`: Previsualiza localmente la versión de producción generada.
- `npm test`: Ejecuta la suite de pruebas unitarias con Vitest.
- `npm run deploy`: Publica automáticamente la app en Google Firebase Hosting.
