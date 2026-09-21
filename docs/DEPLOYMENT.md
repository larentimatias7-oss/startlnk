# Guía de Despliegue en Producción, Seguridad y Operaciones

Esta guía describe los procedimientos operativos estándar (SOP) para poner en producción, asegurar, monitorear y respaldar la plataforma **Starlink Fleet & Usage Monitor (Milicic / TSM Patagonia)**.

---

## 📋 Tabla de Contenidos

- [1. Arquitectura de Despliegue en Producción](#1-arquitectura-de-despliegue-en-producción)
- [2. Despliegue en Dokploy con Traefik v3 (Método Principal)](#2-despliegue-en-dokploy-con-traefik-v3-método-principal)
  - [2.1. Configuración de docker-compose.yml](#21-configuración-de-docker-composeyml)
  - [2.2. Enrutamiento Traefik y Bypass de Validación DNS](#22-enrutamiento-traefik-y-bypass-de-validación-dns)
  - [2.3. Gestión de Secretos en Dokploy](#23-gestión-de-secretos-en-dokploy)
- [3. Pipeline de Integración Continua (Gitea Actions)](#3-pipeline-de-integración-continua-gitea-actions)
  - [3.1. Definición del Workflow ci.yaml](#31-definición-del-workflow-ciyaml)
  - [3.2. Configuración del Runner Self-Hosted (dokploy-runner)](#32-configuración-del-runner-self-hosted-dokploy-runner)
- [4. Despliegue Standalone Alternativo (Docker Compose & Nginx Tradicional)](#4-despliegue-standalone-alternativo-docker-compose--nginx-tradicional)
- [5. Estrategia de Backup y Recuperación de SQLite](#5-estrategia-de-backup-y-recuperación-de-sqlite)
  - [5.1. Respaldo en Caliente con VACUUM INTO](#51-respaldo-en-caliente-con-vacuum-into)
  - [5.2. Script Automatizado para Linux (Cron)](#52-script-automatizado-para-linux-cron)
  - [5.3. Script Automatizado para Windows (PowerShell)](#53-script-automatizado-para-windows-powershell)
  - [5.4. Procedimiento de Restauración (Disaster Recovery)](#54-procedimiento-de-restauración-disaster-recovery)
- [6. Rotación Segura de Credenciales y Secretos](#6-rotación-segura-de-credenciales-y-secretos)
- [7. Supervisión y Healthchecks](#7-supervisión-y-healthchecks)

---

## 1. Arquitectura de Despliegue en Producción

En el entorno productivo de **Milicic / TSM Patagonia**, la aplicación se orquesta sobre la plataforma PaaS **Dokploy**, utilizando **Traefik v3** como Ingress Controller y proxy inverso dinámico:

```mermaid
graph TD
    Client["Navegador Operador / NOC\nhttp://starlink.milicic.local"]
    
    subgraph Host ["Servidor Dokploy (172.27.210.154 / 10.0.1.3)"]
        subgraph Ingress ["Traefik v3 (Dokploy Ingress Controller)"]
            Traefik["Traefik Proxy (Puerto 80 / 443)\nDetecta contenedor por labels de Docker"]
        end

        subgraph DockerNet ["Red Compartida: dokploy-network"]
            Frontend["tsm_starlink_frontend (Nginx)\nPuerto interno 80\nSirve React SPA + Proxy /api/"]
            Backend["tsm_starlink_backend (FastAPI / Uvicorn)\nPuerto interno 8000\nWorker APScheduler 15m"]
        end

        subgraph Storage ["Volumen Persistente"]
            DBVolume[("Volumen Docker: starlink_data\n/app/data/starlink_dashboard.db")]
        end
    end

    subgraph CI_CD ["Infraestructura Gitea"]
        GiteaServer["Gitea (172.27.210.154:3001)"]
        Runner["Gitea Runner (dokploy-runner)"]
        GiteaServer -->|Trigger push main| Runner
    end

    subgraph Upstream ["Plataforma TSM ECHO"]
        EchoAPI["https://echo.tsmpatagonia.com.ar/api"]
    end

    Client -->|HTTP Host: starlink.milicic.local| Traefik
    Traefik -->|Proxy a frontend:80| Frontend
    Frontend -->|Proxy pass /api/ a backend:8000| Backend
    Backend --> DBVolume
    Backend -->|HTTPS Bearer JWT Outbound| EchoAPI
    Runner -->|CI Build & Tests| GiteaServer
```

---

## 2. Despliegue en Dokploy con Traefik v3 (Método Principal)

### 2.1. Configuración de `docker-compose.yml`

El archivo [`docker-compose.yml`](file:///c:/antigravity/tsmpatagonia/docker-compose.yml) en la raíz del repositorio está optimizado para Dokploy:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: tsm_starlink_backend
    restart: unless-stopped
    expose:
      - "8000"
    env_file:
      - .env
    volumes:
      - starlink_data:/app/data
    environment:
      - DATABASE_URL=sqlite:////app/data/starlink_dashboard.db
    networks:
      - dokploy-network

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: tsm_starlink_frontend
    restart: unless-stopped
    expose:
      - "80"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.starlink-frontend.rule=Host(`starlink.milicic.local`)"
      - "traefik.http.services.starlink-frontend.loadbalancer.server.port=80"
      - "traefik.docker.network=dokploy-network"
    depends_on:
      - backend
    networks:
      - dokploy-network

volumes:
  starlink_data:

networks:
  dokploy-network:
    external: true
```

### 2.2. Enrutamiento Traefik y Bypass de Validación DNS

> [!IMPORTANT]
> **Resolución del error de validación de dominios en Dokploy UI**:
> En entornos locales o corporativos (redes privadas, VPN o IPs NAT como `172.27.210.154`), la pestaña **Domains** de la interfaz web de Dokploy ejecuta una verificación DNS estricta contra las IPs detectadas en `eth0` (`10.0.1.3` / `179.60.27.226`). Si hay una discrepancia, Dokploy muestra:
> `Error: Domain resolves to 172.27.210.154 but should point to 179.60.27.226 or 10.0.1.3`
> y bloquea el switch de activación (dejando la ruta apagada con error 404).
>
> **Solución definitiva aplicada:**
> No se utiliza la pestaña de dominios de Dokploy. Al configurar directamente las etiquetas `labels` de Traefik en `docker-compose.yml`, Traefik detecta el contenedor inmediatamente a través de `/var/run/docker.sock` y activa la regla de enrutamiento para `starlink.milicic.local` sin ninguna interferencia de la interfaz web.

### 2.3. Gestión de Secretos en Dokploy

En Dokploy, las variables de entorno de producción no se commitean en Git. Se configuran directamente en la pestaña **Environment Variables** de la aplicación:

```env
ECHO_BASE_URL=https://echo.tsmpatagonia.com.ar/api
ECHO_EMAIL=it.infra@milicic.com.ar
ECHO_PASSWORD=ClaveDeProduccionSuperSegura2026!
SYNC_INTERVAL_MINUTES=15
DATABASE_URL=sqlite:////app/data/starlink_dashboard.db
HOST=0.0.0.0
PORT=8000
```

---

## 3. Pipeline de Integración Continua (Gitea Actions)

### 3.1. Definición del Workflow `ci.yaml`

El archivo [`.gitea/workflows/ci.yaml`](file:///c:/antigravity/tsmpatagonia/.gitea/workflows/ci.yaml) automatiza la validación técnica en cada push:

```yaml
name: Build & Test Fleet Monitor
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  backend-check:
    name: Test FastAPI Backend
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          fetch-depth: 1

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt

      - name: Run Backend Integration Tests
        run: |
          python backend/test_backend.py
          python backend/test_api_endpoints.py

  frontend-build:
    name: Build React Frontend
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          fetch-depth: 1

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies & Build
        run: |
          cd frontend
          npm ci
          npm run build
```

### 3.2. Configuración del Runner Self-Hosted (`dokploy-runner`)

El runner ejecuta los jobs en contenedores Docker efímeros. Su estado `Inactivo` (o `Idle`) en Gitea indica que se encuentra en espera listo para procesar jobs.

---

## 4. Despliegue Standalone Alternativo (Docker Compose & Nginx Tradicional)

### Opción A: Servidor Nginx con Let's Encrypt (Certbot)

Configuración recomendada para `/etc/nginx/sites-available/starlink.tsmpatagonia.com.ar`:

```nginx
# Redirección HTTP a HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name starlink.tsmpatagonia.com.ar;
    return 301 https://$host$request_uri;
}

# Servidor HTTPS Productivo
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name starlink.tsmpatagonia.com.ar;

    # Certificados TLS administrados por Certbot
    ssl_certificate /etc/letsencrypt/live/starlink.tsmpatagonia.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/starlink.tsmpatagonia.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Encabezados de Seguridad
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:8000;" always;

    # Compresión Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Enrutamiento hacia el Frontend SPA (Contenedor Nginx en puerto 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Enrutamiento directo al Backend API (FastAPI en puerto 8000)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

### Opción B: Traefik v3 con Generación Automática de Certificados

Si utilizas Traefik en tu cluster Docker, añade las siguientes etiquetas en el servicio `frontend`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.starlink.rule=Host(`starlink.tsmpatagonia.com.ar`)"
  - "traefik.http.routers.starlink.entrypoints=websecure"
  - "traefik.http.routers.starlink.tls.certresolver=letsencrypt"
  - "traefik.http.services.starlink.loadbalancer.server.port=80"
```

---

## 4. Estrategia de Backup y Recuperación de SQLite

> [!CAUTION]
> **Nunca utilices un simple comando de copia (`cp` o `copy`)** sobre un archivo SQLite en un sistema de producción mientras la aplicación está escribiendo. Esto puede generar una copia corrupta o inconsistente si coincide con una transacción en curso o con el diario Write-Ahead Logging (WAL).

### 4.1. Respaldo en Caliente con `VACUUM INTO`
SQLite incorpora la instrucción atómica `VACUUM INTO 'ruta_destino.db'`, la cual crea una copia de seguridad compactada, consistente y libre de locks sin necesidad de detener el servicio FastAPI.

### 4.2. Script Automatizado para Linux (Cron)

Crea el archivo `/opt/tsm_starlink/scripts/backup_sqlite.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/tsm_starlink"
DATE_STR=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/starlink_db_${DATE_STR}.db"
CONTAINER_NAME="tsm-starlink-backend"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Iniciando backup en caliente de SQLite..."

# Ejecución de VACUUM INTO dentro del contenedor
docker exec "${CONTAINER_NAME}" python -c "
import sqlite3
con = sqlite3.connect('/data/starlink_dashboard.db')
con.execute(\"VACUUM INTO '/data/backup_temp.db'\")
con.close()
"

# Mover el archivo al almacenamiento de host y comprimir
mv ./data/backup_temp.db "${BACKUP_FILE}"
gzip -9 "${BACKUP_FILE}"

echo "[$(date)] Backup completado exitosamente: ${BACKUP_FILE}.gz"

# Política de retención: conservar backups de los últimos 14 días
find "${BACKUP_DIR}" -name "starlink_db_*.db.gz" -type f -mtime +14 -delete
echo "[$(date)] Tareas de limpieza de backups antiguos concluidas."
```

Configuración en Crontab (`crontab -e`):
```cron
# Ejecutar backup diario a las 02:00 AM
0 2 * * * /opt/tsm_starlink/scripts/backup_sqlite.sh >> /var/log/tsm_backup.log 2>&1
```

### 4.3. Script Automatizado para Windows (PowerShell)

Para entornos Windows Server, crea `backup_sqlite.ps1`:

```powershell
$BackupDir = "C:\Backups\TSM_Starlink"
$DateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = "$BackupDir\starlink_db_$DateStr.db"
$DbPath = "c:\antigravity\tsmpatagonia\starlink_dashboard.db"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "Ejecutando backup en caliente con VACUUM INTO..."
$Sql = "VACUUM INTO '$BackupPath';"
& sqlite3.exe $DbPath $Sql

if (Test-Path $BackupPath) {
    Write-Host "Backup generado correctamente en $BackupPath"
    # Eliminar copias con más de 14 días
    Get-ChildItem -Path $BackupDir -Filter "*.db" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
} else {
    Write-Error "Fallo al generar el backup de SQLite."
}
```

### 4.4. Procedimiento de Restauración (Disaster Recovery)

En caso de requerir restauración por corrupción de datos o migración de servidor:

1. **Detener el backend**:
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   ```
2. **Reemplazar el archivo de base de datos**:
   ```bash
   # Si el backup está comprimido:
   gunzip -c /var/backups/tsm_starlink/starlink_db_20260921_020000.db.gz > ./data/starlink_dashboard.db
   ```
3. **Verificar la integridad del archivo restaurado**:
   ```bash
   sqlite3 ./data/starlink_dashboard.db "PRAGMA integrity_check;"
   # Debe retornar: ok
   ```
4. **Reiniciar el backend**:
   ```bash
   docker compose -f docker-compose.prod.yml start backend
   ```
5. **Verificar el endpoint de salud**:
   ```bash
   curl http://localhost:8000/api/health
   ```

---

## 5. Rotación Segura de Credenciales y Secretos

Cuando se actualice la contraseña de la cuenta de TSM ECHO (`ECHO_PASSWORD`):

1. **Actualizar el archivo `.env`**:
   Edita `.env` en el servidor con el nuevo valor de `ECHO_PASSWORD`.
2. **Aplicar los cambios sin caída de servicio**:
   ```bash
   # Recrea únicamente el contenedor backend aplicando las nuevas variables:
   docker compose -f docker-compose.prod.yml up -d --no-deps backend
   ```
3. **Comprobar la re-autenticación**:
   Inspecciona los logs del backend para confirmar el nuevo login exitoso:
   ```bash
   docker compose logs backend | grep "Successfully authenticated to TSM ECHO"
   ```
4. **Disparar una sincronización de verificación**:
   ```bash
   curl -X POST http://localhost:8000/api/terminals/sync
   ```

---

## 6. Supervisión y Healthchecks

Para integrar el dashboard con herramientas de monitoreo externas (Zabbix, Prometheus, Datadog, Uptime Kuma):

- **URL de Verificación**: `https://starlink.tsmpatagonia.com.ar/api/health`
- **Condición de Alerta**:
  * Código HTTP distinto de `200`.
  * Clave JSON `"status"` diferente de `"online"`.
  * Clave JSON `"database_connected"` igual a `false`.
  * Clave JSON `"last_sync.status"` igual a `"ERROR"`.
- **Métricas Clave a Vigilar**:
  * Uso de CPU y memoria del contenedor `tsm-starlink-backend`.
  * Tamaño en disco de `starlink_dashboard.db` (crecimiento esperado: ~5 MB / año).
  * Latencia de respuesta de los endpoints (`< 50 ms`).
