"""
generate.py
Synthetic SFT dataset generation for the MindMitra LLM decision layer.
"""
import hashlib
import numpy as np
from config import GAMES, DOMAIN_OVERLAP_GRAPH, REPORT_TEMPLATE_IDS

# --------------------------------------------------------------------------- #
# RNG & Statistical Helpers
# --------------------------------------------------------------------------- #
def derive_rng(seed):
    if isinstance(seed, int):
        return np.random.default_rng(seed)
    h = int(hashlib.sha256(str(seed).encode()).hexdigest(), 16)
    return np.random.default_rng(h % (2**32))

def ex_gaussian(mu, sigma, beta, rng):
    return max(1.0, float(mu + rng.normal(0.0, sigma) + rng.exponential(beta)))

def unit_count(game_cfg, difficulty_value):
    if isinstance(difficulty_value, dict):
        val = float(np.mean(list(difficulty_value.values())))
    elif isinstance(difficulty_value, (tuple, list)):
        val = float(np.mean(difficulty_value))
    else:
        val = float(difficulty_value)
    return max(1.0, val)

def expected_time(game_cfg, difficulty_value):
    exp_cfg = game_cfg["expected_time_sec"]
    base = float(exp_cfg["base_sec"])
    per_unit = float(exp_cfg["per_unit_sec"])
    return round(base + per_unit * unit_count(game_cfg, difficulty_value), 4)

def generate_time(game_cfg, difficulty_value, rng, theta):
    mu = expected_time(game_cfg, difficulty_value)
    sigma = mu * 0.18
    base_beta = float(game_cfg["expected_time_sec"]["base_sec"]) * 0.35
    # Ability scaling: lower theta -> larger beta (heavier tail, slower responses)
    sigmoid = 1.0 / (1.0 + np.exp(-theta))
    # Centered multiplier: 1.0 at average ability (sigmoid=0.5),
    # <1.0 for high ability (fast), >1.0 for low ability (slow)
    ability_multiplier = 2.0 * (1.0 - sigmoid)
    beta = base_beta * ability_multiplier
    return round(float(ex_gaussian(mu, sigma, beta, rng)), 1)

# --------------------------------------------------------------------------- #
# IRT 2PL error probability
# --------------------------------------------------------------------------- #
def discrimination(game_cfg):
    domain = game_cfg["primary_domain"]
    return {
        "recall": 2.0, "executive_function": 1.5, "visuospatial": 1.2,
        "semantic_memory": 1.3, "language_processing": 1.4
    }.get(domain, 1.4)

def _bounds_tuple(bounds):
    if isinstance(bounds, tuple):
        return bounds
    vals = list(bounds.values())
    return min(v[0] for v in vals), max(v[1] for v in vals)

def difficulty_b(game_cfg):
    bounds = game_cfg.get("bounds")
    if bounds is None:
        return 0.0
    lo, hi = _bounds_tuple(bounds)
    span = hi - lo
    if span <= 1e-9:
        return 0.0
    mid = lo + 0.55 * span
    return float((mid - (lo + span / 2.0)) * 4.0 / span)

def error_probability(game_cfg, theta, rng):
    slip = 0.05
    a = discrimination(game_cfg)
    b = difficulty_b(game_cfg)
    p = slip + (1.0 - slip) / (1.0 + np.exp(a * (theta - b)))
    return float(np.clip(p, 0.02, 0.85))

def draw_ability(rng, theta_mean=0.1, theta_std=0.7):
    return float(rng.normal(theta_mean, theta_std))

# --------------------------------------------------------------------------- #
# Round outcome sampling
# --------------------------------------------------------------------------- #
SLIP_ERROR_TYPES = ["slip_double_tap", "slip_misplaced"]
GENUINE_ERROR_TYPES = [
    "recall_failure", "wrong_pair", "wrong_location", "wrong_person",
    "planning_error", "misplaced_item", "wrong_category"
]
HEAVY_ERROR_TYPES = frozenset(GENUINE_ERROR_TYPES)

def sample_round_outcome(p_err, rng, completed):
    attempts = int(1 + rng.choice([0, 1, 2, 3])) if rng.random() < 0.72 else 1
    errors = int(np.clip(rng.binomial(attempts, min(p_err, 0.99)), 0, attempts - 1)) if completed else attempts
    correct = attempts - errors
    error_types = []
    if errors > 0:
        gen_share = (p_err - 0.03) / max(p_err, 1e-6)
        for _ in range(errors):
            genuine = rng.random() < gen_share
            pool = GENUINE_ERROR_TYPES if genuine else SLIP_ERROR_TYPES
            error_types.append(str(rng.choice(pool)))
    return attempts, correct, errors, error_types

# --------------------------------------------------------------------------- #
# Difficulty / routing helpers
# --------------------------------------------------------------------------- #
def starting_difficulty(game_id, rng):
    game_cfg = GAMES[game_id]
    presets = game_cfg.get("presets")
    bounds = game_cfg.get("bounds")
    if not presets:
        return 5.0
    idx = int(rng.choice([0] * 8 + list(range(len(presets))))) if len(presets) > 1 else 0
    val = presets[idx]
    if isinstance(val, (tuple, list)) and isinstance(bounds, dict):
        return dict(zip(bounds.keys(), val))
    return val

def bumped_difficulty(game_cfg, cur, rng):
    bounds = game_cfg.get("bounds")
    if isinstance(bounds, tuple):
        cur_val = cur if isinstance(cur, (int, float)) else bounds[0]
        return round(float(np.clip(cur_val + 2.0, bounds[0], bounds[1])), 2)
    if isinstance(bounds, dict):
        out = {}
        for k, (lo, hi) in bounds.items():
            cur_k = cur[k] if isinstance(cur, dict) and k in cur else lo
            out[k] = round(float(np.clip(cur_k + 2.0, lo, hi)), 2)
        return out
    return cur

def lowered_difficulty(game_cfg, cur, rng):
    bounds = game_cfg.get("bounds")
    if isinstance(bounds, tuple):
        cur_val = cur if isinstance(cur, (int, float)) else bounds[0]
        return round(float(np.clip(cur_val - 2.0, bounds[0], bounds[1])), 2)
    if isinstance(bounds, dict):
        out = {}
        for k, (lo, hi) in bounds.items():
            cur_k = cur[k] if isinstance(cur, dict) and k in cur else lo
            out[k] = round(float(np.clip(cur_k - 2.0, lo, hi)), 2)
        return out
    return cur

def overlap_neighbors(gid):
    out = set()
    for cluster in DOMAIN_OVERLAP_GRAPH.values():
        if gid in cluster:
            out.update(cluster)
    out.discard(gid)
    return sorted(out)

def next_game(history, rng):
    if not history:
        return str(rng.choice(list(GAMES.keys())))
    gid = history[-1]["game_id"]
    candidates = overlap_neighbors(gid)
    if not candidates:
        return gid
    played = [r["game_id"] for r in history[::-1]]
    for cid in candidates:
        if cid not in played:
            return cid
    last_used = {cid: played.index(cid) for cid in candidates}
    return min(last_used, key=last_used.get)

# --------------------------------------------------------------------------- #
# Feature tokenization & Decision Rule
# --------------------------------------------------------------------------- #
def round_tokens(r):
    dv = r["difficulty_value"]
    if isinstance(dv, dict):
        dv = ";".join(f"{k}:{v}" for k, v in dv.items())
    elif isinstance(dv, (tuple, list)):
        dv = ";".join(str(x) for x in dv)
    return (
        f"g={r['game_id']} src={r['difficulty_source']} v={dv} "
        f"t={r['time_taken_sec']} exp={r['expected_time_sec']} "
        f"att={r['total_attempts']} cor={r['correct_count']} err={r['error_count']} "
        f"et=[{','.join(r['error_types'])}] done={'1' if r['completed'] else '0'} acc={r['accuracy']}"
    )

REASON_GO_HARDER = "recommend_harder"
REASON_MAXED_NEW_GAME = "recommend_new_game_maxed"
REASON_EASIER = "recommend_easier"
REASON_HOLD = "recommend_hold"
REASON_COLD_START = "cold_start_default"

def window_accuracy(window):
    completed = [r for r in window if r["completed"]]
    if not completed: return 0.0
    return float(np.mean([r["accuracy"] for r in completed]))

def window_time_ok(window):
    completed = [r for r in window if r["completed"]]
    if not completed: return False
    ratios = [r["time_taken_sec"] / max(r["expected_time_sec"], 1e-9) for r in completed]
    return float(np.mean([x <= 1.0 for x in ratios])) >= 0.6

def window_recall_errors(window):
    completed = [r for r in window if r["completed"]]
    return sum(1 for r in completed for e in r.get("error_types", []) if e in HEAVY_ERROR_TYPES)

def current_value(rec):
    dv = rec["difficulty_value"]
    if isinstance(dv, dict):
        return float(np.mean(list(dv.values())))
    if isinstance(dv, (tuple, list)):
        return float(np.mean(dv))
    return float(dv)

def at_max(rec):
    game_cfg = GAMES[rec["game_id"]]
    bounds = game_cfg.get("bounds")
    dv = rec["difficulty_value"]
    if bounds is None:
        return current_value(rec) >= 8.0
    if isinstance(bounds, tuple):
        return current_value(rec) >= bounds[1] - 1e-6
    if isinstance(bounds, dict) and isinstance(dv, dict):
        return all(dv.get(k, 0) >= hi - 1e-6 for k, (_, hi) in bounds.items())
    return False

def decide_recommendation(window, history, rng):
    last_round = window[-1]
    game_cfg = GAMES[last_round["game_id"]]
    acc = window_accuracy(window)
    cur_diff = last_round["difficulty_value"]
    
    if acc >= 0.85 and window_time_ok(window):
        if at_max(last_round):
            rec_game = next_game(history, rng)
            return rec_game, starting_difficulty(rec_game, rng), REASON_MAXED_NEW_GAME
        return last_round["game_id"], bumped_difficulty(game_cfg, cur_diff, rng), REASON_GO_HARDER
    if acc <= 0.5 or window_recall_errors(window) >= 2:
        return last_round["game_id"], lowered_difficulty(game_cfg, cur_diff, rng), REASON_EASIER
    return last_round["game_id"], cur_diff, REASON_HOLD

# --------------------------------------------------------------------------- #
# Examples & Session Generation
# --------------------------------------------------------------------------- #
def build_recommendation_example(window, history, rng):
    rec_game, rec_diff, reason = decide_recommendation(window, history, rng)
    prompt = f"Below are the last {len(window)} round records for game {GAMES[window[-1]['game_id']]['name']}. Recommend the next round's game and difficulty. Output JSON only. | " + " | ".join(round_tokens(r) for r in window)
    answer = {"recommended_game_id": rec_game, "recommended_difficulty_value": rec_diff, "reason_code": reason}
    return {"prompt": prompt, "answer": answer}

def build_cold_start_example(history, rng, screening_level):
    last_round = history[-1]
    prompt = f"Below are the last 1 round records for game {GAMES[last_round['game_id']]['name']}. Recommend the next round's game and difficulty. Output JSON only. | " + round_tokens(last_round)
    answer = {
        "recommended_game_id": last_round["game_id"],
        "recommended_difficulty_value": screening_level,
        "reason_code": REASON_COLD_START
    }
    return {"prompt": prompt, "answer": answer}

def _top_domain(long_window):
    acc = {}
    for r in long_window:
        d = GAMES[r["game_id"]]["primary_domain"]
        acc.setdefault(d, []).append(r["accuracy"])
    return max(acc, key=lambda d: float(np.mean(acc[d]))) if acc else "recall"

# Deterministic domain-to-skill mapping for reproducible evaluation
DOMAIN_SKILL_MAP = {
    "recall": "recalling names",
    "visuospatial": "matching pairs under time pressure",
    "executive_function": "planning in advance",
    "semantic_memory": "tracing items in sequence",
    "language_processing": "sustaining focus over longer sessions",
    "attention": "sustaining focus over longer sessions",
    "orientation": "tracing items in sequence",
}

def _weak_domain(long_window, rng):
    domains = {GAMES[r["game_id"]]["primary_domain"] for r in long_window}
    weakest = min(domains, key=lambda d: float(np.mean([r["accuracy"] for r in long_window if GAMES[r["game_id"]]["primary_domain"] == d]))) if len(domains) > 1 else "recall"
    specific_skill = DOMAIN_SKILL_MAP.get(weakest, "recalling names")
    return weakest, specific_skill

def build_report_example(history, long_window, rng):
    if len(long_window) < 5:
        return {"prompt": "gathering-data", "answer": {"reason_code": "still_gathering_data"}}
    accs = [r["accuracy"] for r in long_window]
    first_half = float(np.mean(accs[: len(accs)// 2])) if len(accs) > 4 else float(np.mean(accs))
    second_half = float(np.mean(accs[len(accs)//2:])) if len(accs) > 4 else first_half
    delta = second_half - first_half
    trend_id = "trend_01" if delta > 0.04 else ("trend_07" if delta < -0.04 else "trend_04")
    strong_domain = _top_domain(long_window)
    weak_domain, specific_skill = _weak_domain(long_window, rng)
    slots = {
        "name": "Patient", "n": len(long_window), "domain": strong_domain,
        "strong_domain": strong_domain, "weak_domain": weak_domain,
        "specific_skill": specific_skill, "recommended_game": next_game(history, rng)
    }
    answer = {
        "opening_id": str(rng.choice(REPORT_TEMPLATE_IDS["opening"])),
        "trend_id": trend_id,
        "strength_id": str(rng.choice(REPORT_TEMPLATE_IDS["strength"])),
        "weakness_id": str(rng.choice(REPORT_TEMPLATE_IDS["weakness"])),
        "suggestion_id": str(rng.choice(REPORT_TEMPLATE_IDS["suggestion"])),
        "slots": slots
    }
    return {
        "prompt": f"Below are the last {len(long_window)} round records across all games. Generate the slot-based report template selection. Output JSON only. | " + " | ".join(round_tokens(r) for r in long_window),
        "answer": answer
    }

def generate_user_session(user_id, rng, n_rounds=14, theta_mean=0.1, theta_std=0.7):
    user_theta = draw_ability(rng, theta_mean, theta_std)
    history, task_a = [], []
    current_game = str(rng.choice(list(GAMES.keys())))
    difficulty_value = starting_difficulty(current_game, rng)
    screening_level = difficulty_value  # store the initial screening-assigned level
    cold_start_done = False

    for _ in range(n_rounds):
        game_cfg = GAMES[current_game]
        source = str(rng.choice(["user_selected_preset", "ai_recommended"]))
        # Sample a single per-round ability value (theta + noise)
        ability_sample = user_theta + float(rng.normal(0.0, 0.18))
        p_err = np.clip(error_probability(game_cfg, ability_sample, rng) + (0.05 if source == "ai_recommended" else 0.0), 0.02, 0.85)
        completed = rng.random() >= 0.04
        attempts, correct, errors, error_types = sample_round_outcome(p_err, rng, completed)
        accuracy = float(correct / attempts) if completed else float(np.clip(correct / attempts - rng.uniform(0.0, 0.05), 0.02, 0.35))
        e = expected_time(game_cfg, difficulty_value)
        t = generate_time(game_cfg, difficulty_value, rng, ability_sample) * (rng.uniform(1.2, 3.0) if not completed else 1.0)
        
        history.append({
            "game_id": current_game, "difficulty_source": source, "difficulty_value": difficulty_value,
            "time_taken_sec": round(float(t), 1), "expected_time_sec": round(float(e), 1),
            "total_attempts": attempts, "correct_count": correct, "error_count": errors,
            "error_types": error_types, "completed": completed, "accuracy": round(accuracy, 3)
        })

        # Cold-start example: before we have 2 completed rounds
        if not cold_start_done and len([r for r in history if r["completed"]]) < 2:
            ex_cold = build_cold_start_example(history, rng, screening_level)
            task_a.append(ex_cold)
            cold_start_done = True

        # Regular recommendation example once we have at least 2 completed rounds
        completed_rounds = [r for r in history if r["completed"]]
        if len(completed_rounds) >= 2:
            window = history[-2:]  # last two rounds, regardless of completion
            ex = build_recommendation_example(window, history, rng)
            task_a.append(ex)
            reason, rec_diff = ex["answer"]["reason_code"], ex["answer"]["recommended_difficulty_value"]
            if reason in [REASON_GO_HARDER, REASON_EASIER]:
                difficulty_value = rec_diff
            elif reason == REASON_MAXED_NEW_GAME:
                current_game = ex["answer"]["recommended_game_id"]
                difficulty_value = rec_diff
            else:
                if rng.random() < 0.15:
                    difficulty_value = rec_diff
                if rng.random() < 0.10:
                    current_game = next_game(history, rng)
                    difficulty_value = starting_difficulty(current_game, rng)

    return history, task_a

def generate_users(n_users, rng, theta_mean=0.1, theta_std=0.7):
    histories, task_a = [], []
    for i in range(n_users):
        hist, ta = generate_user_session(f"u{i}", rng, theta_mean=theta_mean, theta_std=theta_std)
        if len(hist) >= 5:
            histories.append(hist)
            task_a.extend(ta)
    return histories, task_a

if __name__ == "__main__":
    rng = derive_rng("mindmitra-sft")
    histories, ta = generate_users(8, rng)
    print(f"users={len(histories)} task_a_examples={len(ta)}")

    # Correlation check: time/expected ratio vs error_count
    all_rounds = []
    for hist in histories:
        all_rounds.extend(hist)
    if all_rounds:
        ratios = [r["time_taken_sec"] / max(r["expected_time_sec"], 1e-9) for r in all_rounds]
        errors = [r["error_count"] for r in all_rounds]
        corr = np.corrcoef(ratios, errors)[0, 1]
        print(f"Pearson correlation between time/expected ratio and error_count: {corr:.3f}")
    else:
        print("No rounds generated.")

    # Task A reason_code distribution
    from collections import Counter
    reason_counts = Counter(ex["answer"]["reason_code"] for ex in ta)
    total_a = sum(reason_counts.values())
    print("\nTask A reason_code distribution:")
    for reason, cnt in reason_counts.most_common():
        pct = 100.0 * cnt / total_a if total_a else 0.0
        flag = "  <-- under 5%" if pct < 5.0 else ""
        print(f"  {reason}: {cnt} ({pct:.1f}%){flag}")
