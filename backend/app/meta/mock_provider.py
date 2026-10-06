from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.meta.provider import MetaProvider


MOCK_BUSINESSES = [
    {
        "id": "100000000000001",
        "name": "Tynato Demo Business",
    },
]

MOCK_PAGES = [
    {
        "id": "200000000000001",
        "name": "Tynato Demo Page",
        "category": "Marketing Agency",
        "access_token": "mock-page-token-1",
    },
]

MOCK_AD_ACCOUNTS = [
    {
        "id": "act_300000000000001",
        "name": "Tynato Demo Ads - India",
        "account_status": 1,
        "currency": "INR",
        "timezone_name": "Asia/Kolkata",
        "business": {"id": "100000000000001", "name": "Tynato Demo Business"},
    },
    {
        "id": "act_300000000000002",
        "name": "Tynato Demo Ads - International",
        "account_status": 1,
        "currency": "USD",
        "timezone_name": "America/New_York",
        "business": {"id": "100000000000001", "name": "Tynato Demo Business"},
    },
]

MOCK_CAMPAIGNS: Dict[str, List[Dict[str, Any]]] = {
    "300000000000001": [
        {
            "id": "400000000000001",
            "name": "Dubai Leads - September",
            "status": "ACTIVE",
            "effective_status": "ACTIVE",
            "objective": "OUTCOME_LEADS",
            "start_time": "2026-09-01T04:30:00+00:00",
            "stop_time": None,
            "daily_budget": 2500,
            "lifetime_budget": None,
        },
        {
            "id": "400000000000002",
            "name": "Trichy Awareness - September",
            "status": "PAUSED",
            "effective_status": "PAUSED",
            "objective": "OUTCOME_AWARENESS",
            "start_time": "2026-09-05T04:30:00+00:00",
            "stop_time": None,
            "daily_budget": 1500,
            "lifetime_budget": None,
        },
    ],
    "300000000000002": [
        {
            "id": "400000000000003",
            "name": "International Lead Generation",
            "status": "ACTIVE",
            "effective_status": "ACTIVE",
            "objective": "OUTCOME_LEADS",
            "start_time": "2026-09-10T13:00:00+00:00",
            "stop_time": None,
            "daily_budget": 5000,
            "lifetime_budget": None,
        },
    ],
}

MOCK_ADSETS: Dict[str, List[Dict[str, Any]]] = {
    "300000000000001": [
        {
            "id": "500000000000001",
            "campaign_id": "400000000000001",
            "name": "Leads - Broad",
            "status": "ACTIVE",
            "optimization_goal": "LEAD_GENERATION",
            "billing_event": "IMPRESSIONS",
            "start_time": "2026-09-01T04:30:00+00:00",
            "end_time": None,
        },
    ],
}

MOCK_ADS: Dict[str, List[Dict[str, Any]]] = {
    "300000000000001": [
        {
            "id": "600000000000001",
            "name": "Dubai Lead Creative 01",
            "status": "ACTIVE",
            "adset_id": "500000000000001",
            "campaign_id": "400000000000001",
            "creative": {"id": "700000000000001"},
        },
    ],
}

MOCK_INSIGHTS: Dict[str, List[Dict[str, Any]]] = {
    "600000000000001": [
        {
            "date_start": "2026-09-28",
            "date_stop": "2026-09-28",
            "spend": "850.25",
            "impressions": "12000",
            "clicks": "385",
            "reach": "9700",
            "ctr": "3.208333",
            "actions": [{"action_type": "lead", "value": "18"}],
        },
        {
            "date_start": "2026-09-29",
            "date_stop": "2026-09-29",
            "spend": "910.75",
            "impressions": "13500",
            "clicks": "412",
            "reach": "10800",
            "ctr": "3.051852",
            "actions": [{"action_type": "lead", "value": "21"}],
        },
    ],
}


class MockMetaProvider(MetaProvider):
    def me(self, token: str) -> Dict[str, Any]:
        return {"id": "mock-meta-user-001", "name": "Tynato Mock User"}

    def permissions(self, token: str) -> List[str]:
        return [
            "business_management",
            "ads_read",
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_metadata",
        ]

    def businesses(self, token: str) -> List[Dict[str, Any]]:
        return [dict(item) for item in MOCK_BUSINESSES]

    def pages(self, token: str) -> List[Dict[str, Any]]:
        return [dict(item) for item in MOCK_PAGES]

    def ad_accounts(self, token: str) -> List[Dict[str, Any]]:
        return [dict(item) for item in MOCK_AD_ACCOUNTS]

    def campaigns(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        key = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        now = datetime.now(timezone.utc).isoformat()
        return [
            {**item, "last_fixture_read_at": now}
            for item in MOCK_CAMPAIGNS.get(key, [])
        ]

    def adsets(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        key = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        return [dict(item) for item in MOCK_ADSETS.get(key, [])]

    def ads(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        key = ad_account_id[4:] if ad_account_id.startswith("act_") else ad_account_id
        return [dict(item) for item in MOCK_ADS.get(key, [])]

    def insights(
        self,
        token: str,
        object_id: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        return [dict(item) for item in MOCK_INSIGHTS.get(object_id, [])]
