import sys
import pytest
from unittest.mock import patch
from simulator.main import main


def test_simulator_cli_exfil_burst():
    """Verify simulator CLI parses args and triggers exfil_burst injection."""
    test_args = ["simulator.main", "--scenario", "exfil_burst", "--delay", "0.0"]
    with patch.object(sys, "argv", test_args):
        with patch("simulator.injector.EventInjector.post_event") as mock_post:
            mock_post.return_value = {"status": "accepted"}
            main()
            assert mock_post.call_count == 4


def test_simulator_cli_normal_day():
    """Verify simulator CLI parses args and triggers normal_day injection."""
    test_args = ["simulator.main", "--scenario", "normal_day", "--delay", "0.0"]
    with patch.object(sys, "argv", test_args):
        with patch("simulator.injector.EventInjector.post_event") as mock_post:
            mock_post.return_value = {"status": "accepted"}
            main()
            assert mock_post.call_count == 4
