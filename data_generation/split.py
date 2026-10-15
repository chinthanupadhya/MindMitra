"""split.py - generate, validate, ChatML-format, and 80/10/10-split the synthetic SFT dataset."""

import json
import math
import random
from collections import Counter
from pathlib import Path

from config import GAMES, REPORT_TEMPLATE_IDS
from generate import (
    derive_rng,
    generate_user_session,
    build_report_example,
)

TARGET = 3000
SEED = "mindmitra-sft-3000"

SYSTEM_PROMPT = (
    "You are the adaptive decision engine of MindMitra, a cognitive gaming app for "
    "elderly dementia patients. You never generate display text in any language. "
    "You only emit structured JSON decisions from per-round performance data. "
    "Recommendation rules: if accuracy >= 0.85 and time_taken <= expected_time, recommend "
    "a harder difficulty value for the same game (any value within the bounded range); "
    "if already at max difficulty, recommend a new game from the same cognitive domain "
    "via the domain-overlap graph, preferring the least-recently-played; "
    "if accuracy < 0.5 or recall/genuine error count >= 2, recommend an easier "
    "value for the same game; else hold the current level. "
    "Cold start (no history): default to the screening-assigned level. "
    "For reports: select human-written template IDs (opening/trend/strength/weakness/"
    "suggestion) plus slot values; you never write any sentence yourself. "
    "Reply with the JSON object ONLY."
)

VALID_REASON_CODES = frozenset({
    "recommend_harder",
    "recommend_easier",
    "recommend_hold",
    "recommend_new_game_maxed",
    "cold_start_default",
})

REPORT_TEMPLATE_KINDS = ("opening", "trend", "strength", "weakness", "suggestion")
REPORT_TEMPLATE_IDS_SET = frozenset(
    tid for kind in REPORT_TEMPLATE_KINDS for tid in REPORT_TEMPLATE_IDS[kind]
)


def to_chatml(prompt: str, answer: dict) -> dict:
    """Wrap a (prompt, answer) pair as a Qwen2.5-Instruct ChatML sample."""
    assistant = json.dumps(answer, ensure_ascii=False, sort_keys=True)
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": assistant},
        ]
    }


def _schema_of(answer: dict) -> str:
    if "recommended_game_id" in answer:
        return "task_a_recommendation"
    if answer.get("reason_code") == "still_gathering_data":
        return "task_b_report"
    if "opening_id" in answer:
        return "task_b_report"
    return "unknown"


def _in_bounds(gid: str, v) -> bool:
    """Check if difficulty value is inside the game's [easy, hard] bounds."""
    bounds = GAMES[gid].get("bounds")
    if bounds is None:
        return isinstance(v, (int, float)) and v > 0
    if isinstance(bounds, tuple):
        return isinstance(v, (int, float)) and bounds[0] <= float(v) <= bounds[1]
    if not isinstance(v, dict):
        return False
    if set(v.keys()) != set(bounds.keys()):
        return False
    return all(
        bounds[k][0] <= float(val) <= bounds[k][1]
        for k, val in v.items()
    )


def validate_sample(sample: dict) -> bool:
    """Structural and schema validation for one ChatML sample."""
    msgs = sample.get("messages", [])
    if len(msgs) != 3:
        return False
    if [m["role"] for m in msgs] != ["system", "user", "assistant"]:
        return False
    if any(not m.get("content") for m in msgs):
        return False
    try:
        answer = json.loads(msgs[2]["content"])
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(answer, dict):
        return False

    schema = _schema_of(answer)
    if schema == "task_a_recommendation":
        if not isinstance(answer.get("reason_code"), str):
            return False
        if answer["reason_code"] not in VALID_REASON_CODES:
            return False
        gid = answer.get("recommended_game_id")
        if gid not in GAMES:
            return False
        if not _in_bounds(gid, answer.get("recommended_difficulty_value")):
            return False
    elif schema == "task_b_report":
        # Accept the minimal "still_gathering_data" shape
        if answer.get("reason_code") == "still_gathering_data":
            return True
        # Full template-based report validation
        for kind in REPORT_TEMPLATE_KINDS:
            tid = answer.get(kind + "_id")
            if tid not in REPORT_TEMPLATE_IDS_SET:
                return False
        slots = answer.get("slots", {})
        required = frozenset({
            "name", "n", "domain", "strong_domain", "weak_domain",
            "specific_skill", "recommended_game"
        })
        if not required.issubset(set(slots.keys())):
            return False
        if slots["recommended_game"] not in GAMES:
            return False
    else:
        return False
    return True


def collect_samples(target: int = TARGET, seed: str = SEED):
    """Roll synthetic users until target validated samples are collected."""
    rng = derive_rng(seed)
    samples = []
    n_a = n_b = n_users = 0

    while len(samples) < target:
        n_users += 1
        hist, ta = generate_user_session(f"s{n_users}", rng)

        if len(hist) >= 5 and len(samples) < target:
            long_win = hist[-12:]
            ex_b = build_report_example(hist, long_win, rng)
            sample_b = to_chatml(ex_b["prompt"], ex_b["answer"])
            if validate_sample(sample_b):
                sample_b["_schema"] = "task_b_report"
                samples.append(sample_b)
                n_b += 1

        for ex in ta:
            if len(samples) >= target:
                break
            sample_a = to_chatml(ex["prompt"], ex["answer"])
            if validate_sample(sample_a):
                sample_a["_schema"] = "task_a_recommendation"
                samples.append(sample_a)
                n_a += 1

    return samples, n_a, n_b, n_users


def split_dataset(samples: list, seed: str = "mindmitra-split") -> dict:
    """
    Split samples into train/val/test, stratified by (schema, reason_code).

    Task A samples are grouped by their actual reason_code (e.g. recommend_harder).
    Task B samples are grouped under the placeholder reason_code "report".
    Each group is independently split 80/10/10, so every category is
    proportionally represented in all three splits.
    """
    rng = random.Random(seed)
    by_group = {}
    for s in samples:
        schema = s.get("_schema", "")
        if schema == "task_a_recommendation":
            ans = json.loads(s["messages"][2]["content"])
            reason = ans["reason_code"]
        else:
            reason = "report"  # placeholder for task_b
        key = (schema, reason)
        by_group.setdefault(key, []).append(s)

    splits = {"train": [], "val": [], "test": []}
    for group in by_group.values():
        rng.shuffle(group)
        n = len(group)
        n_val = round(n * 0.10)
        n_test = round(n * 0.10)
        n_train = n - n_val - n_test
        splits["train"].extend(group[:n_train])
        splits["val"].extend(group[n_train:n_train + n_val])
        splits["test"].extend(group[n_train + n_val:])

    for key in splits:
        rng.shuffle(splits[key])
    return splits


def _strip_meta(samples: list) -> list:
    return [{"messages": s["messages"]} for s in samples]


def write_jsonl(path: Path, samples: list) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        for s in samples:
            fh.write(json.dumps(s, ensure_ascii=False) + "\n")


def summarize(samples: list, label: str) -> dict:
    schemas = Counter(s.get("_schema", "") for s in samples)
    reason_counts = Counter()
    games = Counter()
    for s in samples:
        if s.get("_schema") != "task_a_recommendation":
            continue
        ans = json.loads(s["messages"][2]["content"])
        reason_counts[ans["reason_code"]] += 1
        games[ans["recommended_game_id"]] += 1

    out = {
        "label": label,
        "n": len(samples),
        "task_a": schemas.get("task_a_recommendation", 0),
        "task_b": schemas.get("task_b_report", 0),
        "reason_codes": dict(reason_counts),
        "current_games": dict(games),
    }
    return out


def print_reason_distribution(samples: list, label: str) -> None:
    """Print full Task A reason_code distribution with percentages and under-5% flags."""
    reason_counts = Counter()
    for s in samples:
        if s.get("_schema") != "task_a_recommendation":
            continue
        ans = json.loads(s["messages"][2]["content"])
        reason_counts[ans["reason_code"]] += 1
    total_a = sum(reason_counts.values())
    print(f"\n{label} Task A reason_code distribution:")
    for reason, cnt in reason_counts.most_common():
        pct = 100.0 * cnt / total_a if total_a else 0.0
        flag = "  <-- under 5%" if pct < 5.0 else ""
        print(f"  {reason}: {cnt} ({pct:.1f}%){flag}")


def oversample_reasons(samples: list, rng, target_reasons, min_pct=0.15,
                       theta_mean=1.2, theta_std=0.4) -> list:
    """
    Generate supplemental high-performance users until each target reason
    reaches at least min_pct of the ORIGINAL task_a samples.
    Only examples with a target reason are kept.
    """
    # Compute current reason distribution
    reason_counts = Counter()
    for s in samples:
        if s.get("_schema") != "task_a_recommendation":
            continue
        ans = json.loads(s["messages"][2]["content"])
        reason_counts[ans["reason_code"]] += 1
    original_total_a = sum(reason_counts.values())

    # Fixed target counts based on the original total (not recalculated each iteration)
    target_counts = {r: math.ceil(min_pct * original_total_a) for r in target_reasons}

    # Track which reasons still need more examples
    remaining = {r for r in target_reasons if reason_counts.get(r, 0) < target_counts[r]}

    # Safety cap to prevent infinite loops
    max_supp_users = 5000
    supp_users_used = 0

    while remaining and supp_users_used < max_supp_users:
        supp_users_used += 1
        hist, ta = generate_user_session(
            f"supp_{len(samples)}", rng,
            theta_mean=theta_mean, theta_std=theta_std
        )
        # Process examples from this user
        for ex in ta:
            reason = ex["answer"]["reason_code"]
            if reason not in remaining:
                continue  # skip if not a target reason or already reached target
            sample = to_chatml(ex["prompt"], ex["answer"])
            if not validate_sample(sample):
                continue
            sample["_schema"] = "task_a_recommendation"
            samples.append(sample)
            reason_counts[reason] += 1
            # Check if this reason has now reached its fixed target
            if reason_counts[reason] >= target_counts[reason]:
                remaining.discard(reason)

    if supp_users_used >= max_supp_users:
        print(f"WARNING: Reached safety cap of {max_supp_users} supplemental users. "
              f"Some target reasons may not have reached their fixed target counts.")
    print(f"Oversampling used {supp_users_used} supplemental users.")
    print("Final reason_code distribution after oversampling:")
    for r in target_reasons:
        print(f"  {r}: {reason_counts.get(r, 0)} (target {target_counts[r]})")
    return samples


def oversample_task_b(samples: list, rng, target_ratio=0.30, max_supp_users=5000) -> list:
    """
    Add synthetic Task B (report) examples until Task B reaches target_ratio
    of the FINAL total (task_a + task_b). Uses a fixed target count computed
    from the current task_a count, which does not change during this loop.
    """
    # Count current schemas
    task_a_count = sum(1 for s in samples if s.get("_schema") == "task_a_recommendation")
    task_b_count = sum(1 for s in samples if s.get("_schema") == "task_b_report")
    print(f"Task B oversampling: current task_a={task_a_count}, task_b={task_b_count}")

    # Fixed target: solve for task_b such that task_b / (task_a + task_b) >= target_ratio
    # task_b >= target_ratio * (task_a + task_b)
    # task_b * (1 - target_ratio) >= target_ratio * task_a
    # task_b >= (target_ratio * task_a) / (1 - target_ratio)
    target_task_b_count = math.ceil((target_ratio * task_a_count) / (1 - target_ratio))
    print(f"Task B oversampling: fixed target_task_b_count = {target_task_b_count}")

    supp_users_used = 0
    while task_b_count < target_task_b_count and supp_users_used < max_supp_users:
        supp_users_used += 1
        hist, ta = generate_user_session(f"taskb_supp_{len(samples)}", rng)
        if len(hist) < 5:
            continue
        long_win = hist[-12:]
        ex_b = build_report_example(hist, long_win, rng)
        sample_b = to_chatml(ex_b["prompt"], ex_b["answer"])
        if not validate_sample(sample_b):
            continue
        sample_b["_schema"] = "task_b_report"
        samples.append(sample_b)
        task_b_count += 1

    if supp_users_used >= max_supp_users:
        print(f"WARNING: Reached safety cap of {max_supp_users} supplemental users for Task B oversampling. "
              f"Task B count is {task_b_count}, target was {target_task_b_count}.")
    print(f"Task B oversampling used {supp_users_used} supplemental users. Final task_b={task_b_count}.")
    return samples


def main() -> None:
    data_dir = Path(__file__).resolve().parent
    print(f"Generating {TARGET} synthetic ChatML samples (seed={SEED})...")
    samples, n_a, n_b, n_users = collect_samples()
    print(f"Rolled {n_users} synthetic users -> {len(samples)} samples (task_a={n_a}, task_b={n_b})")

    # Print initial Task A reason_code distribution
    print_reason_distribution(samples, "Initial")

    # Oversample rare high-performance reasons if needed
    target_reasons = {"recommend_harder", "recommend_new_game_maxed"}
    rng = derive_rng(SEED)  # reuse the same seed for reproducibility
    samples = oversample_reasons(samples, rng, target_reasons, min_pct=0.15)

    # Print final distribution after oversampling
    print_reason_distribution(samples, "After oversampling")

    # Oversample Task B to reach 30% of final total
    samples = oversample_task_b(samples, rng)

    # Split into train/val/test
    splits = split_dataset(samples)
    for name in ("train", "val", "test"):
        chunk = splits[name]
        write_jsonl(data_dir / f"{name}.jsonl", _strip_meta(chunk))
        stats = summarize(chunk, name)
        print(f"[{name}] {stats}")
        # Print per-split reason distribution
        print_reason_distribution(chunk, f"[{name}]")

    print(
        f"Finished. train.jsonl={len(splits['train'])}, "
        f"val.jsonl={len(splits['val'])}, test.jsonl={len(splits['test'])}"
    )


if __name__ == "__main__":
    main()
