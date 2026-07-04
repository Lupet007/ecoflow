import subprocess
import sys
import time
from datetime import datetime, timezone

INTERVAL_SECONDS = 300


def run_pipeline():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Running EcoFlow pipeline...")

    result = subprocess.run(
        [sys.executable, "main.py"],
        check=False
    )

    if result.returncode == 0:
        print("Pipeline finished successfully.")
    else:
        print(f"Pipeline failed with exit code: {result.returncode}")

    arso_result = subprocess.run(
        [sys.executable, "arso_ingest.py"],
        check=False
    )

    if arso_result.returncode == 0:
        print("ARSO pipeline finished successfully.")
    else:
        print(f"ARSO pipeline failed with exit code: {arso_result.returncode}")


def main():
    print("EcoFlow periodic scheduler started")

    while True:
        run_pipeline()
        print(f"Next refresh in {INTERVAL_SECONDS} seconds.")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()