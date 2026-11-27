import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { colors } from "./theme";

const SPRING = { useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 };

/**
 * Harita uygulamalarındaki gibi sürüklenebilir alt kart.
 * Durumlar: "half" (yarım ekran) → yukarı çekince "full", aşağı çekince "half" veya kapanır.
 * Tam ekranda içerik kaydırılır; içerik en üstteyken aşağı çekmek kartı küçültür.
 *
 * Props:
 *  - areaHeight: kartın yerleştiği alanın yüksekliği (ör. ekran − alt menü)
 *  - topOffset: tam ekrandayken üstten bırakılacak boşluk (durum çubuğu)
 *  - halfRatio: yarım konumun alan içindeki oranı (0.5 = yarı)
 *  - header: her zaman görünen başlık; footer(isFull): tam ekranda altta sabit alan
 *  - onClose, onSnapChange(snap)
 * Ref: snapTo("half" | "full" | "closed"), scrollToTop()
 */
const DraggableSheet = forwardRef(function DraggableSheet(
  { areaHeight, topOffset = 0, halfRatio = 0.5, header, footer, children, onClose, onSnapChange, stickyHeaderIndices },
  ref,
) {
  const points = useMemo(
    () => ({ full: topOffset, half: Math.round(areaHeight * halfRatio), closed: areaHeight + 24 }),
    [areaHeight, topOffset, halfRatio],
  );
  const y = useRef(new Animated.Value(points.closed)).current;
  const current = useRef("closed");
  const startY = useRef(0);
  const scrollY = useRef(0);
  const scrollRef = useRef(null);
  const [snap, setSnap] = useState("closed");

  const snapTo = useCallback(
    (target, velocity = 0) => {
      current.current = target;
      setSnap(target);
      onSnapChange?.(target);
      Animated.spring(y, { ...SPRING, toValue: points[target], velocity }).start(({ finished }) => {
        if (finished && target === "closed") onClose?.();
      });
    },
    [onClose, onSnapChange, points, y],
  );

  useImperativeHandle(
    ref,
    () => ({
      snapTo,
      scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: false }),
      get snap() {
        return current.current;
      },
    }),
    [snapTo],
  );

  // Alan yüksekliği değişirse (döndürme vb.) mevcut konumu koru
  useEffect(() => {
    y.setValue(points[current.current]);
  }, [points, y]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          if (Math.abs(g.dy) < 6 || Math.abs(g.dy) < Math.abs(g.dx) * 1.2) return false;
          if (current.current !== "full") return true;
          // Tam ekranda: yalnızca içerik en üstteyken aşağı çekiş kartı hareket ettirir
          return scrollY.current <= 0 && g.dy > 0;
        },
        onPanResponderGrant: () => {
          y.stopAnimation((v) => {
            startY.current = v;
          });
        },
        onPanResponderMove: (_e, g) => {
          const next = Math.min(points.closed, Math.max(points.full, startY.current + g.dy));
          y.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const pos = startY.current + g.dy;
          const from = current.current;
          let target;
          if (g.vy < -0.6) target = "full";
          else if (g.vy > 0.6)
            target = from === "full" && pos < points.half ? "half" : pos > points.half ? "closed" : "half";
          else {
            const order = ["full", "half", "closed"];
            target = order.reduce(
              (best, k) => (Math.abs(points[k] - pos) < Math.abs(points[best] - pos) ? k : best),
              "half",
            );
          }
          snapTo(target, g.vy);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [points, snapTo, y],
  );

  const isFull = snap === "full";
  const height = areaHeight - topOffset;

  return (
    <Animated.View
      style={[styles.sheet, { height, transform: [{ translateY: y }] }]}
      {...responder.panHandlers}
      accessibilityViewIsModal={isFull}
    >
      <Pressable
        onPress={() => snapTo(isFull ? "half" : "full")}
        style={styles.grabber}
        accessibilityRole="button"
        accessibilityLabel={isFull ? "Kartı küçült" : "Kartı büyüt"}
      >
        <View style={styles.handle} />
      </Pressable>
      {header}
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={isFull}
        showsVerticalScrollIndicator={isFull}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: isFull ? 96 : 24 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={stickyHeaderIndices}
      >
        {children}
      </Animated.ScrollView>
      {footer ? footer(isFull) : null}
    </Animated.View>
  );
});

export default DraggableSheet;

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 24,
    overflow: "hidden",
  },
  grabber: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "#D1D1D6" },
});
