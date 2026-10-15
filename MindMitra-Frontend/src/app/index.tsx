import { useEffect, useState } from "react";

import AddReminderScreen from "../../screens/AddReminderScreen";
import BookAppointmentScreen from "../../screens/BookAppointmentScreen";
import BookingScreen from "../../screens/BookingScreen";
import CareCircleScreen from "../../screens/CareCircleScreen";
import CaregiverHome from "../../screens/CaregiverHome";
import GamePackGamesScreen from "../../screens/GamePackGamesScreen";
import MyDayScreen from "../../screens/MyDayScreen";
import MyJourneyScreen from "../../screens/MyJourneyScreen";
import PatientHome from "../../screens/PatientHome";
import PatientOnboarding from "../../screens/PatientOnboarding";
import ProfileSettingsScreen from "../../screens/ProfileSettingsScreen";
import TalkToMitraScreen from "../../screens/TalkToMitraScreen";
import { useAuth } from "../context/AuthContext";

type ScreenName =
  | "home"
  | "booking"
  | "circle"
  | "myday"
  | "journey"
  | "mitra"
  | "bookappointment"
  | "onboarding"
  | "profile"
  | "caregiverHome"
  | "gamepack"
  | "addreminder";

export default function Index() {
  const { accountType, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("onboarding");

  const [history, setHistory] = useState<ScreenName[]>([]);

  const navigate = (screen: ScreenName) => {
    if (screen === currentScreen) return;

    setHistory((previousHistory) => [...previousHistory, currentScreen]);

    setCurrentScreen(screen);
  };

  const goBack = () => {
    setHistory((previousHistory) => {
      if (previousHistory.length === 0) {
        return previousHistory;
      }

      const newHistory = [...previousHistory];
      const previousScreen = newHistory.pop();

      if (previousScreen) {
        setCurrentScreen(previousScreen);
      }

      return newHistory;
    });
  };

  // Single source of truth for "are we logged in": whenever AuthContext
  // resolves to no account (whether at startup or after an explicit log
  // out), send the app back to onboarding. This is what makes "Log Out"
  // actually work everywhere, not just on the screen it was pressed from.
  useEffect(() => {
    if (!loading && accountType === null && currentScreen !== "onboarding") {
      setCurrentScreen("onboarding");
      setHistory([]);
    }
  }, [loading, accountType]);

  switch (currentScreen) {
    case "profile":
      return <ProfileSettingsScreen onNavigate={navigate} onBack={goBack} />;

    case "booking":
      return <BookingScreen onNavigate={navigate} onBack={goBack} />;

    case "bookappointment":
      return <BookAppointmentScreen onNavigate={navigate} onBack={goBack} />;

    case "circle":
      return <CareCircleScreen onNavigate={navigate} onBack={goBack} />;

    case "myday":
      return <MyDayScreen onNavigate={navigate} onBack={goBack} />;

    case "addreminder":
      return <AddReminderScreen onBack={goBack} onSaved={goBack} />;

    case "journey":
      return <MyJourneyScreen onNavigate={navigate} onBack={goBack} />;

    case "gamepack":
      return <GamePackGamesScreen onNavigate={navigate} onBack={goBack} />;

    case "mitra":
      return <TalkToMitraScreen onNavigate={navigate} onBack={goBack} />;

    case "caregiverHome":
      // CaregiverHome is fully self-contained with its own internal
      // navigation (its own ScreenName union, its own screen state) — it
      // doesn't call this prop, so passing the outer `navigate` here would
      // just be an unsafe type coercion for no real behavior.
      return <CaregiverHome onBack={goBack} />;

    case "onboarding":
      return <PatientOnboarding onNavigate={navigate} onBack={goBack} />;
    case "home":
    default:
      return <PatientHome onNavigate={navigate} />;
  }
}
