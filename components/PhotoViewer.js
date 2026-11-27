import React, { useEffect, useRef, useState } from "react";
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

/** Tam ekran fotoğraf görüntüleyici: yatay kaydırma, sayaç, kapat. */
export default function PhotoViewer({ photos, index, onClose, title }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [current, setCurrent] = useState(index ?? 0);
  const visible = index !== null && index !== undefined;

  useEffect(() => {
    if (visible) setCurrent(index);
  }, [visible, index]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {visible ? (
          <FlatList
            ref={listRef}
            data={photos}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <View style={{ width, height, justifyContent: "center" }}>
                <Image
                  source={{ uri: item }}
                  style={{ width, height: height * 0.8 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
            )}
          />
        ) : null}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            <Text style={styles.counter}>
              {current + 1} / {photos.length}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 6 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  counter: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 1 },
});
