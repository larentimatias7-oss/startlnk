# Referencia de la API Interna (FastAPI)

Esta especificación documenta exhaustivamente los endpoints REST expuestos por el backend de **TSM Starlink Fleet & Usage Monitor (Milicic / TSM Patagonia)**.

---

## 📋 Resumen de Endpoints

| Método | Endpoint | Categoría | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | [`/api/health`](#1-get-apihealth) | Diagnóstico | Estado del servidor, motor SQLite y conexión con TSM ECHO |
| `GET` | [`/api/sync-logs`](#2-get-apisync-logs) | Diagnóstico | Historial de las últimas 20 sincronizaciones del worker |
| `GET` | [`/api/terminals/overview`](#3-get-apiterminalsoverview) | Flota | Resumen global, métricas KPI, tendencia 30D e inventario |
| `GET` | [`/api/terminals`](#4-get-apiterminals) | Flota | Lista filtrable de terminales satelitales |
| `GET` | [`/api/terminals/{id}`](#5-get-apiterminalsid) | Terminal | Ficha técnica completa y telemetría RF en tiempo real |
| `GET` | [`/api/terminals/{id}/usage-history`](#6-get-apiterminalsidusage-history) | Consumo | Historial de tráfico diario estructurado para gráficos |
| `POST` | [`/api/terminals/{id}/reboot`](#7-post-apiterminalsidreboot) | Control | Disparo de reinicio remoto de la antena vía Starlink Backoffice |
| `POST` | [`/api/terminals/{sl}/opt-in`](#8-post-apiterminalsslopt-in) | Control | Conmutación de política de sobreconsumo prioritario (*Opt-In*) |
| `POST` | [`/api/terminals/{id}/toggle-alerts`](#9-post-apiterminalsidtoggle-alerts) | Control | Activa o silencia individualmente las alertas para un terminal |
| `POST` | [`/api/terminals/sync`](#10-post-apiterminalssync) | Ingesta | Ejecución forzada e inmediata de sincronización con TSM ECHO |
| `GET/PUT` | [`/api/alerts/config`](#11-configuración-de-alertas-y-cadencia) | Alertas | Consulta y actualización de umbrales, cadencia y cooldown |
| `GET/POST`| [`/api/alerts/bots`](#12-gestión-multibot-de-telegram) | Telegram | Listado y registro de múltiples bots de Telegram con verificación |
| `PUT/DELETE`| [`/api/alerts/bots/{id}`](#12-gestión-multibot-de-telegram) | Telegram | Modificación y eliminación de bots de Telegram |
| `POST` | [`/api/alerts/verify-bot`](#12-gestión-multibot-de-telegram) | Telegram | Valida la conectividad de un token contra la API de Telegram |
| `GET/POST`| [`/api/alerts/channels`](#13-canales-y-grupos-destinatarios) | Alertas | Gestión de canales y asignación de bots emisores específicos |
| `PUT/DELETE`| [`/api/alerts/channels/{id}`](#13-canales-y-grupos-destinatarios) | Alertas | Modificación de bot emisor, estado (activo/pausado) o baja de canal |
| `POST` | [`/api/alerts/test-telegram`](#14-pruebas-de-canales) | Alertas | Envía un mensaje de prueba de conectividad a un canal |
| `POST` | [`/api/alerts/channels/{id}/test-real-alerts`](#14-pruebas-de-canales) | Alertas | **Evalúa la flota en vivo y despacha las alertas vigentes al canal** |
| `GET` | [`/api/alerts/history`](#15-auditoría-y-evaluación) | Alertas | Bitácora persistida de incidentes y notificaciones despachadas |
| `POST` | [`/api/alerts/evaluate`](#15-auditoría-y-evaluación) | Alertas | Disparo manual de evaluación de alertas sobre la flota |

---

## 1. `GET /api/health`

Verifica la disponibilidad operativa del backend, la conectividad con la base de datos SQLite, el estado de las credenciales de TSM ECHO y la ejecución del planificador en segundo plano.

- **Método**: `GET`
- **Ruta**: `/api/health`
- **Autenticación**: No requerida.
- **Códigos de Respuesta**:
  * `200 OK`: Sistema en línea o degradado controlado.

### Ejemplo de Respuesta:
```json
{
  "status": "online",
  "service": "TSM Starlink Fleet & Usage Monitor",
  "version": "1.0.0",
  "timestamp": "2026-09-22T14:30:15.124567",
  "database_connected": true,
  "echo_credentials_configured": true,
  "scheduler_running": true,
  "last_sync": {
    "timestamp": "2026-09-22T14:15:00.000000",
    "status": "SUCCESS",
    "terminals": 13,
    "message": "Synced 13 terminals successfully from TSM ECHO"
  }
}
```

---

## 2. `GET /api/sync-logs`

Retorna la bitácora histórica de las últimas 20 ejecuciones del worker de ingesta.

- **Método**: `GET`
- **Ruta**: `/api/sync-logs`
- **Autenticación**: No requerida.
- **Códigos de Respuesta**:
  * `200 OK`: Lista de registros de auditoría.

### Ejemplo de Respuesta:
```json
[
  {
    "id": 42,
    "timestamp": "2026-09-22T14:15:00",
    "status": "SUCCESS",
    "terminals_count": 13,
    "message": "Synced 13 terminals successfully from TSM ECHO"
  }
]
```

---

## 3. `GET /api/terminals/overview`

Retorna la vista consolidada para renderizar el panel principal del dashboard: métricas KPI agregadas de toda la flota, tendencia de tráfico acumulado de los últimos 30 días y el inventario con resumen de ciclo.

- **Método**: `GET`
- **Ruta**: `/api/terminals/overview`
- **Códigos de Respuesta**:
  * `200 OK`: Datos consolidados de flota (`FleetOverviewResponse`).

### Estructura de Respuesta:
- `kpis`: Métricas agregadas (total terminales, online, offline, consumo del mes en GB, cuota total, porcentaje medio de cuota, alertas activas).
- `trend`: Array de 30 puntos diarios para el gráfico de área apilado (`date`, `priority_gb`, `standard_gb`, `total_gb`).
- `terminals`: Listado completo de terminales con estado, telemetría y ciclo de facturación activo.

---

## 4. `GET /api/terminals`

Lista las terminales satelitales registradas con capacidad de filtrado reactivo.

- **Método**: `GET`
- **Ruta**: `/api/terminals`
- **Parámetros de Consulta (Query Params)**:
  * `status` (*string*, opcional): Filtra por estado (`online` o `offline`).
  * `search` (*string*, opcional): Búsqueda textual insensible a mayúsculas sobre `nickname`, `kit_serial`, `service_line_number` y `account_name`.

---

## 5. `GET /api/terminals/{id}`

Obtiene la ficha técnica completa y la telemetría en tiempo real de una antena específica.

- **Método**: `GET`
- **Ruta**: `/api/terminals/{id}`
- **Parámetros de Ruta**:
  * `id` (*string*, requerido): Identificador de la terminal (`device_id` o ID interno).

---

## 6. `GET /api/terminals/{id}/usage-history`

Historial diario estructurado de consumo de datos para el terminal durante el ciclo de facturación actual o histórico.

- **Método**: `GET`
- **Ruta**: `/api/terminals/{device_id}/usage-history`
- **Parámetros de Ruta**:
  * `device_id` (*string*, requerido): Identificador del terminal.

---

## 7. `POST /api/terminals/{id}/reboot`

Envía una orden de reinicio remoto hacia la antena satelital Starlink a través del backoffice de TSM ECHO (`/backoffice/starlink/user-terminals/{id}/reboot`).

> [!WARNING]
> Esta operación reiniciará el hardware del terminal e interrumpirá la conectividad de red durante aproximadamente 2 a 4 minutos.

- **Método**: `POST`
- **Ruta**: `/api/terminals/{device_id}/reboot`
- **Cuerpo de Petición**: Vacío (`{}`).

---

## 8. `POST /api/terminals/{sl}/opt-in`

Conmuta la política de sobreconsumo prioritario de una línea de servicio Starlink (*Data Opt-In* para habilitar datos adicionales facturables, o *Data Opt-Out* para degradar a servicio estándar sin costo adicional tras agotar la cuota).

- **Método**: `POST`
- **Ruta**: `/api/terminals/{service_line_number}/opt-in`
- **Parámetros de Consulta (Query Params)**:
  * `enabled` (*bool*, opcional, por defecto `true`): `true` para activar Opt-In; `false` para desactivar.

---

## 9. `POST /api/terminals/{id}/toggle-alerts`

Permite silenciar o reactivar de forma individual la generación de alertas para un enlace satelital específico. Esto previene la fatiga de alertas durante ventanas de mantenimiento programado o traslados de antena.

- **Método**: `POST`
- **Ruta**: `/api/terminals/{id}/toggle-alerts`
- **Parámetros de Ruta**:
  * `id` (*string*, requerido): Identificador del terminal (`device_id` o ID interno).
- **Códigos de Respuesta**:
  * `200 OK`: Estado actualizado (`ToggleAlertsResponse`).

### Ejemplo de Respuesta:
```json
{
  "terminal_id": "1120901c-0312800e-9ad16181",
  "alerts_enabled": false,
  "message": "Alertas desactivadas para 'Pozo Loma Negra #14'"
}
```

---

## 10. `POST /api/terminals/sync`

Dispara de forma asíncrona una sincronización forzada e inmediata contra TSM ECHO sin esperar al siguiente ciclo del planificador.

- **Método**: `POST`
- **Ruta**: `/api/terminals/sync`
- **Códigos de Respuesta**:
  * `200 OK`: Sincronización concluida (`ActionResponse`).

---

## 11. Configuración de Alertas y Cadencia

### 11.1 `GET /api/alerts/config`
Obtiene la configuración activa del motor de alertas (umbrales de cuota, ritmo de burn-rate, cadencia de monitoreo y cooldown).

#### Ejemplo de Respuesta:
```json
{
  "id": 1,
  "telegram_bot_token": "8899338410:AAHP...",
  "quota_threshold_percent": 80.0,
  "quota_critical_percent": 100.0,
  "early_warning_percent": 60.0,
  "early_warning_days_remaining": 15,
  "alert_on_offline": false,
  "cooldown_hours": 12,
  "sync_interval_minutes": 15,
  "is_enabled": true,
  "updated_at": "2026-09-22T14:15:00.000000"
}
```

### 11.2 `PUT /api/alerts/config`
Actualiza los umbrales de alerta y ajusta dinámicamente la cadencia del worker en segundo plano sin requerir reiniciar la aplicación.

#### Payload de Ejemplo:
```json
{
  "quota_threshold_percent": 80.0,
  "quota_critical_percent": 100.0,
  "early_warning_percent": 60.0,
  "early_warning_days_remaining": 15,
  "alert_on_offline": false,
  "cooldown_hours": 12,
  "sync_interval_minutes": 10,
  "is_enabled": true
}
```

---

## 12. Gestión Multi-Bot de Telegram

Permite registrar múltiples bots de Telegram corporativos (ej. `@inframilicic_bot`, `@guardia_noc_bot`), validar sus credenciales automáticamente con Telegram y asignarlos independientemente a los canales de guardia.

### 12.1 `GET /api/alerts/bots`
Lista todos los bots registrados, enmascarando los tokens para resguardo de seguridad.

#### Ejemplo de Respuesta:
```json
[
  {
    "id": 1,
    "name": "Alertas Infra MILICIC",
    "token_masked": "8899338410:AAHP...b_c8",
    "bot_username": "inframilicic_bot",
    "bot_id": "8899338410",
    "is_default": true,
    "is_active": true,
    "channels_count": 3,
    "created_at": "2026-09-22T13:45:00.000000"
  }
]
```

### 12.2 `POST /api/alerts/bots`
Registra un nuevo bot de Telegram. Valida el token directamente con `getMe` de Telegram antes de guardarlo.

#### Payload:
```json
{
  "name": "NOC Minería Bot",
  "token": "8899338410:AAHPzP7vX76k0UvJ04xQjJk1l2m3",
  "is_default": false,
  "is_active": true
}
```

### 12.3 `PUT /api/alerts/bots/{bot_id}`
Modifica el nombre, estado o marca como default un bot existente.

### 12.4 `DELETE /api/alerts/bots/{bot_id}`
Elimina un bot. Los canales vinculados a este bot conmutarán automáticamente al bot predeterminado.

### 12.5 `POST /api/alerts/verify-bot`
Verifica un token de bot contra Telegram API sin persistirlo.

---

## 13. Canales y Grupos Destinatarios

### 13.1 `GET /api/alerts/channels`
Lista todos los canales o grupos registrados, indicando el bot emisor asignado (`bot_id`, `bot_name`, `bot_username`).

### 13.2 `POST /api/alerts/channels`
Registra un nuevo canal o grupo de Telegram y lo vincula al bot deseado.

#### Payload:
```json
{
  "name": "Guardia NOC Minería",
  "chat_id": "-1004383937012",
  "bot_id": 1,
  "is_active": true
}
```

### 13.3 `PUT /api/alerts/channels/{channel_id}`
Permite pausar o reactivar un canal (`is_active: false/true`) o reasignar su bot emisor al vuelo.

### 13.4 `DELETE /api/alerts/channels/{channel_id}`
Elimina el canal de la lista de destinatarios.

---

## 14. Pruebas de Canales

### 14.1 `POST /api/alerts/test-telegram`
Envía un mensaje sintético de prueba de conectividad para certificar que el bot tiene acceso de escritura al `chat_id`.

#### Payload:
```json
{
  "chat_id": "-1004383937012",
  "bot_id": 1
}
```

### 14.2 `POST /api/alerts/channels/{channel_id}/test-real-alerts`
**Prueba integral con datos reales de flota**: Evalúa en vivo todas las antenas activas contra las reglas de alerta y despacha inmediatamente todas las alertas vigentes al canal indicado, omitiendo el cooldown anti-spam.

- **Método**: `POST`
- **Ruta**: `/api/alerts/channels/{channel_id}/test-real-alerts`
- **Comportamiento**:
  - Si hay alertas vigentes: Envía un banner de encabezado + cada alerta real formateada con sus métricas de consumo y las registra en auditoría.
  - Si la flota está saludable: Envía un reporte formal confirmando 0 alertas activas sobre la flota total.

#### Ejemplo de Respuesta:
```json
{
  "success": true,
  "alerts_count": 9,
  "sent_count": 9,
  "channel_name": "Alertas Infra MIO",
  "bot_username": "inframilicic_bot",
  "message": "Se despacharon 9 de 9 alertas vigentes al canal 'Alertas Infra MIO' vía @inframilicic_bot"
}
```

---

## 15. Auditoría y Evaluación

### 15.1 `GET /api/alerts/history`
Retorna el registro histórico de las últimas 50 alertas evaluadas y despachadas, con terminal, severidad (`WARNING`, `CRITICAL`), mensaje, canales notificados y timestamp.

### 15.2 `POST /api/alerts/evaluate`
Dispara de forma manual e inmediata la evaluación de toda la flota contra las reglas de alerta, notificando a los canales activos que no estén en ventana de cooldown.
