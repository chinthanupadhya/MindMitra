/**
 * MindMitra translation dictionary.
 *
 * IMPORTANT — read before extending this file:
 * These translations were written using general language knowledge, not
 * verified by native speakers. English, Hindi, and Assamese are commonly
 * represented languages and the translations here are likely solid. Bodo,
 * Khasi, Manipuri (Meitei), and Mizo are far less represented — treat those
 * four as a first draft that a native speaker should review before this
 * goes in front of real elderly patients. Getting a greeting or a safety
 * term (like the SOS label) wrong in someone's own language is worse than
 * leaving it in English, so please verify before relying on this for demo
 * or production use with real users.
 *
 * Coverage: this now spans the app's main navigation, the primary patient
 * screens (Home, My Day, Vitals, Care Circle, Booking, Profile, Journey),
 * and the common UI chrome shared across the memory games (Play Again,
 * Home, Well Done, etc). It does NOT cover game-specific content — question
 * text, character names, monument names, and object labels are data-driven
 * and would need their own translated content, not just UI strings, which
 * is a separate and much larger effort than translating interface chrome.
 */

export type LanguageCode = "en" | "hi" | "as" | "brx" | "kha" | "mni" | "lus";

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "as", label: "অসমীয়া" },
  { code: "brx", label: "Bodo" },
  { code: "kha", label: "Khasi" },
  { code: "mni", label: "Manipuri" },
  { code: "lus", label: "Mizo" },
];

type TranslationKey =
  // header / greeting
  | "greeting_prefix" | "view_profile" | "sos"
  // bottom nav
  | "home" | "vitals" | "booking" | "circle" | "profile" | "my_day" | "journey" | "appointments" | "game_stats"
  // patient home
  | "good_morning" | "tap_to_speak" | "talk_to_mitra" | "memory_games" | "daily_tasks" | "my_progress"
  | "todays_glance" | "activities" | "reminders_label"
  // common actions
  | "save" | "cancel" | "add" | "remove" | "back" | "confirm" | "loading" | "no_data" | "edit"
  | "add_reminder" | "add_reading" | "add_to_circle"
  // vitals
  | "my_vitals" | "health_summary" | "no_reading_yet"
  // care circle
  | "my_care_circle" | "not_alone" | "caregivers_email" | "relationship"
  // booking
  | "book_appointment" | "choose_doctor" | "choose_date" | "choose_time" | "consultation_type"
  | "in_person" | "video_call" | "confirm_appointment" | "upcoming_appointments"
  // profile
  | "my_profile" | "personal_information" | "contact_information" | "emergency_contact"
  | "language" | "log_out"
  // journey
  | "my_journey" | "your_progress" | "day_streak" | "accuracy" | "this_week" | "recent_activity"
  // games common
  | "play" | "play_again" | "well_done" | "correct" | "incorrect" | "your_turn" | "give_up"
  | "score" | "time_taken" | "level" | "easy" | "medium" | "hard" | "difficulty"
  | "sort_into" | "correct_answer_prefix"
  | "day_at_glance" | "memory_activity" | "brain_games" | "see_todays_plan" | "my_appointments"
  | "view_or_book" | "family_circle" | "stay_connected"
  | "everything_you_need" | "today_label" | "todays_progress" | "completed_of" | "hold_to_delete"
  | "morning" | "afternoon" | "nothing_scheduled" | "take_your_time" | "no_rush_text"
  | "support_people_text" | "optional_relationship" | "need_caregiver_account"
  | "call" | "no_one_in_circle_yet" | "not_alone" | "reassurance_text";

type TranslationTable = Record<LanguageCode, Record<TranslationKey, string>>;

// "Namaste" is kept as-is across every language on purpose — it's already
// widely understood and used as a respectful greeting across the region,
// including in Northeast India, so it's the safer choice over guessing at
// a colloquial local greeting that could come across wrong.
export const translations: TranslationTable = {
  en: {
    greeting_prefix: "Namaste,", view_profile: "View Profile", sos: "SOS",
    home: "Home", vitals: "Vitals", booking: "Booking", circle: "Circle", profile: "Profile",
    my_day: "My Day", journey: "Journey", appointments: "Appointments", game_stats: "Game Stats",
    good_morning: "Good Morning", tap_to_speak: "Tap to Speak", talk_to_mitra: "Talk to Mitra",
    memory_games: "Memory Games", daily_tasks: "Daily Tasks", my_progress: "My Progress",
    todays_glance: "Today's Glance", activities: "Activities", reminders_label: "Reminders",
    save: "Save", cancel: "Cancel", add: "Add", remove: "Remove", back: "Back", confirm: "Confirm",
    loading: "Loading…", no_data: "No data yet", edit: "Edit",
    add_reminder: "Add Reminder", add_reading: "Add a Health Reading", add_to_circle: "Add to Circle",
    my_vitals: "My Vitals", health_summary: "Health Summary", no_reading_yet: "No reading yet",
    my_care_circle: "My Care Circle", not_alone: "You're not alone",
    caregivers_email: "Caregiver's email", relationship: "Relationship",
    book_appointment: "Book an Appointment", choose_doctor: "Choose a Doctor", choose_date: "Choose a Date",
    choose_time: "Choose a Time", consultation_type: "Consultation Type", in_person: "In Person",
    video_call: "Video Call", confirm_appointment: "Confirm Appointment", upcoming_appointments: "Upcoming Appointments",
    my_profile: "My Profile", personal_information: "Personal Information",
    contact_information: "Contact Information", emergency_contact: "Emergency Contact",
    language: "Language", log_out: "Log Out",
    my_journey: "My Journey", your_progress: "Your Progress", day_streak: "Day Streak",
    accuracy: "Accuracy", this_week: "This Week", recent_activity: "Recent Activity",
    play: "Play", play_again: "Play Again", well_done: "Well done!", correct: "Correct!",
    incorrect: "Not quite", your_turn: "Your turn", give_up: "Give up?",
    score: "Score", time_taken: "Time taken", level: "Level",
    easy: "Easy", medium: "Medium", hard: "Hard", difficulty: "Difficulty",
    sort_into: "Sort into:", correct_answer_prefix: "The correct answer was:",
    day_at_glance: "Here's your day at a glance.", memory_activity: "Memory Activity", brain_games: "GamePack brain games", see_todays_plan: "See today's plan", my_appointments: "My Appointments", view_or_book: "View or book a visit", family_circle: "Family Circle", stay_connected: "Stay connected",
    everything_you_need: "Everything you need for today, all in one place.", today_label: "TODAY", todays_progress: "Today's Progress", completed_of: "of", hold_to_delete: "Hold a reminder to delete it.", morning: "Morning", afternoon: "Afternoon", nothing_scheduled: "Nothing scheduled for today yet.", take_your_time: "Take your time", no_rush_text: "There's no rush. We'll gently remind you when it's time for your next activity.",
    support_people_text: "The people who are here to support you.", optional_relationship: "Relationship (optional)", need_caregiver_account: "They need to already have a caregiver account in MindMitra.", call: "Call", no_one_in_circle_yet: "No one in your Care Circle yet. Tap \"+ Add\" to invite a caregiver.", reassurance_text: "Your family and care team are here whenever you need support. Hold a name above to remove them.",
  },
  hi: {
    greeting_prefix: "नमस्ते,", view_profile: "प्रोफ़ाइल देखें", sos: "एसओएस",
    home: "होम", vitals: "स्वास्थ्य", booking: "बुकिंग", circle: "सर्कल", profile: "प्रोफ़ाइल",
    my_day: "मेरा दिन", journey: "यात्रा", appointments: "अपॉइंटमेंट", game_stats: "गेम आँकड़े",
    good_morning: "सुप्रभात", tap_to_speak: "बोलने के लिए दबाएं", talk_to_mitra: "मित्रा से बात करें",
    memory_games: "स्मृति खेल", daily_tasks: "दैनिक कार्य", my_progress: "मेरी प्रगति",
    todays_glance: "आज की झलक", activities: "गतिविधियाँ", reminders_label: "रिमाइंडर",
    save: "सहेजें", cancel: "रद्द करें", add: "जोड़ें", remove: "हटाएं", back: "वापस", confirm: "पुष्टि करें",
    loading: "लोड हो रहा है…", no_data: "अभी कोई डेटा नहीं", edit: "संपादित करें",
    add_reminder: "रिमाइंडर जोड़ें", add_reading: "स्वास्थ्य रीडिंग जोड़ें", add_to_circle: "सर्कल में जोड़ें",
    my_vitals: "मेरा स्वास्थ्य", health_summary: "स्वास्थ्य सारांश", no_reading_yet: "अभी कोई रीडिंग नहीं",
    my_care_circle: "मेरा केयर सर्कल", not_alone: "आप अकेले नहीं हैं",
    caregivers_email: "देखभालकर्ता का ईमेल", relationship: "रिश्ता",
    book_appointment: "अपॉइंटमेंट बुक करें", choose_doctor: "डॉक्टर चुनें", choose_date: "तारीख चुनें",
    choose_time: "समय चुनें", consultation_type: "परामर्श का प्रकार", in_person: "व्यक्तिगत रूप से",
    video_call: "वीडियो कॉल", confirm_appointment: "अपॉइंटमेंट की पुष्टि करें", upcoming_appointments: "आगामी अपॉइंटमेंट",
    my_profile: "मेरी प्रोफ़ाइल", personal_information: "व्यक्तिगत जानकारी",
    contact_information: "संपर्क जानकारी", emergency_contact: "आपातकालीन संपर्क",
    language: "भाषा", log_out: "लॉग आउट",
    my_journey: "मेरी यात्रा", your_progress: "आपकी प्रगति", day_streak: "दिन की लगातार गतिविधि",
    accuracy: "सटीकता", this_week: "इस सप्ताह", recent_activity: "हाल की गतिविधि",
    play: "खेलें", play_again: "फिर से खेलें", well_done: "शाबाश!", correct: "सही!",
    incorrect: "गलत", your_turn: "आपकी बारी", give_up: "छोड़ना चाहते हैं?",
    score: "स्कोर", time_taken: "लिया गया समय", level: "स्तर",
    easy: "आसान", medium: "मध्यम", hard: "कठिन", difficulty: "कठिनाई",
    sort_into: "इसमें क्रमबद्ध करें:", correct_answer_prefix: "सही उत्तर था:",
    day_at_glance: "यह रहा आपके दिन का सारांश।", memory_activity: "स्मृति गतिविधि", brain_games: "गेमपैक दिमागी खेल", see_todays_plan: "आज की योजना देखें", my_appointments: "मेरे अपॉइंटमेंट", view_or_book: "मुलाकात देखें या बुक करें", family_circle: "परिवार सर्कल", stay_connected: "जुड़े रहें",
    everything_you_need: "आज के लिए आपकी हर ज़रूरत, एक ही जगह पर।", today_label: "आज", todays_progress: "आज की प्रगति", completed_of: "में से", hold_to_delete: "हटाने के लिए रिमाइंडर को दबाए रखें।", morning: "सुबह", afternoon: "दोपहर", nothing_scheduled: "आज के लिए कुछ भी निर्धारित नहीं है।", take_your_time: "अपना समय लें", no_rush_text: "कोई जल्दी नहीं है। अगली गतिविधि का समय होने पर हम आपको धीरे से याद दिलाएंगे।",
    support_people_text: "वे लोग जो आपका साथ देने के लिए यहाँ हैं।", optional_relationship: "रिश्ता (वैकल्पिक)", need_caregiver_account: "उनका MindMitra में देखभालकर्ता खाता पहले से होना चाहिए।", call: "कॉल करें", no_one_in_circle_yet: "अभी तक आपके केयर सर्कल में कोई नहीं है। देखभालकर्ता को आमंत्रित करने के लिए \"+ जोड़ें\" दबाएं।", reassurance_text: "आपका परिवार और देखभाल टीम जब भी आपको ज़रूरत हो, यहाँ मौजूद है। हटाने के लिए किसी नाम को दबाए रखें।",
  },
  as: {
    greeting_prefix: "নমস্কাৰ,", view_profile: "প্ৰ'ফাইল চাওক", sos: "এছঅ'এছ",
    home: "ঘৰ", vitals: "স্বাস্থ্য", booking: "বুকিং", circle: "চাৰ্কেল", profile: "প্ৰ'ফাইল",
    my_day: "মোৰ দিন", journey: "যাত্ৰা", appointments: "সাক্ষাৎ", game_stats: "গেম পৰিসংখ্যা",
    good_morning: "শুভ ৰাতিপুৱা", tap_to_speak: "কথা ক'বলৈ টিপক", talk_to_mitra: "মিত্ৰাৰ সৈতে কথা কওক",
    memory_games: "স্মৃতি খেল", daily_tasks: "দৈনিক কাম", my_progress: "মোৰ উন্নতি",
    todays_glance: "আজিৰ চমু বিৱৰণ", activities: "কাৰ্যকলাপ", reminders_label: "ৰিমাইণ্ডাৰ",
    save: "সংৰক্ষণ কৰক", cancel: "বাতিল কৰক", add: "যোগ কৰক", remove: "আঁতৰাওক", back: "উভতি যাওক", confirm: "নিশ্চিত কৰক",
    loading: "লোড হৈ আছে…", no_data: "এতিয়ালৈকে তথ্য নাই", edit: "সম্পাদনা কৰক",
    add_reminder: "ৰিমাইণ্ডাৰ যোগ কৰক", add_reading: "স্বাস্থ্য ৰিডিং যোগ কৰক", add_to_circle: "চাৰ্কেললৈ যোগ কৰক",
    my_vitals: "মোৰ স্বাস্থ্য", health_summary: "স্বাস্থ্য সাৰাংশ", no_reading_yet: "এতিয়াও কোনো ৰিডিং নাই",
    my_care_circle: "মোৰ কেয়াৰ চাৰ্কেল", not_alone: "আপুনি অকলা নহয়",
    caregivers_email: "যত্নকাৰীৰ ইমেইল", relationship: "সম্পৰ্ক",
    book_appointment: "সাক্ষাৎ বুক কৰক", choose_doctor: "চিকিৎসক বাছক", choose_date: "তাৰিখ বাছক",
    choose_time: "সময় বাছক", consultation_type: "পৰামৰ্শৰ ধৰণ", in_person: "সৰাসৰি",
    video_call: "ভিডিঅ' কল", confirm_appointment: "সাক্ষাৎ নিশ্চিত কৰক", upcoming_appointments: "আগন্তুক সাক্ষাৎ",
    my_profile: "মোৰ প্ৰ'ফাইল", personal_information: "ব্যক্তিগত তথ্য",
    contact_information: "যোগাযোগৰ তথ্য", emergency_contact: "জৰুৰীকালীন যোগাযোগ",
    language: "ভাষা", log_out: "লগ আউট",
    my_journey: "মোৰ যাত্ৰা", your_progress: "আপোনাৰ উন্নতি", day_streak: "দিনৰ ধাৰাবাহিকতা",
    accuracy: "সঠিকতা", this_week: "এই সপ্তাহত", recent_activity: "শেহতীয়া কাৰ্যকলাপ",
    play: "খেলক", play_again: "পুনৰ খেলক", well_done: "বহুত ভাল!", correct: "শুদ্ধ!",
    incorrect: "ভুল", your_turn: "আপোনাৰ পাল", give_up: "এৰি দিব বিচাৰে নেকি?",
    score: "স্ক'ৰ", time_taken: "লোৱা সময়", level: "স্তৰ",
    easy: "সহজ", medium: "মধ্যম", hard: "কঠিন", difficulty: "কঠিনতা",
    sort_into: "ইয়াত সজাওক:", correct_answer_prefix: "শুদ্ধ উত্তৰ আছিল:",
    day_at_glance: "আপোনাৰ দিনটোৰ চমু বিৱৰণ।", memory_activity: "স্মৃতি কাৰ্যকলাপ", brain_games: "গেমপেক মগজু খেল", see_todays_plan: "আজিৰ পৰিকল্পনা চাওক", my_appointments: "মোৰ সাক্ষাৎ", view_or_book: "সাক্ষাৎ চাওক বা বুক কৰক", family_circle: "পৰিয়াল চাৰ্কেল", stay_connected: "সংযুক্ত থাকক",
    everything_you_need: "আজিৰ বাবে আপোনাৰ প্ৰয়োজনীয় সকলো, এখনতে।", today_label: "আজি", todays_progress: "আজিৰ উন্নতি", completed_of: "টাৰ", hold_to_delete: "আঁতৰাবলৈ ৰিমাইণ্ডাৰ টিপি ধৰক।", morning: "ৰাতিপুৱা", afternoon: "দুপৰীয়া", nothing_scheduled: "আজিৰ বাবে একো নিৰ্ধাৰণ কৰা নাই।", take_your_time: "আপোনাৰ সময় লওক", no_rush_text: "কোনো খৰখেদা নাই। পৰৱৰ্তী কাৰ্যকলাপৰ সময় হলে আমি আপোনাক মৃদুভাৱে মনত পেলাই দিম।",
    support_people_text: "সেই মানুহবোৰ যিসকল আপোনাক সহায় কৰিবলৈ ইয়াত আছে।", optional_relationship: "সম্পৰ্ক (বৈকল্পিক)", need_caregiver_account: "তেওঁলোকৰ MindMitra ত ইতিমধ্যে এটা যত্নকাৰী একাউণ্ট থাকিব লাগিব।", call: "কল কৰক", no_one_in_circle_yet: "এতিয়াও আপোনাৰ কেয়াৰ চাৰ্কেলত কোনো নাই। যত্নকাৰীক আমন্ত্ৰণ জনাবলৈ \"+ যোগ কৰক\" টিপক।", reassurance_text: "আপোনাৰ পৰিয়াল আৰু কেয়াৰ দলটো যেতিয়াই আপোনাৰ প্ৰয়োজন হয় ইয়াত আছে। আঁতৰাবলৈ ওপৰৰ নাম এটা টিপি ধৰক।",
  },
  // Bodo, Khasi, Manipuri, Mizo — first-draft translations, please verify
  // with a native speaker before relying on these.
  brx: {
    greeting_prefix: "Nomoshkar,", view_profile: "Profile nu", sos: "SOS",
    home: "Nokham", vitals: "Slwmwi", booking: "Booking", circle: "Circle", profile: "Profile",
    my_day: "Angni San", journey: "Bathra", appointments: "Sasay", game_stats: "Game Stats",
    good_morning: "Bwrwi San", tap_to_speak: "Bibang nangou", talk_to_mitra: "Mitra jwng orai",
    memory_games: "Sengelnai Games", daily_tasks: "Sanjwrni Mokhang", my_progress: "Angni Growno",
    todays_glance: "Angni Sanni Sengel", activities: "Mokhangfwrwi", reminders_label: "Reminder",
    save: "Bikhaya", cancel: "Khantho", add: "Dagra", remove: "Uzu", back: "Phinba", confirm: "Confirm",
    loading: "Load Jwnwi…", no_data: "Data Gownwi", edit: "Sorjila",
    add_reminder: "Reminder Dagra", add_reading: "Slwmwi Reading Dagra", add_to_circle: "Circle-a Dagra",
    my_vitals: "Angni Slwmwi", health_summary: "Slwmwi Sarangso", no_reading_yet: "Reading Gownwi",
    my_care_circle: "Angni Care Circle", not_alone: "Nong dashi gwjwn",
    caregivers_email: "Care Nangfrwi Email", relationship: "Somoni",
    book_appointment: "Sasay Book Kra", choose_doctor: "Daktor Sailai", choose_date: "San Sailai",
    choose_time: "Somoy Sailai", consultation_type: "Somajoni Bibang", in_person: "Somoyao",
    video_call: "Video Call", confirm_appointment: "Sasay Confirm Kra", upcoming_appointments: "Fwrwini Sasayfwr",
    my_profile: "Angni Profile", personal_information: "Angni Khobor",
    contact_information: "Contact Khobor", emergency_contact: "Emergency Contact",
    language: "Rao", log_out: "Log Out",
    my_journey: "Angni Bathra", your_progress: "Nongni Growno", day_streak: "Sanni Streak",
    accuracy: "Thik-thakoni", this_week: "Wnkhrwni Bihu", recent_activity: "Dasi Mokhangfwr",
    play: "Khel Kra", play_again: "Dwn Khel Kra", well_done: "Gab Zaya!", correct: "Thik!",
    incorrect: "Gum Thika", your_turn: "Nongni Pala", give_up: "Gerbai?",
    score: "Score", time_taken: "Lanai Somoy", level: "Level",
    easy: "Sofa", medium: "Majang", hard: "Gaham", difficulty: "Gahamnai",
    sort_into: "Bosa sailai:", correct_answer_prefix: "Thik jababo yao:",
    day_at_glance: "Nongni sanni khobor.", memory_activity: "Sengelnai Mokhang", brain_games: "GamePack mokhang", see_todays_plan: "Sanni plan nu", my_appointments: "Angni Sasayfwr", view_or_book: "Sasay nu are book kra", family_circle: "Momai Circle", stay_connected: "Jwdwn thangnaya",
    everything_you_need: "Sanni jayga jwng gwswn dagra, sasa jaygaao.", today_label: "SAN", todays_progress: "Sanni Growno", completed_of: "ni", hold_to_delete: "Uzunw reminder-a tini rakha.", morning: "Bwrwi", afternoon: "Dinnyari", nothing_scheduled: "Sanni bathra dagra oi.", take_your_time: "Nongni somoy lai", no_rush_text: "Jwlwi thangdw. Fwrwini mokhang somoyao jwng nonga sengelnaigwn.",
    support_people_text: "Nongkho modai koubw dagra bidin thangnai mansifwr.", optional_relationship: "Somoni (dwnkha)", need_caregiver_account: "Bisyni MindMitra-ao care account dunwi gwnang.", call: "Call Kra", no_one_in_circle_yet: "Nongni Care Circle-ao gaham dwn. Care nangfwr dagra \"+ Dagra\" tini.", reassurance_text: "Nongni momai are care team-a nonga gwnangnai somoyao dunwi. Uzu dagra befo mwngba tini rakha.",
  },
  kha: {
    greeting_prefix: "Kublei,", view_profile: "Peit ïa ka profile", sos: "SOS",
    home: "Ïing", vitals: "Kaba pynbiang jingsngewthuh", booking: "Booking", circle: "Circle", profile: "Profile",
    my_day: "Ka Sngi Jong Nga", journey: "Ka Lam Jingïaid", appointments: "Ka Jingpule", game_stats: "Game Stats",
    good_morning: "Khublei Ka Sngi", tap_to_speak: "Kylli ban ong", talk_to_mitra: "Ong bad Mitra",
    memory_games: "Khelloi Jingmut", daily_tasks: "Ka Kam Sngi", my_progress: "Ka Jingïaid Jong Nga",
    todays_glance: "Peit Ka Sngi", activities: "Ka Kamfwr", reminders_label: "Reminder",
    save: "Ïap", cancel: "Khoi", add: "Thap", remove: "Pule", back: "Kylli sha khyndew", confirm: "Confirm",
    loading: "Kaba pynthymmai…", no_data: "Ym don ka jingïaid", edit: "Pynsngew",
    add_reminder: "Thap Reminder", add_reading: "Thap ka Jingtip Jingsngewthuh", add_to_circle: "Thap ha ka Circle",
    my_vitals: "Ka Jingsngewthuh Jong Nga", health_summary: "Jingpynbna Jingsngewthuh", no_reading_yet: "Ym don ka jingtip",
    my_care_circle: "Ka Care Circle Jong Nga", not_alone: "Phi ym long mynsiem tang",
    caregivers_email: "Email Jong U Nongïarap", relationship: "Kam Kylla",
    book_appointment: "Book ïa ka Jingpule", choose_doctor: "Thew u Duktor", choose_date: "Thew ka Sngi",
    choose_time: "Thew ka Por", consultation_type: "Jaka Jingpule", in_person: "Ha Jaka",
    video_call: "Video Call", confirm_appointment: "Confirm ïa ka Jingpule", upcoming_appointments: "Ka Jingpule Kaba La",
    my_profile: "Ka Profile Jong Nga", personal_information: "Jingtip Longbriew",
    contact_information: "Jingtip Jingïarap", emergency_contact: "Jingïarap Emergency",
    language: "Ktien", log_out: "Log Out",
    my_journey: "Ka Lam Jingïaid Jong Nga", your_progress: "Ka Jingïaid Jong Phi", day_streak: "Ka Streak Sngi",
    accuracy: "Ka Jingtip Kham", this_week: "Ha Ka Bnai", recent_activity: "Ka Kam Kaba Nyngkong",
    play: "Kheloi", play_again: "Kheloi Baroh", well_done: "Long bha!", correct: "Long!",
    incorrect: "Ym Long", your_turn: "Ka Por Jong Phi", give_up: "Duh ka jingkheloi?",
    score: "Score", time_taken: "Por Kaba Pyllait", level: "Level",
    easy: "Bha", medium: "Mynmynhen", hard: "Rem", difficulty: "Kaba Rem",
    sort_into: "Thew ïa kane:", correct_answer_prefix: "Ka jingmalade kaba long:",
    day_at_glance: "Kane ka jingtip ka sngi jong phi.", memory_activity: "Ka Kam Jingmut", brain_games: "GamePack khelloi", see_todays_plan: "Peit ka plan sngi", my_appointments: "Ka Jingpule Jong Nga", view_or_book: "Peit wat book", family_circle: "Ka Circle Iing", stay_connected: "Wan jrong",
    everything_you_need: "Kiba phi lah kwah ïa ka sngi, ha ka jaka lang.", today_label: "SNGI", todays_progress: "Ka Jingïaid Ka Sngi", completed_of: "na", hold_to_delete: "Kylli tang ïa ka reminder ban pule.", morning: "Mynstep", afternoon: "Sepngi", nothing_scheduled: "Ym don khyndiat ka sngi.", take_your_time: "Peit ïa ka por jong phi", no_rush_text: "Ym don jingsakhih. Ngan pynsngew ïa phi haba don ka por bad ka kam kaba mynhynniew.",
    support_people_text: "Ki briew kiba don ha kane ban rukom ïa phi.", optional_relationship: "Kam Kylla (ym khlem)", need_caregiver_account: "Wat don ha ki ka profile nongïarap ha MindMitra.", call: "Kylli", no_one_in_circle_yet: "Ym don khyndiat ha ka Care Circle jong phi. Kylli \"+ Thap\" ban thap u nongïarap.", reassurance_text: "Ka rung bad ka care team jong phi don naduh sha por ba phi kwah. Kylli tang ïa ka kyrteng ban pule.",
  },
  mni: {
    greeting_prefix: "Namaste,", view_profile: "Profile yeng-u", sos: "SOS",
    home: "Yum", vitals: "Hakchang", booking: "Booking", circle: "Circle", profile: "Profile",
    my_day: "Eigi Numit", journey: "Chatnaba", appointments: "Unaba", game_stats: "Game Stats",
    good_morning: "Ayukkha Numit", tap_to_speak: "Ngangnaba tinnou", talk_to_mitra: "Mitra ga ngangnou",
    memory_games: "Ningsing Games", daily_tasks: "Numitkhigi Thabak", my_progress: "Eigi Chaokhatpa",
    todays_glance: "Ngasigi Yengba", activities: "Thabaksing", reminders_label: "Reminder",
    save: "Thamou", cancel: "Cancel Tou", add: "Hapchinnou", remove: "Louthokno", back: "Halakni", confirm: "Confirm Tou",
    loading: "Load Toure…", no_data: "Data Leite", edit: "Semdok Tou",
    add_reminder: "Reminder Hapchinnou", add_reading: "Hakchang Reading Hapchinnou", add_to_circle: "Circle-da Hapchinnou",
    my_vitals: "Eigi Hakchang", health_summary: "Hakchanggi Chumthang", no_reading_yet: "Reading Amata Leite",
    my_care_circle: "Eigi Care Circle", not_alone: "Nahakna Ishadana Leite",
    caregivers_email: "Nongkhonbagi Email", relationship: "Marisang",
    book_appointment: "Unaba Book Tou", choose_doctor: "Doctor Khanbiyu", choose_date: "Numit Khanbiyu",
    choose_time: "Matam Khanbiyu", consultation_type: "Unabagi Makhal", in_person: "Mamangda",
    video_call: "Video Call", confirm_appointment: "Unaba Confirm Tou", upcoming_appointments: "Lakkadaba Unabasing",
    my_profile: "Eigi Profile", personal_information: "Isagi Paokhum",
    contact_information: "Contact Paokhum", emergency_contact: "Emergency Contact",
    language: "Lon", log_out: "Log Out",
    my_journey: "Eigi Chatnaba", your_progress: "Nahakki Chaokhatpa", day_streak: "Numitki Streak",
    accuracy: "Chumna Leiba", this_week: "Chahi Asigi Chayol", recent_activity: "Anouba Thabak",
    play: "Sannou", play_again: "Amuk Sannou", well_done: "Yamna Phajei!", correct: "Achumba!",
    incorrect: "Chumdae", your_turn: "Nahakki Turn", give_up: "Loisin-gadra?",
    score: "Score", time_taken: "Louba Matam", level: "Level",
    easy: "Yamna Laiba", medium: "Marakta", hard: "Kalaba", difficulty: "Kalabagi Mathang",
    sort_into: "Masida thammu:", correct_answer_prefix: "Achumba paokhum adu:",
    day_at_glance: "Nahakki numitki paokhum asini.", memory_activity: "Ningsing Thabak", brain_games: "GamePack games", see_todays_plan: "Ngasigi plan yengu", my_appointments: "Eigi Unabasing", view_or_book: "Yengu nattraga book tou", family_circle: "Imung Circle", stay_connected: "Punna leiyu",
    everything_you_need: "Ngasigi mathou pumnamak, mapham amada.", today_label: "NGASI", todays_progress: "Ngasigi Chaokhatpa", completed_of: "na", hold_to_delete: "Louthoknaba reminder tinnou.", morning: "Ayukkha", afternoon: "Numidang", nothing_scheduled: "Ngasigi karisu leite.", take_your_time: "Nahakki matam lou", no_rush_text: "Thanaba karisu leite. Matam adu oiraga eikhoina nahakpu ngangbigani.",
    support_people_text: "Nahakpu mateng pangbiba mising asi mapham asida lei.", optional_relationship: "Marisang (khambiba ngamba)", need_caregiver_account: "Makhoi MindMitra-da nongkhonbagi account amuk leiba tai.", call: "Call Tou", no_one_in_circle_yet: "Nahakki Care Circle-da kana amata leite. Nongkhonbabu unaba \"+ Hapchinnou\" tinnou.", reassurance_text: "Nahakki imung amasung care team-na nahakna mathou taba matam khudingda mapham asida lei. Louthoknaba ming amagi mathakta tinna thammu.",
  },
  lus: {
    greeting_prefix: "Chibai,", view_profile: "Profile en", sos: "SOS",
    home: "In", vitals: "Damna", booking: "Booking", circle: "Circle", profile: "Profile",
    my_day: "Ka Ni", journey: "Kawng Zin", appointments: "Inkawmna", game_stats: "Game Stats",
    good_morning: "Chhungril Chibai", tap_to_speak: "Sawi tur khah", talk_to_mitra: "Mitra bia bi",
    memory_games: "Hriatreh Games", daily_tasks: "Ni tin thil tih", my_progress: "Ka Zirtaawmna",
    todays_glance: "Tunni Enna", activities: "Thiltihte", reminders_label: "Reminder",
    save: "Dah", cancel: "Cancel", add: "Thlah", remove: "Paih", back: "Kir leh", confirm: "Confirm",
    loading: "Load a nih…", no_data: "Data awm lo", edit: "Siamdan",
    add_reminder: "Reminder Thlah", add_reading: "Damna Reading Thlah", add_to_circle: "Circle-ah Thlah",
    my_vitals: "Ka Damna", health_summary: "Damna Chungchang", no_reading_yet: "Reading awm lo",
    my_care_circle: "Ka Care Circle", not_alone: "I awm chhiat lo",
    caregivers_email: "Enkawltu Email", relationship: "Inzawmna",
    book_appointment: "Inkawmna Book", choose_doctor: "Doctor Thlang", choose_date: "Ni Thlang",
    choose_time: "Hun Thlang", consultation_type: "Inkawmna Dan", in_person: "Mimal Ngeiin",
    video_call: "Video Call", confirm_appointment: "Inkawmna Confirm", upcoming_appointments: "Inkawmna Lo Awm Tur",
    my_profile: "Ka Profile", personal_information: "Mimal Chanchin",
    contact_information: "Biakna Chanchin", emergency_contact: "Emergency Contact",
    language: "Tawng", log_out: "Log Out",
    my_journey: "Ka Kawng Zin", your_progress: "I Zirtaawmna", day_streak: "Ni Streak",
    accuracy: "Dikna", this_week: "Chhung Hin", recent_activity: "Thil Tih Tawktawk",
    play: "In", play_again: "In Leh", well_done: "Ka lawm e!", correct: "Dik!",
    incorrect: "Dik lo", your_turn: "I chan", give_up: "I chhuah dawn em?",
    score: "Score", time_taken: "Hun Hman", level: "Level",
    easy: "Awlsam", medium: "Zaawn", hard: "Harsa", difficulty: "Harsatna",
    sort_into: "Hetah dah:", correct_answer_prefix: "Chhânna dik chu:",
    day_at_glance: "He hi i ni enna a ni.", memory_activity: "Hriatreh Thiltih", brain_games: "GamePack games", see_todays_plan: "Tunni plan en", my_appointments: "Ka Inkawmnate", view_or_book: "En emaw book", family_circle: "Chhungkaw Circle", stay_connected: "Inzawm reng rawh",
    everything_you_need: "Tunni atana i mamawh apiang, hmun khatah.", today_label: "TUNNI", todays_progress: "Tunni Zirtaawmna", completed_of: "aṭanga", hold_to_delete: "Paih nan reminder khah reng.", morning: "Zingkar", afternoon: "Chhak", nothing_scheduled: "Tunni atan engmah ruahman a awm lo.", take_your_time: "I hun hman ang", no_rush_text: "Chak lo. Thil tih dang hun a lo thleng chuan kan hriattir tawh ang che.",
    support_people_text: "Mi i tanpuitu turte hi.", optional_relationship: "Inzawmna (a ngai lo)", need_caregiver_account: "Anni chuan MindMitra-ah enkawltu account an nei tawh a ngai.", call: "Call", no_one_in_circle_yet: "I Care Circle-ah tumah awm lo va. Enkawltu sawm turin \"+ Thlah\" khah rawh.", reassurance_text: "I chhungte leh care team chu i mamawh apiangin an awm reng. Paih nan hming khah reng.",
  },
};

export function translate(languageCode: string | null | undefined, key: TranslationKey): string {
  const code = (languageCode ?? "en") as LanguageCode;
  return translations[code]?.[key] ?? translations.en[key];
}
