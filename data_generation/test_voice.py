import requests
import json
import time

URL = "http://localhost:8000/api/v1/voice/help"
OUTPUT_FILE = "/Users/chinthangupadhya/.gemini/antigravity/brain/346fb63d-ca90-4a82-b97a-7f12d500e8ad/voice_test_results.md"

languages = {
    "English": {
        "rules": "How do I play Monument Memory?",
        "math": "What is 15 multiplied by 32?",
        "trivia": "Who won the world cup in 2022?",
        "settings": "Change my medicine schedule to 8 AM.",
        "nav": "How do I go back to the home screen?"
    },
    "Hindi": {
        "rules": "Main Monument Memory kaise khelu?",
        "math": "Pandrah ko battis se guna karne par kya aayega?",
        "trivia": "2022 ka world cup kisne jeeta tha?",
        "settings": "Mera dawai ka time subah 8 baje kar do.",
        "nav": "Main home screen par wapas kaise jau?"
    },
    "Bengali": {
        "rules": "Ami Monument Memory kivabe khelbo?",
        "math": "Ponero ke botrish diye gun korle koto hoy?",
        "trivia": "2022 e world cup ke jitechhilo?",
        "settings": "Amar osudh khawar somoy sokal 8 tay kore dao.",
        "nav": "Ami home screen e kivabe firot jabo?"
    },
    "Assamese": {
        "rules": "Moi Monument Memory kenekoi khelu?",
        "math": "Pondhoro aru botrish puron korile kiman hobo?",
        "trivia": "2022 or world cup kune jikise?",
        "settings": "Mur dhorop khua xomoy rati pua 8 bajat kori diyak.",
        "nav": "Moi home screen olol kenekoi ghurim?"
    },
    "Manipuri": {
        "rules": "Eina Monument Memory karamna sannahoughe?",
        "math": "Taranithoi ga taretthu ga chandok-a da kaya leigey?",
        "trivia": "2022 world cup kana na pamkhi?",
        "settings": "Eigi hidak chaba matam ayuk 8 da onthok-o.",
        "nav": "Home screen da karamna han-ge?"
    },
    "Mizo": {
        "rules": "Engtinnge Monument Memory ka khelh ang?",
        "math": "Sawmpanga leh sawmthumpahnih puntir chuan engzatnge ni ang?",
        "trivia": "Kum 2022 world cup kha tu nge la?",
        "settings": "Ka damdawi ei hun zing dar 8-ah min thlak sak rawh.",
        "nav": "Home screen-ah engtinnge ka let leh ang?"
    },
    "Bodo": {
        "rules": "Ang Monument Memory kwo mwrwi gelengwn?",
        "math": "Ji-ba arw Tham-ji-nwi swnjabbla bese jagwn?",
        "trivia": "2022 ni world cup kwo swr derhah-dong-mwn?",
        "settings": "Angni mulug jana-nai som kwo phungni 8 bajia-w kalalm.",
        "nav": "Home screen a-w ang mwrwi hw-pw-nangw?"
    },
    "Khasi": {
        "rules": "Kumno nga lehkai ia ka Monument Memory?",
        "math": "Khatsan pynroi bad lai phew ar man katno?",
        "trivia": "Mano ba jop ia ka world cup ha ka snem 2022?",
        "settings": "Pynkylla ia ka por bam dawai jong nga sha ka 8 baje mynstep.",
        "nav": "Kumno ngan leit phai sha ka home screen?"
    }
}

def test_api(query):
    payload = {"user_query": query}
    try:
        response = requests.post(URL, json=payload, timeout=15)
        return response.json().get("spoken_response", "Error: No response")
    except Exception as e:
        return f"Error: {e}"

with open(OUTPUT_FILE, "w") as f:
    f.write("# Voice Assistant Multilingual & Guardrail Testing\n\n")
    f.write("This document contains the exact real-time responses from the API when hit with various edge cases and languages.\n\n")
    
    for lang, tests in languages.items():
        f.write(f"## {lang}\n\n")
        f.write("| Feature/Guardrail | Input Query | System Response |\n")
        f.write("|-------------------|-------------|-----------------|\n")
        
        for feature, query in tests.items():
            print(f"Testing {lang} - {feature}...")
            resp = test_api(query)
            # escape pipes for markdown tables
            safe_resp = resp.replace('|', '\\|').replace('\n', ' ')
            f.write(f"| **{feature.capitalize()}** | {query} | {safe_resp} |\n")
            time.sleep(0.5)
        f.write("\n")
        
print("Testing complete. Results saved.")
