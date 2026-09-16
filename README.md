# Clara · Finanzas personales

PWA en español y MXN. Desarrollada por **charly_dev y Grid.mx**. Interfaz minimalista en azul marino, vidrio translúcido, navegación táctil y uso local sin conexión después de la primera carga.

## Iniciar y verificar

Node.js 24 y npm:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Para probar las reglas de Firebase se requiere Java 21:

```sh
npx firebase emulators:exec --only firestore --project demo-clara-profiles "node --test tests/firestore-rules.test.mjs"
```

La integración continua ejecuta pruebas de cálculos, aislamiento local, sincronización, reglas de Firebase, servidor opcional y compilación. Genera `clara-dist`; no despliega Hosting automáticamente.

## Perfiles: primero en tu dispositivo

1. Crea un perfil con su nombre, sin iniciar sesión ni enviar movimientos a la nube.
2. Cada perfil tiene una base IndexedDB independiente: movimientos, cuentas, deudas, fijos, presupuesto y categorías. El bloqueo WebAuthn también es por perfil.
3. La cabecera permite cambiar o crear perfiles. La selección se guarda por pestaña; cambiar recarga la app para impedir que una operación pendiente escriba en otra base.
4. En Configuración puedes conectar **ese perfil** a Google. La vinculación requiere una acción explícita: una sesión Google existente no activa la nube para todos los perfiles.
5. Desconectar Google conserva la cartera local y pausa el respaldo. La vinculación queda asociada a su cuenta original; para otra cuenta se crea otro perfil.
6. En otro dispositivo, selecciona **Recuperar de Google** y elige el perfil. Puedes tener varios perfiles bajo la misma cuenta, con registros separados.

La base `clara-profiles` guarda solo el catálogo local. Las finanzas viven en `clara-profile-{id}`. La base histórica `crystal-finanzas` se conserva como **Mis datos anteriores**, sin atribuirla automáticamente a una cuenta Google: las versiones anteriores compartían esa base entre accesos. Revísala antes de vincularla.

Los datos antiguos de Google pueden recuperarse explícitamente en otro perfil. Las colecciones antiguas con identificadores anónimos o claves manuales no se sincronizan; su recuperación local se conserva cuando existe en el dispositivo original.

Los perfiles separan datos dentro de la app; no son cuentas protegidas por contraseña ni cifran IndexedDB. Cualquier persona con acceso a ese navegador puede seleccionar un perfil sin bloqueo. Borrar los datos del sitio borra todas sus bases locales. Conserva respaldos.

## Google y almacenamiento en la nube

Se usa Firebase Authentication con Google y Firestore **Standard**, instancia `(default)` del proyecto configurado. La cuenta Google identifica al dueño; el respaldo se guarda en Firestore, no en Google Drive.

```text
clara_users/{Google UID}/profiles/{cloudProfileId}
  entries/{entryId}
  preferences/main
```

Las reglas exigen que el UID autenticado coincida con la ruta y que el proveedor sea Google. Validan campos, montos, marcas temporales y preferencias. No permiten acceso anónimo, escritura global ni borrados físicos; las eliminaciones se propagan como registros marcados para evitar que otro dispositivo los restaure accidentalmente. Las rutas antiguas de Google solo permiten lectura del dueño para recuperación.

Se sincronizan registros, presupuesto y categorías. El bloqueo, ocultar cifras y la selección de perfil permanecen locales. Las preferencias no incluyen credenciales. Se intenta sincronizar después de cambios, al recuperar conexión, al volver a la app y cada minuto mientras está abierta. No se garantiza ejecución con la PWA cerrada.

La sincronización compara la última edición y usa transacciones para no sobrescribir una versión más reciente recibida durante la operación. Las fechas dependen del reloj del dispositivo; mantén los relojes sincronizados. No hay fusión de campos editados simultáneamente. La interfaz distingue guardado local, nube pendiente y última sincronización; los fallos no borran datos locales.

Restaurar JSON o vaciar un perfil afecta únicamente ese perfil y su respaldo vinculado cuando se sincronice. Vaciar guarda marcas de eliminación; no equivale a purgar físicamente documentos de Firestore.

## Configurar y publicar

El proyecto conserva la configuración Firebase existente; `.env.example` permite usar otro proyecto. Las opciones públicas de Firebase no son credenciales administrativas. Nunca añadas claves de cuentas de servicio ni tokens al repositorio.

Google debe estar habilitado en Firebase Authentication y el dominio de la app debe figurar entre los dominios autorizados. Primero compila, después despliega:

```sh
npm run build
npx firebase deploy --only firestore:rules,hosting --project mis-finanzas-af0aa
```

El comando `firebase deploy` por sí solo no compila. Las reglas deben publicarse junto con la versión de perfiles; las versiones antiguas dejan de poder escribir en las rutas compartidas. Verifica las reglas y los flujos de Google antes de distribuir ampliamente la app. Firebase aplica las cuotas y condiciones del plan del proyecto; este código no garantiza uso gratuito ilimitado.

## Funciones

- Inicio y diario: ingresos, gastos, cuentas, filtros, calendario y presupuesto.
- Fijos: compromisos mensuales prorrateados entre los días reales del mes.
- Deudas: saldo original, abonos, cuotas y simulador sin intereses.
- Gráficas de categorías e ingresos/gastos.
- Exportación Excel, CSV, PDF y respaldo/restauración JSON del perfil activo.
- Instalación PWA, caché de archivos y uso local sin conexión.
- WebAuthn opcional: biometría o PIN, con verificación de desafío, origen y firma. Protege la interfaz, no cifra las finanzas ni los respaldos.

Balance mensual = ingresos menos gastos del mes. Saldo de cuenta = saldo inicial más su historial. Los fijos y cuotas son planificación, no cargos automáticos. El presupuesto diario reparte lo disponible después de reservar compromisos. El simulador no incluye intereses ni comisiones.

## Acabado móvil

Se conservan el calendario con arrastre e inercia, avisos tipo iOS con sonido y vibración, integración de notificaciones del dispositivo y búsqueda manual de actualizaciones. Los avisos del sistema se activan por perfil y dependen de permisos del navegador; no programan alarmas con la app cerrada. La preferencia de ocultar cifras evita mostrar montos en los avisos de prueba. Las actualizaciones se descargan en segundo plano y se aplican explícitamente para proteger formularios en curso.

Cabecera fija con perfil y mes, espacios seguros de iOS, botones táctiles, cifras legibles y diálogos de vidrio. Las animaciones de navegación, apertura y progreso respetan `prefers-reduced-motion`. Se incluyen alternativas opacas para transparencia reducida o navegadores sin desenfoque. Es un efecto web inspirado en Liquid Glass; no usa componentes nativos de Apple.

Para instalar: Safari en iOS → Compartir → Añadir a pantalla de inicio; Chrome en Android → Instalar app. Se necesita HTTPS y una primera carga completa con conexión. La revisión visual se realiza en navegador; queda pendiente probar con dispositivos físicos iOS y Android.

En entornos Windows que bloquean subprocesos: `node scripts/build-portable.mjs` y `node scripts/test-portable.mjs`. La compilación optimizada de producción es `npm run build`.

El servidor histórico de `server/` se conserva para compatibilidad del repositorio, pero la interfaz actual no lo utiliza: todos los respaldos conectados pasan por Google y las rutas privadas por perfil.
