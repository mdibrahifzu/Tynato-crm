"""
Dashboard compatibility module.

The actual /dashboard endpoint lives in:
    app.dashboard.dashboard

This module intentionally does not define another
/dashboard route.
"""

from app.dashboard.dashboard import router

__all__ = ["router"]