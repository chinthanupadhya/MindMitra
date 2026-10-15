import json
from llama_cpp import Llama, LlamaGrammar

def run():
    print("Loading model and GBNF grammar...")
    llm = Llama(
        model_path="conversion/mindmitra_qwen_q4_k_m.gguf",
        n_ctx=2048,
        n_gpu_layers=-1,
        verbose=False
    )

    with open("inference/mindmitra_schema.gbnf", "r") as f:
        grammar = LlamaGrammar.from_string(f.read())

    system_prompt = "You are MindMitra, an empathetic AI mental health triaging assistant. Analyze user inputs and output strictly structured JSON."

    test_inputs = [
        "I can't stop shaking before exams and my heart is beating so fast I feel dizzy.",
        "Just feeling a bit tired after working 12 hours straight without breaks.",
        "Everything is fine today, just checking in for my daily routine log."
    ]

    for user_input in test_inputs:
        print(f"\nUser: \"{user_input}\"")
        response = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ],
            temperature=0.1,
            grammar=grammar,
            max_tokens=256
        )
        print("MindMitra Output:")
        print(response["choices"][0]["message"]["content"])

if __name__ == "__main__":
    run()