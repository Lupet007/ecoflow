import time
import subprocess

print("EcoFlow scheduler started")

while True:
    print("Running pipeline...")

    subprocess.run(["python", "main.py"])

    print("Waiting 300 seconds...")
    time.sleep(300)