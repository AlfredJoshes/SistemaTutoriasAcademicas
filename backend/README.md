# Backend — Sistema Web de Gestión y Seguimiento de Tutorías Académicas en estudiantes de 10mo semestre de la universidad salesiana de bolivia

Sistema backend desarrollado en **Node.js** con **Express** y **PostgreSQL** mediante consultas SQL directas con el driver nativo `pg` (sin ORM). Implementa una arquitectura **MVC clásica** (rutas, controladores y servicios) orientada a un prototipo MVP ligero, rápido y defensible ante un tribunal/jurado de evaluación.

---

## 1. Requisitos Previos

- **Node.js**: v18.0.0 o superior
- **npm**: v9.0.0 o superior
- **PostgreSQL**: v12 o superior corriendo localmente (sin Docker)

---

## 2. Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                  # Conexión al pool de PostgreSQL (pg)
│   ├── db/
│   │   ├── schema.sql             # Definición de las tablas e índices
│   │   ├── migration_autenticador_logs.sql  # Alta del 2FA y la bitácora de accesos
│   │   ├── migration_coordinador_notificaciones.sql  # Rol coordinador y notificaciones
│   │   └── seed.sql               # Datos de prueba con contraseñas bcrypt reales
│   ├── middleware/
│   │   └── auth.js                # Middlewares requireAuth y requireRole
│   ├── services/                  # Lógica de negocio y consultas SQL directas
│   │   ├── auth.service.js
│   │   ├── usuarios.service.js
│   │   ├── disponibilidad.service.js
│   │   ├── sesiones.service.js
│   │   ├── bitacora.service.js
│   │   ├── twofa.service.js       # Autenticador TOTP: secreto, QR y códigos de respaldo
│   │   ├── logs.service.js        # Bitácora de accesos y límite de intentos
│   │   └── notificaciones.service.js  # Avisos internos de la plataforma
│   ├── controllers/               # Manejo de peticiones y respuestas HTTP
│   │   ├── auth.controller.js
│   │   ├── usuarios.controller.js
│   │   ├── disponibilidad.controller.js
│   │   ├── sesiones.controller.js
│   │   ├── bitacora.controller.js
│   │   ├── twofa.controller.js
│   │   ├── logs.controller.js
│   │   └── notificaciones.controller.js
│   ├── routes/                    # Definición de endpoints Express
│   │   ├── auth.routes.js
│   │   ├── usuarios.routes.js
│   │   ├── disponibilidad.routes.js
│   │   ├── sesiones.routes.js
│   │   ├── bitacora.routes.js
│   │   ├── logs.routes.js
│   │   ├── notificaciones.routes.js
│   │   └── index.js
│   ├── utils/
│   │   ├── jwt.js                 # Firma y verificación de tokens JWT (acceso y parcial 2FA)
│   │   ├── cifrado.js             # AES-256-GCM para el secreto del autenticador
│   │   ├── peticion.js            # IP y navegador del cliente para la auditoría
│   │   └── horarios.js            # Aritmética de horarios y cálculo de bloques
│   ├── app.js                     # Configuración de Express y middlewares globales
│   └── server.js                  # Arranque del servidor HTTP
├── .env.example
├── .env
├── package.json
└── README.md
```

---

## 3. Instalación y Configuración Paso a Paso

### Paso 1: Clonar/Acceder al proyecto e instalar dependencias
```bash
cd backend
npm install
```

### Paso 2: Configurar las variables de entorno
Copia el archivo `.env.example` como `.env` y ajusta tus credenciales de PostgreSQL local:
```bash
cp .env.example .env
```
Contenido de `.env`:
```env
PORT=4000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=tu_contraseña_postgres
PGDATABASE=tutorias_pares
JWT_SECRET=secreto_para_firma_jwt_2026
JWT_EXPIRES_IN=8h

# Autenticador de segundo factor (TOTP)
JWT_2FA_EXPIRES_IN=5m
TOTP_ISSUER=Tutorias Pares USB
TOTP_ENC_KEY=clave_larga_distinta_del_jwt_secret
```

> `TOTP_ENC_KEY` cifra los secretos del autenticador guardados en la base. Si se
> deja vacía se usa `JWT_SECRET`. **No la cambies cuando ya existan cuentas con
> el autenticador activo**: los secretos guardados dejarían de poder descifrarse
> y esas cuentas necesitarían volver a vincular su aplicación.

### Paso 3: Crear la Base de Datos en PostgreSQL
Abre tu consola psql o terminal y ejecuta:
```bash
createdb -U postgres tutorias_pares
```

### Paso 4: Cargar Esquema y Datos Semilla
Ejecuta los siguientes comandos para crear las 4 tablas y popular la base de datos:
```bash
# Cargar tablas e índices
psql -U postgres -d tutorias_pares -f src/db/schema.sql

# Cargar usuarios, disponibilidades, sesiones y bitácora de prueba
psql -U postgres -d tutorias_pares -f src/db/seed.sql
```
*(También puedes usar los scripts npm configurados: `npm run db:init` y `npm run db:seed`)*

### Paso 5: Migraciones
`schema.sql` ya incluye todo lo siguiente, por lo que este paso **solo es
necesario en bases de datos creadas antes de estas incorporaciones**. Las dos
migraciones son idempotentes: pueden ejecutarse varias veces sin perder datos.
```bash
npm run db:migrate
# equivale a:
psql -U postgres -d tutorias_pares -f src/db/migration_autenticador_logs.sql
psql -U postgres -d tutorias_pares -f src/db/migration_coordinador_notificaciones.sql
```
- `migration_autenticador_logs.sql`: agrega a `usuarios` las columnas
  `totp_secret`, `totp_habilitado` y `totp_activado_en`, y crea las tablas
  `totp_codigos_respaldo` y `logs_acceso`.
- `migration_coordinador_notificaciones.sql`: amplía el `CHECK` del campo `rol`
  para admitir `coordinador` y crea la tabla `notificaciones`.

> El rol `coordinador` **no puede crearse desde el formulario de registro**
> (`POST /api/auth/registro` solo acepta `tutor` y `estudiante`): la cuenta se
> carga con el seed o se asigna en la base de datos. Es una cuenta de supervisión.

---

## 4. Usuarios de Prueba Cargados (Seed)

> **Contraseña universal para todos los usuarios de prueba:** `123456`

| Nombre Completo | Correo Electrónico | Rol | Área de Apoyo |
|---|---|---|---|
| Ana Rojas | `ana.tutor@usalesiana.edu.bo` | tutor | Metodología de Investigación |
| Carlos Mamani | `carlos.tutor@usalesiana.edu.bo` | tutor | Estadística y SPSS |
| Lucía Fernández | `lucia.estudiante@usalesiana.edu.bo` | estudiante | N/A |
| Jorge Quispe | `jorge.estudiante@usalesiana.edu.bo` | estudiante | N/A |
| Marta Villarroel | `coordinacion@usalesiana.edu.bo` | coordinador | N/A |

---

## 5. Ejecución del Servidor

```bash
# Modo desarrollo con recarga automática (nodemon)
npm run dev

# Modo producción
npm start
```
El servidor estará escuchando en: `http://localhost:4000`  
Verificación de salud (Health check): `GET http://localhost:4000/health`

---

## 6. Tabla de Endpoints de la API

Todas las rutas protegidas requieren enviar el token JWT en la cabecera:
```http
Authorization: Bearer <TU_TOKEN_JWT>
```

| Método | Ruta | Rol Requerido | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/registro` | Público | Registro de nuevos usuarios (tutor o estudiante) |
| `POST` | `/api/auth/login` | Público | Paso 1: valida la contraseña. Devuelve el token JWT, o `requiere_2fa` + `token_temporal` si la cuenta tiene autenticador |
| `POST` | `/api/auth/2fa/verificar` | Público (token temporal) | Paso 2: valida el código TOTP o uno de respaldo y entrega el token JWT definitivo |
| `POST` | `/api/auth/logout` | Autenticado | Cierra sesión y lo deja asentado en la bitácora |
| `GET` | `/api/auth/perfil` | Autenticado | Datos actualizados del usuario autenticado |
| `GET` | `/api/auth/2fa/estado` | Autenticado | Estado del autenticador y códigos de respaldo restantes |
| `POST` | `/api/auth/2fa/configurar` | Autenticado | Genera el secreto y el QR (`otpauth://`) para vincular la aplicación |
| `POST` | `/api/auth/2fa/activar` | Autenticado | Confirma con un código de 6 dígitos y entrega 8 códigos de respaldo |
| `POST` | `/api/auth/2fa/desactivar` | Autenticado | Baja del autenticador (exige contraseña **y** código vigente) |
| `POST` | `/api/auth/2fa/codigos-respaldo` | Autenticado | Emite códigos de respaldo nuevos e invalida los anteriores |
| `GET` | `/api/usuarios/tutores` | Autenticado | Lista de tutores con su disponibilidad anidada |
| `GET` | `/api/usuarios/perfil` | Autenticado | Información del perfil del usuario autenticado |
| `POST` | `/api/disponibilidad` | Solo Tutor | Crear una nueva franja horaria de disponibilidad |
| `GET` | `/api/disponibilidad/mias` | Solo Tutor | Listar franjas de disponibilidad configuradas por el tutor |
| `DELETE` | `/api/disponibilidad/:id` | Solo Tutor | Eliminar una franja horaria de disponibilidad |
| `GET` | `/api/disponibilidad/:tutorId/slots` | Autenticado | Bloques libres de un tutor en una fecha (`?fecha=AAAA-MM-DD&duracion=60`): disponibilidad publicada menos sesiones vigentes |
| `POST` | `/api/sesiones` | Solo Estudiante | Solicitar tutoría (**valida disponibilidad del tutor, fecha futura y solapamiento con `OVERLAPS`**) |
| `GET` | `/api/sesiones/mias` | Autenticado | Listar sesiones agendadas según el rol del usuario |
| `PATCH` | `/api/sesiones/:id/estado` | Autenticado | Cambiar estado (Tutor: `confirmada`\|`rechazada`; Estudiante: `cancelada`) |
| `POST` | `/api/bitacora` | Solo Tutor | Registrar bitácora (marca sesión como `completada`) |
| `GET` | `/api/bitacora/dashboard` | Autenticado | Resumen analítico **según el rol**: el tutor ve lo que dictó, el estudiante lo que recibió y la coordinación toda la plataforma |
| `GET` | `/api/logs` | Autenticado | Bitácora de accesos propia; **solo la coordinación** agrega `?alcance=todos` para ver la de toda la plataforma. Filtros: `evento`, `exito`, `correo`, `desde`, `hasta`, `pagina`, `limite` |
| `GET` | `/api/logs/resumen` | Autenticado | Conteos de los últimos `?dias=30`: accesos correctos, rechazados, códigos fallidos y bloqueos |
| `GET` | `/api/logs/eventos` | Autenticado | Catálogo de los tipos de evento auditados |
| `GET` | `/api/notificaciones` | Autenticado | Avisos del usuario (`?solo_no_leidas=true&limite=15`) con el conteo de no leídos |
| `GET` | `/api/notificaciones/contador` | Autenticado | Solo el número de avisos sin leer (lo consulta la campanita) |
| `PATCH` | `/api/notificaciones/:id/leida` | Autenticado | Marcar un aviso propio como leído |
| `POST` | `/api/notificaciones/leidas` | Autenticado | Marcar todos los avisos propios como leídos |

---



