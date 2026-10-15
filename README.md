# MindMitra — LLM/AI Decision Layer

Cognitive gaming app for elderly dementia patients (SIH26003). The AI never generates
displayed text — it only makes structured decisions (game ID, difficulty value, template
IDs) from per-round performance data. See `MindMitra_LLM_Build_Spec (1).md` for the full
architecture; this repo is the offline build pipeline (Sections 9 & 10) plus the DB and
cloud-path scaffolding.

## Pipeline Stages

Each top-level directory corresponds to one stage of the pipeline. **No logic is
implemented yet** — these are placeholders for the build.

### 1. `data_generation/` — Synthetic SFT Dataset (Spec Section 10)
- Generate 800–1,200 examples minimum (2,500–4,000 for a robust version), ~40–80
  examples per distinct flow state.
- Synthetic performance-pattern examples (accuracy / time / error combinations) covering
  the full parameter range per game — not just the 3 clean difficulty tiers.
- Include deliberate edge cases: abandoned rounds, cold-start (no history), tie-breaking.
- Split 80/10/10 train/val/test, ensuring every state is represented in val/test.
- No translated input phrasing needed (Spec Section 8) — effort goes into
  performance-pattern coverage, not language coverage.

### 2. `training/` — QLoRA Fine-Tuning (Spec Section 9, steps 1–2)
- Base model: Qwen2.5-1.5B-Instruct.
- SFT via LoRA/QLoRA on the decision-schema dataset from stage 1.
- The model's input/output space is numeric/structured only (Spec Sections 5–7).

### 3. `evaluation/` — Held-Out Evaluation (Spec Section 9, step 8)
- Maintain a held-out test set of flow scenarios from stage 1.
- Test the fine-tuned model against the decision rule (Spec Section 5.3).
- Evaluate **before AND after** GGUF quantization — quantization can
  disproportionately hurt JSON fidelity.

### 4. `conversion/` — Merge, GGUF, Quantization (Spec Section 9, steps 3–5)
- Merge LoRA adapters into the base weights.
- Convert the merged model → GGUF.
- Quantize to q4_k_m (best quality/size tradeoff).

### 5. `inference/` — Deployment (Spec Section 9, steps 6–7; Section 11)
- llama.cpp integration (Android/iOS bindings) for on-device offline inference.
- GBNF grammar-constrained decoding to structurally force valid JSON output matching
  the schema.
- Cloud-path system prompt (Spec Section 11): a shared logic spec drives both paths —
  same state definitions, decision rules, and JSON schema, no fine-tuning required.

### 6. `db/` — SQL Schema (Spec Section 6)
- `users`, `rounds` (per-round record, UUID `round_id` + `synced` flag for the
  offline/online dual-DB setup), and `reports` (slot-based template output).

## Requirements
See `requirements.txt`: numpy, pandas, transformers, peft, bitsandbytes, accelerate, torch.
