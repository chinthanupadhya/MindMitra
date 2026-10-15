import requests
import json
import random

URL = "http://localhost:8000/api/v1/report?user_name=Tester"

def generate_round(acc):
    return {
        "game_id": random.choice(["sequence", "match2", "meet_and_greet", "pathfinder"]),
        "difficulty_source": "user_selected_preset",
        "difficulty_value": 5,
        "time_taken_sec": random.uniform(30, 90),
        "expected_time_sec": 60,
        "total_attempts": random.randint(1, 3),
        "correct_count": random.randint(0, 3),
        "error_count": random.randint(0, 2),
        "error_types": [],
        "completed": True,
        "accuracy": acc
    }

# Case 1: Excellent performance (Tester1, 5 rounds)
req1 = [generate_round(1.0), generate_round(0.9), generate_round(1.0), generate_round(0.95), generate_round(1.0)]
# Case 2: Poor performance (Tester2, 6 rounds)
req2 = [generate_round(0.2), generate_round(0.3), generate_round(0.1), generate_round(0.2), generate_round(0.1), generate_round(0.2)]
# Case 3: Mixed performance (Tester3, 7 rounds)
req3 = [generate_round(1.0), generate_round(0.2), generate_round(0.8), generate_round(0.4), generate_round(0.7), generate_round(0.9), generate_round(0.3)]
# Case 4: Average performance (Tester4, 5 rounds)
req4 = [generate_round(0.5), generate_round(0.5), generate_round(0.6), generate_round(0.5), generate_round(0.6)]

cases = [
    ("Tester1", req1),
    ("Tester2", req2),
    ("Tester3", req3),
    ("Tester4", req4)
]

results = []
for i, (uname, req) in enumerate(cases):
    try:
        url = f"http://localhost:8000/api/v1/report?user_name={uname}"
        resp = requests.post(url, json=req, timeout=15)
        data = resp.json()
        report = data.get("report", {})
        results.append({
            "case": i + 1,
            "user": uname,
            "opening_id": report.get("opening_id"),
            "strength_id": report.get("strength_id"),
            "weakness_id": report.get("weakness_id"),
            "suggestion_id": report.get("suggestion_id"),
        })
    except Exception as e:
        print(f"Error on case {i+1}: {e}")

print("Report Template ID Variations:")
for r in results:
    print(r)
