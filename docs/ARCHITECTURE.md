# Arquitectura de Software y Diseño Técnico

Este documento detalla la arquitectura de software, los flujos de datos, el ciclo de vida de autenticación JWT, el modelo relacional y el motor de alertas del sistema **TSM Starlink Fleet & Usage Monitor (Milicic / TSM Patagonia)**.

---

## 1. Visión General de la Arquitectura

El sistema implementa una arquitectura desacoplada y orientada a servicios, optimizada para proporcionar alta disponibilidad, baja latencia de respuesta y resiliencia ante cortes o degradaciones en la plataforma upstream de **TSM ECHO** (`https://echo.tsmpatagonia.com.ar/api`).

### Principios de Diseño:
1. **Desacoplamiento Operativo**: Los operadores y tableros de control leen exclusivamente desde una base de datos local SQLite de alta velocidad. Ninguna petición de lectura del frontend impacta de forma directa ni bloquea la API externa de ECHO.
2. **Ingesta Asíncrona Desatendida**: Un worker en segundo plano (`APScheduler`) sincroniza periódicamente el estado de la flota, telemetría de radiofrecuencia (RF), ciclos de facturación y consumo diario. La cadencia es parametrizable en caliente desde la interfaz (5 a 60 minutos).
3. **Autenticación Transparente con Auto-Recuperación**: El cliente HTTP interno gestiona el ciclo de vida del token JWT Bearer, detecta vencimientos mediante códigos `401 Unauthorized` y renueva la sesión automáticamente sin interrumpir la operación.
4. **Motor de Alertas y Despacho Multi-Bot**: Evaluación continua de doble criterio (umbrales fijos y proyección acelerada de consumo *burn-rate*) con ruteo hacia múltiples bots y canales de Telegram independientes.
5. **Comandos Críticos con Doble Factor de Confirmación**: Las operaciones remotas de impacto operativo (*Reboot* y *Data Opt-In*) se ejecutan bajo demanda hacia el backoffice de Starlink a través de endpoints seguros y modales interactivos de confirmación.

---

## 2. Diagrama de Arquitectura y Flujo de Datos

```mermaid
flowchart TB
    subgraph ClientTier ["Capa de Presentación (Frontend SPA - React 18 + Vite)"]
        Browser["Navegador Web (Operador NOC / Infraestructura Milicic)"]
        Header["Header & Estado Upstream ECHO"]
        KPIs["Tarjetas KPI & Alarmas"]
        TrendChart["Gráfico Tendencia 30D Recharts"]
        FleetTable["Tabla de Inventario, Ordenamiento & Burn-Rate"]
        TerminalDetail["Modal Telemetría RF & Barras Diarias"]
        AlertsView["AlertConfigView (Bots, Canales, Reglas, Auditoría)"]
        Modals["Modales Confirmación Reboot / Opt-In"]
        
        Browser <--> Header
        Browser <--> KPIs
        Browser <--> TrendChart
        Browser <--> FleetTable
        Browser <--> AlertsView
        Browser <--> TerminalDetail
        Browser <--> Modals
    end

    subgraph APITier ["Capa de Aplicación y API (FastAPI Backend)"]
        FastAPIServer["Servidor ASGI (Uvicorn + FastAPI)"]
        RouterTerminals["Router /api/terminals (Flota & Acciones)"]
        RouterAlerts["Router /api/alerts (Config, Multi-Bot, Canales, Tests)"]
        RouterHealth["Router /api/health (Salud & Sync Logs)"]
        SecurityLayer["CORS, Masking de Secretos & Sanitización"]
        
        FastAPIServer --> RouterTerminals
        FastAPIServer --> RouterAlerts
        FastAPIServer --> RouterHealth
        FastAPIServer --> SecurityLayer
    end

    subgraph ServiceTier ["Capa de Servicios y Segundo Plano"]
        Scheduler["Planificador Dinámico (APScheduler 5-60m)"]
        SyncService["Servicio de Ingesta (SyncService)"]
        AlertService["Motor de Alertas (AlertService - Reglas & Cooldown)"]
        TelegramService["Despacho Telegram (TelegramService - Multi-Bot)"]
        EchoClient["Cliente HTTP Asíncrono (EchoClient / httpx)"]
        TokenCache[("Caché JWT en Memoria")]

        Scheduler --> SyncService
        SyncService --> EchoClient
        SyncService -->|Auto-evaluar tras ingesta| AlertService
        AlertService --> TelegramService
        RouterTerminals -->|Comandos Remotos| EchoClient
        RouterAlerts --> AlertService
        RouterAlerts --> TelegramService
        EchoClient <--> TokenCache
    end

    subgraph DataTier ["Capa de Persistencia (SQLite / SQLAlchemy 2.0)"]
        DBEngine["Motor SQLAlchemy 2.0 (check_same_thread=False)"]
        TableTerminals[("Tabla terminals")]
        TableCycles[("Tabla billing_cycles")]
        TableUsages[("Tabla daily_usages")]
        TableBots[("Tabla telegram_bots")]
        TableChannels[("Tabla telegram_channels")]
        TableConfig[("Tabla alert_configs")]
        TableEvents[("Tabla alert_events")]
        TableLogs[("Tabla sync_logs")]

        DBEngine --- TableTerminals
        DBEngine --- TableCycles
        DBEngine --- TableUsages
        DBEngine --- TableBots
        DBEngine --- TableChannels
        DBEngine --- TableConfig
        DBEngine --- TableEvents
        DBEngine --- TableLogs
    end

    subgraph ExternalServices ["Servicios Externos"]
        EchoAPI["Plataforma TSM ECHO\nhttps://echo.tsmpatagonia.com.ar/api"]
        TelegramAPI["Telegram Bot API\nhttps://api.telegram.org/bot<token>"]
    end

    Header & KPIs & TrendChart & FleetTable & AlertsView -->|HTTP REST / JSON| FastAPIServer
    RouterTerminals & RouterAlerts & RouterHealth -->|Consultas SQL| DBEngine
    SyncService & AlertService -->|Escritura Transaccional| DBEngine
    EchoClient -->|HTTPS Bearer JWT Outbound| EchoAPI
    TelegramService -->|HTTPS POST JSON Outbound| TelegramAPI
```

---

## 3. Ciclo de Vida del JWT y Estrategia de Autenticación

El acceso a la API interna de TSM ECHO requiere un JSON Web Token (JWT) provisto en el encabezado HTTP `Authorization: Bearer <token>`.

### 3.1. Adquisición Inicial del Token
Al instanciarse o requerir una llamada a la API sin token en memoria, [`EchoClient`](file:///c:/antigravity/tsmpatagonia/backend/app/services/echo_client.py) ejecuta la autenticación:
- **Endpoint**: `POST https://echo.tsmpatagonia.com.ar/api/login`
- **Payload**:
  ```json
  {
    "email": "it.infra@milicic.com.ar",
    "password": "****************"
  }
  ```
- **Almacenamiento**: El token resultante se guarda en memoria RAM (`self._token`). **Nunca se escribe en disco ni se persiste en base de datos**.

### 3.2. Detección de Expiración y Re-autenticación Automática
1. El cliente ejecuta la petición HTTP hacia el endpoint destino con el token actual.
2. Si la respuesta retorna un código HTTP `401 Unauthorized`:
   - El cliente invalida el token actual en memoria.
   - Dispara automáticamente una nueva llamada a `/api/login`.
   - Si la autenticación es exitosa, reintenta inmediatamente la petición original con el nuevo token.
3. Este mecanismo previene fallas intermitentes por caducidad de sesión sin intervención del operador.

---

## 4. Flujo de Ingesta Periódica (SyncService)

El proceso de sincronización se ejecuta a través de [`SyncService.sync_fleet()`](file:///c:/antigravity/tsmpatagonia/backend/app/services/sync_service.py):

```mermaid
sequenceDiagram
    autonumber
    participant Sch as APScheduler
    participant Sync as SyncService
    participant Echo as EchoClient (TSM ECHO)
    participant DB as SQLite DB
    participant Alert as AlertService
    participant TG as Telegram API

    Sch->>Sync: Disparo periódico (cada X minutos)
    Sync->>Echo: GET /stDeviceLists (Inventario)
    Echo-->>Sync: Lista de dispositivos y kitSerials
    
    loop Por cada terminal
        Sync->>Echo: GET /stDeviceIdRouters/userterminal (RF y Telemetría)
        Echo-->>Sync: SNR, Ping, Throughput, Obstrucción
    end

    Sync->>Echo: GET /billingCycles (Ciclos activos)
    Echo-->>Sync: Cuotas y fechas de ciclo
    
    Sync->>Echo: GET /dailydatausage (Consumo diario)
    Echo-->>Sync: Histórico de tráfico por categoría
    
    Sync->>DB: Upsert transaccional (terminals, cycles, usages)
    Sync->>DB: Registrar log en sync_logs
    
    Sync->>Alert: evaluate_fleet_alerts()
    Alert->>DB: Consultar reglas, cooldowns y bots
    opt Alertas detectadas fuera de cooldown
        Alert->>TG: Despachar notificaciones a canales activos
        Alert->>DB: Registrar eventos en alert_events
    end
```

---

## 5. Modelo de Datos Relacional (SQLAlchemy ORM)

### 5.1. Diagrama Entidad-Relación (ER)

```mermaid
erDiagram
    terminals {
        string id PK "Identificador único (ej: ut01000000-...)"
        string device_id "Identificador del dispositivo con prefijo ut"
        string raw_device_id "UUID limpio sin prefijo ut"
        string nickname "Nombre asignado o kitSerial"
        string kit_serial "Número de serie del kit Starlink"
        string service_line_number FK "Número de línea de servicio (SL-...)"
        string account_name "Razón social del cliente o campamento"
        boolean is_online "Estado de conectividad del enlace"
        float downlink_mbps "Ancho de banda actual de bajada"
        float uplink_mbps "Ancho de banda actual de subida"
        float ping_ms "Latencia de ida y vuelta promedio"
        float drop_rate "Tasa de paquetes descartados"
        float obstruction_percent "Porcentaje de visión satelital obstruida"
        float signal_quality "Calidad del haz de RF (0-100%)"
        integer uptime_seconds "Tiempo continuo de operación"
        string dish_model "Modelo de antena satelital"
        string dish_serial "Número de serie de la antena"
        boolean has_public_ip "Indica si posee IP pública"
        string router_id "Identificador del router asociado"
        boolean wifi_bypassed "Modo puente / bypass del Wi-Fi"
        float latitude "Coordenada de latitud"
        float longitude "Coordenada de longitud"
        string h3_cell_id "Índice geoespacial H3"
        boolean is_alert "Bandera de alerta activa"
        string consumed_alarm "Alarma de cuota (NORMAL, 80, 100)"
        string active_alerts_json "Detalle JSON de alertas activas"
        boolean alerts_enabled "Control individual de alertas (Silenciar)"
        datetime updated_at "Fecha y hora de actualización"
    }

    billing_cycles {
        integer id PK "Identificador único provisto por ECHO"
        string service_line_number "Línea de servicio asociada"
        string start_date "Fecha inicio ciclo"
        string end_date "Fecha fin ciclo"
        float total_amount_gb "Cuota mensual total contratada (GB)"
        float consumed_amount_gb "Consumo acumulado a la fecha (GB)"
        float consumed_percent "Porcentaje de consumo de cuota"
        string consumed_alarm "Estado de alarma (NORMAL, 80, 100)"
        string consumed_status "Estado de facturación"
        string currency "Moneda del contrato"
        boolean is_active "Indica si es el ciclo en curso"
        datetime updated_at "Fecha y hora de actualización"
    }

    daily_usages {
        integer id PK "Autoincremental primario"
        integer billing_cycle_id FK "FK hacia billing_cycles.id"
        string service_line_number "Línea de servicio asociada"
        string date "Fecha del consumo (YYYY-MM-DD)"
        float priority_gb "Consumo en datos prioritarios (GB)"
        float opt_in_priority_gb "Consumo excedente con cargo (GB)"
        float standard_gb "Consumo en datos estándar (GB)"
        float non_bill_gb "Tráfico de gestión no facturable (GB)"
        float total_gb "Consumo total acumulado en el día (GB)"
    }

    telegram_bots {
        integer id PK "Autoincremental primario"
        string name "Nombre amigable (ej: Alertas Infra MILICIC)"
        string token "HTTP API Token de @BotFather"
        string bot_username "Usuario del bot en Telegram (sin @)"
        string bot_id "ID numérico único del bot"
        boolean is_default "Indica si es el bot predeterminado"
        boolean is_active "Estado operativo del bot"
        datetime created_at "Fecha de registro"
    }

    telegram_channels {
        integer id PK "Autoincremental primario"
        string name "Nombre descriptivo del canal o grupo"
        string chat_id "Chat ID de Telegram (ej: -1004383937012)"
        integer bot_id FK "FK hacia telegram_bots.id"
        boolean is_active "Estado de despacho (activo/pausado)"
        datetime created_at "Fecha de registro"
    }

    alert_configs {
        integer id PK "Identificador único"
        string telegram_bot_token "Token legacy / fallback de bot"
        float quota_threshold_percent "Umbral de advertencia de cuota (%)"
        float quota_critical_percent "Umbral de cuota crítica (%)"
        float early_warning_percent "Umbral de consumo para burn-rate (%)"
        integer early_warning_days_remaining "Días restantes mínimos para burn-rate"
        boolean alert_on_offline "Notificar enlaces caídos"
        integer cooldown_hours "Ventana anti-spam de enfriamiento (hs)"
        integer sync_interval_minutes "Cadencia de sincronización en minutos"
        boolean is_enabled "Interruptor maestro de alertas"
        datetime updated_at "Última modificación"
    }

    alert_events {
        integer id PK "Autoincremental primario"
        string terminal_id "Identificador de la terminal"
        string terminal_name "Nombre amigable de la antena"
        string service_line_number "Línea de servicio"
        string alert_type "Tipo (QUOTA_WARNING, EARLY_BURN_RATE, etc)"
        string severity "Severidad (WARNING, CRITICAL)"
        string message "Resumen descriptivo del evento"
        integer channels_notified "Cantidad de canales notificados"
        datetime timestamp "Fecha y hora del despacho"
    }

    sync_logs {
        integer id PK "Autoincremental primario"
        datetime timestamp "Marca de tiempo de la sincronización"
        string status "Resultado (SUCCESS, WARNING, ERROR)"
        integer terminals_count "Terminales procesadas"
        string message "Mensaje descriptivo o traza de error"
    }

    billing_cycles ||--o{ daily_usages : "contiene registros diarios"
    terminals ||--o{ billing_cycles : "asociado por service_line_number"
    telegram_bots ||--o{ telegram_channels : "asigna bot emisor a canal"
```

---

## 6. Motor de Alertas Inteligente

### 6.1. Reglas de Evaluación
El motor evalúa concurrentemente 4 categorías de eventos:
1. **Cuota Crítica (≥ 100%)**: Dispara alerta roja ante agotamiento total de cuota contratada.
2. **Cuota de Advertencia (≥ 80%)**: Dispara alerta preventiva antes de agotar los datos prioritarios.
3. **Alerta Temprana de Ritmo Acelerado (*Burn-Rate*)**:
   $$\text{Tasa Diaria} = \frac{\text{Consumo Acumulado (GB)}}{\text{Días Transcurridos del Ciclo}}$$
   $$\text{Días para Agotamiento} = \frac{\text{Cuota Restante (GB)}}{\text{Tasa Diaria}}$$
   Si el consumo supera el umbral configurado (ej: 60%) restando más de $X$ días en el ciclo (ej: 15 días) y los días para agotar la cuota son menores a los días restantes de ciclo, se genera una advertencia preventiva de sobreconsumo.
4. **Enlace Satelital Desconectado (*Offline*)**: Si la opción está habilitada en la configuración, notifica antenas sin reporte de RF.

### 6.2. Ventana de Cooldown Anti-Spam
Para evitar saturar los canales de guardia con mensajes repetitivos cada 15 minutos:
- Cada terminal registra en memoria la última fecha de notificación por tipo de alerta.
- No se vuelve a emitir la misma alerta a los canales generales hasta transcurrido el lapso de `cooldown_hours` (configurable entre 2 y 24 horas).

### 6.3. Despacho Multi-Bot y Pruebas con Alertas Reales
- **Ruteo Multi-Bot**: Cada canal de Telegram despacha sus mensajes a través de su bot asignado (`bot_id`). Si el bot específico no está disponible, conmuta limpiamente al bot predeterminado (`is_default`).
- **Prueba en Vivo con Alertas Reales (`test_channel_with_real_alerts`)**: Evalúa el estado de la flota al momento exacto de accionar el botón, omite la ventana de cooldown y despacha todas las alertas reales vigentes al canal seleccionado, garantizando una validación fidedigna de entrega.

---

## 7. Arquitectura de Componentes Frontend (Milicic UI)

La aplicación web está estructurada en componentes desacoplados diseñados bajo los lineamientos corporativos de Milicic S.A.:

- **[`Header.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/Header.jsx)**: Identidad de marca con isotipo oficial, indicador de estado de conexión upstream ECHO y accesos rápidos.
- **[`KpiCards.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/KpiCards.jsx)**: 4 tarjetas métricas directas: disponibilidad de flota, terminales online/offline, consumo mensual global y balance de cuotas.
- **[`FleetChart.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/FleetChart.jsx)**: Gráfico de área apilado con Recharts que ilustra la tendencia acumulada de 30 días con gradientes corporativos.
- **[`TerminalTable.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/TerminalTable.jsx)**: Tabla reactiva de inventario con ordenamiento multimétrica, badges de estado, indicadores de burn-rate y conmutador individual de alertas por antena.
- **[`AlertConfigView.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/AlertConfigView.jsx)**: Centro de configuración integral dividido en pestañas:
  1. *Telegram & Bots*: Alta de múltiples bots con validación `getMe`, gestión de canales y botones de prueba (`Probar Canal` y `Alertas Reales`).
  2. *Reglas de Alerta*: Parametrización de umbrales, detección de burn-rate, cooldown y cadencia del sincronizador.
  3. *Historial de Auditoría*: Bitácora de incidentes y notificaciones emitidas.
- **[`TerminalDetailModal.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/TerminalDetailModal.jsx)**: Modal de telemetría de RF en tiempo real (SNR, Azimuth, Elevación, Ping, Obstrucción) y desglose de consumo por día.
- **[`ActionConfirmModal.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/ActionConfirmModal.jsx)**: Modal de confirmación con doble validación de seguridad para operaciones de alto impacto (*Reboot* y *Data Opt-In*).
- **[`Toast.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/Toast.jsx)**: Sistema reactivo de avisos flotantes corporativos para confirmaciones y alertas de error.
