import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Dimensions, StatusBar, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { supabase } from '../../lib/supabaseClient';
import { syncService } from '../../lib/syncService';

// Must match the real `games` row for Triple Stack (game_type = 'sequence_match').
const TRIPLE_STACK_GAME_ID = '9eaaafd6-9272-4bc6-89f1-44c6829b56f7';

// ============================================================================
// TRIPLE STACK — Pyramid Edition
// ============================================================================

type Difficulty = 'easy' | 'medium';
type Screen = 'menu' | 'playing' | 'done';

interface CardData { id: string; symbol: string; }
interface Slot { id: string; layer: 0 | 1; row: number; x: number; card: CardData | null; }

const SYMBOLS = ['🍵', '🎋', '🌾', '🐘', '🌺', '🏔️', '⛩️', '🏮', '🏯', '🍣', '🌸', '🎎'];
const TILE = 60;
const UNIT = TILE / 2;
const GAP_Y = 22;
const BUFFER_LIMIT = 8;

const LAYOUT: Record<Difficulty, { rows: number[]; bridges: number[][] }> = {
  easy: { 
    rows: [3, 4, 4, 3], 
    bridges: [[0, 1], [0, 1, 2], [0, 1, 2], [0, 1]] 
  }, // 24 tiles
  medium: { 
    rows: [4, 6, 6, 4], 
    bridges: [[0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2]] 
  }, // 36 tiles
};

const DIFF_INFO: Record<Difficulty, { label: string; desc: string; kinds: number }> = {
  easy: { label: 'Easy', desc: '24 tiles, smaller pyramid', kinds: 8 },
  medium: { label: 'Hard', desc: '36 tiles, bigger pyramid', kinds: 12 },
};

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function buildBoard(diff: Difficulty): Slot[] {
  const { rows, bridges } = LAYOUT[diff];
  const slots: Slot[] = [];
  rows.forEach((len, r) => {
    for (let i = 0; i < len; i++) slots.push({ id: `L0-${r}-${i}`, layer: 0, row: r, x: i * 2, card: null });
    bridges[r].forEach((gapIdx) => {
      slots.push({ id: `L1-${r}-${gapIdx}`, layer: 1, row: r, x: gapIdx * 2 + 1, card: null });
    });
  });

  const kinds = DIFF_INFO[diff].kinds;
  const deck: CardData[] = [];
  SYMBOLS.slice(0, kinds).forEach((symbol, si) => {
    for (let c = 0; c < 3; c++) deck.push({ id: `${si}-${c}-${Math.random().toString(36).slice(2, 7)}`, symbol });
  });
  const shuffled = shuffle(deck);
  return slots.map((s, i) => ({ ...s, card: shuffled[i] }));
}

function isExposed(slot: Slot, board: Slot[]): boolean {
  if (!slot.card) return false;
  return !board.some(
    (s) => s.card && s.layer > slot.layer && s.row === slot.row && Math.abs(s.x - slot.x) < 2
  );
}

function fmtSeconds(sec: number): string {
  return `${sec} second${sec === 1 ? '' : 's'}`;
}

export default function TripleStackPyramid() {
  const router = useRouter();
  const { src, diff } = useLocalSearchParams();
  const { patient } = useAuth();
  const { t } = useTranslation();

  const isAi = src === 'ai';
  const [screen, setScreen] = useState<Screen>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [board, setBoard] = useState<Slot[]>([]);
  const [buffer, setBuffer] = useState<CardData[]>([]);
  const [matches, setMatches] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<'cleared' | 'full' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, [stopTimer]);
  useEffect(() => () => stopTimer(), [stopTimer]);

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    setBoard(buildBoard(diff));
    setBuffer([]); setMatches(0); setElapsed(0); setOutcome(null); setPaused(false);
    setScreen('playing');
    startTimer();
  };

  // AI auto-start: when launched from an AI recommendation with ?diff=..., skip
  // the level menu and go straight into that difficulty.
  useEffect(() => {
    if (diff === 'easy' || diff === 'medium') {
      startGame(diff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff]);

  const saveQuitRound = () => {
    if (!patient?.id || screen !== 'playing') return;
    const totalAttempts = matches;
    syncService.saveRound({
      user_id: patient.id,
      game_id: TRIPLE_STACK_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: DIFF_INFO[difficulty].kinds,
      time_taken_sec: elapsed,
      expected_time_sec: 30 + 3 * DIFF_INFO[difficulty].kinds,
      total_attempts: totalAttempts > 0 ? totalAttempts : 1,
      correct_count: matches,
      error_count: 0,
      error_types: [],
      completed: false,
      accuracy: totalAttempts > 0 ? 1 : 1,
    });
  };

  const backToMenu = () => { stopTimer(); setScreen('menu'); };
  const handleBackPress = () => {
    Alert.alert(
      'Give up?',
      'Do you want to quit and return to the game list?',
      [
        { text: 'Continue playing', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => router.back() },
      ],
      { cancelable: true }
    );
  };
  const handleInGameBack = () => {
    Alert.alert(
      'Give up?',
      'Do you want to quit and return to the game list?',
      [
        { text: 'Continue playing', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => { saveQuitRound(); stopTimer(); router.back(); } },
      ],
      { cancelable: true }
    );
  };
  const togglePause = () => {
    if (paused) { startTimer(); setPaused(false); } else { stopTimer(); setPaused(true); }
  };

  const drawSlot = (slot: Slot) => {
    if (screen !== 'playing' || paused || !slot.card || !isExposed(slot, board)) return;
    const tile = slot.card;
    const newBoard = board.map((s) => (s.id === slot.id ? { ...s, card: null } : s));
    const remaining = newBoard.filter((s) => s.card !== null).length;

    const candidate = [...buffer, tile];
    const sameCount = candidate.filter((c) => c.symbol === tile.symbol).length;

    if (sameCount === 3) {
      const cleared = candidate.filter((c) => c.symbol !== tile.symbol);
      setFlash(tile.symbol);
      setTimeout(() => setFlash(null), 500);
      setMatches((m) => m + 1);
      setBoard(newBoard);
      setBuffer(cleared);
      if (remaining === 0 && cleared.length === 0) {
        stopTimer(); setOutcome('cleared'); setScreen('done');
        saveRoundResult(matches + 1, 0, elapsed, difficulty);
      }
      return;
    }

    setBoard(newBoard);
    setBuffer(candidate);
    if (candidate.length >= BUFFER_LIMIT) {
      stopTimer(); setOutcome('full'); setScreen('done');
      saveRoundResult(matches, 1, elapsed, difficulty);
    }
  };

  const saveRoundResult = async (
    finalMatches: number,
    errorCount: number,
    timeTaken: number,
    diff: Difficulty
  ) => {
    if (!patient?.id) return;

    const totalAttempts = finalMatches + errorCount;
    syncService.saveRound({
      user_id: patient.id,
      game_id: TRIPLE_STACK_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: DIFF_INFO[diff].kinds,
      time_taken_sec: timeTaken,
      expected_time_sec: 30 + 3 * DIFF_INFO[diff].kinds,
      total_attempts: totalAttempts,
      correct_count: finalMatches,
      error_count: errorCount,
      error_types: errorCount > 0 ? ['buffer_overflow'] : [],
      completed: true,
      accuracy: totalAttempts > 0 ? finalMatches / totalAttempts : 1,
    });
  };

  const rows = LAYOUT[difficulty].rows;
  const maxLen = Math.max(...rows, 1);
  const pyramidWidth = maxLen * TILE;

  if (screen === 'menu') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.menu}>
          <Text style={styles.title}>Triple Stack</Text>
          <Text style={styles.subtitle}>
            Only the raised tiles can be tapped. Clearing one uncovers the tiles beneath it.
            Collect three matching pictures in the tray to clear them.
          </Text>
          <Text style={styles.caregiverLabel}>CAREGIVER: CHOOSE A LEVEL</Text>
          {(Object.keys(DIFF_INFO) as Difficulty[]).map((d) => (
            <TouchableOpacity key={d} style={styles.diffCard} activeOpacity={0.8} onPress={() => startGame(d)}>
              <Text style={styles.diffLabel}>{DIFF_INFO[d].label}</Text>
              <Text style={styles.diffDesc}>{DIFF_INFO[d].desc}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.primaryBtn, {marginTop: 20, backgroundColor: '#8E8E93'}]} onPress={handleBackPress}>
            <Text style={styles.primaryBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'done') {
    const cleared = outcome === 'cleared';
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.menu}>
          <Text style={styles.bigEmoji}>{cleared ? '🌸' : '🍵'}</Text>
          <Text style={styles.title}>{cleared ? 'Pyramid cleared!' : 'The tray is full'}</Text>
          <Text style={styles.subtitle}>
            {cleared ? 'A lovely round — every set was completed.' : "That's alright. Let's begin a fresh round whenever ready."}
          </Text>
          <View style={styles.statsBox}>
            <View style={styles.statRow}><Text style={styles.statLabel}>Pictures matched</Text><Text style={styles.statValue}>{matches}</Text></View>
            <View style={styles.statRow}><Text style={styles.statLabel}>Time taken</Text><Text style={styles.statValue}>{fmtSeconds(elapsed)}</Text></View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => startGame(difficulty)}>
            <Text style={styles.primaryBtnText}>{t("play_again")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={backToMenu}>
            <Text style={styles.secondaryBtnText}>{t("home")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bufferSlots: (CardData | null)[] = [...buffer, ...Array(Math.max(0, BUFFER_LIMIT - buffer.length)).fill(null)];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleInGameBack}><Text style={styles.headerLink}>← Start</Text></TouchableOpacity>
        <TouchableOpacity onPress={togglePause}><Text style={styles.headerLink}>{paused ? '▶ Resume' : '⏸ Pause'}</Text></TouchableOpacity>
      </View>
      <Text style={styles.progressText}>
        {matches > 0 ? `${matches} matched so far — nicely done` : 'Tap a raised tile to begin'}
      </Text>
      {paused && <View style={styles.pausedBanner}><Text style={styles.pausedText}>Paused — tap Resume when ready</Text></View>}

      <View style={styles.trayBox}>
        <Text style={styles.zoneLabel}>THE TRAY</Text>
        <View style={styles.trayGrid}>
          {bufferSlots.map((c, i) =>
            c ? (
              <View key={c.id} style={[styles.trayTile, flash === c.symbol && styles.trayTileFlash]}>
                <Text style={styles.symbolText}>{c.symbol}</Text>
              </View>
            ) : (
              <View key={`e${i}`} style={styles.trayEmpty} />
            )
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.pyramidScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.zoneLabel, { marginBottom: 14 }]}>THE PYRAMID</Text>
        <View style={{ width: pyramidWidth, alignSelf: 'center' }}>
          {board.map((slot) => {
            if (!slot.card) return null;
            const exposed = isExposed(slot, board);
            const rowWidth = rows[slot.row] * TILE;
            const rowOffset = (pyramidWidth - rowWidth) / 2;
            const left = rowOffset + slot.x * UNIT;
            const top = slot.row * (TILE + GAP_Y) - (slot.layer === 1 ? 14 : 0);
            return (
              <TouchableOpacity
                key={slot.id}
                disabled={!exposed || paused}
                onPress={() => drawSlot(slot)}
                activeOpacity={0.75}
                style={[
                  styles.pyramidTile,
                  { left, top, width: TILE - 6, height: TILE - 6 },
                  exposed ? styles.tileExposed : styles.tileLocked,
                  slot.layer === 1 && exposed && styles.tileRaised,
                ]}
              >
                <Text style={[styles.symbolText, !exposed && styles.symbolDim]}>{slot.card.symbol}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: (rows.length - 1) * (TILE + GAP_Y) + TILE + 10 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EFE8D8' },
  menu: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: '#3B3527', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#6B6350', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  caregiverLabel: { fontSize: 12, letterSpacing: 1, color: '#8C8264', textAlign: 'center', marginBottom: 10 },
  diffCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D8C9A3', borderRadius: 18, padding: 18, marginBottom: 12 },
  diffLabel: { fontSize: 19, fontWeight: '700', color: '#3B3527' },
  diffDesc: { fontSize: 14, color: '#8C8264', marginTop: 2 },
  bigEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 10 },
  statsBox: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D8C9A3', borderRadius: 18, padding: 18, marginVertical: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { fontSize: 15, color: '#8C8264' },
  statValue: { fontSize: 15, color: '#3B3527', fontWeight: '700' },
  primaryBtn: { backgroundColor: '#8CA872', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#6B6350', fontSize: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerLink: { color: '#8C8264', fontSize: 15 },
  progressText: { textAlign: 'center', color: '#6B6350', fontSize: 15, marginBottom: 8 },
  pausedBanner: { marginHorizontal: 20, backgroundColor: '#F3ECDB', borderRadius: 14, paddingVertical: 10, marginBottom: 8 },
  pausedText: { textAlign: 'center', color: '#6B6350' },
  trayBox: { marginHorizontal: 16, borderWidth: 2, borderColor: '#D8C9A3', backgroundColor: '#F3ECDB', borderRadius: 18, padding: 14, marginBottom: 10 },
  zoneLabel: { fontSize: 12, letterSpacing: 1, color: '#8C8264', textAlign: 'center', marginBottom: 8 },
  trayGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  trayTile: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D8C9A3', alignItems: 'center', justifyContent: 'center' },
  trayTileFlash: { backgroundColor: '#E8C468' },
  trayEmpty: { width: 46, height: 46, borderRadius: 10, borderWidth: 2, borderColor: '#D8C9A3', borderStyle: 'dashed' },
  pyramidScroll: { paddingHorizontal: 16, paddingBottom: 30 },
  pyramidTile: { position: 'absolute', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileExposed: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D8C9A3' },
  tileRaised: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4, borderColor: '#C9A24B' },
  tileLocked: { backgroundColor: '#E4D9B8', borderWidth: 2, borderColor: '#D3C6A0' },
  symbolText: { fontSize: 28 },
  symbolDim: { opacity: 0.35 },
});
