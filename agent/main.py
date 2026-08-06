"""
CipherWatch Agent Main Entrypoint
Delegates execution to agent.cli for complete command-line interface and service management.
"""

import sys
from agent.cli import main

if __name__ == "__main__":
    main()
