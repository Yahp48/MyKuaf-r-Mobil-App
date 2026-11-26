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
  StatusBar,
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
import { AntDesign, FontAwesome, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { colors } from "../components/theme";
import { useRealtimeEvent } from "../services/realtime";
import { favoriteApi, mapsApi, salonApi } from "../services/api";

// Konum izni verilmezse Kırşehir merkezi gösterilir.
const DEFAULT_REGION = { latitude: 39.1451, longitude: 34.1605, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const PROMO_SEEN_KEY = "mykuafor.promoSeen.v1";

export default function HomeScreen({ navigation }) {
  const mapRef = useRef(null);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        loadSalons(null);
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(coords);
        loadSalons(coords);
      } catch {
        loadSalons(null);
      }
    })();

    // Mağaza tanıtımı yalnızca bir kez gösterilir.
    AsyncStorage.getItem(PROMO_SEEN_KEY)
      .then((seen) => !seen && setTimeout(() => setShowPromo(true), 1500))
      .catch(() => {});
  }, [loadSalons]);

  const closePromo = (goShop) => {
    setShowPromo(false);
    AsyncStorage.setItem(PROMO_SEEN_KEY, "1").catch(() => {});
    if (goShop) navigation.navigate("Shop");
  };

  // İşletme panelinde yeni salon açılınca veya salon bilgisi değişince harita anında tazelenir.
  useRealtimeEvent("salons:changed", () => loadSalons(userLocation));

  const visibleSalons = search.trim()
    ? salons.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR")))
    : salons;

  const selectSalon = (salon) => {
    setSelected(salon);
    setRoute(null);
    mapRef.current?.animateToRegion({ ...DEFAULT_REGION, latitude: salon.latitude, longitude: salon.longitude }, 400);
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
        edgePadding: { top: 60, right: 40, bottom: 320, left: 40 },
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
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <AppHeader />

      <View style={styles.mapWrap}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={22} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Kuaför ara"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Kuaför ara"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Aramayı temizle">
              <AntDesign name="close" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={userLocation ? { ...DEFAULT_REGION, ...userLocation } : DEFAULT_REGION}
          showsUserLocation={!!userLocation}
        >
          {visibleSalons.map((salon) => (
            <Marker
              key={salon.id}
              coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
              title={salon.name}
              pinColor={salon.isOpenNow ? colors.primary : "gray"}
              onPress={() => selectSalon(salon)}
            />
          ))}
          {route && <Polyline coordinates={route.coords} strokeColor={colors.primary} strokeWidth={4} />}
        </MapView>
        {loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {selected && (
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setSelected(null)} accessibilityLabel="Kapat">
              <AntDesign name="close" size={20} color="#333" />
            </TouchableOpacity>
            <ScrollView>
              <Text style={styles.salonName}>{selected.name}</Text>
              <View style={styles.row}>
                <FontAwesome name="star" size={15} color="#f5a623" />
                <Text style={styles.rating}>
                  {selected.ratingCount
                    ? `${selected.rating} (${selected.ratingCount} değerlendirme)`
                    : "Henüz değerlendirme yok"}
                </Text>
              </View>
              <Text style={[styles.hours, { color: selected.isOpenNow ? colors.success : colors.danger }]}>
                {selected.isOpenNow ? "Şu an açık" : "Şu an kapalı"}
                {selected.todayHours
                  ? ` · Bugün ${selected.todayHours.opens} - ${selected.todayHours.closes}`
                  : " · Bugün kapalı"}
                {selected.distanceKm !== undefined ? ` · ${selected.distanceKm} km` : ""}
              </Text>
              <Text style={styles.address}>{selected.address}</Text>
              {route && (
                <Text style={styles.routeInfo}>
                  Rota: {route.distance} · yaklaşık {route.duration}
                </Text>
              )}

              <View style={styles.actions}>
                <Action icon="directions" label="Yol Tarifi" onPress={getDirections} loading={routeLoading} />
                <Action icon="call" label="Ara" onPress={callSalon} />
                <Action
                  icon={selected.isFavorite ? "favorite" : "favorite-border"}
                  label="Kaydet"
                  onPress={toggleFavorite}
                />
                <Action icon="share" label="Paylaş" onPress={shareSalon} />
              </View>

              <TouchableOpacity
                style={styles.bookButton}
                onPress={() =>
                  navigation.navigate("CalendarScreen", { salonId: selected.id, salonName: selected.name })
                }
              >
                <FontAwesome5 name="calendar-alt" size={20} color="#fff" />
                <Text style={styles.bookText}>Randevu Al</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      <Modal visible={showPromo} transparent animationType="fade" onRequestClose={() => closePromo(false)}>
        <View style={styles.overlay}>
          <View style={styles.promo}>
            <TouchableOpacity style={styles.promoClose} onPress={() => closePromo(false)} accessibilityLabel="Kapat">
              <AntDesign name="close" size={22} color="#333" />
            </TouchableOpacity>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600&h=360&fit=crop" }}
              style={styles.promoImage}
              accessibilityIgnoresInvertColors
            />
            <View style={{ padding: 20 }}>
              <Text style={styles.promoTitle}>Mağazamız açıldı!</Text>
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

function Action({ icon, label, onPress, loading }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} disabled={loading} accessibilityLabel={label}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name={icon} size={20} color="#fff" />}
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 46,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.text },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapLoading: { position: "absolute", top: "45%", alignSelf: "center" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "60%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  sheetClose: { position: "absolute", right: 14, top: 14, zIndex: 2, padding: 6 },
  salonName: { fontSize: 20, fontWeight: "bold", color: colors.text, marginRight: 30 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  rating: { marginLeft: 6, color: colors.text, fontSize: 14 },
  hours: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  address: { marginTop: 6, fontSize: 14, color: colors.muted },
  routeInfo: { marginTop: 6, fontSize: 14, color: colors.accent, fontWeight: "600" },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  action: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: { color: "#fff", marginLeft: 4, fontSize: 12, fontWeight: "600" },
  bookButton: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bookText: { color: "#fff", fontSize: 16, fontWeight: "bold", marginLeft: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  promo: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", width: "100%" },
  promoClose: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    padding: 6,
  },
  promoImage: { width: "100%", height: 180 },
  promoTitle: { fontSize: 20, fontWeight: "bold", textAlign: "center", color: colors.text },
  promoText: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 20 },
  promoButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
  },
  promoButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
