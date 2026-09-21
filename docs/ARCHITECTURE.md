# Arquitectura de Software y Diseño Técnico

Este documento detalla la arquitectura de software, los flujos de datos, el ciclo de vida de autenticación JWT y el modelo relacional del sistema **TSM Starlink Fleet & Usage Monitor**.

---

## 1. Visión General de la Arquitectura

El sistema implementa una arquitectura desacoplada y orientada a servicios, optimizada para proporcionar alta disponibilidad, baja latencia de respuesta y resiliencia ante cortes o degradaciones en la plataforma upstream de **TSM ECHO** (`https://echo.tsmpatagonia.com.ar/api`).

### Principios de Diseño:
1. **Desacoplamiento Operativo**: Los operadores y tableros de control leen exclusivamente desde una base de datos local SQLite de alta velocidad. Ninguna petición de lectura del frontend impacta de forma directa ni bloquea la API externa de ECHO.
2. **Ingesta Asíncrona Desatendida**: Un worker en segundo plano (`APScheduler`) se encarga periódicamente de sincronizar el estado de la flota, telemetría de radiofrecuencia (RF), ciclos de facturación y consumo diario.
3. **Autenticación Transparente con Auto-Recuperación**: El cliente HTTP interno gestiona el ciclo de vida del token JWT Bearer, detecta vencimientos mediante códigos `401 Unauthorized` y renueva la sesión automáticamente sin interrumpir la operación.
4. **Comandos Críticos con Doble Factor de Confirmación**: Las operaciones remotas de impacto operativo (*Reboot* y *Data Opt-In*) se ejecutan bajo demanda hacia el backoffice de Starlink a través de endpoints seguros y modales interactivos de confirmación.

---

## 2. Diagrama de Arquitectura y Flujo de Datos

```mermaid
flowchart TB
    subgraph ClientTier ["Capa de Presentación (Frontend SPA)"]
        Browser["Navegador Web (Operador / NOC)"]
        ReactApp["React 18 SPA (Vite + Tailwind CSS + Recharts)"]
        Browser <--> ReactApp
    end

    subgraph APITier ["Capa de Aplicación y API (FastAPI Backend)"]
        FastAPIServer["Servidor ASGI (Uvicorn + FastAPI)"]
        RouterTerminals["Router /api/terminals"]
        RouterHealth["Router /api/health"]
        SecurityLayer["Control de Confirmación & CORS"]
        
        FastAPIServer --> RouterTerminals
        FastAPIServer --> RouterHealth
        FastAPIServer --> SecurityLayer
    end

    subgraph ServiceTier ["Capa de Servicios y Segundo Plano"]
        Scheduler["Planificador Periódico (APScheduler 15m)"]
        SyncService["Servicio de Ingesta (SyncService)"]
        EchoClient["Cliente HTTP Asíncrono (EchoClient / httpx)"]
        TokenCache[("Caché JWT en Memoria")]

        Scheduler --> SyncService
        SyncService --> EchoClient
        RouterTerminals -->|Comandos Remotos| EchoClient
        EchoClient <--> TokenCache
    end

    subgraph DataTier ["Capa de Persistencia (SQLite / SQLAlchemy)"]
        DBEngine["Motor SQLAlchemy 2.0 (check_same_thread=False)"]
        TableTerminals[("Tabla terminals")]
        TableCycles[("Tabla billing_cycles")]
        TableUsages[("Tabla daily_usages")]
        TableLogs[("Tabla sync_logs")]

        DBEngine --- TableTerminals
        DBEngine --- TableCycles
        DBEngine --- TableUsages
        DBEngine --- TableLogs
    end

    subgraph UpstreamTier ["Servicios Externos (TSM ECHO)"]
        EchoAPI["https://echo.tsmpatagonia.com.ar/api"]
        AuthService["/login (JWT Auth)"]
        FleetService["/stDeviceLists (Inventario)"]
        TelemetryService["/stDeviceIdRouters/userterminal (RF)"]
        BillingService["/billingCycles & /dailydatausage"]
        BackofficeService["/backoffice/starlink (Reboot / Opt-In)"]

        EchoAPI --- AuthService
        EchoAPI --- FleetService
        EchoAPI --- TelemetryService
        EchoAPI --- BillingService
        EchoAPI --- BackofficeService
    end

    ReactApp -->|HTTP REST / JSON| FastAPIServer
    RouterTerminals -->|Lectura Consultas SQL| DBEngine
    RouterHealth -->|Verificación SELECT 1| DBEngine
    SyncService -->|Escritura Transaccional| DBEngine
    EchoClient -->|HTTPS Bearer JWT| EchoAPI
```

---

## 3. Ciclo de Vida del JWT y Estrategia de Autenticación

El acceso a la API interna de TSM ECHO requiere un token JSON Web Token (JWT) provisto en el encabezado HTTP `Authorization: Bearer <token>`.

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
- **Respuesta**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "id": 44,
    "perfil_id": 4,
    "grupo_id": 3
  }
  ```
El token, el `user_id`, el `perfil_id` y el `grupo_id` se almacenan en el estado interno del cliente en memoria.

### 3.2. Manejo Automático de Errores 401 y Re-Login Transparente
Dado que los tokens JWT de ECHO tienen una ventana de expiración definida, el método interno `_request()` intercepta las respuestas HTTP:

```mermaid
sequenceDiagram
    autonumber
    participant S as SyncService / Endpoint
    participant C as EchoClient (_request)
    participant E as TSM ECHO API

    S->>C: Ejecutar petición GET /stDeviceLists
    C->>E: GET /stDeviceLists con Bearer Token actual
    alt Token Válido (HTTP 200)
        E-->>C: 200 OK (Datos de Flota)
        C-->>S: Retorna JSON
    else Token Expirado o Inválido (HTTP 401 Unauthorized)
        E-->>C: 401 Unauthorized
        Note over C: Interceptor detecta 401
        C->>E: POST /login (Renovación de credenciales)
        alt Login Exitoso
            E-->>C: 200 OK (Nuevo Bearer Token)
            Note over C: Actualiza token en memoria
            C->>E: Reintenta petición original con nuevo Token
            E-->>C: 200 OK (Datos de Flota)
            C-->>S: Retorna JSON exitoso
        else Fallo Crítico de Login
            E-->>C: 401 / 500 Error
            C-->>S: Retorna None (Registra error en logs)
        end
    end
```

### 3.3. Modo Contingencia / Demo
Si las variables de entorno `ECHO_EMAIL` y `ECHO_PASSWORD` no están definidas o la red externa es inalcanzable:
- `EchoClient.has_credentials` evalúa a `False`.
- El sistema no detiene su arranque ni genera excepciones no controladas.
- En la primera ejecución, [`SyncService`](file:///c:/antigravity/tsmpatagonia/backend/app/services/sync_service.py) inicializa una flota de demostración con 8 terminales georreferenciadas y 20 días de consumo simulado.
- Si ya existían datos en la base local, se preserva el último snapshot disponible y el endpoint `/api/health` reporta estado `degraded` con advertencia explicativa.
- Tan pronto se configuran credenciales válidas, el sistema detecta terminales reales en `/stDeviceLists`, purga los datos simulados y consolida la flota en vivo.

---

## 4. Estrategia de Ingesta del Worker (`APScheduler`)

Para evitar la saturación de los servidores de TSM ECHO y proveer tiempos de respuesta inferiores a 10 ms en el frontend, se implementa una tarea desatendida planificada.

### 4.1. Configuración del Scheduler
- **Librería**: `apscheduler.schedulers.asyncio.AsyncIOScheduler`
- **Disparador**: `IntervalTrigger(minutes=settings.SYNC_INTERVAL_MINUTES)` (por defecto cada 15 minutos).
- **Ciclo de Vida (Lifespan)**:
  1. Al iniciar la aplicación FastAPI (`backend/app/main.py`), se arranca el scheduler.
  2. Se programa un disparo inicial inmediato (`run_sync`) para garantizar que la base de datos esté actualizada desde el arranque.
  3. Al detener el servidor (`shutdown`), el scheduler se cierra de forma ordenada mediante `scheduler.shutdown()`.

### 4.2. Algoritmo de Sincronización Jerárquica
Cada ciclo de ingesta ejecuta el siguiente orden de operaciones:

1. **Consulta de Inventario Global**:
   - Invoca `GET /stDeviceLists`. Si el perfil del usuario no posee acceso global (Perfil 4), utiliza el fallback `GET /stDeviceLists/user/{user_id}`.
   - Extrae la lista de `deviceId`, `kitSerial`, `nickname`, `serviceLineNumber`, `isOnline` y `downlink`.
2. **Saneamiento de Base de Datos**:
   - Si se reciben identificadores reales, se eliminan los registros huérfanos o de demostración que no coincidan con la flota reportada.
3. **Telemetría RF por Terminal**:
   - Para cada enlace, invoca `GET /stDeviceIdRouters/userterminal/{clean_id}` (donde `clean_id` es el UUID sin el prefijo `ut`).
   - Extrae métricas físicas: Throughput de bajada y subida en Mbps (convirtiendo desde bps), latencia de ping, calidad de señal (%), porcentaje de tiempo obstruido, uptime acumulado y celda geográfica H3.
4. **Ciclos de Facturación por Service Line**:
   - Con el `serviceLineNumber`, consulta `GET /billingCycles/{serviceLineNumber}`.
   - Identifica el ciclo activo (último elemento del arreglo), calculando cuota contratada en GB (`DBtotalAmountGB`), consumo actual (`DBconsumedAmountGB`), porcentaje de utilización y estados de alarma (`NORMAL`, `80` o `100`).
5. **Consumo Diario del Ciclo**:
   - Con el `billingCycle.id` activo, consulta `GET /dailydatausage/{billingCycleId}`.
   - Inserta o actualiza los consumos por fecha (`YYYY-MM-DD`), desagregando:
     * `priority_gb` (Datos Prioritarios)
     * `opt_in_priority_gb` (Datos Prioritarios Excedentes Opt-In)
     * `standard_gb` (Datos Estándar Ilimitados)
     * `non_bill_gb` (Tráfico no facturable)
     * `total_gb` (Suma total del día)
6. **Auditoría y Transaccionalidad**:
   - Se ejecuta `db.commit()` tras procesar exitosamente la flota.
   - Se registra una entrada en la tabla `sync_logs` con el total de terminales sincronizadas, marca de tiempo y estado (`SUCCESS` o `ERROR`).
   - En caso de excepción, se invoca `db.rollback()` para garantizar la consistencia relacional.

---

## 5. Modelo de Datos Relacional (SQLite / SQLAlchemy)

La persistencia se implementa sobre SQLite utilizando SQLAlchemy 2.0 con soporte multihilo (`check_same_thread=False`).

### 5.1. Diagrama Entidad-Relación (ER)

```mermaid
erDiagram
    terminals {
        string id PK "Identificador único (ej: ut01000000-...)"
        string device_id "Identificador del dispositivo con prefijo ut"
        string raw_device_id "UUID limpio sin prefijo ut"
        string nickname "Nombre asignado o kitSerial"
        string kit_serial "Número de serie del kit Starlink"
        string service_line_number FK "Número de línea de servicio (ej: SL-...)"
        string account_name "Razón social del cliente o cuenta"
        boolean is_online "Estado de conectividad del enlace"
        float downlink_mbps "Ancho de banda actual de bajada"
        float uplink_mbps "Ancho de banda actual de subida"
        float ping_ms "Latencia de ida y vuelta promedio"
        float drop_rate "Tasa de paquetes descartados"
        float obstruction_percent "Porcentaje de visión satelital obstruida"
        float signal_quality "Calidad del haz de radiofrecuencia (0-100%)"
        integer uptime_seconds "Tiempo de funcionamiento continuo en segundos"
        string dish_model "Modelo de antena (ej: Flat High Performance)"
        string dish_serial "Número de serie de la antena"
        boolean has_public_ip "Indica si posee IP pública enrutable"
        string router_id "Identificador del router asociado"
        boolean wifi_bypassed "Modo bypass / puente del router Wi-Fi"
        float latitude "Coordenada de latitud geográfica"
        float longitude "Coordenada de longitud geográfica"
        string h3_cell_id "Índice geoespacial H3 de Uber"
        boolean is_alert "Bandera de alerta activa"
        string consumed_alarm "Nivel de alarma de cuota (NORMAL, 80, 100)"
        string active_alerts_json "Detalle JSON de alarmas"
        datetime updated_at "Fecha y hora de última actualización"
    }

    billing_cycles {
        integer id PK "Identificador único de ciclo provisto por ECHO"
        string service_line_number "Línea de servicio asociada (indexada)"
        string start_date "Fecha inicio ciclo (ISO-8601)"
        string end_date "Fecha fin ciclo (ISO-8601)"
        float total_amount_gb "Cuota mensual total contratada en GB"
        float consumed_amount_gb "Consumo acumulado a la fecha en GB"
        float consumed_percent "Porcentaje de consumo de la cuota"
        string consumed_alarm "Estado de alarma (NORMAL, 80, 100)"
        string consumed_status "Estado de facturación (ACTIVE, OVERAGE)"
        string currency "Moneda del contrato (ej: USD)"
        boolean is_active "Indica si es el ciclo en curso"
        datetime updated_at "Fecha y hora de actualización"
    }

    daily_usages {
        integer id PK "Autoincremental primario"
        integer billing_cycle_id FK "Clave foránea hacia billing_cycles.id"
        string service_line_number "Línea de servicio asociada"
        string date "Fecha del consumo (formato YYYY-MM-DD)"
        float priority_gb "Consumo en datos prioritarios (GB)"
        float opt_in_priority_gb "Consumo excedente con cargo (GB)"
        float standard_gb "Consumo en datos estándar (GB)"
        float non_bill_gb "Tráfico de gestión no facturable (GB)"
        float total_gb "Consumo total acumulado en el día (GB)"
    }

    sync_logs {
        integer id PK "Autoincremental primario"
        datetime timestamp "Marca de tiempo de la sincronización"
        string status "Resultado de la ingesta (SUCCESS, WARNING, ERROR)"
        integer terminals_count "Cantidad de terminales procesadas"
        string message "Mensaje descriptivo o traza de error"
    }

    billing_cycles ||--o{ daily_usages : "contiene registros diarios (CASCADE DELETE)"
    terminals ||--o{ billing_cycles : "asociado por service_line_number"
```

### 5.2. Detalle de Tablas y Restricciones

#### Tabla `terminals`
- Almacena el inventario de antenas, su estado operacional y métricas de RF.
- **Índices**: `id` (PK), `device_id`, `service_line_number`.
- Permite búsquedas textuales optimizadas (`ilike`) por `nickname`, `kit_serial`, `service_line_number` y `account_name`.

#### Tabla `billing_cycles`
- Representa los períodos de facturación de cada línea de servicio.
- **Índices**: `id` (PK asignada por ECHO), `service_line_number`.
- Relación uno a muchos con `daily_usages` con eliminación en cascada (`ondelete="CASCADE"`).

#### Tabla `daily_usages`
- Desglose diario de datos transmitidos por tipo de servicio.
- **Índices**: `id` (PK), `billing_cycle_id` (FK), `service_line_number`, `date`.
- **Restricción de Unicidad Compuesta**: `Index("ix_cycle_date", "billing_cycle_id", "date", unique=True)` que previene duplicación de métricas al re-sincronizar el mismo día.

#### Tabla `sync_logs`
- Bitácora de auditoría para supervisar la salud del worker en segundo plano y diagnosticar problemas de conectividad upstream.
- Permite al frontend determinar con precisión cuándo fue el último refresco exitoso.

---

## 6. Sistema de Diseño Milicic UI & Arquitectura de Componentes

La capa de frontend implementa el sistema de diseño corporativo **Milicic UI** ([`.agent/skills/diseno-UI-milicic/SKILL.md`](file:///c:/antigravity/tsmpatagonia/.agent/skills/diseno-UI-milicic/SKILL.md)):

### 6.1. Tokens y Variables Visuales
- **Canvas Base (`#0F141A`)**: Fondo oscuro profundo con tinte pizarra.
- **Superficie de Tarjetas (`#1A222B`)**: Contenedores elevados con bordes de contraste `#2A3441`.
- **Naranja Milicic (`#F39200`)**: Color primario para botones de acción, acentos de selección y líneas de tendencia destacadas.
- **Estados Operativos**:
  - `Activo / Online`: Verde esmeralda `#10B981` con pulso lumínico.
  - `Offline / Crítico`: Rojo rubí `#EF4444`.
  - `Advertencia / Cuota > 80%`: Ámbar `#F59E0B`.

### 6.2. Componentes Desacoplados
- **[`MilicicLogo.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/MilicicLogo.jsx)**: Componente corporativo optimizado para renderizar el isotipo de franjas y texto institucional sin artefactos ni degradación por escalado.
- **[`Header.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/Header.jsx)**: Header corporativo con badge de estado del upstream ECHO y botón de sincronización manual interactivo con spinner.
- **[`KpiCards.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/KpiCards.jsx)**: 4 métricas directas: Disponibilidad de flota, Terminales online/offline, Consumo global en GB y Estado de cuotas prioritarias.
- **[`FleetChart.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/FleetChart.jsx)**: Gráfico Recharts con gradientes de color corporativos Milicic, tooltips personalizados y formato de fechas dinámico.
- **[`TerminalTable.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/TerminalTable.jsx)**: Tabla de inventario de alto rendimiento con barra de búsqueda reactiva y filtros por estado.
- **[`TerminalDetailModal.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/TerminalDetailModal.jsx)**: Ficha técnica emergente con métricas de RF en vivo (SNR, Azimuth, Elevación, Ping) e histograma de consumo diario.
- **[`ActionConfirmModal.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/ActionConfirmModal.jsx)**: Modal de doble confirmación para salvaguardar acciones críticas (*Reboot* y *Data Opt-In*).
- **[`Toast.jsx`](file:///c:/antigravity/tsmpatagonia/frontend/src/components/Toast.jsx)**: Notificaciones flotantes no invasivas para confirmación de comandos y avisos de red.

---

## 7. Arquitectura de Red y Enrutamiento Dokploy + Traefik

El sistema en producción opera en un entorno contenerizado administrado por Dokploy:

1. **Ingress Traefik Dinámico**: Traefik escucha peticiones en los puertos 80 y 443 del host. Mediante su proveedor de Docker conectado a `/var/run/docker.sock`, detecta automáticamente el contenedor `tsm_starlink_frontend` a través de sus etiquetas:
   - `traefik.enable=true`
   - `traefik.http.routers.starlink-frontend.rule=Host('starlink.milicic.local')`
   - `traefik.docker.network=dokploy-network`
2. **Red Interna `dokploy-network`**: Permite la comunicación segura y directa entre Traefik y el frontend sin exponer puertos al sistema operativo anfitrión.
3. **Servidor Web Nginx Interno**: El contenedor de frontend ejecuta Nginx en el puerto 80, sirviendo los activos estáticos compilados de React e implementando un proxy inverso para la ruta `/api/` hacia `http://backend:8000/api/`.
4. **Persistencia Transaccional**: El backend monta el volumen nombrado de Docker `starlink_data` en `/app/data`, asegurando que la base de datos `starlink_dashboard.db` conserve los históricos aun cuando los contenedores se reconstruyan o actualicen.

