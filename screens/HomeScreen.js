import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import polyline from "@mapbox/polyline";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBottomNavHeight } from "../components/BottomNav";
import DraggableSheet from "../components/DraggableSheet";
import SalonSheet, { HALF_RATIO, Stars, distanceText, openStatusText } from "../components/SalonSheet";
import { colors, shadow } from "../components/theme";
import { upToDiscount } from "../components/pricing";
import { useApp } from "../context/AppContext";
import { useRealtimeEvent } from "../services/realtime";
import { mapsApi, salonApi } from "../services/api";
import { confirm, toast } from "../components/Feedback";

// Konum izni yoksa / alınamazsa gösterilecek bölge (İstanbul, iki yaka)
const FALLBACK_REGION = { latitude: 41.025, longitude: 29.015, latitudeDelta: 0.14, longitudeDelta: 0.14 };
// Kullanıcının çevresi: yaklaşık 2 km'lik görünüm
const NEAR_DELTA = { latitudeDelta: 0.018, longitudeDelta: 0.018 };
const PROMO_SEEN_KEY = "bibakim.promoSeen.v1";
// İşletme türleri (hepsi kadınlara yönelik); yalnızca haritada olan türler gösterilir
const KIND_CHIPS = [
  { kind: "HAIR", label: "Kuaför", icon: "cut-outline" },
  { kind: "NAIL", label: "Tırnak", icon: "hand-left-outline" },
  { kind: "SKIN", label: "Cilt bakımı", icon: "water-outline" },
  { kind: "BEAUTY", label: "Güzellik merkezi", icon: "sparkles-outline" },
  { kind: "BROW_LASH", label: "Kaş ve kirpik", icon: "eye-outline" },
  { kind: "MAKEUP", label: "Makyaj", icon: "color-palette-outline" },
  { kind: "MASSAGE", label: "Masaj ve spa", icon: "leaf-outline" },
];

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");

export default function HomeScreen({ navigation, route: navRoute }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navHeight = useBottomNavHeight();
  const { user, unreadNotifications } = useApp();
  const mapRef = useRef(null);
  const salonSheetRef = useRef(null);
  const listSheetRef = useRef(null);

  const [screenHeight, setScreenHeight] = useState(windowHeight);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    open: false,
    top: false,
    fav: false,
    deal: false,
    online: false,
    kind: null,
  });
  const [selected, setSelected] = useState(null);
  const [salonSnap, setSalonSnap] = useState("closed");
  const [listOpen, setListOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [tracksMarkers, setTracksMarkers] = useState(true);

  // Kartların yerleştiği alan: ekran − alt menü
  const areaHeight = screenHeight - navHeight;
  const sheetTop = insets.top + 6;
  const halfY = Math.round(areaHeight * HALF_RATIO);

  const loadSalons = useCallback(async (coords) => {
    try {
      const data = await salonApi.list({ lat: coords?.latitude, lng: coords?.longitude, pageSize: 50 });
      setSalons(data.items);
    } catch (e) {
      toast.error("Salonlar yüklenemedi", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const focusOn = useCallback((coords, animated = true) => {
    mapRef.current?.animateToRegion({ ...coords, ...NEAR_DELTA }, animated ? 500 : 0);
  }, []);

  /**
   * Konumu alır ve haritayı oraya taşır. Önce son bilinen konum (anında), ardından güncel konum.
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
            confirm({
              title: "Konum izni kapalı",
              message: "Size en yakın salonları göstermek için konum iznine ihtiyacımız var.",
              confirmText: "Ayarları aç",
              icon: "location-outline",
            }).then((ok) => ok && (() => Linking.openSettings())());
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
        if (askIfDenied) toast.error("Konum alınamadı", "Lütfen konum servislerinin açık olduğundan emin olun.");
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
  // Hizmet adıyla arama (ör. "kalıcı oje", "balyaj"): sunucuda eşleşen salonlar
  const [serviceMatches, setServiceMatches] = useState(new Set());
  useEffect(() => {
    if (term.length < 3) return setServiceMatches(new Set());
    const t = setTimeout(() => {
      salonApi
        .list({ q: term, pageSize: 50 })
        .then((r) => setServiceMatches(new Set(r.items.map((s) => s.id))))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [term]);
  const visibleSalons = useMemo(
    () =>
      salons.filter(
        (s) =>
          (!term ||
            s.name.toLocaleLowerCase("tr-TR").includes(term) ||
            serviceMatches.has(s.id) ||
            s.address.toLocaleLowerCase("tr-TR").includes(term) ||
            (s.district ?? "").toLocaleLowerCase("tr-TR").includes(term)) &&
          (!filters.open || s.isOpenNow) &&
          (!filters.top || (s.ratingCount > 0 && s.rating >= 4.5)) &&
          (!filters.fav || s.isFavorite) &&
          (!filters.deal || !!s.discount) &&
          (!filters.online || s.bookable !== false) &&
          (!filters.kind || s.kind === filters.kind),
      ),
    [salons, term, filters, serviceMatches],
  );
  const kindsPresent = useMemo(() => new Set(salons.map((s) => s.kind)), [salons]);
  const filtering =
    term || filters.open || filters.top || filters.fav || filters.deal || filters.online || filters.kind;
  const hasDeals = salons.some((s) => s.discount);
  // Liste konuma göre sıralı gelir: en yakın salonun şehri vitrin için varsayılan şehirdir.
  const nearestCity = salons[0]?.city;

  // Özel işaretler: görünüm değişince Android'in işaret görüntüsünü yeniden çizmesi için kısa süre izlenir.
  const markerKey = `${visibleSalons.map((s) => s.id).join(",")}|${selected?.id ?? ""}`;
  useEffect(() => {
    setTracksMarkers(true);
    const t = setTimeout(() => setTracksMarkers(false), 700);
    return () => clearTimeout(t);
  }, [markerKey]);

  /** Salonu kartın üstünde kalan görünür harita alanının ortasına getirir. */
  const centerAbove = useCallback(
    (salon) => {
      const visibleTop = insets.top + 110;
      const targetY = (visibleTop + halfY) / 2;
      const offset = ((screenHeight / 2 - targetY) / screenHeight) * NEAR_DELTA.latitudeDelta;
      mapRef.current?.animateToRegion(
        { latitude: salon.latitude - offset, longitude: salon.longitude, ...NEAR_DELTA },
        400,
      );
    },
    [halfY, insets.top, screenHeight],
  );

  const selectSalon = (salon) => {
    Keyboard.dismiss();
    if (listOpen) listSheetRef.current?.snapTo("closed");
    if (selected?.id !== salon.id) setRoute(null);
    setSelected(salon);
    centerAbove(salon);
  };

  const getDirections = async () => {
    if (!selected) return;
    if (!userLocation) {
      confirm({
        title: "Konum gerekli",
        message: "Yol tarifi için konum izni verin.",
        confirmText: "Ayarları aç",
        icon: "location-outline",
      }).then((ok) => ok && (() => Linking.openSettings())());
      return;
    }
    setRouteLoading(true);
    try {
      const data = await mapsApi.directions(selected.id, userLocation.latitude, userLocation.longitude);
      const coords = polyline.decode(data.polyline).map(([latitude, longitude]) => ({ latitude, longitude }));
      setRoute({ salonId: selected.id, coords, distance: data.distance.text, duration: data.duration.text });
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: insets.top + 120, right: 48, bottom: screenHeight - halfY + 24, left: 48 },
        animated: true,
      });
    } catch (e) {
      // Sunucuda yol tarifi kapalıysa cihazın harita uygulamasına yönlendir.
      const q = `${selected.latitude},${selected.longitude}`;
      const url = Platform.OS === "ios" ? `maps://?daddr=${q}` : `google.navigation:q=${q}`;
      confirm({
        title: "Uygulama içi rota alınamadı",
        message: e.message,
        confirmText: "Haritalar'da aç",
        cancelText: "Kapat",
        icon: "navigate-outline",
      }).then((ok) => ok && (() => Linking.openURL(url).catch(() => {}))());
    } finally {
      setRouteLoading(false);
    }
  };

  const setFavorite = (id, value) => {
    setSalons((list) => list.map((s) => (s.id === id ? { ...s, isFavorite: value } : s)));
    setSelected((s) => (s && s.id === id ? { ...s, isFavorite: value } : s));
  };

  const toggleFilter = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }));
  const openList = () => {
    Keyboard.dismiss();
    setListOpen(true);
  };

  useEffect(() => {
    if (listOpen) listSheetRef.current?.snapTo("half");
  }, [listOpen]);

  // Vitrinden bir salona dokunulunca harita o salonu açar (listede yoksa gelen özet kullanılır).
  const focusSalon = navRoute?.params?.focusSalon;
  useEffect(() => {
    if (!focusSalon) return;
    selectSalon(salons.find((s) => s.id === focusSalon.id) ?? focusSalon);
    navigation.setParams({ focusSalon: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSalon]);

  const salonSheetVisible = !!selected;
  // Konum düğmesi: kart yarım ekrandayken kartın hemen üstünde, aksi halde alt menünün üstünde
  const controlsBottom = salonSheetVisible && salonSnap !== "closed" ? screenHeight - halfY + 12 : navHeight + 14;
  const hideControls = (salonSheetVisible && salonSnap === "full") || listOpen;
  const activeRoute = route && selected && route.salonId === selected.id ? route : null;

  return (
    <View style={styles.container} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
        mapPadding={{ top: insets.top + 100, right: 0, bottom: navHeight, left: 0 }}
        onPress={(e) => {
          // Android'de işarete dokunmak haritaya da "marker-press" olarak iletilir; kartı kapatma.
          if (e.nativeEvent?.action === "marker-press") return;
          Keyboard.dismiss();
          if (selected) salonSheetRef.current?.close();
        }}
      >
        {visibleSalons.map((salon) => {
          const isSel = selected?.id === salon.id;
          return (
            <Marker
              key={salon.id}
              coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
              onPress={(e) => {
                e.stopPropagation?.();
                selectSalon(salon);
              }}
              anchor={{ x: 0.5, y: 0.32 }}
              tracksViewChanges={tracksMarkers}
              zIndex={isSel ? 10 : 1}
              accessibilityLabel={salon.name}
            >
              <View style={styles.marker}>
                <View
                  style={[
                    styles.pin,
                    salon.bookable === false && styles.pinListing,
                    salon.isOpenNow === false && styles.pinClosed,
                    isSel && styles.pinSelected,
                  ]}
                >
                  <Ionicons
                    name="cut"
                    size={isSel ? 18 : 14}
                    color={salon.bookable === false ? colors.primary : "#fff"}
                  />
                  {salon.discount?.activeToday ? (
                    <View style={styles.pinDeal}>
                      <Text style={styles.pinDealText}>%</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.markerLabel, isSel && styles.markerLabelSel]} numberOfLines={1}>
                  {salon.name}
                </Text>
              </View>
            </Marker>
          );
        })}
        {activeRoute && <Polyline coordinates={activeRoute.coords} strokeColor={colors.primary} strokeWidth={5} />}
      </MapView>

      {/* Üst: arama + filtreler */}
      <View style={[styles.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Salon veya hizmet ara (ör. kalıcı oje)"
            placeholderTextColor={colors.faint}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => visibleSalons.length && openList()}
            returnKeyType="search"
            accessibilityLabel="Salon ara"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Aramayı temizle" hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.faint} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.searchDivider} />
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button"
            accessibilityLabel={`Bildirimler${unreadNotifications ? `, ${unreadNotifications} okunmamış` : ""}`}
            hitSlop={8}
            style={styles.searchIcon}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel="Profil"
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials(user?.name) || "?"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          keyboardShouldPersistTaps="handled"
        >
          <FeatureChip
            icon="trophy"
            label="Öne çıkanlar"
            onPress={() => navigation.navigate("Featured", { city: nearestCity })}
          />
          <FilterChip
            icon="calendar-outline"
            label="Online randevu"
            on={filters.online}
            onPress={() => toggleFilter("online")}
          />
          <FilterChip icon="time-outline" label="Şimdi açık" on={filters.open} onPress={() => toggleFilter("open")} />
          {hasDeals ? (
            <FilterChip
              icon="pricetag-outline"
              label="İndirimli"
              on={filters.deal}
              onPress={() => toggleFilter("deal")}
            />
          ) : null}
          <FilterChip icon="star-outline" label="4,5+ puan" on={filters.top} onPress={() => toggleFilter("top")} />
          <FilterChip
            icon="bookmark-outline"
            label="Kaydedilenler"
            on={filters.fav}
            onPress={() => toggleFilter("fav")}
          />
          {KIND_CHIPS.filter((k) => kindsPresent.has(k.kind)).map((k) => (
            <FilterChip
              key={k.kind}
              icon={k.icon}
              label={k.label}
              on={filters.kind === k.kind}
              onPress={() => setFilters((f) => ({ ...f, kind: f.kind === k.kind ? null : k.kind }))}
            />
          ))}
        </ScrollView>
      </View>

      {loading && (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* Alt kontroller: liste ve konum */}
      {!hideControls && (
        <View style={[styles.controls, { bottom: controlsBottom }]} pointerEvents="box-none">
          {!salonSheetVisible && !loading ? (
            <TouchableOpacity
              style={styles.listPill}
              onPress={openList}
              accessibilityRole="button"
              accessibilityLabel="Salon listesini aç"
            >
              <Ionicons name="list" size={18} color={colors.text} />
              <Text style={styles.listPillText}>
                {visibleSalons.length
                  ? filtering
                    ? `${visibleSalons.length} sonuç`
                    : userLocation
                      ? `Yakındaki ${visibleSalons.length} salon`
                      : `${visibleSalons.length} salon`
                  : "Sonuç yok"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={styles.locateButton}
            onPress={() => (userLocation && !locating ? focusOn(userLocation) : locate({ askIfDenied: true }))}
            accessibilityRole="button"
            accessibilityLabel="Konumuma git"
          >
            {locating ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name={userLocation ? "locate" : "locate-outline"} size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Kartlar: alt menünün üstündeki alanda */}
      <View style={[styles.sheetArea, { height: areaHeight }]} pointerEvents="box-none">
        {listOpen && (
          <DraggableSheet
            ref={listSheetRef}
            areaHeight={areaHeight}
            topOffset={sheetTop}
            halfRatio={0.42}
            onClose={() => setListOpen(false)}
            header={
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>{filtering ? "Sonuçlar" : "Yakındaki salonlar"}</Text>
                <Text style={styles.listCount}>{visibleSalons.length} salon</Text>
              </View>
            }
          >
            {visibleSalons.length ? (
              visibleSalons.map((s) => <SalonListItem key={s.id} salon={s} onPress={() => selectSalon(s)} />)
            ) : (
              <View style={styles.emptyList}>
                <Ionicons name="search-outline" size={28} color={colors.faint} />
                <Text style={styles.emptyText}>Bu ölçütlere uyan salon bulunamadı.</Text>
              </View>
            )}
          </DraggableSheet>
        )}
        {selected && (
          <SalonSheet
            ref={salonSheetRef}
            salon={selected}
            areaHeight={areaHeight}
            topOffset={sheetTop}
            route={activeRoute}
            routeLoading={routeLoading}
            onDirections={getDirections}
            onFavoriteChange={setFavorite}
            onSnapChange={setSalonSnap}
            onClose={() => {
              setSelected(null);
              setSalonSnap("closed");
              setRoute(null);
            }}
            onBook={(params) => navigation.navigate("CalendarScreen", params)}
          />
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
    </View>
  );
}

function FilterChip({ icon, label, on, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterChip, on && styles.filterChipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      {on ? (
        <Ionicons name="checkmark" size={15} color={colors.primary} />
      ) : icon ? (
        <Ionicons name={icon} size={15} color={colors.text} />
      ) : null}
      <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FeatureChip({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, styles.featureChip]} accessibilityRole="button">
      <Ionicons name={icon} size={15} color="#fff" />
      <Text style={[styles.filterText, { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SalonListItem({ salon, onPress }) {
  const status = openStatusText(salon);
  const meta = [salon.kindLabel, distanceText(salon.distanceKm)].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={salon.name}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listName} numberOfLines={1}>
          {salon.name}
        </Text>
        <View style={styles.listRating}>
          {salon.ratingCount ? (
            <>
              <Text style={styles.listRatingValue}>
                {salon.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}
              </Text>
              <Stars value={salon.rating} size={12} />
              <Text style={styles.listMuted}>({salon.ratingCount})</Text>
            </>
          ) : (
            <Text style={styles.listMuted}>Yeni salon</Text>
          )}
        </View>
        {meta ? <Text style={styles.listMuted}>{meta}</Text> : null}
        {salon.bookable !== false ? (
          <Text style={styles.listOnline}>
            <Ionicons name="calendar" size={12} color={colors.success} /> Online randevu
          </Text>
        ) : null}
        {salon.discount ? (
          <Text style={styles.listDeal}>
            {salon.discount.activeToday ? "" : "Yakında: "}
            {upToDiscount(salon.discount.maxPercent)}
          </Text>
        ) : null}
        <Text style={styles.listMuted} numberOfLines={1}>
          <Text style={{ color: status.color, fontWeight: "700" }}>{status.label}</Text>
          {status.detail ? ` · ${status.detail}` : ""}
        </Text>
      </View>
      {salon.photo ? (
        <Image source={{ uri: salon.photo }} style={styles.listPhoto} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.listPhoto, styles.listPhotoEmpty]}>
          <Ionicons name="cut-outline" size={24} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  search: {
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 28,
    paddingLeft: 18,
    paddingRight: 6,
    height: 54,
    ...shadow,
    shadowOpacity: 0.14,
    elevation: 6,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text, paddingVertical: 0 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: "#D1D1D6", marginHorizontal: 8 },
  searchIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  filters: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: colors.background,
    ...shadow,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  filterChipOn: { backgroundColor: colors.primarySoft },
  filterText: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  filterTextOn: { color: colors.primary },
  mapLoading: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 10,
    ...shadow,
  },
  controls: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.background,
    ...shadow,
    shadowOpacity: 0.14,
  },
  listPillText: { fontSize: 14, fontWeight: "700", color: colors.text },
  locateButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
    shadowOpacity: 0.14,
  },
  sheetArea: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  marker: { alignItems: "center", maxWidth: 140 },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinClosed: { backgroundColor: "#8E8E93" },
  // Rehber kaydı (online randevu yok): beyaz zemin, vurgu rengi kenarlık
  pinListing: { backgroundColor: "#fff", borderColor: colors.primary, borderWidth: 2 },
  listOnline: { fontSize: 12.5, fontWeight: "700", color: colors.success, marginTop: 3 },
  pinSelected: { width: 38, height: 38, borderRadius: 19, borderWidth: 3 },
  pinDeal: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  pinDealText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  featureChip: { backgroundColor: colors.primary },
  listDeal: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 3 },
  markerLabel: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
    textShadowColor: "#fff",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  markerLabelSel: { color: colors.primary, fontSize: 12.5 },
  listHeader: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listTitle: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  listCount: { fontSize: 13, color: colors.muted, marginTop: 2 },
  listItem: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listName: { fontSize: 16, fontWeight: "700", color: colors.text },
  listRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  listRatingValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  listMuted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  listPhoto: { width: 86, height: 86, borderRadius: 12, backgroundColor: colors.surface },
  listPhotoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  emptyList: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
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
