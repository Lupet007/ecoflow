import subprocess
import sys
import time

INTERVAL_SECONDS = 300


def run_pipeline():
    print("Running pipeline...")

    result = subprocess.run(
        [sys.executable, "main.py"],
        check=False
    )

    if result.returncode != 0:
        print(f"Pipeline finished with error code: {result.returncode}")


def main():
    print("EcoFlow scheduler started")

    while True:
        run_pipeline()
        print(f"Waiting {INTERVAL_SECONDS} seconds...")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()