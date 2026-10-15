"""
export_training_data.py
Generates the full MindMitra SFT training dataset and writes it to:
  - task_a_train.jsonl   → Game routing examples (recommend harder/easier/hold/new game)
  - task_b_train.jsonl   → Clinical report template selection examples
  - task_a_train_sample.json  → 3 human-readable examples for inspection
  - task_b_train_sample.json  → 3 human-readable examples for inspection

Run:
  python3 export_training_data.py
"""

import json
from generate import (
    derive_rng,
    generate_users,
    build_report_example,
)

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
N_USERS          = 500   # number of synthetic patients
SEED             = "mindmitra-sft-v1"
TASK_A_FILE      = "task_a_train.jsonl"
TASK_B_FILE      = "task_b_train.jsonl"
TASK_A_SAMPLE    = "task_a_train_sample.json"
TASK_B_SAMPLE    = "task_b_train_sample.json"

# ──────────────────────────────────────────────────────────────
# Generate
# ──────────────────────────────────────────────────────────────
print(f"Generating {N_USERS} synthetic patient sessions...")
rng = derive_rng(SEED)
histories, task_a_examples = generate_users(N_USERS, rng)
print(f"  ✅ Patients generated : {len(histories)}")
print(f"  ✅ Task A examples    : {len(task_a_examples)}")

# Build Task B examples from the long rolling window (10-14 rounds) of each patient
task_b_examples = []
for history in histories:
    long_window = history[-14:]          # last 14 rounds = report window
    ex = build_report_example(history, long_window, rng)
    if ex["prompt"] != "gathering-data": # skip patients with <5 rounds
        task_b_examples.append(ex)

print(f"  ✅ Task B examples    : {len(task_b_examples)}")

# ──────────────────────────────────────────────────────────────
# Write JSONL files (one JSON object per line — standard SFT format)
# ──────────────────────────────────────────────────────────────
def write_jsonl(examples, filepath):
    with open(filepath, "w", encoding="utf-8") as f:
        for ex in examples:
            # Standard SFT chat format:
            # {"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}
            record = {
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are the adaptive decision engine of MindMitra. "
                            "Output strictly valid JSON with no extra text."
                        )
                    },
                    {
                        "role": "user",
                        "content": ex["prompt"]
                    },
                    {
                        "role": "assistant",
                        "content": json.dumps(ex["answer"], ensure_ascii=False)
                    }
                ]
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

write_jsonl(task_a_examples, TASK_A_FILE)
write_jsonl(task_b_examples, TASK_B_FILE)
print(f"\n  📄 Saved: {TASK_A_FILE}  ({len(task_a_examples)} lines)")
print(f"  📄 Saved: {TASK_B_FILE}  ({len(task_b_examples)} lines)")

# ──────────────────────────────────────────────────────────────
# Write human-readable sample files (first 3 examples, pretty-printed)
# ──────────────────────────────────────────────────────────────
def write_sample(examples, filepath, n=3):
    samples = []
    for ex in examples[:n]:
        samples.append({
            "prompt":  ex["prompt"],
            "answer":  ex["answer"],
            "--- EXPLANATION ---": {
                "prompt_meaning": "What the mobile app sends to the AI after a round",
                "answer_meaning": "What the AI must output — the routing decision"
            }
        })
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

write_sample(task_a_examples, TASK_A_SAMPLE)
write_sample(task_b_examples, TASK_B_SAMPLE)
print(f"  🔍 Sample: {TASK_A_SAMPLE}  (first 3 examples, human-readable)")
print(f"  🔍 Sample: {TASK_B_SAMPLE}  (first 3 examples, human-readable)")

# ──────────────────────────────────────────────────────────────
# Distribution report
# ──────────────────────────────────────────────────────────────
from collections import Counter
reason_counts = Counter(ex["answer"]["reason_code"] for ex in task_a_examples)
total = sum(reason_counts.values())
print("\n── Task A reason_code distribution ──────────────────────")
for reason, cnt in reason_counts.most_common():
    bar = "█" * int(30 * cnt / total)
    print(f"  {reason:<30} {cnt:>5} ({100*cnt/total:5.1f}%)  {bar}")

trend_counts = Counter(ex["answer"]["trend_id"] for ex in task_b_examples)
print("\n── Task B trend_id distribution ─────────────────────────")
for trend, cnt in trend_counts.most_common():
    bar = "█" * int(30 * cnt / len(task_b_examples))
    print(f"  {trend:<20} {cnt:>5} ({100*cnt/len(task_b_examples):5.1f}%)  {bar}")

print("\n✅ All done.")
