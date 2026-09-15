# Clara · Finanzas personales

PWA de finanzas personales en español y MXN. Diseño móvil en azul marino inspirado en las referencias del proyecto: tarjetas suaves, tipografía Helvetica Neue/system, navegación inferior, cifras grandes y acentos semánticos.

## Iniciar

Requiere Node.js **24 LTS** y npm.

```sh
npm ci
npm run dev
```

Abrir la dirección que muestra Vite. La base de datos empieza vacía. **Explorar un ejemplo** carga datos ficticios únicamente cuando no hay registros; no se envían al repositorio.

```sh
npm run build
npm run preview
npm test
node server/sync.test.mjs
```

El service worker se activa en la versión compilada, no en el servidor de desarrollo. Se incluyen iconos PNG de 192/512 px, icono maskable y apple-touch-icon.

## Funciones

- Inicio: balance neto mensual, presupuesto, límite variable diario, cuentas y últimos movimientos.
- Diario: selección de mes/día, calendario horizontal, búsqueda, ingresos, gastos y reserva diaria.
- Movimientos: crear, editar y eliminar ingresos/gastos; categoría, cuenta, fecha y teclado numérico táctil.
- Cuentas: saldo inicial más todos los movimientos vinculados; la edición del nombre actualiza sus movimientos.
- Fijos: compromisos mensuales prorrateados entre los días reales del mes.
- Deudas: saldo original, pagos anteriores, cuota mensual, abonos vinculados, progreso y simulador sin intereses.
- Balances: gastos por categoría y exportación CSV, Excel (3 pestañas) y PDF ejecutivo de una página.
- Respaldo JSON y restauración validada y atómica. Un respaldo reemplaza los registros actuales; descarga uno antes de restaurar.
- Persistencia IndexedDB/Dexie, caché Workbox y exportaciones disponibles sin conexión después de la primera carga completa.
- Privacidad de cifras y bloqueo opcional mediante WebAuthn del dispositivo.
- Sincronización opcional con servidor propio; nunca se muestra “sincronizado” solo por tener conexión.

## Qué representan los números

**Balance neto mensual = ingresos registrados − gastos registrados** en el mes seleccionado. No incluye saldos iniciales de cuentas.

**Saldo de una cuenta = saldo inicial + ingresos − gastos** de todo su historial.

**Reserva diaria = (fijos mensuales + cuotas de deudas activas) / días del mes.** Las cuotas se limitan al saldo pendiente cuando este es menor.

**Límite variable diario = máximo(0, presupuesto − fijos − cuotas) / días del mes.** Es un reparto uniforme del presupuesto, no una predicción de ingresos futuros ni un recálculo de lo que queda del mes.

Los fijos y cuotas son **planificación**: no generan cargos automáticos. Cada pago debe registrarse para afectar el balance. Las tarjetas actuales de planificación se usan al consultar cualquier mes; no existe versionado histórico de planes. Los abonos sí conservan fecha e historial. El simulador supone cuotas constantes, sin intereses, comisiones ni nuevos cargos.

## Instalar en el teléfono

Publica `dist/` en un servidor HTTPS de archivos estáticos.

- iOS: abrir en Safari → Compartir → Añadir a pantalla de inicio.
- Android: abrir en Chrome → Instalar app / Añadir a pantalla de inicio.
- Abrir con conexión una vez y esperar la carga completa. Los datos se guardan en ese navegador/origen; instalar en otro dispositivo no los copia automáticamente.
- Las nuevas versiones quedan en espera hasta cerrar las ventanas de la app y volver a abrirla, para evitar perder un formulario en curso.

Para un subdirectorio (por ejemplo GitHub Pages), definir `BASE_PATH=/Calculadora-de-gastos/` al compilar. Se incluye un workflow de validación que genera el artefacto `crystal-dist`; no publica automáticamente.

## Servidor de sincronización opcional

Sin configurar servidor, la app es completamente local. El servidor incluido es **personal, de un solo usuario**; todos los dispositivos que usen su clave comparten la misma base. No conectes usuarios independientes a una instancia.

1. Compilar la app.
2. Generar una clave aleatoria de al menos 32 caracteres (`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`).
3. Definir `SYNC_TOKEN` en el entorno del servidor; no añadirla al código ni al repositorio.
4. Ejecutar `npm run server` (Node 24). Por defecto escucha en `127.0.0.1:3000` y sirve `dist/`.
5. Publicar mediante un proxy HTTPS. Si la PWA está en otro origen, definir `ALLOWED_ORIGIN` con su origen exacto (sin ruta ni `/` final).
6. En Configuración de Clara, guardar la dirección base HTTPS y la clave. Usar **Sincronizar ahora** para comprobar la conexión.

Variables adicionales: `PORT`, `HOST`, `DATA_DIR`. Por defecto SQLite vive en `server/data/crystal.sqlite`, excluido de Git; respalda esa carpeta de forma privada. Las pruebas usan una base temporal aislada.

La sincronización usa registros por ID, última edición según reloj del dispositivo y marcas de eliminación. No fusiona campos editados simultáneamente: gana el registro con fecha más reciente. Mantén los relojes sincronizados. Los registros se envían por HTTPS; el servidor y su base deben estar bajo tu control. Presupuesto y preferencias de interfaz son locales y no se sincronizan (el presupuesto se incluye en el respaldo JSON).

La sincronización automática se intenta al cambiar registros, recuperar conexión y periódicamente mientras la app está abierta. iOS/Android pueden suspender una PWA cerrada: vuelve a abrirla para completar la sincronización pendiente. Los datos no se borran al fallar la red.

## Seguridad local

WebAuthn solicita verificación del usuario y comprueba desafío, origen, RP ID y firma ECDSA. El autenticador puede usar biometría **o el PIN del dispositivo**, según el sistema. Se requiere HTTPS o localhost y un navegador que exponga `getPublicKey()` para habilitarlo.

Este bloqueo protege la **interfaz**, no cifra IndexedDB y no sustituye el bloqueo del teléfono. Los respaldos contienen datos en texto claro. La clave del servidor permanece en el almacenamiento local del navegador y no se incluye en exportaciones. No guardes información bancaria de autenticación en conceptos o categorías.

No se ha validado biometría con un iPhone/Android físico en esta implementación. Prueba el desbloqueo en tus dispositivos antes de depender de él. Borrar los datos del sitio también borra tus finanzas locales; conserva respaldos.

## Verificación realizada

- TypeScript sin errores y compilación Vite/Workbox completada.
- Pruebas de año bisiesto, cálculos mensuales, abonos/eliminaciones y validación de respaldos.
- Servidor: autenticación, validación, escritura/lectura, conflictos, marcas de eliminación y CORS.
- Navegador: visualización móvil, alta de movimiento y persistencia al recargar; recarga y exportaciones con el servidor detenido.
- Revisión npm: sin vulnerabilidades conocidas en las versiones fijadas al crear el proyecto.

En entornos Windows que impiden crear subprocesos se incluyen alternativas de compilación/pruebas en el mismo proceso: `node scripts/build-portable.mjs` y `node scripts/test-portable.mjs`. La compilación normal optimizada es `npm run build`. Los archivos grandes de exportación se cargan bajo demanda y se precachean para usarlos sin red.

## Identidad Clara y acabado de vidrio

El rediseño simplifica la jerarquía, elimina frases y paneles decorativos y añade un monograma C vectorial. La tarjeta de balance usa vidrio perlado; la navegación y los diálogos usan transparencias con desenfoque mediante `backdrop-filter` y `-webkit-backdrop-filter`. Hay alternativas opacas para navegadores sin soporte y preferencias de transparencia reducida. Los botones respetan tamaños táctiles y los campos mantienen un mínimo de 16 px.

El acabado es una implementación web inspirada en Liquid Glass, no un componente nativo de Apple. La revisión se realiza en navegador con tamaños móviles; queda pendiente validar visualmente en dispositivos iOS y Android físicos. Los identificadores internos de la base de datos y credenciales conservan su nombre original para preservar registros existentes al actualizar.
