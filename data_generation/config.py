"""data_generation/config.py

Static configuration for the synthetic SFT dataset generation pipeline.
Single source of truth for the game catalog, difficulty parameter bounds,
domain overlap graphs, baseline time estimates, and report template IDs.

All values sourced from `MindMitra_LLM_Build_Spec (1).md` (SIH26003).
No pipeline logic here — generation scripts import this module as data only.

NOTE ON ESTIMATES: numbers not given verbatim in the spec are flagged
"(estimate)" — expected_time_sec baselines in particular are first-pass
guesses for elderly users and must be calibrated against real round data
before training.
"""

# ---------------------------------------------------------------------------
# Game catalog — Spec Section 3 (7 games shipping in the app)
# ---------------------------------------------------------------------------
# Fields per game:
#   name               human label (display text lives in the frontend, not here)
#   primary_domain     primary cognitive domain
#   secondary_domain   secondary domain ("-" where the spec lists none)
#   difficulty_levels  number of preset tiers; None = infinite scaling (no tiers)
#   key_parameter      what the AI's difficulty_value controls
#   presets            preset difficulty values Easy -> Hard, as per Spec §3;
#                      None for games with no tiered presets
#   bounds             AI-recommendation range: Easy value is the LOWER bound,
#                      Hard value the UPPER bound (Spec §4). For multi-parameter
#                      games, a per-key dict.
#   expected_time_sec  {"base_sec", "per_unit_sec", "unit"} baseline estimate
#
# NOTE: "pathfinder" is intentionally absent. It was in the 8-game spec but
# no 8th game exists in the frontend or the `games` table, so it must never be
# a valid AI output — otherwise GPT-4o can recommend a game the app can't launch.
GAMES = {
    "sequence": {
        "name": "Sequence",
        "primary_domain": "recall",
        "secondary_domain": "attention",
        "difficulty_levels": None,            # infinite scaling, no tiers (Spec §3)
        "key_parameter": "sequence_length",
        "presets": None,                      # +1 length per success, no presets
        # max is a soft generation cap only — the live game scales indefinitely
        "bounds": (3, 12),                    # (estimate) min start = 3, cap = 12
        "expected_time_sec": {"base_sec": 45.0, "per_unit_sec": 6.0,
                              "unit": "sequence item"},
    },
    "match2": {
        "name": "Match 2",
        "primary_domain": "visuospatial",
        "secondary_domain": "recall",
        "difficulty_levels": 3,
        "key_parameter": "pairs",
        "presets": [6, 10, 15],               # Easy / Med / Hard (Spec §3)
        "bounds": (6, 15),
        "expected_time_sec": {"base_sec": 30.0, "per_unit_sec": 5.0,
                              "unit": "pair"},
    },
    "meet_and_greet": {
        "name": "Meet & Greet",
        "primary_domain": "recall",
        "secondary_domain": "executive_function",
        "difficulty_levels": 3,
        "key_parameter": "people, questions",
        "presets": [(3, 5), (5, 7), (7, 12)],  # People/Questions (Spec §3)
        "bounds": {"people": (3, 7), "questions": (5, 12)},
        "expected_time_sec": {"base_sec": 60.0, "per_unit_sec": 5.0,
                              "unit": "person; +3.0s per question"},
    },
    "monument_memory": {
        "name": "Monument Memory",
        "primary_domain": "recall",
        "secondary_domain": "language_processing",
        "difficulty_levels": 3,
        "key_parameter": "locations, questions",
        "presets": [(3, 5), (5, 7), (7, 12)],  # Locations/Questions (Spec §3)
        "bounds": {"locations": (3, 7), "questions": (5, 12)},
        "expected_time_sec": {"base_sec": 45.0, "per_unit_sec": 5.0,
                              "unit": "location; +3.0s per question"},
    },
    "missing_objects": {
        "name": "Missing Objects",
        "primary_domain": "visuospatial",
        "secondary_domain": "-",              # no secondary domain listed (Spec §3)
        "difficulty_levels": 3,
        "key_parameter": "missing_items",
        "presets": [3, 4, 4],                 # 3 / 4 / 4 — Hard is timed (Spec §3)
        "bounds": (3, 4),
        "timed_on_hard": True,                # Hard adds a time constraint, not items
        "expected_time_sec": {"base_sec": 30.0, "per_unit_sec": 10.0,
                              "unit": "missing item"},
    },
    "triple_stack": {
        "name": "Triple Stack",
        "primary_domain": "executive_function",
        "secondary_domain": "visuospatial",
        "difficulty_levels": 2,               # Easy / Med only (Spec §3)
        "key_parameter": "card_count",
        "presets": [6, 12],                   # low / high (estimate — not in spec)
        "bounds": (6, 12),
        "expected_time_sec": {"base_sec": 30.0, "per_unit_sec": 3.0,
                              "unit": "card"},
    },
    "sort_match": {
        "name": "Sort & Match",
        "primary_domain": "executive_function",
        "secondary_domain": "semantic_memory",
        "difficulty_levels": 3,
        "key_parameter": "categories, objects",
        "presets": [(2, 6), (3, 9), (4, 12)],  # Categories/Objects (Spec §3)
        "bounds": {"categories": (2, 4), "objects": (6, 12)},
        "expected_time_sec": {"base_sec": 45.0, "per_unit_sec": 4.0,
                              "unit": "category; +2.5s per object"},
    },
}

# ---------------------------------------------------------------------------
# Domain overlap graph — Spec Section 3 (for cross-game routing)
# ---------------------------------------------------------------------------
# Clusters as stated in the spec. When the model recommends moving to a new
# game, candidates come from the game's own cluster(s).
DOMAIN_OVERLAP_GRAPH = {
    # Recall cluster: Sequence <-> Match 2 <-> Meet & Greet <-> Monument Memory
    "recall": ["sequence", "match2", "meet_and_greet", "monument_memory"],
    # Visuospatial cluster: Match 2 <-> Missing Objects <-> Triple Stack
    # (pathfinder excluded — no 8th game exists in the app)
    "visuospatial": ["match2", "missing_objects", "triple_stack"],
    # Semantic/Language: Sort & Match <-> Meet & Greet
    "semantic_language": ["sort_match", "meet_and_greet"],
}

# Explicit edges implied by the clusters, for tie-breaking between equally
# valid next games. Spec §5.4: default to least-recently-played.
DOMAIN_OVERLAP_EDGES = [
    ("sequence", "match2"),
    ("match2", "meet_and_greet"),
    ("meet_and_greet", "monument_memory"),
    ("match2", "missing_objects"),
    ("missing_objects", "triple_stack"),
    ("sort_match", "meet_and_greet"),
]

# ---------------------------------------------------------------------------
# Report template IDs — Spec Section 7 (slot-based modular templates)
# ---------------------------------------------------------------------------
# 5 categories, ~10-12 phrasing variants each (~55-60 templates total, not 200).
# Variant IDs below are placeholders until the human-written English phrasings
# are authored; translation to NER languages is a content task, not AI work
# (Spec §7, §8).
REPORT_TEMPLATE_CATEGORIES = ["opening", "trend", "strength", "weakness", "suggestion"]
REPORT_TEMPLATE_VARIANTS_PER_CATEGORY = 11   # 11 x 5 = 55 templates

REPORT_TEMPLATE_IDS = {
    category: [f"{category}_{i:02d}"
               for i in range(1, REPORT_TEMPLATE_VARIANTS_PER_CATEGORY + 1)]
    for category in REPORT_TEMPLATE_CATEGORIES
}

# Language-variant naming convention: "<category>_<variant>_<lang>",
# e.g. "opening_03_as" = Assamese version of opening variant 3 (Spec §7).
REPORT_TEMPLATE_LANG_SUFFIX_FORMAT = "{category}_{variant:02d}_{lang}"

# Slot keys filled into the assembled template sentence (Spec §7 AI output).
REPORT_TEMPLATE_SLOTS = [
    "name",
    "n",
    "domain",
    "strong_domain",
    "weak_domain",
    "specific_skill",
    "recommended_game",
]
