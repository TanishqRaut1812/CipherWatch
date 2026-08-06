import time
import requests
import logging
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cipherwatch.simulator")

DEFAULT_API_URL = "http://localhost:8000/api/events"


class EventInjector:
    """
    HTTP event injector utility that transmits privacy-compliant metadata event sequences
    directly into the CipherWatch backend ingestion pipeline, simulating agent activities.
    """

    def __init__(self, api_url: str = DEFAULT_API_URL):
        self.api_url = api_url

    def post_event(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Post a single synthetic metadata event payload to the backend."""
        try:
            response = requests.post(self.api_url, json=event_data, timeout=5)
            if response.status_code in (200, 201):
                res_data = response.json()
                logger.info(f"Successfully injected event [{event_data.get('event_type')}] -> Status: 201 Created")
                return res_data
            else:
                logger.error(f"Failed to inject event: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.warning(f"Unable to connect to backend at {self.api_url}: {e}")
            return None

    def inject_sequence(self, event_list: List[Dict[str, Any]], delay_sec: float = 0.5) -> List[Dict[str, Any]]:
        """Sequentially post a list of metadata events with configurable time delay."""
        results = []
        logger.info(f"Starting injection sequence of {len(event_list)} synthetic events (delay={delay_sec}s)...")
        for idx, event in enumerate(event_list, start=1):
            logger.info(f"Step {idx}/{len(event_list)}: Sending {event.get('event_type')}")
            res = self.post_event(event)
            if res:
                results.append(res)
            if idx < len(event_list):
                time.sleep(delay_sec)
        logger.info(f"Injection sequence completed. {len(results)}/{len(event_list)} events accepted.")
        return results
