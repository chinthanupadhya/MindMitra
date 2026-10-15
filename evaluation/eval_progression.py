import json
import re
from pathlib import Path
from llama_cpp import Llama
from tqdm import tqdm

EVAL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = EVAL_DIR.parent

MODEL_PATH = PROJECT_ROOT / "conversion" / "qwen2.5-1.5b-instruct.Q4_K_M.gguf"
if not MODEL_PATH.exists():
    MODEL_PATH = EVAL_DIR / "qwen2.5-1.5b-instruct.Q4_K_M.gguf"

TEST_DATA_PATH = PROJECT_ROOT / "data_generation" / "test.jsonl"
if not TEST_DATA_PATH.exists():
    TEST_DATA_PATH = EVAL_DIR / "test.jsonl"

llm = Llama(
    model_path=str(MODEL_PATH),
    n_ctx=2048,
    n_gpu_layers=-1,
    verbose=False,
)

with open(TEST_DATA_PATH, "r", encoding="utf-8") as f:
    test_data = [json.loads(line) for line in f if line.strip()]

task_a_data = [
    entry
    for entry in test_data
    if "recommended_game_id"
    in json.loads(
        next(
            m["content"] for m in entry["messages"] if m["role"] == "assistant"
        )
    )
]

diff_errors = []
game_correct = 0
total = len(task_a_data)

for entry in tqdm(task_a_data, desc="Evaluating Task A"):
    messages = [m for m in entry["messages"] if m["role"] != "assistant"]
    gt = json.loads(
        next(m["content"] for m in entry["messages"] if m["role"] == "assistant")
    )

    res = llm.create_chat_completion(
        messages=messages, temperature=0.0, max_tokens=256
    )
    raw_pred = res["choices"][0]["message"]["content"].strip()
    clean_pred = re.sub(r"^```(?:json)?\s*", "", raw_pred)
    clean_pred = re.sub(r"\s*```$", "", clean_pred)

    try:
        parsed = json.loads(clean_pred)
        if parsed.get("recommended_game_id") == gt.get("recommended_game_id"):
            game_correct += 1

        gt_diff = gt.get("recommended_difficulty_value")
        pred_diff = parsed.get("recommended_difficulty_value")

        # Scalar numeric comparison
        if isinstance(gt_diff, (int, float)) and isinstance(
            pred_diff, (int, float)
        ):
            diff_errors.append(abs(gt_diff - pred_diff))
        # Composite dictionary comparison
        elif isinstance(gt_diff, dict) and isinstance(pred_diff, dict):
            for k, v in gt_diff.items():
                if k in pred_diff and isinstance(pred_diff[k], (int, float)):
                    diff_errors.append(abs(v - pred_diff[k]))
    except json.JSONDecodeError:
        pass

div = total if total > 0 else 1
mae = sum(diff_errors) / len(diff_errors) if diff_errors else 0.0

print("\n" + "=" * 50)
print("     COMPREHENSIVE TASK A DIFFICULTY BENCHMARK    ")
print("=" * 50)
print(f"Total Samples:             {total}")
print(
    f"Game ID Accuracy:          {game_correct}/{total} ({(game_correct/div)*100:.2f}%)"
)
print(
    f"Comprehensive Param MAE:   {mae:.3f} across {len(diff_errors)} parameters"
)
print("=" * 50)