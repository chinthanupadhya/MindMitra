import GameDifficultyScreen from '../../../components/GameDifficultyScreen';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';

export default function MeetAndGreetDifficultyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleSelect = (difficulty: "easy" | "medium" | "hard") => {
    router.push(`/meet-and-greet/${difficulty}`);
  };

  return (
    <GameDifficultyScreen
      title={t("difficulty")}
      subtitle="Meet & Greet"
      onSelect={handleSelect}
      options={[
        { key: "easy", label: t("easy"), subtitle: "3 People / 5 Questions" },
        { key: "medium", label: t("medium"), subtitle: "5 People / 7 Questions" },
        { key: "hard", label: t("hard"), subtitle: "7 Characters, 3 Traits + Profession/Color" },
      ]}
      extra={[
        {
          label: "Personalize Characters",
          subtitle: "Add photos of friends & family",
          onPress: () => router.push('/meet-and-greet/personalize'),
        },
      ]}
    />
  );
}