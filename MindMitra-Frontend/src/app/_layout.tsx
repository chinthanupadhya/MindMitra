import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
    <AuthProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="match2" />
        <Stack.Screen name="meet-and-greet" />
        <Stack.Screen name="sequence" />
        <Stack.Screen name="monuments" />
        <Stack.Screen name="triple-stack" />
        <Stack.Screen name="sort-and-match" />
        <Stack.Screen name="missing-objects" />
      </Stack>
    </ThemeProvider>
    </AuthProvider>
    </SafeAreaProvider>
  );
}
