import json
import re
from pathlib import Path
from llama_cpp import Llama

EVAL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = EVAL_DIR.parent

MODEL_PATH = PROJECT_ROOT / "conversion" / "qwen2.5-1.5b-instruct.Q4_K_M.gguf"
if not MODEL_PATH.exists():
    MODEL_PATH = EVAL_DIR / "qwen2.5-1.5b-instruct.Q4_K_M.gguf"

TEST_DATA_PATH = PROJECT_ROOT / "data_generation" / "test.jsonl"
if not TEST_DATA_PATH.exists():
    TEST_DATA_PATH = EVAL_DIR / "test.jsonl"

# Remove chat_format="chatml" to use the embedded GGUF template directly
llm = Llama(
    model_path=str(MODEL_PATH),
    n_ctx=2048,
    n_gpu_layers=-1,
    verbose=False,
)

with open(TEST_DATA_PATH, "r", encoding="utf-8") as f:
    test_data = [json.loads(line) for line in f if line.strip()][:10]

print("=== INSPECTING FIRST 10 SAMPLES ===")
for i, entry in enumerate(test_data):
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

    print(f"\n--- Sample {i+1} ---")
    print(f"Ground Truth: {gt}")
    print(f"Model Output: {clean_pred}")