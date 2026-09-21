import httpx
import logging
from typing import Optional, Dict, Any, List
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class EchoClient:
    def __init__(self):
        self._token: Optional[str] = None
        self._user_id: Optional[int] = None
        self._perfil_id: Optional[int] = None
        self._grupo_id: Optional[int] = None
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def base_url(self) -> str:
        return settings.ECHO_BASE_URL.rstrip("/")

    @property
    def email(self) -> str:
        return settings.ECHO_EMAIL

    @property
    def password(self) -> str:
        return settings.ECHO_PASSWORD

    @property
    def user_id(self) -> Optional[int]:
        return self._user_id

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @property
    def has_credentials(self) -> bool:
        return bool(self.email and self.password)

    async def login(self) -> Optional[str]:
        """Authenticate with ECHO and cache JWT Bearer token"""
        if not self.has_credentials:
            logger.warning("ECHO credentials not provided in environment.")
            return None

        client = await self.get_client()
        try:
            url = f"{self.base_url}/login"
            resp = await client.post(
                url,
                json={"email": self.email, "password": self.password},
                headers={"Content-Type": "application/json", "Accept": "application/json"}
            )
            if resp.status_code == 200:
                data = resp.json()
                self._token = data.get("token")
                self._user_id = data.get("id")
                self._perfil_id = data.get("perfil_id")
                self._grupo_id = data.get("grupo_id")
                logger.info(f"Successfully authenticated to TSM ECHO for user: {self.email} (ID: {self._user_id}, Perfil: {self._perfil_id})")
                return self._token
            else:
                logger.error(f"ECHO authentication failed (HTTP {resp.status_code}): {resp.text}")
                return None
        except Exception as e:
            logger.error(f"Error connecting to ECHO during login: {e}")
            return None

    async def _request(self, method: str, path: str, **kwargs) -> Optional[Any]:
        """Execute request with transparent JWT and automatic retry on 401"""
        if not self._token and self.has_credentials:
            await self.login()

        client = await self.get_client()
        headers = kwargs.pop("headers", {})
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        headers["Accept"] = "application/json"

        url = f"{self.base_url}/{path.lstrip('/')}"

        try:
            resp = await client.request(method, url, headers=headers, **kwargs)
            
            # If 401, refresh token once and retry
            if resp.status_code == 401 and self.has_credentials:
                logger.info("Received 401 from ECHO. Refreshing session token...")
                new_token = await self.login()
                if new_token:
                    headers["Authorization"] = f"Bearer {new_token}"
                    resp = await client.request(method, url, headers=headers, **kwargs)

            if 200 <= resp.status_code < 300:
                return resp.json()
            else:
                logger.warning(f"ECHO API request failed [{method} {path}]: HTTP {resp.status_code} - {resp.text}")
                return None
        except Exception as e:
            logger.error(f"Network error communicating with ECHO [{method} {path}]: {e}")
            return None

    # --- ECHO API Operations ---

    async def get_device_lists(self) -> List[Dict[str, Any]]:
        """Fetch all Starlink terminals / devices: GET /stDeviceLists"""
        res = await self._request("GET", "/stDeviceLists")
        if (not res or not isinstance(res, list)) and self._user_id:
            res = await self._request("GET", f"/stDeviceLists/user/{self._user_id}")
        return res if isinstance(res, list) else []

    async def get_user_terminal_telemetry(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Fetch real-time telemetry for a terminal: GET /stDeviceIdRouters/userterminal/{deviceId}"""
        clean_id = device_id.removeprefix("ut")
        res = await self._request("GET", f"/stDeviceIdRouters/userterminal/{clean_id}")
        if isinstance(res, list) and len(res) > 0:
            return res[0]
        elif isinstance(res, dict):
            return res
        return None

    async def get_billing_cycles(self, service_line_number: str) -> List[Dict[str, Any]]:
        """Fetch billing cycles for a service line: GET /billingCycles/{serviceLineNumber}"""
        res = await self._request("GET", f"/billingCycles/{service_line_number}")
        return res if isinstance(res, list) else []

    async def get_daily_data_usage(self, billing_cycle_id: int) -> List[Dict[str, Any]]:
        """Fetch daily data consumption breakdown: GET /dailydatausage/{billingCycleId}"""
        res = await self._request("GET", f"/dailydatausage/{billing_cycle_id}")
        return res if isinstance(res, list) else []

    async def get_data_blocks(self, billing_cycle_id: int) -> List[Dict[str, Any]]:
        """Fetch data blocks and quota status: GET /datablocks/{billingCycleId}"""
        res = await self._request("GET", f"/datablocks/{billing_cycle_id}")
        return res if isinstance(res, list) else []

    async def reboot_terminal(self, device_id: str) -> Dict[str, Any]:
        """Trigger remote terminal reboot: POST /backoffice/starlink/user-terminals/{deviceId}/reboot"""
        res = await self._request("POST", f"/backoffice/starlink/user-terminals/{device_id}/reboot", json={})
        return res or {"message": "Reboot request submitted"}

    async def set_data_opt_in(self, service_line_number: str, enabled: bool = True) -> Dict[str, Any]:
        """Toggle priority overage opt-in"""
        action = "data-opt-in" if enabled else "data-opt-out"
        res = await self._request("POST", f"/backoffice/starlink/service-lines/{service_line_number}/{action}", json={})
        return res or {"message": f"Opt-in set to {enabled}"}

echo_client = EchoClient()
