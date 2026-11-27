import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import polyline from "@mapbox/polyline";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { colors, shadow } from "../components/theme";
import { useRealtimeEvent } from "../services/realtime";
import { favoriteApi, mapsApi, salonApi } from "../services/api";

// Konum izni yoksa / alınamazsa gösterilecek bölge (Kırşehir merkezi)
const FALLBACK_REGION = { latitude: 39.1451, longitude: 34.1605, latitudeDelta: 0.05, longitudeDelta: 0.05 };
// Kullanıcının çevresi: yaklaşık 2 km'lik görünüm
const NEAR_DELTA = { latitudeDelta: 0.018, longitudeDelta: 0.018 };
const PROMO_SEEN_KEY = "mykuafor.promoSeen.v1";

export default function HomeScreen({ navigation }) {
  const mapRef = useRef(null);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showPromo, setShowPromo] = useState(false);

  const loadSalons = useCallback(async (coords) => {
    try {
      const data = await salonApi.list({ lat: coords?.latitude, lng: coords?.longitude, pageSize: 50 });
      setSalons(data.items);
    } catch (e) {
      Alert.alert("Salonlar yüklenemedi", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const focusOn = useCallback((coords, animated = true) => {
    mapRef.current?.animateToRegion({ ...coords, ...NEAR_DELTA }, animated ? 500 : 0);
  }, []);

  /**
   * Konumu alır ve haritayı oraya taşır. Önce son bilinen konum (anında), ardından güncel konum (birkaç sn).
   * `askIfDenied`: konum düğmesine basıldığında izin kapalıysa ayarlara yönlendir.
   */
  const locate = useCallback(
    async ({ askIfDenied = false } = {}) => {
      setLocating(true);
      try {
        let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted" && canAskAgain) ({ status } = await Location.requestForegroundPermissionsAsync());
        if (status !== "granted") {
          if (askIfDenied) {
            Alert.alert("Konum izni kapalı", "Size en yakın salonları göstermek için konum iznine ihtiyacımız var.", [
              { text: "Vazgeç", style: "cancel" },
              { text: "Ayarları aç", onPress: () => Linking.openSettings() },
            ]);
          }
          return null;
        }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
        if (last) {
          const quick = { latitude: last.coords.latitude, longitude: last.coords.longitude };
          setUserLocation(quick);
          focusOn(quick);
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(coords);
        focusOn(coords);
        return coords;
      } catch {
        if (askIfDenied) Alert.alert("Konum alınamadı", "Lütfen konum servislerinin açık olduğundan emin olun.");
        return null;
      } finally {
        setLocating(false);
      }
    },
    [focusOn],
  );

  useEffect(() => {
    (async () => {
      const coords = await locate();
      loadSalons(coords);
    })();
    // Mağaza tanıtımı yalnızca bir kez gösterilir.
    AsyncStorage.getItem(PROMO_SEEN_KEY)
      .then((seen) => !seen && setTimeout(() => setShowPromo(true), 1500))
      .catch(() => {});
  }, [locate, loadSalons]);

  // İşletme panelinde yeni salon açılınca veya salon bilgisi değişince harita anında tazelenir.
  useRealtimeEvent("salons:changed", () => loadSalons(userLocation));

  const closePromo = (goShop) => {
    setShowPromo(false);
    AsyncStorage.setItem(PROMO_SEEN_KEY, "1").catch(() => {});
    if (goShop) navigation.navigate("Shop");
  };

  const term = search.trim().toLocaleLowerCase("tr-TR");
  const visibleSalons = term ? salons.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(term)) : salons;

  const selectSalon = (salon) => {
    setSelected(salon);
    setRoute(null);
    // Kart haritanın alt yarısını kapladığı için salon biraz yukarıda konumlanır.
    mapRef.current?.animateToRegion(
      { latitude: salon.latitude - NEAR_DELTA.latitudeDelta * 0.18, longitude: salon.longitude, ...NEAR_DELTA },
      400,
    );
  };

  const getDirections = async () => {
    if (!userLocation) {
      Alert.alert("Konum gerekli", "Yol tarifi için konum izni verin.", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Ayarları aç", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setRouteLoading(true);
    try {
      const data = await mapsApi.directions(selected.id, userLocation.latitude, userLocation.longitude);
      const coords = polyline.decode(data.polyline).map(([latitude, longitude]) => ({ latitude, longitude }));
      setRoute({ coords, distance: data.distance.text, duration: data.duration.text });
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 48, bottom: 360, left: 48 },
        animated: true,
      });
    } catch (e) {
      // Sunucuda yol tarifi kapalıysa cihazın harita uygulamasına yönlendir.
      const q = `${selected.latitude},${selected.longitude}`;
      const url = Platform.OS === "ios" ? `maps://?daddr=${q}` : `google.navigation:q=${q}`;
      Alert.alert("Uygulama içi rota alınamadı", e.message, [
        { text: "Kapat", style: "cancel" },
        { text: "Haritalar'da aç", onPress: () => Linking.openURL(url).catch(() => {}) },
      ]);
    } finally {
      setRouteLoading(false);
    }
  };

  const callSalon = () => {
    if (!selected?.phone) return Alert.alert("Telefon yok", "Bu salonun telefon numarası kayıtlı değil.");
    Linking.openURL(`tel:${selected.phone}`).catch(() => {});
  };

  const toggleFavorite = async () => {
    const next = !selected.isFavorite;
    const apply = (value) => {
      setSelected((s) => (s ? { ...s, isFavorite: value } : s));
      setSalons((list) => list.map((s) => (s.id === selected.id ? { ...s, isFavorite: value } : s)));
    };
    apply(next);
    try {
      await (next ? favoriteApi.addSalon(selected.id) : favoriteApi.removeSalon(selected.id));
    } catch (e) {
      apply(!next);
      Alert.alert("Hata", e.message);
    }
  };

  const shareSalon = () =>
    Share.share({ message: `${selected.name}\n${selected.address}${selected.website ? `\n${selected.website}` : ""}` });

  return (
    <View style={styles.container}>
      <AppHeader />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={FALLBACK_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={(e) => {
            // Android'de işarete dokunmak haritaya da "marker-press" olarak iletilir; kartı kapatma.
            if (e.nativeEvent?.action === "marker-press") return;
            if (selected) setSelected(null);
          }}
        >
          {visibleSalons.map((salon) => (
            <Marker
              key={salon.id}
              coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
              title={salon.name}
              pinColor={salon.isOpenNow ? colors.primary : "#8E8E93"}
              onPress={() => selectSalon(salon)}
            />
          ))}
          {route && <Polyline coordinates={route.coords} strokeColor={colors.primary} strokeWidth={5} />}
        </MapView>

        {/* Arama */}
        <View style={styles.searchWrap} pointerEvents="box-none">
          <View style={styles.search}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Salon veya kuaför ara"
              placeholderTextColor={colors.faint}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              accessibilityLabel="Salon ara"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Aramayı temizle" hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={colors.faint} />
              </TouchableOpacity>
            ) : null}
          </View>
          {!loading ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {term
                  ? `${visibleSalons.length} sonuç`
                  : userLocation
                    ? `Yakınınızda ${salons.length} salon`
                    : `${salons.length} salon`}
              </Text>
            </View>
          ) : null}
        </View>

        {loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* Konumuma git */}
        <TouchableOpacity
          style={[styles.locateButton, { bottom: selected ? 24 + 300 : 24 }]}
          onPress={() => (userLocation && !locating ? focusOn(userLocation) : locate({ askIfDenied: true }))}
          accessibilityRole="button"
          accessibilityLabel="Konumuma git"
        >
          {locating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="locate" size={22} color={userLocation ? colors.primary : colors.text} />
          )}
        </TouchableOpacity>

        {selected && (
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <TouchableOpacity
              style={styles.sheetClose}
              onPress={() => setSelected(null)}
              accessibilityLabel="Kapat"
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.salonName}>{selected.name}</Text>

              <View style={styles.metaRow}>
                {selected.ratingCount ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={14} color="#F5A623" />
                    <Text style={styles.metaStrong}>{selected.rating}</Text>
                    <Text style={styles.metaText}>({selected.ratingCount})</Text>
                  </View>
                ) : (
                  <Text style={styles.metaText}>Yeni salon</Text>
                )}
                <Text style={styles.dot}>·</Text>
                <Text style={[styles.metaStrong, { color: selected.isOpenNow ? colors.success : colors.danger }]}>
                  {selected.isOpenNow ? "Açık" : "Kapalı"}
                </Text>
                {selected.todayHours ? (
                  <Text style={styles.metaText}>
                    {" "}
                    {selected.todayHours.opens}–{selected.todayHours.closes}
                  </Text>
                ) : null}
                {selected.distanceKm !== undefined ? (
                  <>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.metaText}>{selected.distanceKm} km</Text>
                  </>
                ) : null}
              </View>

              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={16} color={colors.muted} />
                <Text style={styles.address}>{selected.address}</Text>
              </View>
              {route ? (
                <View style={styles.addressRow}>
                  <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                  <Text style={[styles.address, { color: colors.text, fontWeight: "600" }]}>
                    {route.distance} · yaklaşık {route.duration}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Action icon="navigate-outline" label="Yol tarifi" onPress={getDirections} loading={routeLoading} />
                <Action icon="call-outline" label="Ara" onPress={callSalon} />
                <Action
                  icon={selected.isFavorite ? "heart" : "heart-outline"}
                  label={selected.isFavorite ? "Kayıtlı" : "Kaydet"}
                  onPress={toggleFavorite}
                  active={selected.isFavorite}
                />
                <Action icon="share-outline" label="Paylaş" onPress={shareSalon} />
              </View>

              <TouchableOpacity
                style={styles.bookButton}
                onPress={() =>
                  navigation.navigate("CalendarScreen", { salonId: selected.id, salonName: selected.name })
                }
                accessibilityRole="button"
              >
                <Text style={styles.bookText}>Randevu al</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      <Modal visible={showPromo} transparent animationType="fade" onRequestClose={() => closePromo(false)}>
        <View style={styles.overlay}>
          <View style={styles.promo}>
            <TouchableOpacity style={styles.promoClose} onPress={() => closePromo(false)} accessibilityLabel="Kapat">
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600&h=360&fit=crop" }}
              style={styles.promoImage}
              accessibilityIgnoresInvertColors
            />
            <View style={{ padding: 22 }}>
              <Text style={styles.promoKicker}>YENİ</Text>
              <Text style={styles.promoTitle}>Mağazamız açıldı</Text>
              <Text style={styles.promoText}>
                Salonlarımızda kullandığımız profesyonel saç bakım ürünleri artık uygulamada.
              </Text>
              <TouchableOpacity style={styles.promoButton} onPress={() => closePromo(true)}>
                <Text style={styles.promoButtonText}>Mağazayı keşfet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav active="Home" />
    </View>
  );
}

function Action({ icon, label, onPress, loading, active }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} disabled={loading} accessibilityLabel={label}>
      <View style={[styles.actionIcon, active && { backgroundColor: colors.primarySoft }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Ionicons name={icon} size={21} color={active ? colors.primary : colors.text} />
        )}
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  searchWrap: { position: "absolute", top: 20, left: 16, right: 16, alignItems: "flex-start" },
  search: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    ...shadow,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text },
  countPill: {
    marginTop: 10,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadow,
    shadowOpacity: 0.06,
  },
  countText: { fontSize: 12.5, fontWeight: "600", color: colors.text },
  mapLoading: { position: "absolute", top: "45%", alignSelf: "center" },
  locateButton: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 300,
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    ...shadow,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 16,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#D8D8DC", marginBottom: 12 },
  sheetClose: {
    position: "absolute",
    right: 14,
    top: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  salonName: { fontSize: 21, fontWeight: "700", color: colors.text, marginRight: 40, letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaStrong: { fontSize: 14, fontWeight: "600", color: colors.text },
  metaText: { fontSize: 14, color: colors.muted },
  dot: { marginHorizontal: 6, color: colors.faint },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
  address: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  action: { alignItems: "center", flex: 1 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { marginTop: 6, fontSize: 12, fontWeight: "500", color: colors.text },
  bookButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  promo: { backgroundColor: colors.background, borderRadius: 20, overflow: "hidden", width: "100%" },
  promoClose: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  promoImage: { width: "100%", height: 180 },
  promoKicker: { fontSize: 11, fontWeight: "800", color: colors.primary, letterSpacing: 1.5 },
  promoTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  promoText: { fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
  promoButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  promoButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
