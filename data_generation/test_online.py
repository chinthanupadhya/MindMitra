import json
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

# Sample round states matching tokenization standards
perfect_round = {
    "game_id": "match2",
    "difficulty_source": "ai_recommended",
    "difficulty_value": 9.0,
    "time_taken_sec": 30.0,
    "expected_time_sec": 75.0,
    "total_attempts": 1,
    "correct_count": 1,
    "error_count": 0,
    "error_types": [],
    "completed": True,
    "accuracy": 1.0,
}

struggling_round = {
    "game_id": "pathfinder",
    "difficulty_source": "user_selected_preset",
    "difficulty_value": 7.0,
    "time_taken_sec": 85.0,
    "expected_time_sec": 50.0,
    "total_attempts": 3,
    "correct_count": 1,
    "error_count": 2,
    "error_types": ["planning_error"],
    "completed": True,
    "accuracy": 0.33,
}

# ----------------------------------------------------
# 1. Test Task A: Recommendation
# ----------------------------------------------------
print("=== 1. Testing Task A (/recommend) ===")
res_a = requests.post(f"{BASE_URL}/recommend", json=[perfect_round, perfect_round])
print(json.dumps(res_a.json(), indent=2))

# ----------------------------------------------------
# 2. Test Task B: Cold-Start Guard (< 5 rounds)
# ----------------------------------------------------
print("\n=== 2. Testing Task B Cold-Start (< 5 rounds) ===")
res_b_cold = requests.post(
    f"{BASE_URL}/report", params={"user_name": "Sita"}, json=[perfect_round] * 3
)
print(json.dumps(res_b_cold.json(), indent=2))

# ----------------------------------------------------
# 3. Test Task B: Report Generation (Declining Trend)
# ----------------------------------------------------
print("\n=== 3. Testing Task B (Declining Performance Trend) ===")
res_b_declining = requests.post(
    f"{BASE_URL}/report",
    params={"user_name": "Ramesh"},
    json=[perfect_round] * 3 + [struggling_round] * 4,
)
print(json.dumps(res_b_declining.json(), indent=2))

# ----------------------------------------------------
# 4. Multilingual Voice: Manipuri Query
# ----------------------------------------------------
print("\n=== 4. Testing Multilingual Voice (Manipuri) ===")
res_manipuri = requests.post(
    f"{BASE_URL}/voice/help",
    json={
        "game_id": "sequence",
        "user_query": "Sequence game asi karamna sannahani?",
    },
)
print(json.dumps(res_manipuri.json(), indent=2, ensure_ascii=False))

# ----------------------------------------------------
# 5. Multilingual Voice: Mizo Query
# ----------------------------------------------------
print("\n=== 5. Testing Multilingual Voice (Mizo) ===")
res_mizo = requests.post(
    f"{BASE_URL}/voice/help",
    json={
        "game_id": "match2",
        "user_query": "Match 2 hi engtin nge ka khelh ang?",
    },
)
print(json.dumps(res_mizo.json(), indent=2, ensure_ascii=False))

# ----------------------------------------------------
# 6. Guardrail Check: Block Math Request
# ----------------------------------------------------
print("\n=== 6. Testing Guardrail: Block Math Query ===")
res_math = requests.post(
    f"{BASE_URL}/voice/help",
    json={"game_id": "pathfinder", "user_query": "What is 45 multiplied by 12?"},
)
print(json.dumps(res_math.json(), indent=2))

# ----------------------------------------------------
# 7. Guardrail Check: Block Setting Modification
# ----------------------------------------------------
print("\n=== 7. Testing Guardrail: Block Setting Alteration ===")
res_settings = requests.post(
    f"{BASE_URL}/voice/help",
    json={
        "game_id": None,
        "user_query": "Mera medicine reminder subah 8 baje ka set kar do.",
    },
)
print(json.dumps(res_settings.json(), indent=2, ensure_ascii=False))
print("\n=== 8. Testing Multilingual Voice (Khasi) ===")
res_khasi = requests.post(
    f"{BASE_URL}/voice/help",
    json={
        "game_id": "match2",
        "user_query": "Kumno nga dei ban ialeh ia kane ka Match 2 game?",  # "How should I play this Match 2 game?" in Khasi
    },
)
print(json.dumps(res_khasi.json(), indent=2, ensure_ascii=False))