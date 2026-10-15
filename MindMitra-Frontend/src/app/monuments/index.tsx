import GameDifficultyScreen from '../../../components/GameDifficultyScreen';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';

export default function MonumentDifficultyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleSelect = (difficulty: "easy" | "medium" | "hard") => {
    router.push(`/monuments/${difficulty}`);
  };

  return (
    <GameDifficultyScreen
      title={t("difficulty")}
      subtitle="Monument Tour"
      onSelect={handleSelect}
      options={[
        { key: "easy", label: t("easy"), subtitle: "3 Monuments / 5 Questions" },
        { key: "medium", label: t("medium"), subtitle: "5 Monuments / 7 Questions" },
        { key: "hard", label: t("hard"), subtitle: "7 Monuments / 10 Questions" },
      ]}
      extra={[
        {
          label: "Personalize Monuments",
          subtitle: "Add places you've visited",
          onPress: () => router.push('/monuments/personalize'),
        },
      ]}
    />
  );
}