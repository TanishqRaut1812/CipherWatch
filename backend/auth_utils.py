import hashlib
import secrets

def generate_agent_token() -> str:
    """Generate a secure random bearer token for agent auth."""
    return f"cw_agent_{secrets.token_hex(24)}"

def hash_token(token: str) -> str:
    """Compute SHA-256 hash of agent token for secure storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def verify_token(token: str, token_hash: str) -> bool:
    """Verify standard agent token against stored hash."""
    return secrets.compare_digest(hash_token(token), token_hash)
