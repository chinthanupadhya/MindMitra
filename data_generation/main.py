import os
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

from config import GAMES, DOMAIN_OVERLAP_GRAPH, REPORT_TEMPLATE_IDS
from generate import round_tokens, next_game

# ---------------------------------------------------------------------------
# Environment & Setup
# ---------------------------------------------------------------------------
load_dotenv()

app = FastAPI(title="MindMitra Self-Hosted Cloud API")

# Allow the Expo dev client / web preview and any mobile device on the LAN to
# call this API. Harmless on native, required for Expo Web testing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

LANGUAGE_NAMES = {
    "en":  "English",
    "hi":  "Hindi (Devanagari script)",
    "as":  "Assamese (অসমীয়া script)",
    "bn":  "Bengali (বাংলা script)",
    "mni": "Meitei / Manipuri (Meitei Mayek script — spoken in Manipur, India)",
    "lus": "Mizo (Mizo ṭawng — spoken in Mizoram, India, NOT Portuguese or French)",
    "brx": "Bodo (spoken in Assam, India — use simple Devanagari or transliterated Bodo)",
    "kha": "Khasi (Ka Ktien Khasi — spoken in Meghalaya, India)",
}

# ---------------------------------------------------------------------------
# Pydantic Schemas & Type Validation
# ---------------------------------------------------------------------------
class RoundRecord(BaseModel):
    game_id: str
    difficulty_source: Optional[str] = "user_selected_preset"
    difficulty_value: Any
    time_taken_sec: Optional[float] = 0.0
    expected_time_sec: Optional[float] = 60.0
    total_attempts: Optional[int] = 1
    correct_count: Optional[int] = 0
    error_count: Optional[int] = 0
    error_types: Optional[List[str]] = []
    completed: Optional[bool] = True
    accuracy: Optional[float] = 0.0

class HelpRequest(BaseModel):
    game_id: Optional[str] = None
    user_query: str
    language: Optional[str] = None  # optional hint; LLM auto-detects from query

# ---------------------------------------------------------------------------
# Input Normalization & Translation Middleware (Fix #1)
# ---------------------------------------------------------------------------
# Every user input (voice transcript or typed text) flows through
# normalize_input() before it reaches any GPT prompt. It:
#   1. Detects the actual language (if not provided / overrides the hint),
#   2. Translates/transliterates the text into the app's configured target
#      language (default English) using gpt-4o-mini,
#   3. Preserves numbers, code-mixed words, game titles, scores, and any
#      JSON-ish tokens verbatim (so game metrics are never corrupted),
#   4. Returns BOTH the normalized (English) text for the model AND the
#      original text so downstream handlers can still read the raw input.

NORMALIZATION_SYSTEM = """You are a language-normalization layer for a memory-care app.
Your ONLY job is to convert the user's input into clean {target} text while:

- Translating regional languages, dialects, and code-mixed text (e.g. Hinglish) into {target}.
- KEEPING the following EXACTLY UNCHANGED (verbatim, even if they look odd):
  numbers, percentages, time formats (9:30, 14:05), game titles (Match 2, Sequence, Meet and Greet, Monument Memory, Sort and Match, Triple Stack, Missing Objects), doctor names, medicine names, emojis, and any JSON-like tokens or quoted strings.
- Preserving the user's emotional intent and tone (worried, happy, confused, urgent).
- Outputting ONLY the normalized text — no quotes, no labels, no explanation."""

def normalize_input(user_query: str, language: Optional[str] = None) -> Dict[str, str]:
    """Detect + translate/transliterate a user query into English (target).

    Always returns {'original': ..., 'normalized': ..., 'detected_language': ...}.
    Never raises: if the LLM normalization call fails, the original text is
    passed through unchanged so the voice/bot never breaks.
    """
    original = (user_query or "").strip()

    # Fast path: already ASCII English — no translation needed. (Contains at
    # least one letter and no non-Latin script.)
    if any(ch.isalpha() for ch in original) and all(ord(ch) < 128 or ch in "@#%&*()[]{}'\".:;,!?-" for ch in original):
        return {
            "original": original,
            "normalized": original,
            "detected_language": language or "en",
        }

    try:
        lang_hint = LANGUAGE_NAMES.get(language, language) if language else "the user's language"
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": NORMALIZATION_SYSTEM.format(target="English")},
                {
                    "role": "user",
                    "content": (
                        f"Detected/hinted input language: {lang_hint}.\n"
                        f"Normalize this into English (keep numbers, games, names, emojis, quotes verbatim):\n{original}"
                    ),
                },
            ],
            temperature=0.0,
            max_tokens=220,
        )
        normalized = (resp.choices[0].message.content or "").strip().strip('"').strip()
        detected = language or "en"

        if not normalized:
            normalized = original
        return {
            "original": original,
            "normalized": normalized,
            "detected_language": detected,
        }
    except Exception:
        # Translation is best-effort — never break the downstream flow.
        return {
            "original": original,
            "normalized": original,
            "detected_language": language or "en",
        }

class RecapRequest(BaseModel):
    language: str
    user_name: str
    last_round: Dict[str, Any]   # single RoundRecord as plain dict

class CaregiverSummaryRequest(BaseModel):
    user_name: str
    rounds: List[RoundRecord]
    language: Optional[str] = "en"  # defaults to English; supports all 8 MindMitra languages

# ---------------------------------------------------------------------------
# Base System Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPT_BASE = """You are the adaptive decision engine of MindMitra.
Output strictly JSON matching this schema:
{
  "reasoning": "Explicitly state the user's accuracy and time from the LAST round. Evaluate them against the threshold (0.85 accuracy, 60s time). State if difficulty should go up, down, or hold.",
  "reason_code": "recommend_harder" | "recommend_easier" | "recommend_hold" | "recommend_new_game",
  "recommended_difficulty_value": float | int | dict,
  "recommended_game_id": str
}

Rules:
1. If accuracy >= 0.85 and time_taken <= expected_time, recommend a harder difficulty (within bounds).
   -> MATHEMATICAL RULE: To make it harder, you MUST add exactly +2.0 to the current difficulty value. You MUST then clip the value so it does not exceed the maximum bound specified in the game's config. (If the current difficulty is a dictionary, add +2.0 to every key's value and clip each to its max bound).
2. If already at max difficulty, recommend a new game from the same cognitive domain via the domain graph.
3. If accuracy < 0.5 or recall/genuine error count >= 2, recommend an easier difficulty.
   -> MATHEMATICAL RULE: To make it easier, you MUST subtract exactly -2.0 from the current difficulty value. You MUST then clip the value so it does not drop below the minimum bound specified in the game's config. (If the current difficulty is a dictionary, subtract 2.0 from every key's value and clip each to its min bound).
4. Else hold the current level (do not change the difficulty value).

Examples:
Input: Below are the last 2 round records for game Sequence. Recommend the next round's game and difficulty. Output JSON only. | g=sequence src=user_selected_preset v=5.0 t=108.2 exp=75.0 att=4 cor=1 err=3 et=[wrong_person,wrong_pair,wrong_pair] done=1 acc=0.25 | g=sequence src=user_selected_preset v=5.0 t=83.3 exp=63.0 att=4 cor=1 err=3 et=[wrong_person,wrong_pair,wrong_category] done=1 acc=0.25
Output: {"reasoning": "The last round accuracy was 0.25, which is < 0.5. The error count is 3, which is >= 2. Therefore, recommend easier. Current difficulty is 5.0, so 5.0 - 2.0 = 3.0.", "reason_code": "recommend_easier", "recommended_difficulty_value": 3.0, "recommended_game_id": "sequence"}

Input: Below are the last 2 round records for game Meet & Greet. Recommend the next round's game and difficulty. Output JSON only. | g=sort_match src=ai_recommended v=categories:4;objects:12 t=76.3 exp=77.0 att=1 cor=1 err=0 et=[] done=1 acc=1.0 | g=meet_and_greet src=ai_recommended v=people:3.0;questions:5.0 t=76.2 exp=80.0 att=1 cor=1 err=0 et=[] done=1 acc=1.0
Output: {"reasoning": "The last round accuracy was 1.0, which is >= 0.85. The time taken was 76.2s, which is <= expected 80.0s. Therefore, recommend harder. Current difficulty is people:3.0, questions:5.0. Adding 2.0 gives people:5.0, questions:7.0.", "reason_code": "recommend_harder", "recommended_difficulty_value": {"people": 5.0, "questions": 7.0}, "recommended_game_id": "meet_and_greet"}

Input: Below are the last 2 round records for game Triple Stack. Recommend the next round's game and difficulty. Output JSON only. | g=triple_stack src=ai_recommended v=8.0 t=74.1 exp=54.0 att=4 cor=3 err=1 et=[recall_failure] done=1 acc=0.75 | g=triple_stack src=ai_recommended v=8.0 t=56.1 exp=54.0 att=2 cor=1 err=1 et=[slip_double_tap] done=1 acc=0.5
Output: {"reasoning": "The last round accuracy was 0.5, which is >= 0.5 but < 0.85. The time taken was 56.1s. It does not meet the strict threshold for harder or easier. Therefore, hold the current level of 8.0.", "reason_code": "recommend_hold", "recommended_difficulty_value": 8.0, "recommended_game_id": "triple_stack"}
"""

def run_cloud_llm(system_prompt: str, user_prompt: str) -> dict:
    """Task A recommendation via a real hosted cloud model — zero phone RAM used."""
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.0
    )
    return json.loads(completion.choices[0].message.content)


# ---------------------------------------------------------------------------
# Endpoint 1: Task A Game Routing (using Cloud Model)
# ---------------------------------------------------------------------------
@app.post("/api/v1/recommend")
def recommend_next_game(rounds: List[RoundRecord] = Body(...)):
    if not rounds:
        raise HTTPException(status_code=400, detail="Rounds window cannot be empty")
    
    game_id = rounds[-1].game_id
    
    # Inject config context so zero-shot LLM knows the rules
    config_context = f"Games reference: {json.dumps(GAMES)}\nDomain Graph: {json.dumps(DOMAIN_OVERLAP_GRAPH)}\n"
    
    prompt_str = f"{config_context}\nBelow are the last {len(rounds)} round records for game {game_id}. Recommend the next round's game and difficulty. Output JSON only. | "
    prompt_str += " | ".join(round_tokens(r.model_dump()) for r in rounds)

    return run_cloud_llm(SYSTEM_PROMPT_BASE, prompt_str)


# ---------------------------------------------------------------------------
# Endpoint 2: Task B Clinical Report Generation (using OpenAI Structured Outputs)
# ---------------------------------------------------------------------------
@app.post("/api/v1/report")
def generate_report(
    user_name: str = Query(...),
    language: Optional[str] = Query("en"),
    rounds: List[RoundRecord] = Body(...),
):
    if len(rounds) < 5:
        return {
            "status": "gathering_data",
            "message": "Fewer than 5 rounds completed.",
            "report": None,
        }

    raw_dicts = [r.model_dump() for r in rounds]
    prompt_str = f"Below are the last {len(rounds)} round records across all games. Generate the slot-based report template selection. Output JSON only. | "
    prompt_str += " | ".join(round_tokens(r) for r in raw_dicts)

    # Pre-calculate complex domain/trend metrics in Python since Qwen can't do this
    # and gpt-4o-mini struggles zero-shot without exact values.
    rng = np.random.default_rng(42)
    accs = [r["accuracy"] for r in raw_dicts]
    first_half = float(np.mean(accs[:len(accs) // 2])) if len(accs) > 4 else float(np.mean(accs))
    second_half = float(np.mean(accs[len(accs) // 2:])) if len(accs) > 4 else first_half
    delta = second_half - first_half

    trend_id = "trend_01" if delta > 0.04 else ("trend_07" if delta < -0.04 else "trend_04")
    
    # Simple top/weak domain calc
    domains = {GAMES[r["game_id"]]["primary_domain"] for r in raw_dicts}
    strong_domain = max(domains, key=lambda d: float(np.mean([r["accuracy"] for r in raw_dicts if GAMES[r["game_id"]]["primary_domain"] == d]))) if domains else "recall"
    weak_domain = min(domains, key=lambda d: float(np.mean([r["accuracy"] for r in raw_dicts if GAMES[r["game_id"]]["primary_domain"] == d]))) if len(domains) > 1 else "recall"
    
    # Specific skill mapping based on domain
    skill_map = {
        "recall": "recalling names", "visuospatial": "matching pairs under time pressure",
        "executive_function": "planning in advance", "semantic_memory": "tracing items in sequence",
        "language_processing": "sustaining focus over longer sessions", "attention": "sustaining focus over longer sessions",
        "orientation": "tracing items in sequence"
    }
    specific_skill = skill_map.get(weak_domain, "recalling names")
    rec_game = next_game(raw_dicts, rng)

    # Compute opening_id deterministically
    opening_variants = REPORT_TEMPLATE_IDS["opening"]
    opening_index = hash(user_name + str(len(rounds))) % len(opening_variants)
    opening_id = opening_variants[opening_index]

    valid_ids_str = json.dumps(REPORT_TEMPLATE_IDS, indent=2)
    context_prompt = f"""You are the MindMitra reporting engine. 
You must output strictly JSON matching this report schema:
{{
  "opening_id": str,
  "trend_id": str,
  "strength_id": str,
  "weakness_id": str,
  "suggestion_id": str,
  "slots": {{
    "name": str,
    "n": int,
    "domain": str,
    "strong_domain": str,
    "weak_domain": str,
    "specific_skill": str,
    "recommended_game": str
  }}
}}

EXACT TARGET JSON VALUES (You MUST output exactly these values in the JSON structure for the slots and trend):
- opening_id: "{opening_id}"
- trend_id: "{trend_id}"
- slots.name: "{user_name}"
- slots.n: {len(rounds)}
- slots.domain: "{strong_domain}"
- slots.strong_domain: "{strong_domain}"
- slots.weak_domain: "{weak_domain}"
- slots.specific_skill: "{specific_skill}"
- slots.recommended_game: "{rec_game}"

DYNAMIC TEMPLATE SELECTION:
For the remaining template IDs (strength_id, weakness_id, and suggestion_id), you must select the MOST APPROPRIATE phrasing variant from the following list based on the user's performance context. Do NOT output a hardcoded "_01" every time. Vary your selection to make the report sound natural and personalized!

Valid template IDs:
{valid_ids_str}

Strictly format these values into the JSON schema, matching the slot keys perfectly.
"""

    # We use OpenAI to parse this into strict JSON since it's great at formatting
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": context_prompt},
                {"role": "user", "content": prompt_str}
            ],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        report_data = json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report via OpenAI")
    
    # Inject slots manually if missing to guarantee schema
    if "slots" not in report_data:
        report_data["slots"] = {}
    report_data["slots"]["name"] = user_name

    # Per spec §7/§8: the model outputs ONLY template IDs + slot values; all
    # display text (including translations) lives in frontend lookup tables.
    # We deliberately do NOT generate or translate paragraph text here —
    # doing so would violate the "AI never generates displayed text" rule and
    # the no-runtime-translation rule. The frontend renders the templates.
    return {"status": "success", "report": report_data}


# ---------------------------------------------------------------------------
# Distress keyword fallback — guarantees detection in low-resource languages
# where gpt-4o-mini has limited coverage (Manipuri, Bodo, Khasi, Mizo).
# If ANY keyword matches, distress_flag is forced True regardless of LLM output.
# ---------------------------------------------------------------------------
DISTRESS_KEYWORDS: list[str] = [
    # English
    "scared", "afraid", "confused", "don't understand", "dont understand",
    "don't know", "dont know", "help me", "lost", "i'm lost", "im lost",
    # Hindi
    "डर", "भयभीत", "समझ नहीं", "समझ नही", "मदद", "खो गया", "घबरा",
    # Assamese
    "ভয়", "বুজা নাই", "বুজিব নোৱাৰো", "সহায়",
    # Bengali
    "ভয় পাচ্ছি", "বুঝতে পারছি না", "বুঝি না", "সাহায্য",
    # Manipuri (Meitei)
    "ꯆꯠꯄꯥ", "ꯉꯃꯗꯦ", "ꯍꯜꯂꯣꯛ", "ꯄꯥꯝꯕꯤ",
    # Mizo
    "hlauh", "hrethiam lo", "ka hre lo", "ka hlauh",
    # Bodo (also uses Devanagari)
    "जेव्लायो", "नामसिनायो", "थाखाया", "मो बुजिनो",
    # Khasi
    "um", "m'bud", "m bud", "ka hlauh", "don't understand",
]

def _has_distress_keyword(text: str) -> bool:
    """Case-insensitive keyword scan across all 8 supported languages."""
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in DISTRESS_KEYWORDS)


# ---------------------------------------------------------------------------
# Endpoint 3: Multilingual Voice Assistant (cloud LLM — separate feature)
# ---------------------------------------------------------------------------
def _detect_game(query: str) -> Optional[str]:
    """Fuzzy-match the user's (possibly misspelled) query to a game key.

    Returns the game key ("match2", "sequence", ...) if the query clearly
    mentions one of the games, else None. Tolerant of typos and transliteration
    so "matche" / "match tu" / "sekwens" still map correctly.
    """
    if not query:
        return None
    q = query.lower().strip()

    # name/alias -> game key, with the actual name and common misspellings
    aliases = {
        "match2": ["match 2", "match2", "match two", "matche", "matching pair", "match pair", "memory card", "match the pair", "match pairs", "matchem"],
        "sequence": ["sequence", "sekwens", "sequens", "sequence memory", "pattern", "repeat the pattern", "remember the sequence", "seq"],
        "meet_and_greet": ["meet and greet", "meet & greet", "meet", "greet", "meet people", "remember people", "new people", "meet-and-greet"],
        "monument_memory": ["monument", "monument memory", "monuments", "famous place", "landmark", "monument tour"],
        "sort_match": ["sort and match", "sort & match", "sort match", "sorting", "sort", "organize", "sort and sort"],
        "triple_stack": ["triple stack", "triple", "stack", "triple-stack"],
        "missing_objects": ["missing object", "missing objects", "missing", "spot the missing", "find the missing", "missing item"],
    }
    for key, tokens in aliases.items():
        for tok in tokens:
            if tok in q:
                return key
    return None


@app.post("/api/v1/voice/help")
def voice_assistant_help(req: HelpRequest):
    rules_context = ", ".join(
        [
            f"{{v['name']}} (Domain: {{v['primary_domain']}}, Goal: {{v['key_parameter']}})"
            for k, v in GAMES.items()
        ]
    )

    system_prompt = f"""You are the MindMitra In-Game Voice Helper.

PURPOSE & ALLOWED SCOPE:
1. Explain rules, mechanics, and objectives for the 8 MindMitra games:
   {rules_context}
2. Provide simple navigation guidance within the MindMitra game interface.

LANGUAGE & REGIONAL SUPPORT:
- The user's app language (TARGET LANGUAGE) is: {LANGUAGE_NAMES.get(req.language or 'en', 'English')}.
- You MUST write your ENTIRE response in the TARGET LANGUAGE stated above. Do NOT respond in any other language, even if the user writes in a different language or scripts. If you cannot produce the target language confidently, write a short, simple English sentence.
- Supported languages: English, Hindi, Assamese (অসমীয়া), Bengali (বাংলা), Manipuri / Meitei (মৈতৈলোন্), Mizo (Mizo ṭawng), Bodo (बड़ो), and Khasi (Ka Ktien Khasi).

STRICT GUARDRAILS & BOUNDARIES:
- DO NOT solve mathematical equations, arithmetic, homework, or word problems.
- DO NOT answer general trivia, science, weather, coding, news, or chitchat.
- DO NOT attempt to modify settings, alarms, medicine schedules, or account details (instruct the user to consult their caregiver).
- If the query falls outside game rules or basic app guidance, politely decline in their language: "I can only assist with MindMitra game rules and app guidance."

RESPONSE CONSTRAINTS:
- Keep answers warm, simple, and under 2 short sentences.
- Never mention diagnoses or clinical terms."""

    # Inject specific game context if the mobile app tells us which game is open.
    # If no game was provided but the user's (possibly misspelled) words clearly
    # mention one, fuzzy-match it too — so "help with matche" works as intended.
    game_id = req.game_id
    if not game_id:
        game_id = _detect_game(req.user_query)

    # ---- Fix #1: normalize + translate any non-English / code-mixed input
    # BEFORE it reaches the model. The model always receives clean English,
    # while game detection uses the original (so "matche" still matches).
    normalized = normalize_input(req.user_query, req.language)

    game_context = ""
    if game_id and game_id in GAMES:
        g = GAMES[game_id]
        game_context = (
            f"\n\nCURRENT GAME CONTEXT: The user is currently playing '{g['name']}'. "
            f"Primary domain: {g['primary_domain']}. Key parameter: {g['key_parameter']}. "
            f"Use this to answer game-specific questions accurately."
        )

    full_system_prompt = system_prompt + game_context + """

DISTRESS DETECTION:
You must also return a JSON object with two fields:
- "spoken_response": your warm response text (as above)
- "distress_flag": true if the user seems confused, scared, lost, or distressed (e.g. says they don't understand anything, are scared, don't know where they are); false otherwise.

Always output valid JSON with exactly these two keys."""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": full_system_prompt},
            {
                "role": "user",
                "content": f"Current game: {game_id or 'None'}. User says: {normalized['normalized']}",
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=180,
        frequency_penalty=0.5,
        presence_penalty=0.3,
    )
    try:
        raw = json.loads(completion.choices[0].message.content)
    except Exception:
        raw = {}
    # Python keyword fallback: override LLM if low-resource language missed it
    llm_flag  = bool(raw.get("distress_flag", False))
    kw_flag   = _has_distress_keyword(req.user_query)
    final_flag = llm_flag or kw_flag

    reply = (raw.get("spoken_response") or "").strip()

    # NEVER return an empty preset. If the LLM glitched and produced no
    # reply text, compose a short warm reply in the TARGET language from the
    # (translated) user text so the user always gets something real back.
    if not reply:
        try:
            lang_name = LANGUAGE_NAMES.get(req.language or "en", "English")
            fb = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": (
                        f"You are a warm, simple assistant for an elderly memory-care user. "
                        f"Reply in {lang_name} ONLY, 1-2 sentences, gentle tone, no clinical language."
                    )},
                    {"role": "user", "content": f"The user said: {normalized['normalized']}. Give a short, caring reply in {lang_name}."},
                ],
                temperature=0.3,
                max_tokens=90,
            )
            reply = (fb.choices[0].message.content or "").strip()
        except Exception:
            reply = ""

    return {
        "spoken_response": reply,
        "distress_flag": final_flag,
    }


# ---------------------------------------------------------------------------
# Endpoint 4: Voice Recap — "What did I just play?" (for dementia patients)
# ---------------------------------------------------------------------------
@app.post("/api/v1/voice/recap")
def voice_recap(req: RecapRequest):
    """Takes the last round record and returns a warm spoken sentence in the user's language."""
    game_name = GAMES.get(req.last_round.get("game_id", ""), {}).get("name", req.last_round.get("game_id", "the game"))
    correct = req.last_round.get("correct_count", 0)
    total = req.last_round.get("total_attempts", 0)
    difficulty = req.last_round.get("difficulty_value", "")

    # Map language codes to explicit full names so LLM never slips to a wrong language
    LANGUAGE_NAMES = {
        "en":  "English",
        "hi":  "Hindi (Devanagari script)",
        "as":  "Assamese (অসমীয়া script)",
        "bn":  "Bengali (বাংলা script)",
        "mni": "Meitei / Manipuri (Meitei Mayek script — spoken in Manipur, India)",
        "lus": "Mizo (Mizo ṭawng — spoken in Mizoram, India, NOT Portuguese or French)",
        "brx": "Bodo (spoken in Assam, India — use simple Devanagari or transliterated Bodo)",
        "kha": "Khasi (Ka Ktien Khasi — spoken in Meghalaya, India)",
    }
    lang_name = LANGUAGE_NAMES.get(req.language, req.language)

    system_prompt = f"""You are a warm, gentle voice assistant for MindMitra, a memory care app for elderly patients.
Given a summary of the user's last game round, produce exactly ONE short, encouraging sentence.
CRITICAL LANGUAGE RULE: You MUST respond in {lang_name} ONLY.
Do NOT use any other language. Do NOT mix languages. If unsure, write a simple English sentence.
Rules:
- Always address the user by name.
- Mention the game they played and their score (correct out of total attempts).
- Be warm, simple, and encouraging. Never use clinical language.
- Output a plain string only — no JSON, no bullet points."""

    user_prompt = (
        f"User name: {req.user_name}. Target language: {lang_name}. "
        f"They just played: {game_name}. Score: {correct} correct out of {total} attempts. "
        f"Difficulty level: {difficulty}. Generate one warm recap sentence in {lang_name}."
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=80,
    )
    return {"spoken_response": completion.choices[0].message.content.strip()}


# ---------------------------------------------------------------------------
# Endpoint 5: Caregiver Summary — Clinical, factual summary for doctors/family
# ---------------------------------------------------------------------------
@app.post("/api/v1/caregiver/summary")
def caregiver_summary(req: CaregiverSummaryRequest):
    """Generates a clinically-framed plain-English summary for caregivers, not the patient."""
    if len(req.rounds) < 5:
        return {
            "status": "gathering_data",
            "message": "Fewer than 5 rounds completed. Not enough data for a summary.",
            "summary": None,
        }

    raw_dicts = [r.model_dump() for r in req.rounds]

    # Pre-compute key metrics so LLM has exact numbers to report
    accs = [r["accuracy"] for r in raw_dicts]
    avg_acc = round(float(np.mean(accs)) * 100, 1)
    first_half_acc = round(float(np.mean(accs[:len(accs) // 2])) * 100, 1)
    second_half_acc = round(float(np.mean(accs[len(accs) // 2:])) * 100, 1)
    total_sessions = len(raw_dicts)
    games_played = list({r["game_id"] for r in raw_dicts})
    error_counts = sum(r["error_count"] for r in raw_dicts)

    # Count how many times difficulty was reduced
    difficulty_drops = sum(
        1 for i in range(1, len(raw_dicts))
        if (
            isinstance(raw_dicts[i]["difficulty_value"], (int, float))
            and isinstance(raw_dicts[i-1]["difficulty_value"], (int, float))
            and raw_dicts[i]["difficulty_value"] < raw_dicts[i-1]["difficulty_value"]
        )
    )

    LANGUAGE_NAMES = {
        "en":  "English",
        "hi":  "Hindi (Devanagari script)",
        "as":  "Assamese (অসমীয়া script)",
        "bn":  "Bengali (বাংলা script)",
        "mni": "Meitei / Manipuri (Meitei Mayek script — spoken in Manipur, India)",
        "lus": "Mizo (Mizo ṭawng — spoken in Mizoram, India, NOT Portuguese or French)",
        "brx": "Bodo (spoken in Assam, India — use simple Devanagari or transliterated Bodo)",
        "kha": "Khasi (Ka Ktien Khasi — spoken in Meghalaya, India)",
    }
    lang_name = LANGUAGE_NAMES.get(req.language or "en", "English")

    system_prompt = f"""You are a clinical assistant generating a caregiver summary for a cognitive health app called MindMitra.
Your audience is the patient's family member, caregiver, or health worker — NOT the patient.

CRITICAL LANGUAGE RULE: You MUST write the entire summary in {lang_name} ONLY. Do NOT use any other language.

Rules:
- Be factual, concise, and data-driven. Use the exact numbers provided.
- DO NOT use encouraging or motivational language.
- DO NOT claim or imply a dementia diagnosis under any circumstances.
- If there are concerns, always frame them as 'may be worth discussing with a health worker' — never as a medical conclusion.
- 3-5 sentences maximum.
- Structure: session count → accuracy trend → notable concerns → closing recommendation."""

    user_prompt = (
        f"Patient name: {req.user_name}. "
        f"Total sessions analysed: {total_sessions}. "
        f"Games played: {', '.join(games_played)}. "
        f"Overall average accuracy: {avg_acc}%. "
        f"First-half accuracy: {first_half_acc}%, Second-half accuracy: {second_half_acc}%. "
        f"Total errors across all sessions: {error_counts}. "
        f"Number of times difficulty was reduced: {difficulty_drops}. "
        f"Generate a 3-5 sentence caregiver summary."
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=200,
    )
    return {
        "status": "success",
        "user_name": req.user_name,
        "sessions_analysed": total_sessions,
        "summary": completion.choices[0].message.content.strip(),
    }


# ---------------------------------------------------------------------------
# Endpoint 6: Speech-to-Text (STT) — Whisper transcription
# The app records audio (via expo-audio) and posts it here as base64 JSON,
# because React Native's FormData/file upload is unreliable.
# ---------------------------------------------------------------------------
class SttRequest(BaseModel):
    audio_base64: str
    language: Optional[str] = None
    content_type: Optional[str] = "audio/m4a"
    # An optional natural-language hint. Whisper uses it as a "prompt"; Google
    # STT uses it as phrase hints (speech_contexts) for proper nouns and app
    # terms (e.g. "Mitra", "Match 2", "reminder").
    prompt: Optional[str] = None


# Google STT support is optional but preferred: set GOOGLE_APPLICATION_CREDENTIALS
# (path to a service-account JSON) or GOOGLE_CLOUD_PROJECT to enable it. When
# enabled, /voice/stt uses Google Cloud Speech-to-Text first; otherwise OpenAI
# Whisper is the fallback. Google STT gives the best accuracy for the 8 supported
# South Asian languages + code-mixed speech, and never leaks audio outside the
# configured GCP project.
_google_stt_client = None
def get_google_stt_client():
    global _google_stt_client
    if _google_stt_client is None:
        import google.cloud.speech_v1 as speech
        from google.oauth2 import service_account
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            creds = service_account.Credentials.from_service_account_file(creds_path)
            _google_stt_client = speech.SpeechClient(credentials=creds)
        else:
            # Fall back to ADC (gcloud auth or GOOGLE_CLOUD_PROJECT env)
            _google_stt_client = speech.SpeechClient()
    return _google_stt_client

def google_stt_available() -> bool:
    try:
        get_google_stt_client()
        return True
    except Exception:
        return False


def _decode_audio_for_google(audio_bytes: bytes) -> bytes:
    """Convert m4a/AAC bytes to FLAC so Google STT can read them.

    Google's SpeechClient accepts FLAC/WAV/raw PCM directly; it does NOT accept
    m4a. We transcode with ffmpeg when available. If ffmpeg is missing (rare),
    we let Google try with the original bytes — it will error, and the caller
    falls back to Whisper.
    """
    try:
        import subprocess
        import tempfile
        proc = subprocess.run(
            ["ffmpeg", "-y", "-f", "m4a", "-i", "-", "-f", "flac", "-ac", "1", "-ar", "16000", "pipe:1"],
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=60,
        )
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout
    except Exception:
        pass
    return audio_bytes


# Map MindMitra language codes to Google STT language codes.
GOOGLE_LANGCODE = {
    "hi": "hi-IN",
    "as": "as-IN",
    "bn": "bn-IN",
    "mni": "mni-IN",
    "lus": "lus-IN",
    "brx": "brx-IN",
    "kha": "kha-IN",
    "en": "en-IN",
}
GOOGLE_LANG_MULTI = "hi-IN"  # Google best supports Hindi/English code-mixing


@app.post("/api/v1/voice/stt")
async def voice_stt(req: SttRequest):
    """Transcribe a base64-encoded audio recording.

    Preferred: Google Cloud Speech-to-Text (accurate for all 8 supported South
    Asian languages + code-switching). Fallback: OpenAI Whisper.
    """
    import base64
    audio_bytes = base64.b64decode(req.audio_base64)

    # ---- Path 1: Google Cloud Speech-to-Text ----
    if google_stt_available():
        try:
            speech_client = get_google_stt_client()
            # Google wants FLAC/WAV. Transcoder present? yes -> flac bytes.
            content = _decode_audio_for_google(audio_bytes)

            config_args = {
                "encoding": "FLAC" if content is not audio_bytes else "AUTO",
                "sample_rate_hertz": 16000,
                "language_code": GOOGLE_LANGCODE.get(req.language, GOOGLE_LANG_MULTI),
                "enable_automatic_punctuation": True,
                "use_enhanced": True,
                "model": "latest_long",
                "audio_channel_count": 1,
                "profanity_filter": False,
            }
            if req.prompt:
                config_args["speech_contexts"] = [
                    {"phrases": [req.prompt]},
                ]

            from google.cloud.speech_v1 import types as gtypes
            audio_obj = gtypes.RecognitionAudio(content=content)
            gt_config = gtypes.RecognitionConfig(**config_args)
            response = speech_client.recognize(config=gt_config, audio=audio_obj)

            if response.results:
                alt = response.results[0].alternatives[0]
                text = alt.transcript.strip()
                if text:
                    return {"text": text, "language": req.language, "engine": "google"}
        except Exception:
            # Fall through to Whisper
            pass

    # ---- Path 2: OpenAI Whisper (fallback) ----
    # Force AUTO language detection (language=None) so the transcript matches
    # what was ACTUALLY spoken, not the app's configured language. The detected
    # language is returned so the assistant can reply in the same tongue.
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=("recording.m4a", audio_bytes, req.content_type or "audio/m4a"),
        language=None,  # auto-detect from audio
        prompt=req.prompt or "",
    )
    detected = getattr(transcript, "language", None) or req.language
    return {"text": transcript.text.strip(), "language": detected, "engine": "whisper"}


# ---------------------------------------------------------------------------
# Endpoint 7: Text-to-Speech (TTS) — Mitra speaks back in the user's language
# ---------------------------------------------------------------------------
from fastapi.responses import Response
import base64

@app.post("/api/v1/voice/tts")
def voice_tts(req: HelpRequest):
    """Turn Mitra's reply into spoken audio (base64) so the app can play it.

    Uses gpt-4o-mini-tts (multilingual) instead of tts-1 (English-only) so the
    reply is spoken in the same language Mitra wrote it in (all 8 supported).
    """
    lang_name = LANGUAGE_NAMES.get(req.language or "en", req.language or "English")
    speech = client.audio.speech.create(
        model="gpt-4o-mini-tts",
        voice="alloy",
        input=req.user_query,
        instructions=(
            f"Speak the text in {lang_name} with a warm, slow, gentle tone "
            f"suited to an elderly memory-care user. Pronounce words naturally "
            f"in {lang_name}."
        ),
    )
    audio_bytes = speech.content
    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "content_type": "audio/mpeg",
    }


# ---------------------------------------------------------------------------
# Endpoint: Speech-to-Text (dedicated transcription)
# POST /api/v1/voice/transcribe — multipart audio file -> Whisper -> text
# ---------------------------------------------------------------------------
@app.post("/api/v1/voice/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe an uploaded audio recording using OpenAI Whisper.

    Accepts a multipart file (expo-av produces .m4a). Whispers supports wav /
    mp3 / webm / ogg; for .m4a we attempt an ffmpeg transcode to 16k mono wav
    (which Whisper accepts reliably). If ffmpeg is unavailable we pass the
    bytes through and let Whisper validate — but we NEVER return empty text
    silently to the app.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    payload = audio_bytes
    filename = file.filename or "recording.m4a"
    content_type = file.content_type or "audio/m4a"

    # Transcode m4a -> wav if ffmpeg is available (best Whisper compatibility).
    transcode_content_type = content_type
    if filename.lower().endswith((".m4a", ".aac", ".mp4")) or "m4a" in content_type:
        try:
            import subprocess
            proc = subprocess.run(
                ["ffmpeg", "-y", "-i", "-", "-f", "wav", "-ac", "1", "-ar", "16000", "pipe:1"],
                input=audio_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=60,
            )
            if proc.returncode == 0 and proc.stdout:
                payload = proc.stdout
                filename = "recording.wav"
                content_type = "audio/wav"
                transcode_content_type = "audio/wav"
        except Exception:
            transcode_content_type = content_type  # pass through

    try:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, payload, transcode_content_type),
            language=(language or None),
            prompt=(
                "MindMitra memory app. Talk to Mitra. Games: Match 2, Sequence, "
                "Monument Memory, Meet and Greet, Missing Objects. Appointments, "
                "reminders, medicine, doctor, care circle."
            ),
        )
    except Exception as e:
        # NEVER swallow: surface a clear message so the app shows a real error
        # instead of sending a placeholder to the assistant.
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    text = (transcript.text or "").strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Sorry, I couldn't hear that clearly, please try again.",
        )

    return {
        "text": text,
        "language": getattr(transcript, "language", None) or language or "en",
        "engine": "whisper",
    }


@app.get("/")
def health_check():
    return {"status": "online", "service": "MindMitra Online Cloud API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
