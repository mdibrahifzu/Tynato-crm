import hashlib
import hmac
import json
import logging
import os
import queue
import re
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

_URL = os.getenv(
    "MONITORING_EVENT_URL", "http://127.0.0.1:18080/v1/events"
).strip()
_SECRET = os.getenv("MONITORING_EVENT_HMAC_SECRET", "").strip()
_ENABLED = os.getenv("MONITORING_EVENTS_ENABLED", "1").lower() in {
    "1", "true", "yes", "on"
}
_Q = queue.Queue(maxsize=300)
_LOCK = threading.Lock()
_STATES = {}
_STARTED = False

META_CONFIG_CATEGORY = "CRM_META_CONFIG_ISSUE"
META_CREDENTIAL_MESSAGE = "Meta Page credential not found"


def _post(event):
    for attempt in range(3):
        ts = str(int(time.time()))
        body = json.dumps(event, separators=(",", ":")).encode()
        sig = hmac.new(
            _SECRET.encode(), ts.encode() + b"." + body, hashlib.sha256
        ).hexdigest()
        req = urllib.request.Request(
            _URL, data=body, method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Monitor-Timestamp": ts,
                "X-Monitor-Signature": "sha256=" + sig,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=2.5) as response:
                if 200 <= response.status < 300:
                    return True
                code = response.status
        except urllib.error.HTTPError as exc:
            code = exc.code
        except Exception:
            code = 0
        if code and code < 500 and code not in (408, 425, 429):
            return False
        if attempt < 2:
            time.sleep(0.25 * (2 ** attempt))
    return False


def _event(service, category, status, summary, details, severity="high"):
    return {
        "event_id": str(uuid.uuid4()),
        "service": service,
        "category": category,
        "status": status,
        "severity": severity,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary[:500],
        "details": details,
    }


def _sender():
    while True:
        event = _Q.get()
        try:
            if not _post(event):
                logging.getLogger(__name__).warning(
                    "Monitoring log event was not accepted; see monitoring API health"
                )
        except Exception:
            pass
        finally:
            _Q.task_done()


def _enqueue(event):
    try:
        _Q.put_nowait(event)
    except queue.Full:
        # Never block ordinary CRM work because monitoring is overloaded.
        pass


def _auto_recoverable(state):
    # Meta config incidents must never resolve from log silence.
    return state["category"] != META_CONFIG_CATEGORY


class _Bridge(logging.Handler):
    def emit(self, record):
        try:
            if record.levelno < logging.ERROR:
                return
            name = record.name or "root"
            if name.startswith(("app.monitoring_telemetry",
                                "app.monitoring_log_bridge",
                                "tynato.crm.monitoring")):
                return

            msg = record.getMessage()
            exc_msg = (str(record.exc_info[1])
                       if record.exc_info and record.exc_info[1] else "")
            is_meta_cfg = (META_CREDENTIAL_MESSAGE in msg
                           or META_CREDENTIAL_MESSAGE in exc_msg)

            slug = re.sub(r"[^A-Za-z0-9_.:-]+", "_", name.lower())[:62]
            service = ("crm_log_" + slug)[:80]
            if is_meta_cfg:
                category = META_CONFIG_CATEGORY
            elif any(word in name.lower()
                     for word in ("worker", "meta", "reminder", "push", "audio")):
                category = "CRM_BACKGROUND_ERROR"
            else:
                category = "CRM_APPLICATION_ERROR"
            severity = "medium" if category == META_CONFIG_CATEGORY else "high"

            key = service + "|" + category
            exc_type = ""
            if record.exc_info and record.exc_info[0]:
                exc_type = record.exc_info[0].__name__

            details = {
                "source": "application_log",
                "logger": name[:120],
                "source_file": Path(record.pathname).name[:100],
                "function": record.funcName[:80],
                "line": int(record.lineno),
                "exception_type": exc_type[:100],
            }
            with _LOCK:
                state = _STATES.setdefault(
                    key, {"active": False, "last_seen": 0.0,
                          "service": service, "category": category,
                          "severity": severity, "details": details},
                )
                state["last_seen"] = time.monotonic()
                state["details"] = details
                if state["active"]:
                    return
                state["active"] = True

            _enqueue(_event(
                service, category, "failure",
                f"CRM error logged by {name[:100]}"
                + (f" ({exc_type})" if exc_type else ""),
                details,
                severity=severity,
            ))
        except Exception:
            pass


def _recovery_watch():
    quiet_seconds = max(
        120, int(os.getenv("MONITORING_LOG_RECOVERY_SECONDS", "300"))
    )
    while True:
        time.sleep(30)
        now = time.monotonic()
        with _LOCK:
            recover = [
                (key, dict(value))
                for key, value in _STATES.items()
                if value["active"]
                and _auto_recoverable(value)
                and now - value["last_seen"] >= quiet_seconds
            ]
            for key, _ in recover:
                _STATES[key]["active"] = False

        for _, state in recover:
            _enqueue(_event(
                state["service"], state["category"], "success",
                "CRM error stream has recovered",
                state["details"],
                severity=state["severity"],
            ))


def install_monitoring_log_bridge():
    global _STARTED
    if not _ENABLED or not _URL or not _SECRET:
        logging.getLogger(__name__).warning(
            "Monitoring log bridge not configured; CRM remains operational"
        )
        return
    root = logging.getLogger()
    if not any(isinstance(h, _Bridge) for h in root.handlers):
        root.addHandler(_Bridge(level=logging.ERROR))
    if not _STARTED:
        threading.Thread(target=_sender, daemon=True,
                         name="crm-monitoring-log-sender").start()
        threading.Thread(target=_recovery_watch, daemon=True,
                         name="crm-monitoring-log-recovery").start()
        _STARTED = True
        logging.getLogger(__name__).info("CRM monitoring log bridge enabled")