"""
Comprehensive multilingual test for MindMitra's 3 new features:
  1. /api/v1/voice/help  — game_id context + distress_flag
  2. /api/v1/voice/recap — dementia recap in user's language
  3. /api/v1/caregiver/summary — clinical summary (English only, 1 run)
"""
import requests
import json

BASE = "http://localhost:8000/api/v1"
SEP  = "-" * 60

LANGUAGES = [
    ("English",   "en",  "How do I play this game?",       "I am very scared and confused, I don't understand anything"),
    ("Hindi",     "hi",  "यह गेम कैसे खेलते हैं?",           "मुझे डर लग रहा है, मुझे कुछ समझ नहीं आ रहा"),
    ("Assamese",  "as",  "এই গেমটো কেনেকৈ খেলিব?",           "মই ভয় পাইছো, মই একো বুজা নাই"),
    ("Bengali",   "bn",  "এই গেমটি কীভাবে খেলবো?",           "আমি ভয় পাচ্ছি, আমি কিছুই বুঝতে পারছি না"),
    ("Manipuri",  "mni", "ꯃꯇꯨꯡ ꯒꯦꯝ ꯀꯔꯤꯕꯥ?",              "ꯑꯩ ꯆꯠꯄꯥ ꯌꯥꯗꯦ, ꯑꯩꯒꯤ ꯃꯇꯥꯡꯗꯥ ꯑꯩ ꯉꯃꯗꯦ"),
    ("Mizo",      "lus", "Hi game hi engtin nge ziah?",    "Ka hlauh em em a, ka hrethiam lo"),
    ("Bodo",      "brx", "इ गेम माव खालामना?",               "मो जेव्लायो, मो एबा नामसिनायो"),
    ("Khasi",     "kha", "Nongkynmaw game ba jingïa?",     "Nga leh um, nga m'bud em"),
]

GAMES = ["sequence", "match2", "meet_and_greet", "pathfinder",
         "monument_memory", "missing_objects", "triple_stack", "sort_match"]

def print_result(label, data):
    print(f"\n  ✅ {label}")
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"     {k}: {v}")
    else:
        print(f"     {data}")

results = {}

# ─────────────────────────────────────────────────────
# FEATURE 1: /voice/help — game_id context
# ─────────────────────────────────────────────────────
print("\n" + SEP)
print("FEATURE 1: /voice/help — Game Context (game_id injection)")
print(SEP)

feature1_results = []
for lang_name, lang_code, query, _ in LANGUAGES:
    game_id = GAMES[LANGUAGES.index((lang_name, lang_code, query, _)) % len(GAMES)]
    try:
        r = requests.post(f"{BASE}/voice/help", json={
            "user_query": query,
            "game_id": game_id,
            "language": lang_code
        }, timeout=15)
        data = r.json()
        row = {
            "language": lang_name,
            "game_id": game_id,
            "spoken_response": data.get("spoken_response", "ERROR"),
            "distress_flag": data.get("distress_flag", "?")
        }
        feature1_results.append(row)
        print(f"\n  [{lang_name}] game={game_id}")
        print(f"     Response : {row['spoken_response']}")
        print(f"     Distress : {row['distress_flag']}")
    except Exception as e:
        print(f"\n  [{lang_name}] ERROR: {e}")

# ─────────────────────────────────────────────────────
# FEATURE 1b: /voice/help — Distress Detection
# ─────────────────────────────────────────────────────
print("\n" + SEP)
print("FEATURE 1b: /voice/help — Distress Detection across all languages")
print(SEP)

feature1b_results = []
for lang_name, lang_code, _, distress_query in LANGUAGES:
    try:
        r = requests.post(f"{BASE}/voice/help", json={
            "user_query": distress_query,
            "language": lang_code
        }, timeout=15)
        data = r.json()
        row = {
            "language": lang_name,
            "distress_flag": data.get("distress_flag", "?"),
            "spoken_response": data.get("spoken_response", "ERROR"),
        }
        feature1b_results.append(row)
        flag = "🚨 DISTRESS" if row["distress_flag"] else "✅ OK"
        print(f"\n  [{lang_name}] {flag}")
        print(f"     Response : {row['spoken_response']}")
    except Exception as e:
        print(f"\n  [{lang_name}] ERROR: {e}")

# ─────────────────────────────────────────────────────
# FEATURE 2: /voice/recap — "What did I just play?"
# ─────────────────────────────────────────────────────
print("\n" + SEP)
print("FEATURE 2: /voice/recap — Dementia Recap in all languages")
print(SEP)

NAMES = ["Ravi", "Priya", "Abdul", "Sunita", "Thoibi", "Liani", "Biren", "Philo"]
ACCS  = [1.0,    0.75,   0.5,    0.25,   1.0,    0.75,   0.5,   0.25]

feature2_results = []
for i, (lang_name, lang_code, _, _) in enumerate(LANGUAGES):
    game_id = GAMES[i % len(GAMES)]
    try:
        r = requests.post(f"{BASE}/voice/recap", json={
            "language": lang_code,
            "user_name": NAMES[i],
            "last_round": {
                "game_id": game_id,
                "accuracy": ACCS[i],
                "correct_count": int(ACCS[i] * 4),
                "total_attempts": 4,
                "difficulty_value": 5
            }
        }, timeout=15)
        data = r.json()
        row = {
            "language": lang_name,
            "user_name": NAMES[i],
            "game": game_id,
            "accuracy": f"{int(ACCS[i]*100)}%",
            "spoken_response": data.get("spoken_response", "ERROR"),
        }
        feature2_results.append(row)
        print(f"\n  [{lang_name}] {NAMES[i]} | {game_id} | {row['accuracy']}")
        print(f"     Recap: {row['spoken_response']}")
    except Exception as e:
        print(f"\n  [{lang_name}] ERROR: {e}")

# ─────────────────────────────────────────────────────
# FEATURE 3: /caregiver/summary — Clinical Summary (English, 1 run)
# ─────────────────────────────────────────────────────
print("\n" + SEP)
print("FEATURE 3: /caregiver/summary — Clinical Summary (English)")
print(SEP)

rounds_good = [
    {"game_id": "sequence", "difficulty_source": "ai_recommended",
     "difficulty_value": 7, "time_taken_sec": 55, "expected_time_sec": 60,
     "total_attempts": 4, "correct_count": 4, "error_count": 0,
     "error_types": [], "completed": True, "accuracy": 1.0}
] * 5

rounds_poor = [
    {"game_id": "match2", "difficulty_source": "ai_recommended",
     "difficulty_value": 3, "time_taken_sec": 90, "expected_time_sec": 60,
     "total_attempts": 4, "correct_count": 1, "error_count": 3,
     "error_types": ["wrong_pair", "wrong_pair", "wrong_pair"],
     "completed": True, "accuracy": 0.25}
] * 5

try:
    r = requests.post(f"{BASE}/caregiver/summary", json={
        "user_name": "Ravi Kumar",
        "rounds": rounds_good + rounds_poor
    }, timeout=20)
    data = r.json()
    print(f"\n  Patient: Ravi Kumar | Sessions: {data.get('sessions_analysed')}")
    print(f"  Summary:\n  {data.get('summary')}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n" + SEP)
print("ALL TESTS COMPLETE")
print(SEP)
