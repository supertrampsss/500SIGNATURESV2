"""Client HTTP des connecteurs : retries avec backoff exponentiel et jitter.

4 tentatives maximum, jamais de contournement de quota (docs/03 §1).
"""

import random
import time

import httpx

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4


def fetch(url: str, headers: dict | None = None, timeout: float = 60.0) -> httpx.Response:
    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
            if response.status_code in RETRYABLE_STATUS:
                last_error = httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request, response=response
                )
            else:
                response.raise_for_status()
                return response
        except (httpx.TransportError, httpx.HTTPStatusError) as error:
            last_error = error
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep((2**attempt) + random.uniform(0, 1))
    raise last_error
