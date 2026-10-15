import json
import re
from pathlib import Path
from tqdm import tqdm
from llama_cpp import Llama

EVAL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = EVAL_DIR.parent

# Updated to use your new fine-tuned GGUF filename
MODEL_PATH = PROJECT_ROOT / "conversion" / "mindmitra_qwen_q4_k_m.gguf"
if not MODEL_PATH.exists():
    MODEL_PATH = EVAL_DIR / "mindmitra_qwen_q4_k_m.gguf"

TEST_DATA_PATH = PROJECT_ROOT / "data_generation" / "test.jsonl"
if not TEST_DATA_PATH.exists():
    TEST_DATA_PATH = EVAL_DIR / "test.jsonl"

llm = Llama(
    model_path=str(MODEL_PATH),
    n_ctx=2048,
    n_gpu_layers=-1,
    verbose=False
)

with open(TEST_DATA_PATH, "r", encoding="utf-8") as f:
    test_data = [json.loads(line) for line in f if line.strip()]

# Filter strictly for Task A rows (Game Routing)
task_a_samples = []
for entry in test_data:
    asst_msg_raw = next((m["content"] for m in entry["messages"] if m["role"] == "assistant"), "{}")
    try:
        expected_json = json.loads(asst_msg_raw)
    except json.JSONDecodeError:
        continue

    if "reason_code" in expected_json:
        task_a_samples.append((entry, expected_json))

print(f"Evaluating Task A across {len(task_a_samples)} isolated samples with progress tracking...\n")

json_parse_success = 0
task_a_correct_route = 0
task_a_mae_sum = 0.0

# Wrapped with tqdm for real-time progress bar visualization
for entry, expected_json in tqdm(task_a_samples, desc="Evaluating Task A", unit="sample"):
    input_messages = [m for m in entry["messages"] if m["role"] != "assistant"]

    res = llm.create_chat_completion(
        messages=input_messages,
        temperature=0.0,
        max_tokens=256,
        repeat_penalty=1.1
    )

    raw_output = res["choices"][0]["message"]["content"].strip()
    clean_output = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_output).strip()

    try:
        pred_json = json.loads(clean_output)
        json_parse_success += 1
    except json.JSONDecodeError:
        continue

    if pred_json.get("recommended_game_id") == expected_json.get("recommended_game_id"):
        task_a_correct_route += 1

    pred_diff = pred_json.get("recommended_difficulty_value", {})
    true_diff = expected_json.get("recommended_difficulty_value", {})
    if isinstance(pred_diff, dict) and isinstance(true_diff, dict):
        diff_errors = [
            abs(float(pred_diff.get(k, 0)) - float(v))
            for k, v in true_diff.items() if k in pred_diff
        ]
        if diff_errors:
            task_a_mae_sum += sum(diff_errors) / len(diff_errors)

total_evaluated = len(task_a_samples)
parsing_rate = (json_parse_success / total_evaluated * 100) if total_evaluated > 0 else 0.0
routing_acc = (task_a_correct_route / total_evaluated * 100) if total_evaluated > 0 else 0.0
avg_mae = (task_a_mae_sum / total_evaluated) if total_evaluated > 0 else 0.0

print("\n" + "=" * 50)
print(f"TASK A EVALUATION RESULTS")
print(f"Valid JSON Parsing Rate: {parsing_rate:.2f}% ({json_parse_success}/{total_evaluated})")
print(f"Routing Accuracy:        {routing_acc:.2f}%")
print(f"Parameter MAE:           {avg_mae:.3f}")
print("=" * 50)