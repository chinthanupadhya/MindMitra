import json
from pathlib import Path
from llama_cpp import Llama, LlamaGrammar
from tqdm import tqdm

def main():
    model_path = "conversion/mindmitra_qwen_q4_k_m.gguf"
    test_path = "data_generation/test.jsonl"

    print("Loading Quantized GGUF Model with Metal GPU acceleration...")
    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=-1,
        verbose=False
    )

    # 1. Inspect test dataset to extract dynamic reason_codes
    with open(test_path, "r") as f:
        test_data = [json.loads(line) for line in f if line.strip()]

    extracted_codes = set()
    for entry in test_data:
        for m in entry["messages"]:
            if m["role"] == "assistant":
                try:
                    parsed = json.loads(m["content"])
                    if "reason_code" in parsed:
                        extracted_codes.add(parsed["reason_code"])
                except Exception:
                    pass

    # 2. Build standard JSON Schema
    json_schema = {
        "type": "object",
        "properties": {
            "reason_code": {
                "type": "string",
                "enum": sorted(list(extracted_codes)) if extracted_codes else []
            },
            "recommendation": {"type": "string"},
            "confidence": {"type": "number"}
        },
        "required": ["reason_code", "recommendation"]
    }

    # 3. Create native grammar from the JSON schema
    grammar = LlamaGrammar.from_json_schema(json.dumps(json_schema))

    total = len(test_data)
    valid_json = 0
    correct_reason_code = 0

    print(f"Evaluating native JSON Schema grammar across {total} test samples...")
    for entry in tqdm(test_data):
        messages = entry["messages"]
        input_messages = [m for m in messages if m["role"] != "assistant"]
        ground_truth_raw = next(m["content"] for m in messages if m["role"] == "assistant")
        ground_truth = json.loads(ground_truth_raw)

        response = llm.create_chat_completion(
            messages=input_messages,
            temperature=0.1,
            grammar=grammar,
            max_tokens=256
        )

        output_text = response["choices"][0]["message"]["content"].strip()

        try:
            parsed = json.loads(output_text)
            valid_json += 1
            if parsed.get("reason_code") == ground_truth.get("reason_code"):
                correct_reason_code += 1
        except json.JSONDecodeError:
            pass

    print("\n--- JSON Schema Constrained GGUF Evaluation Results ---")
    print(f"Valid JSON Output: {valid_json}/{total} ({(valid_json/total)*100:.2f}%)")
    print(f"Reason Code Accuracy: {correct_reason_code}/{total} ({(correct_reason_code/total)*100:.2f}%)")

if __name__ == "__main__":
    main()