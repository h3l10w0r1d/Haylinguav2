# backend/middleware/rate_limit.py
from __future__ import annotations

import ipaddress
import json
import os
import re
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque, Dict, List, Optional, Tuple

from starlette.requests import Request
from starlette.responses import JSONResponse

_TAUNT_LOG = "Rate limit triggered. DOS/DDOS attack is too basic for Haylingua, try something more creative :) Cheers, Armen Ghazaryan"
_CLIENT_MESSAGE = "Too many requests. Please slow down and try again later."


@dataclass(frozen=True)
class Rule:
    """A simple fixed-window rule."""
    method: Optional[str]  # None -> any
    path_regex: re.Pattern
    limit: int
    window_seconds: int


def _compile_rules() -> Tuple[Rule, ...]:
    # Global rule for all endpoints (per IP)
    rules = [
        Rule(None, re.compile(r".*"), limit=300, window_seconds=60),
        # Sensitive endpoints (tighter per IP)
        Rule("POST", re.compile(r"^/login$"), limit=15, window_seconds=60),
        Rule("POST", re.compile(r"^/signup$"), limit=6, window_seconds=60),
        Rule("POST", re.compile(r"^/auth/verify-email$"), limit=10, window_seconds=60),
        Rule("POST", re.compile(r"^/auth/resend.*"), limit=6, window_seconds=60),
        Rule("POST", re.compile(r"^/me/change-password$"), limit=6, window_seconds=3600),
        Rule("POST", re.compile(r"^/me/email-change/.*"), limit=6, window_seconds=3600),
        Rule("POST", re.compile(r"^/me/2fa/.*"), limit=20, window_seconds=3600),
        # Backstop against forcing cache misses on /explain (exercise_explanations
        # cache handles steady-state cost; this caps the worst case of scripted
        # spam hitting many distinct wrong answers to force fresh GPT-4o calls).
        Rule("POST", re.compile(r"^/me/exercises/\d+/explain$"), limit=30, window_seconds=3600),
    ]
    return tuple(rules)


DEFAULT_RULES: Tuple[Rule, ...] = _compile_rules()


class InMemoryRateLimiter:
    """Fixed-window sliding timestamps, in-memory (resets on deploy)."""

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = {}

    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        now = time.time()
        dq = self._hits.get(key)
        if dq is None:
            dq = deque()
            self._hits[key] = dq

        cutoff = now - window_seconds
        while dq and dq[0] <= cutoff:
            dq.popleft()

        if len(dq) >= limit:
            retry = int(max(1, (dq[0] + window_seconds) - now))
            return False, retry

        dq.append(now)
        return True, 0


def _parse_trusted_proxies() -> List[Any]:
    raw = (os.getenv("TRUSTED_PROXY_IPS") or "").strip()
    nets: List[Any] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            nets.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            pass
    return nets


_TRUSTED_PROXY_NETS = _parse_trusted_proxies()


def _peer_is_trusted_proxy(request: Request) -> Optional[bool]:
    if not _TRUSTED_PROXY_NETS:
        return None
    host = request.client.host if request.client else None
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in net for net in _TRUSTED_PROXY_NETS)


def _get_client_ip(request: Request) -> str:
    if _peer_is_trusted_proxy(request) is False:
        return request.client.host if request.client else "unknown"

    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return (request.client.host if request.client else "unknown")


def _should_skip(path: str, method: str) -> bool:
    if method == "OPTIONS":
        return True
    if path.startswith("/docs") or path.startswith("/openapi.json") or path.startswith("/redoc"):
        return True
    if path.startswith("/static/") or path.startswith("/assets/"):
        return True
    if path in ("/health", "/"):
        return True
    return False


def _extract_identifier(path: str, method: str, body_bytes: bytes) -> Optional[str]:
    if method != "POST":
        return None
    if not body_bytes:
        return None
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None

    for k in ("email", "username", "query", "new_email"):
        v = payload.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    return None


class RateLimitMiddleware:
    """
    Pure ASGI rate limiting middleware — avoids BaseHTTPMiddleware's
    StreamingResponse / body-buffering incompatibility (starlette#1012).

    - Applies a default global rule to all requests (per IP).
    - Applies tighter rules for sensitive endpoints (per IP).
    - Applies a per-identifier rule for auth endpoints when identifier is present.

    NOTE: In-memory; resets on deploy.
    """

    def __init__(self, app: Any, rules: Tuple[Rule, ...] = DEFAULT_RULES) -> None:
        self.app = app
        self._rules = rules
        self._limiter = InMemoryRateLimiter()

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Test suites hit the app hundreds of times per run through a single
        # synthetic client IP ("testclient") sharing one in-memory bucket —
        # unrelated tests start tripping each other's rate limits once the
        # suite grows past a few dozen requests. Opt-in only (default off)
        # so this can never be accidentally left on in a real deployment.
        if os.getenv("DISABLE_RATE_LIMIT", "").strip().lower() == "true":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path
        method = request.method.upper()

        if _should_skip(path, method):
            await self.app(scope, receive, send)
            return

        ip = _get_client_ip(request)

        # Buffer the full request body so we can:
        #   1. extract an identifier for per-identifier throttles
        #   2. replay it for the downstream handler
        # We drain all http.request chunks ourselves rather than relying on
        # BaseHTTPMiddleware, which breaks StreamingResponse disconnect handling.
        body_chunks: List[bytes] = []
        more = True
        while more:
            message = await receive()
            if message["type"] != "http.request":
                # Unexpected — pass through untouched and bail
                await self.app(scope, receive, send)
                return
            body_chunks.append(message.get("body", b""))
            more = message.get("more_body", False)

        body = b"".join(body_chunks)

        # Replay callable: first call returns the buffered body; subsequent
        # calls pass through to the real receive (for disconnect detection).
        _replayed = False

        async def replay_receive():
            nonlocal _replayed
            if not _replayed:
                _replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        # ── Per-IP rules ────────────────────────────────────────────────────
        for rule in self._rules:
            if rule.method is not None and rule.method != method:
                continue
            if not rule.path_regex.match(path):
                continue
            key = f"ip:{ip}:{rule.method or 'ANY'}:{rule.path_regex.pattern}:{rule.window_seconds}"
            allowed, retry = self._limiter.hit(key, rule.limit, rule.window_seconds)
            if not allowed:
                print(f"[rate_limit] ip={ip} path={path} method={method} retry_after={retry}s — {_TAUNT_LOG}")
                response = JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry)},
                    content={"detail": _CLIENT_MESSAGE, "retry_after_seconds": retry},
                )
                await response(scope, replay_receive, send)
                return

        # ── Per-identifier rules (auth endpoints) ────────────────────────────
        identifier = _extract_identifier(path, method, body)
        if identifier and (path in ("/login", "/signup") or path.startswith("/auth/") or path.startswith("/me/")):
            if path == "/login":
                limit, window = 20, 3600
            elif path == "/signup":
                limit, window = 10, 3600
            elif path.startswith("/auth/"):
                limit, window = 20, 3600
            else:
                limit, window = 30, 3600
            key = f"id:{identifier}:{path}:{window}"
            allowed, retry = self._limiter.hit(key, limit, window)
            if not allowed:
                print(f"[rate_limit] id={identifier} path={path} retry_after={retry}s — {_TAUNT_LOG}")
                response = JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry)},
                    content={"detail": _CLIENT_MESSAGE, "retry_after_seconds": retry},
                )
                await response(scope, replay_receive, send)
                return

        await self.app(scope, replay_receive, send)
