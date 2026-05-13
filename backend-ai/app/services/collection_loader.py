import json
import os
from typing import Any, Dict, Optional

_REPO_COLLECTION_CANDIDATES = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "collection.json")),
]


def load_api_collection(explicit: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    if explicit and isinstance(explicit, dict) and explicit.get("apis"):
        return explicit
    path = (os.getenv("COLLECTION_JSON_PATH") or "").strip()
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    for candidate in _REPO_COLLECTION_CANDIDATES:
        if os.path.isfile(candidate):
            with open(candidate, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
    return None
