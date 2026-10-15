import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import colors from "../theme/colors";

export interface ChartGameSeries {
  gameName: string;
  // Accuracy points (0-100), one per round, oldest first.
  points: number[];
}

interface GameAccuracyChartProps {
  series: ChartGameSeries[];
  height?: number;
}

// Distinct colors for up to 8 games.
const GAME_COLORS = [
  "#0D631B",
  "#E8A23A",
  "#007AFF",
  "#B0402A",
  "#5856D6",
  "#E64C3C",
  "#2E7D32",
  "#8E44AD",
];

const PLOT_W = 340;

/**
 * Accurate, readable line chart: accuracy (%) vs round number.
 * - One colored line per game (only games with data are shown).
 * - Each game is capped at its 10 most recent rounds.
 * - Lines are drawn as dense point-sequences (no rotation tricks), so they
 *   always render clearly on React Native.
 * - Tap a point to see its exact accuracy; tap the legend to hide a game.
 */
const GameAccuracyChart: React.FC<GameAccuracyChartProps> = ({
  series,
  height = 220,
}) => {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<{ series: number; point: number } | null>(null);

  const visible = series.filter((s) => s.points.length > 0);
  if (visible.length === 0) {
    return <Text style={styles.empty}>No games played yet.</Text>;
  }

  const maxRounds = visible.reduce((m, s) => Math.max(m, s.points.length), 1);
  const plotH = Math.max(height - 40, 120);

  const padL = 36, padR = 12, padT = 14, padB = 26;
  const innerW = PLOT_W - padL - padR;
  const innerH = plotH - padT - padB;

  const X = (roundIdx: number) => {
    if (maxRounds === 1) return padL + innerW / 2;
    return padL + (roundIdx / (maxRounds - 1)) * innerW;
  };
  const Y = (acc: number) => {
    const a = Math.max(0, Math.min(acc, 100));
    return padT + innerH - (a / 100) * innerH;
  };

  const lines = visible.map((s, si) => {
    const pts = s.points.slice(-10).map((acc, ri) => ({
      acc: Math.max(0, Math.min(acc, 100)),
      x: X(ri),
      y: Y(Math.max(0, Math.min(acc, 100))),
      round: ri + 1,
    }));
    return { gameName: s.gameName, color: GAME_COLORS[si % GAME_COLORS.length], pts };
  });

  // Build the polyline for a line as dense points (interpolated) so no
  // rotation/segment rendering is needed — always visible.
  const buildPolyline = (pts: { x: number; y: number }[]) => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (pts.length === 1) out.push(pts[0]);
    return out;
  };

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height }}>
        <View style={[styles.chartArea, { width: PLOT_W, height: plotH }]}>
          {/* Y gridlines + labels */}
          {[0, 25, 50, 75, 100].map((v) => (
            <React.Fragment key={v}>
              <View style={[styles.gridH, { top: Y(v) - 0.5, width: innerW }]} />
              <Text style={[styles.gridLabel, { top: Y(v) - 8, left: 2 }]}>{v}</Text>
            </React.Fragment>
          ))}

          {/* X axis labels (rounds) */}
          {Array.from({ length: Math.max(maxRounds, 1) }, (_, i) => i).map((ri) => (
            <Text key={ri} style={[styles.xLabel, { top: padT + innerH + 8, left: X(ri) - 8 }]}>
              {ri + 1}
            </Text>
          ))}
          <Text style={[styles.xTitle, { top: padT + innerH + 20, left: padL + innerW / 2 - 12 }]}>Round #</Text>

          {/* Lines (dense polyline) + points */}
          {lines.map((line) => {
            if (hidden[line.gameName]) return null;
            const poly = buildPolyline(line.pts);
            return (
              <View key={line.gameName} pointerEvents="none">
                {poly.map((p, i) => (
                  <View
                    key={i}
                    style={[styles.polyDot, { left: p.x - 1.5, top: p.y - 1.5, backgroundColor: line.color }]}
                  />
                ))}
              </View>
            );
          })}

          {/* Points (larger, tappable) */}
          {lines.map((line, si) =>
            hidden[line.gameName] ? null : line.pts.map((pt, pi) => {
              const isSelected = selected && selected.series === si && selected.point === pi;
              return (
                <View
                  key={`pt-${line.gameName}-${pi}`}
                  style={[
                    styles.point,
                    {
                      left: pt.x - 6,
                      top: pt.y - 6,
                      backgroundColor: line.color,
                      zIndex: 10,
                    },
                  ]}
                >
                  {isSelected && (
                    <Text style={[styles.pointLabel, { color: line.color }]}>{Math.round(pt.acc)}%</Text>
                  )}
                </View>
              );
            })
          )}

          {/* Touch layer (tap a point to reveal accuracy) */}
          {lines.map((line, si) =>
            hidden[line.gameName] ? null : line.pts.map((pt, pi) => (
              <Pressable
                key={`hit-${line.gameName}-${pi}`}
                style={[styles.hitArea, { left: pt.x - 24, top: pt.y - 24 }]}
                onPress={() => {
                  if (selected && selected.series === si && selected.point === pi) setSelected(null);
                  else setSelected({ series: si, point: pi });
                }}
                accessibilityLabel={`Accuracy ${Math.round(pt.acc)} percent on round ${pt.round}`}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Legend: tap to show/hide a game */}
      <View style={styles.legendRow}>
        {lines.map((line) => (
          <Pressable
            key={line.gameName}
            style={[styles.legendItem, hidden[line.gameName] && styles.legendHidden]}
            onPress={() => setHidden((h) => ({ ...h, [line.gameName]: !h[line.gameName] }))}
            accessibilityLabel={`Toggle ${line.gameName}`}
          >
            <View style={[styles.legendDot, { backgroundColor: line.color }]} />
            <Text style={styles.legendText}>{line.gameName}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  empty: { color: colors.textSecondary, fontSize: 15, paddingVertical: 14 },
  chartArea: { position: "relative" },
  gridH: { position: "absolute", backgroundColor: colors.surfaceHigh, opacity: 0.5, height: 1 },
  gridLabel: { position: "absolute", fontSize: 10, color: colors.textSecondary },
  xLabel: { position: "absolute", fontSize: 10, color: colors.textSecondary },
  xTitle: { position: "absolute", fontSize: 10, color: colors.textSecondary },
  polyDot: { position: "absolute", width: 3, height: 3, borderRadius: 1.5 },
  point: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  pointLabel: { position: "absolute", top: -22, fontSize: 11, fontWeight: "700", minWidth: 38, textAlign: "center", zIndex: 20 },
  hitArea: { position: "absolute", width: 48, height: 48 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  legendHidden: { opacity: 0.3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: colors.textSecondary },
});

export default GameAccuracyChart;