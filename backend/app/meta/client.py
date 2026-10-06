from typing import Any, Dict, List, Optional

import httpx

from app.meta.config import (
    META_API_VERSION,
    META_APP_ID,
    META_APP_SECRET,
    META_GRAPH_BASE_URL,
    META_HTTP_TIMEOUT_SECONDS,
    META_REDIRECT_URI,
)


class MetaAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class MetaClient:
    def __init__(self) -> None:
        self.timeout = httpx.Timeout(META_HTTP_TIMEOUT_SECONDS)

    def _request(
        self,
        method: str,
        path: str,
        token: str = "",
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = "Bearer {}".format(token)

        url = "{}{}".format(META_GRAPH_BASE_URL, path)

        try:
            with httpx.Client(
                timeout=self.timeout,
                follow_redirects=False,
            ) as client:
                response = client.request(
                    method,
                    url,
                    headers=headers,
                    params=params or {},
                )
        except httpx.RequestError as exc:
            raise MetaAPIError(
                "Meta API is temporarily unavailable",
                502,
            ) from exc

        try:
            body = response.json()
        except ValueError:
            body = {}

        if response.status_code >= 400:
            # Never return Meta's raw error body to the CRM client.
            raise MetaAPIError(
                "Meta API request failed",
                response.status_code,
            )

        return body

    def _paged_request(
        self,
        path: str,
        token: str,
        params: Optional[Dict[str, Any]] = None,
        max_pages: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Read a cursor-paginated Meta edge without following tokenized next URLs."""
        base_params = dict(params or {})
        base_params.setdefault("limit", 100)

        items: List[Dict[str, Any]] = []
        after: Optional[str] = None

        for _ in range(max_pages):
            page_params = dict(base_params)
            if after:
                page_params["after"] = after

            body = self._request(
                "GET",
                path,
                token=token,
                params=page_params,
            )
            page_items = body.get("data", [])
            if isinstance(page_items, list):
                items.extend(
                    item for item in page_items if isinstance(item, dict)
                )

            paging = body.get("paging") or {}
            cursors = paging.get("cursors") or {}
            next_after = cursors.get("after")
            if not next_after or next_after == after:
                break
            after = str(next_after)
        else:
            raise MetaAPIError(
                "Meta API pagination limit reached",
                502,
            )

        return items

    def exchange_code(self, code: str) -> Dict[str, Any]:
        initial = self._request(
            "GET",
            "/oauth/access_token",
            params={
                "client_id": META_APP_ID,
                "redirect_uri": META_REDIRECT_URI,
                "client_secret": META_APP_SECRET,
                "code": code,
            },
        )

        token = initial.get("access_token")
        if not token:
            raise MetaAPIError(
                "Meta did not return an access token",
                502,
            )

        initial_expires_in = initial.get("expires_in")
        if not initial_expires_in:
            return {"access_token": token, "expires_in": None}

        try:
            long_lived = self._request(
                "GET",
                "/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": META_APP_ID,
                    "client_secret": META_APP_SECRET,
                    "fb_exchange_token": token,
                },
            )
        except MetaAPIError as exc:
            if exc.status_code in {400, 422}:
                return {
                    "access_token": token,
                    "expires_in": initial_expires_in,
                }
            raise

        return {
            "access_token": long_lived.get("access_token") or token,
            "expires_in": long_lived.get("expires_in") or initial_expires_in,
        }

    def me(self, token: str) -> Dict[str, Any]:
        return self._request(
            "GET",
            "/me",
            token=token,
            params={"fields": "id,name"},
        )

    def permissions(self, token: str) -> List[str]:
        try:
            result = self._request(
                "GET",
                "/me/permissions",
                token=token,
                params={"fields": "permission,status"},
            )
        except MetaAPIError as exc:
            # Business Login for Business token types may not expose the
            # classic permissions edge. Do not swallow auth/server failures.
            if exc.status_code not in {400, 404}:
                raise
            return []

        granted: List[str] = []
        for item in result.get("data", []):
            if (
                isinstance(item, dict)
                and item.get("status") == "granted"
                and item.get("permission")
            ):
                granted.append(str(item["permission"]))

        return granted

    def businesses(self, token: str) -> List[Dict[str, Any]]:
        return self._paged_request(
            "/me/businesses",
            token,
            {"fields": "id,name"},
        )

    def pages(self, token: str) -> List[Dict[str, Any]]:
        return self._paged_request(
            "/me/accounts",
            token,
            {"fields": "id,name,category,access_token"},
        )

    def ad_accounts(self, token: str) -> List[Dict[str, Any]]:
        return self._paged_request(
            "/me/adaccounts",
            token,
            {
                "fields": (
                    "id,name,account_status,currency,"
                    "timezone_name,business{id,name}"
                )
            },
        )

    def campaigns(
        self,
        token: str,
        ad_account_id: str,
    ) -> List[Dict[str, Any]]:
        normalized = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        return self._paged_request(
            "/act_{}/campaigns".format(normalized),
            token,
            {
                "fields": (
                    "id,name,objective,status,effective_status,"
                    "start_time,stop_time,daily_budget,lifetime_budget"
                )
            },
        )

    def adsets(
        self,
        token: str,
        ad_account_id: str,
    ) -> List[Dict[str, Any]]:
        normalized = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        return self._paged_request(
            "/act_{}/adsets".format(normalized),
            token,
            {
                "fields": (
                    "id,campaign_id,name,status,optimization_goal,"
                    "billing_event,start_time,end_time"
                )
            },
        )

    def ads(
        self,
        token: str,
        ad_account_id: str,
    ) -> List[Dict[str, Any]]:
        normalized = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        return self._paged_request(
            "/act_{}/ads".format(normalized),
            token,
            {
                "fields": (
                    "id,name,status,adset_id,campaign_id,creative{id}"
                )
            },
        )

    def lead(
        self,
        token: str,
        leadgen_id: str,
    ) -> Dict[str, Any]:
        leadgen_id = str(leadgen_id or "").strip()
        if not leadgen_id:
            raise ValueError("Meta lead ID is required")

        return self._request(
            "GET",
            "/{}".format(leadgen_id),
            token=token,
            params={
                "fields": (
                    "id,created_time,field_data,ad_id,"
                    "adset_id,campaign_id,form_id"
                )
            },
        )

    def leadgen_forms(
        self,
        token: str,
        page_id: str,
    ) -> List[Dict[str, Any]]:
        page_id = str(page_id or "").strip()
        if not page_id:
            raise ValueError("Meta Page ID is required")

        return self._paged_request(
            "/{}/leadgen_forms".format(page_id),
            token,
            {
                "fields": (
                    "id,name,status,created_time,"
                    "updated_time,questions"
                )
            },
        )

    def insights(
        self,
        token: str,
        object_id: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        return self._paged_request(
            "/{}/insights".format(object_id),
            token,
            params or {
                "fields": (
                    "date_start,date_stop,spend,impressions,reach,"
                    "frequency,clicks,ctr,cpc,cpm,actions,"
                    "cost_per_action_type"
                )
            },
        )
