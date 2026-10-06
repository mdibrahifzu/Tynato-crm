from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.meta.client import MetaClient
from app.meta.config import META_PROVIDER


class MetaProvider(ABC):
    """Provider contract shared by real Meta API access and deterministic local fixtures."""

    @abstractmethod
    def me(self, token: str) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def permissions(self, token: str) -> List[str]:
        raise NotImplementedError

    @abstractmethod
    def businesses(self, token: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def pages(self, token: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def ad_accounts(self, token: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def campaigns(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def adsets(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def ads(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def insights(
        self,
        token: str,
        object_id: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError


class RealMetaProvider(MetaProvider):
    def __init__(self, client: Optional[MetaClient] = None) -> None:
        self.client = client or MetaClient()

    def me(self, token: str) -> Dict[str, Any]:
        return self.client.me(token)

    def permissions(self, token: str) -> List[str]:
        return self.client.permissions(token)

    def businesses(self, token: str) -> List[Dict[str, Any]]:
        return self.client.businesses(token)

    def pages(self, token: str) -> List[Dict[str, Any]]:
        return self.client.pages(token)

    def ad_accounts(self, token: str) -> List[Dict[str, Any]]:
        return self.client.ad_accounts(token)

    def campaigns(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        return self.client.campaigns(token, ad_account_id)

    def adsets(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        return self.client.adsets(token, ad_account_id)

    def ads(self, token: str, ad_account_id: str) -> List[Dict[str, Any]]:
        return self.client.ads(token, ad_account_id)

    def insights(
        self,
        token: str,
        object_id: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        return self.client.insights(token, object_id, params)


def get_real_meta_provider() -> RealMetaProvider:
    # OAuth exchange and identity validation must never use the mock provider.
    return RealMetaProvider()


def get_meta_provider() -> MetaProvider:
    if META_PROVIDER == "mock":
        from app.meta.mock_provider import MockMetaProvider

        return MockMetaProvider()
    return RealMetaProvider()
