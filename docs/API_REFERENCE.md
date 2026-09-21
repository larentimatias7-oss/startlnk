# Referencia de la API Interna (FastAPI)

Esta especificación documenta exhaustivamente los endpoints REST expuestos por el backend de **TSM Starlink Fleet & Usage Monitor**.

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
| `POST` | [`/api/terminals/sync`](#9-post-apiterminalssync) | Ingesta | Ejecución forzada e inmediata de sincronización con TSM ECHO |

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
  "timestamp": "2026-09-21T20:30:15.124567",
  "database_connected": true,
  "echo_credentials_configured": true,
  "scheduler_running": true,
  "last_sync": {
    "timestamp": "2026-09-21T20:15:00.000000",
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
    "timestamp": "2026-09-21T20:15:00",
    "status": "SUCCESS",
    "terminals_count": 13,
    "message": "Synced 13 terminals successfully from TSM ECHO"
  },
  {
    "id": 41,
    "timestamp": "2026-09-21T20:00:00",
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
  * `200 OK`: Datos consolidados de flota.

### Esquema de la Respuesta:
- `kpis` (*Object*):
  * `total_terminals` (*int*): Total de terminales registradas.
  * `online_count` (*int*): Terminales activas y conectadas.
  * `offline_count` (*int*): Terminales sin enlace satelital.
  * `availability_percent` (*float*): Porcentaje de disponibilidad general.
  * `total_consumed_month_gb` (*float*): Sumatoria de GB consumidos en el mes vigente.
  * `total_quota_month_gb` (*float*): Sumatoria de GB contratados de la flota.
  * `fleet_quota_consumed_percent` (*float*): Porcentaje de uso global de la cuota.
  * `terminals_in_warning` (*int*): Enlaces entre 80% y 99.9% de su cuota.
  * `terminals_in_critical` (*int*): Enlaces que han alcanzado o superado el 100%.
  * `last_sync_time` (*string / ISO-8601*): Fecha y hora de la última sincronización.
  * `sync_status` (*string*): `SUCCESS`, `WARNING` o `ERROR`.
- `fleet_daily_trend` (*Array<Object>*): Registros diarios consolidados (últimos 30 días):
  * `date` (*string*): Fecha en formato `YYYY-MM-DD`.
  * `total_gb` (*float*): Tráfico total diario en GB.
  * `priority_gb` (*float*): Tráfico prioritario.
  * `opt_in_priority_gb` (*float*): Tráfico prioritario excedente con cargo.
  * `standard_gb` (*float*): Tráfico estándar.
- `terminals` (*Array<Object>*): Lista de resúmenes de cada terminal (`TerminalSummary`).

### Ejemplo de Respuesta:
```json
{
  "kpis": {
    "total_terminals": 13,
    "online_count": 12,
    "offline_count": 1,
    "availability_percent": 92.3,
    "total_consumed_month_gb": 11068.34,
    "total_quota_month_gb": 15700.0,
    "fleet_quota_consumed_percent": 70.5,
    "terminals_in_warning": 2,
    "terminals_in_critical": 1,
    "last_sync_time": "2026-09-21T20:15:00",
    "sync_status": "SUCCESS"
  },
  "fleet_daily_trend": [
    {
      "date": "2026-09-01",
      "total_gb": 348.25,
      "priority_gb": 320.10,
      "opt_in_priority_gb": 0.0,
      "standard_gb": 28.15
    },
    {
      "date": "2026-09-02",
      "total_gb": 412.80,
      "priority_gb": 380.40,
      "opt_in_priority_gb": 12.50,
      "standard_gb": 19.90
    }
  ],
  "terminals": [
    {
      "id": "ut01000000-00000000-00000001",
      "device_id": "ut01000000-00000000-00000001",
      "nickname": "Pozo Loma Negra #14",
      "kit_serial": "KIT00492001",
      "service_line_number": "SL-384910-48201-92",
      "account_name": "Milicic S.A.",
      "is_online": true,
      "downlink_mbps": 184.2,
      "uplink_mbps": 24.8,
      "ping_ms": 41.5,
      "drop_rate": 0.0012,
      "signal_quality": 98.0,
      "has_public_ip": true,
      "is_alert": false,
      "consumed_alarm": "NORMAL",
      "active_cycle_id": 4801,
      "quota_total_gb": 1000.0,
      "quota_consumed_gb": 742.8,
      "quota_consumed_percent": 74.3,
      "updated_at": "2026-09-21T20:15:05"
    }
  ]
}
```

---

## 4. `GET /api/terminals`

Retorna la lista de terminales registradas, permitiendo filtrado dinámico por estado de conectividad y búsqueda por texto.

- **Método**: `GET`
- **Ruta**: `/api/terminals`
- **Parámetros de Consulta (Query Params)**:
  * `status` (*string*, opcional): Filtra por estado de enlace. Valores soportados: `online` o `offline`.
  * `search` (*string*, opcional): Coincidencia parcial insensible a mayúsculas sobre `nickname`, `kit_serial`, `service_line_number` o `account_name`.
- **Códigos de Respuesta**:
  * `200 OK`: Lista de objetos `TerminalSummary`.

### Ejemplo de Petición:
```http
GET /api/terminals?status=online&search=Loma%20Negra HTTP/1.1
Host: localhost:8000
Accept: application/json
```

---

## 5. `GET /api/terminals/{id}`

Retorna la información técnica exhaustiva de un enlace satelital, incluyendo parámetros de hardware, router Wi-Fi, telemetría física de radiofrecuencia (RF) y el ciclo de facturación activo.

- **Método**: `GET`
- **Ruta**: `/api/terminals/{device_id}`
- **Parámetros de Ruta**:
  * `device_id` (*string*, requerido): Identificador del dispositivo con prefijo `ut` (ej: `ut01000000-...`), sin prefijo o `id` de base de datos.
- **Códigos de Respuesta**:
  * `200 OK`: Ficha técnica completa del terminal (`TerminalDetail`).
  * `404 Not Found`: No existe ningún terminal con el identificador proporcionado.

### Ejemplo de Respuesta:
```json
{
  "id": "ut01000000-00000000-00000001",
  "device_id": "ut01000000-00000000-00000001",
  "raw_device_id": "01000000-00000000-00000001",
  "nickname": "Pozo Loma Negra #14",
  "kit_serial": "KIT00492001",
  "service_line_number": "SL-384910-48201-92",
  "account_name": "Milicic S.A.",
  "is_online": true,
  "downlink_mbps": 184.2,
  "uplink_mbps": 24.8,
  "ping_ms": 41.5,
  "drop_rate": 0.0012,
  "signal_quality": 98.0,
  "has_public_ip": true,
  "is_alert": false,
  "consumed_alarm": "NORMAL",
  "active_cycle_id": 4801,
  "quota_total_gb": 1000.0,
  "quota_consumed_gb": 742.8,
  "quota_consumed_percent": 74.3,
  "updated_at": "2026-09-21T20:15:05",
  "dish_model": "Flat High Performance",
  "dish_serial": "DISH-0098001",
  "router_id": "RTR-0001",
  "wifi_bypassed": false,
  "obstruction_percent": 0.0,
  "uptime_seconds": 1234567,
  "latitude": -38.9516,
  "longitude": -68.0591,
  "h3_cell_id": "599573887498223615",
  "billing_cycle": {
    "id": 4801,
    "service_line_number": "SL-384910-48201-92",
    "start_date": "2026-09-01T00:00:00.000Z",
    "end_date": "2026-09-30T23:59:59.000Z",
    "total_amount_gb": 1000.0,
    "consumed_amount_gb": 742.8,
    "consumed_percent": 74.3,
    "consumed_alarm": "NORMAL",
    "consumed_status": "ACTIVE",
    "is_active": true
  }
}
```

---

## 6. `GET /api/terminals/{id}/usage-history`

Retorna la serie cronológica diaria de consumo para el ciclo de facturación activo del terminal, desglosado en las categorías de tráfico de Starlink requeridas para renderizado de gráficos.

- **Método**: `GET`
- **Ruta**: `/api/terminals/{device_id}/usage-history`
- **Parámetros de Ruta**:
  * `device_id` (*string*, requerido): Identificador del terminal.
- **Códigos de Respuesta**:
  * `200 OK`: Historial de consumo (`UsageHistoryResponse`).
  * `404 Not Found`: Terminal no encontrado.

### Ejemplo de Respuesta:
```json
{
  "device_id": "ut01000000-00000000-00000001",
  "service_line_number": "SL-384910-48201-92",
  "cycle_id": 4801,
  "total_priority_gb": 710.20,
  "total_opt_in_gb": 0.0,
  "total_standard_gb": 28.50,
  "total_consumed_gb": 742.80,
  "daily_usages": [
    {
      "date": "2026-09-01",
      "priority_gb": 32.40,
      "opt_in_priority_gb": 0.0,
      "standard_gb": 1.20,
      "non_bill_gb": 0.35,
      "total_gb": 33.95
    },
    {
      "date": "2026-09-02",
      "priority_gb": 41.10,
      "opt_in_priority_gb": 0.0,
      "standard_gb": 2.10,
      "non_bill_gb": 0.40,
      "total_gb": 43.60
    }
  ]
}
```

---

## 7. `POST /api/terminals/{id}/reboot`

Envía una orden de reinicio remoto hacia la antena satelital Starlink a través de los endpoints de backoffice de TSM ECHO (`/backoffice/starlink/user-terminals/{id}/reboot`).

> [!WARNING]
> Esta operación reiniciará el hardware del terminal satelital e interrumpirá la conectividad de red durante aproximadamente 2 a 4 minutos mientras se reorientan los haces de RF.

- **Método**: `POST`
- **Ruta**: `/api/terminals/{device_id}/reboot`
- **Cuerpo de Petición (Body)**: Vacío (`{}`).
- **Códigos de Respuesta**:
  * `200 OK`: Orden procesada o encolada con éxito (`ActionResponse`).
  * `404 Not Found`: Terminal no encontrado.

### Ejemplo de Respuesta:
```json
{
  "success": true,
  "message": "Reboot instruction dispatched to Starlink terminal Pozo Loma Negra #14",
  "action": "reboot",
  "target": "ut01000000-00000000-00000001",
  "timestamp": "2026-09-21T20:31:00.123456"
}
```

---

## 8. `POST /api/terminals/{sl}/opt-in`

Conmuta la política de sobreconsumo prioritario de una línea de servicio Starlink (*Data Opt-In* para habilitar datos adicionales facturables, o *Data Opt-Out* para degradar a servicio estándar sin costo adicional tras agotar la cuota).

- **Método**: `POST`
- **Ruta**: `/api/terminals/{service_line_number}/opt-in`
- **Parámetros de Ruta**:
  * `service_line_number` (*string*, requerido): Número de línea de servicio (ej: `SL-384910-48201-92`).
- **Parámetros de Consulta (Query Params)**:
  * `enabled` (*bool*, opcional, por defecto `true`): `true` para activar Opt-In; `false` para desactivar (Opt-Out).
- **Códigos de Respuesta**:
  * `200 OK`: Política modificada exitosamente (`ActionResponse`).
  * `404 Not Found`: Línea de servicio no encontrada.

### Ejemplo de Petición:
```http
POST /api/terminals/SL-384910-48201-92/opt-in?enabled=true HTTP/1.1
Host: localhost:8000
Content-Length: 0
```

### Ejemplo de Respuesta:
```json
{
  "success": true,
  "message": "Data Opt-In set to True for SL-384910-48201-92",
  "action": "opt-in",
  "target": "SL-384910-48201-92",
  "timestamp": "2026-09-21T20:31:30.987654"
}
```

---

## 9. `POST /api/terminals/sync`

Dispara de forma asíncrona una sincronización forzada e inmediata contra TSM ECHO sin esperar al siguiente ciclo del planificador.

- **Método**: `POST`
- **Ruta**: `/api/terminals/sync`
- **Cuerpo de Petición**: Vacío.
- **Códigos de Respuesta**:
  * `200 OK`: Sincronización concluida (`ActionResponse`).

### Ejemplo de Respuesta:
```json
{
  "success": true,
  "message": "Synced 13 terminals successfully from TSM ECHO",
  "action": "manual_sync",
  "target": "13 terminals",
  "timestamp": "2026-09-21T20:32:00.000000"
}
```
