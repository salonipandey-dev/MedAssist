"""Environment settings for connecting a browser frontend."""

import os
from urllib.parse import urlsplit


def get_cors_origins() -> list[str]:
    """Read exact HTTP(S) origins; cross-origin access is disabled by default."""
    origins = []
    for value in os.getenv("MEDASSIST_CORS_ORIGINS", "").split(","):
        origin = value.strip()
        if not origin:
            continue

        try:
            parsed = urlsplit(origin)
            # Accessing port also checks for non-numeric and out-of-range ports.
            parsed.port
            valid = (
                parsed.scheme in {"http", "https"}
                and parsed.hostname
                and parsed.username is None
                and parsed.password is None
                and origin == f"{parsed.scheme}://{parsed.netloc}"
                and not parsed.netloc.endswith(":")
                and "*" not in origin
                and not any(char.isspace() or ord(char) < 32 for char in origin)
            )
        except ValueError:
            valid = False

        if not valid:
            raise ValueError(
                "MEDASSIST_CORS_ORIGINS must contain comma-separated HTTP(S) "
                "origins without paths, credentials, or wildcards. "
                "Example: http://localhost:5173"
            )
        if origin not in origins:
            origins.append(origin)

    return origins
