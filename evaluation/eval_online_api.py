import json
import requests
from pathlib import Path
from tqdm import tqdm

API_BASE = "http://127.0.0.1:8000/api/v1"
TEST_DATA_PATH = Path("test.jsonl")  # Adjust if located elsewhere

if not TEST_DATA_PATH.exists():
    for p in [Path("../data_generation/test.jsonl"), Path("data_generation/test.jsonl")]:
        if p.exists():
            TEST_DATA_PATH = p
            break

with open(TEST_DATA_PATH, "r", encoding="utf-8") as f:
    test_data = [json.loads(line) for line in f if line.strip()]

# LIMIT TO 150 SAMPLES TO SAVE TIME AND TOKENS
test_data = test_data[:150]


# ---------------------------------------------------------------------------
# Token parser: reconstruct RoundRecord dicts from the token string
# ---------------------------------------------------------------------------
def parse_round_tokens(token_str: str) -> dict:
    """Parse 'g=match2 src=ai_recommended v=6.0 t=64.7 ...' back into a RoundRecord dict."""
    fields = {}
    for part in token_str.strip().split():
        key, _, val = part.partition("=")
        if val:  # skip parts without '='
            fields[key] = val

    # Parse difficulty_value (could be scalar or dict like "people:3.0;questions:5.0")
    raw_v = fields.get("v", "0")
    if ":" in raw_v:
        difficulty_value = {}
        for pair in raw_v.split(";"):
            k, _, v = pair.partition(":")
            difficulty_value[k] = float(v)
    else:
        try:
            difficulty_value = float(raw_v)
        except ValueError:
            difficulty_value = 0.0

    # Parse error_types list from et=[wrong_pair,slip_double_tap]
    et_raw = fields.get("et", "[]")
    et_raw = et_raw.strip("[]")
    error_types = [e.strip() for e in et_raw.split(",") if e.strip()]

    return {
        "game_id": fields.get("g", "match2"),
        "difficulty_source": fields.get("src", "ai_recommended"),
        "difficulty_value": difficulty_value,
        "time_taken_sec": float(fields.get("t", "0")),
        "expected_time_sec": float(fields.get("exp", "0")),
        "total_attempts": int(fields.get("att", "1")),
        "correct_count": int(fields.get("cor", "0")),
        "error_count": int(fields.get("err", "0")),
        "error_types": error_types,
        "completed": fields.get("done", "0") == "1",
        "accuracy": float(fields.get("acc", "0")),
    }


def extract_rounds_from_message(messages: list) -> list:
    """Extract round records by parsing the token string in the user message."""
    user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
    # Split on " | " — first segment is the instruction, rest are round tokens
    parts = user_msg.split(" | ")
    if len(parts) < 2:
        return []
    round_tokens = parts[1:]  # skip the instruction prefix
    return [parse_round_tokens(tok) for tok in round_tokens]


task_a_total = 0
task_a_correct = 0
task_a_mae_sum = 0.0

task_b_total = 0
task_b_schema_success = 0
slot_accuracy_counts = {}

print(f"Starting cloud API evaluation across {len(test_data)} test records (capped at 150)...")

for entry in tqdm(test_data, desc="Evaluating Online API"):
    messages = entry["messages"]
    asst_raw = next((m["content"] for m in messages if m["role"] == "assistant"), "{}")

    try:
        expected = json.loads(asst_raw)
    except json.JSONDecodeError:
        continue

    is_task_a = "reason_code" in expected
    is_task_b = "opening_id" in expected or "slots" in expected

    # Parse actual round data from the user message token string
    parsed_rounds = extract_rounds_from_message(messages)

    if is_task_a:
        task_a_total += 1

        payload_rounds = parsed_rounds if parsed_rounds else [{
            "game_id": "match2",
            "difficulty_source": "ai_recommended",
            "difficulty_value": 5.0,
            "time_taken_sec": 45.0,
            "expected_time_sec": 60.0,
            "total_attempts": 2,
            "correct_count": 1,
            "error_count": 1,
            "error_types": [],
            "completed": True,
            "accuracy": 0.5
        }]

        try:
            resp = requests.post(f"{API_BASE}/recommend", json=payload_rounds, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("recommended_game_id") == expected.get("recommended_game_id"):
                    task_a_correct += 1

                pred_diff = data.get("recommended_difficulty_value", 0)
                true_diff = expected.get("recommended_difficulty_value", 0)

                if isinstance(pred_diff, dict) and isinstance(true_diff, dict):
                    common_keys = set(pred_diff.keys()).intersection(set(true_diff.keys()))
                    if common_keys:
                        mae = sum(abs(float(pred_diff[k]) - float(true_diff[k])) for k in common_keys) / len(
                            common_keys)
                        task_a_mae_sum += mae
                elif isinstance(pred_diff, (int, float)) and isinstance(true_diff, (int, float)):
                    task_a_mae_sum += abs(float(pred_diff) - float(true_diff))
        except Exception:
            continue

    elif is_task_b:
        continue

        if parsed_rounds and len(parsed_rounds) >= 5:
            mock_rounds = parsed_rounds
        else:
            mock_rounds = [{
                "game_id": "match2",
                "difficulty_source": "ai_recommended",
                "difficulty_value": 5.0,
                "time_taken_sec": 40.0,
                "expected_time_sec": 60.0,
                "total_attempts": 2,
                "correct_count": 1,
                "error_count": 1,
                "error_types": [],
                "completed": True,
                "accuracy": 0.5
            }] * 6

        try:
            resp = requests.post(
                f"{API_BASE}/report",
                params={"user_name": expected.get("slots", {}).get("name", "TestUser")},
                json=mock_rounds,
                timeout=15
            )
            if resp.status_code == 200:
                res_json = resp.json()
                if res_json.get("status") == "success":
                    task_b_schema_success += 1
                    report = res_json.get("report", {})
                    true_slots = expected.get("slots", {})
                    pred_slots = report.get("slots", {})

                    for k, true_val in true_slots.items():
                        if k not in slot_accuracy_counts:
                            slot_accuracy_counts[k] = {"correct": 0, "total": 0}
                        slot_accuracy_counts[k]["total"] += 1

                        if k == 'n':
                            try:
                                if int(pred_slots.get(k, -1)) == int(true_val):
                                    slot_accuracy_counts[k]["correct"] += 1
                            except (ValueError, TypeError):
                                pass
                        else:
                            if str(pred_slots.get(k, "")).strip().lower() == str(true_val).strip().lower():
                                slot_accuracy_counts[k]["correct"] += 1
        except Exception:
            continue

print("\n" + "=" * 50)
print("ONLINE API EVALUATION SUMMARY")
print("=" * 50)
if task_a_total > 0:
    print(f"Task A Evaluated: {task_a_total} samples")
    print(f"  - Routing Accuracy: {(task_a_correct / task_a_total) * 100:.2f}%")
    print(f"  - Parameter MAE:    {task_a_mae_sum / task_a_total:.3f}")

if task_b_total > 0:
    print(f"\nTask B Evaluated: {task_b_total} reports")
    print(f"  - Schema Success Rate: {(task_b_schema_success / task_b_total) * 100:.2f}%")
    print("  - Slot Breakdown:")
    for slot_name, stats in slot_accuracy_counts.items():
        acc = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        print(f"    - {slot_name:<18}: {acc:.1f}% ({stats['correct']}/{stats['total']})")
print("=" * 50)