import time
from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from backend.db.models import AgentModel


class AgentAuthCache:
    """Lightweight in-memory TTL cache for authenticated agents."""

    def __init__(self, ttl_seconds: float = 30.0, max_size: int = 1000):
        self.ttl_seconds: float = ttl_seconds
        self.max_size: int = max_size
        self._cache: Dict[str, Tuple[AgentModel, float]] = {}  # key -> (agent_instance, timestamp)

    def _make_key(self, agent_id: str, token: str) -> str:
        return f"{agent_id}:{token}"

    def get(self, agent_id: str, token: str, db: Session) -> Optional[AgentModel]:
        """Retrieve cached AgentModel if hit and TTL valid (<= 30s)."""
        key = self._make_key(agent_id, token)
        entry = self._cache.get(key)
        if not entry:
            return None

        agent_copy, timestamp = entry
        if (time.time() - timestamp) > self.ttl_seconds:
            self._cache.pop(key, None)
            return None

        # Re-attach copy to active session without executing a DB query
        return db.merge(agent_copy, load=False)

    def put(self, agent_id: str, token: str, agent: AgentModel, db: Session) -> AgentModel:
        """Store authenticated AgentModel instance in TTL cache."""
        if len(self._cache) >= self.max_size:
            # Evict oldest entry
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            self._cache.pop(oldest_key, None)

        key = self._make_key(agent_id, token)
        # Detach/expunge agent from current session so it can be cached safely
        db.expunge(agent)
        self._cache[key] = (agent, time.time())
        # Re-merge back into current request session so caller can use it
        return db.merge(agent, load=False)

    def invalidate(self, agent_id: str):
        """Invalidate cache entries for a specific agent ID (e.g. on revocation or token rotation)."""
        keys_to_remove = [k for k in self._cache if k.startswith(f"{agent_id}:")]
        for k in keys_to_remove:
            self._cache.pop(k, None)

    def clear(self):
        """Clear all cached authentication entries."""
        self._cache.clear()


# Global Singleton Instance
agent_auth_cache = AgentAuthCache(ttl_seconds=30.0, max_size=1000)
