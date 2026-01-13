"""
Vaticore/World Knowledge web search adapter.

Calls Aiden's World Knowledge service which provides intent-based routing
to multiple search backends (Brave, Tavily, Perplexica).
"""

import logging
import os
from typing import Optional

import requests
from open_webui.retrieval.web.main import SearchResult, get_filtered_results

log = logging.getLogger(__name__)

# Default to localhost, can be overridden by VATICORE_URL env var
DEFAULT_VATICORE_URL = "http://localhost:8010"


def search_vaticore(
    base_url: str,
    query: str,
    count: int,
    filter_list: Optional[list[str]] = None,
) -> list[SearchResult]:
    """Search using Aiden's World Knowledge service.

    The World Knowledge service provides intent-based routing to multiple
    search backends (Brave for realtime, Tavily for technical, etc.).

    Args:
        base_url: Base URL for the World Knowledge service (e.g., http://localhost:8010)
        query: The query to search for
        count: Maximum number of results to return
        filter_list: Optional list of domains to filter results

    Returns:
        List of SearchResult objects
    """
    url = f"{base_url}/v1/search"

    payload = {
        "query": query,
        "max_results": count,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()

        json_response = response.json()
        results = json_response.get("results", [])

        # Log which adapter was used
        intent = json_response.get("intent_detected", "unknown")
        adapters = json_response.get("adapters_used", [])
        latency = json_response.get("latency_ms", 0)
        log.info(f"Vaticore search: intent={intent}, adapters={adapters}, latency={latency}ms, results={len(results)}")

        if filter_list:
            results = get_filtered_results(results, filter_list)

        return [
            SearchResult(
                link=result.get("url", ""),
                title=result.get("title", ""),
                snippet=result.get("snippet", result.get("content", "")),
            )
            for result in results[:count]
        ]

    except requests.exceptions.RequestException as e:
        log.error(f"Vaticore search failed: {e}")
        raise Exception(f"World Knowledge search failed: {e}")
