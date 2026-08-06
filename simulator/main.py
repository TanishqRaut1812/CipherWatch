import argparse
import sys
import logging
from simulator.injector import EventInjector, DEFAULT_API_URL
from simulator.scenarios import (
    get_scenario_normal_day,
    get_scenario_bulk_exfiltration,
    get_scenario_slow_drip,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cipherwatch.simulator.cli")


def main():
    parser = argparse.ArgumentParser(description="CipherWatch Synthetic Security Event Scenario Simulator CLI")
    parser.add_argument(
        "--scenario",
        type=str,
        default="exfil_burst",
        choices=["normal_day", "exfil_burst", "slow_drip"],
        help="Target scenario sequence to inject into backend API (default: exfil_burst)",
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default=DEFAULT_API_URL,
        help=f"Target backend ingestion API endpoint (default: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay in seconds between event submissions (default: 0.5)",
    )
    args = parser.parse_args()

    logger.info(f"=== CipherWatch Scenario Simulator ===")
    logger.info(f"Target Scenario: {args.scenario}")
    logger.info(f"Backend API URL: {args.api_url}")

    if args.scenario == "normal_day":
        events = get_scenario_normal_day()
    elif args.scenario == "exfil_burst":
        events = get_scenario_bulk_exfiltration()
    elif args.scenario == "slow_drip":
        events = get_scenario_slow_drip()
    else:
        logger.error(f"Unknown scenario '{args.scenario}'")
        sys.exit(1)

    injector = EventInjector(api_url=args.api_url)
    results = injector.inject_sequence(events, delay_sec=args.delay)

    logger.info(f"Simulation completed. {len(results)}/{len(events)} events accepted by ingestion engine.")


if __name__ == "__main__":
    main()
