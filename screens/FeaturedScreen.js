import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import { colors, formatTL, shadow } from "../components/theme";
import { Stars, distanceText, openStatusText } from "../components/SalonSheet";
import { discountRange, upToDiscount } from "../components/pricing";
import { salonApi } from "../services/api";
import { CardListSkeleton, LoadError } from "../components/Skeleton";
import { useRealtimeEvent } from "../services/realtime";

const PERIODS = [
  { key: "week", label: "Haftanın", title: "Haftanın salonları", since: "Bu hafta" },
  { key: "month", label: "Ayın", title: "Ayın salonları", since: "Bu ay" },
  { key: "year", label: "Yılın", title: "Yılın salonları", since: "Bu yıl" },
];
const MEDALS = ["#D4A017", "#A7A9AC", "#B87333"];

/**
 * Vitrin: seçilen şehirde haftanın / ayın / yılın kuaförleri ve indirimdeki salonlar.
 * Sıralama yalnızca gerçek verilerden (tamamlanan randevular ve değerlendirmeler) hesaplanır; ücretli öne çıkarma yoktur.
 */
export default function FeaturedScreen({ navigation, route }) {
  const [city, setCity] = useState(route.params?.city ?? null);
  const [cities, setCities] = useState([]);
  const [cityPicker, setCityPicker] = useState(false);
  const [period, setPeriod] = useState("month");
  const [ranking, setRanking] = useState(null);
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    salonApi
      .cities()
      .then((r) => {
        setCities(r.items);
        setCity((c) => c ?? r.items[0]?.city ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!city) return;
    setError(null);
    try {
      const [r, d] = await Promise.all([salonApi.featured(city, period), salonApi.deals(city)]);
      setRanking(r);
      setDeals(d.items);
    } catch (e) {
      setError(e.message);
    }
  }, [city, period]);

  useEffect(() => {
    setRanking(null);
    load();
  }, [load]);

  useRealtimeEvent("salons:changed", load);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openSalon = (salon) => navigation.navigate("Home", { focusSalon: salon });
  const p = PERIODS.find((x) => x.key === period);

  return (
    <View style={styles.container}>
      <AppHeader title="Öne çıkanlar" back />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.cityButton}
            onPress={() => setCityPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Şehir: ${city ?? "seçilmedi"}. Değiştir`}
          >
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.cityText}>{city ?? "Şehir seçin"}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>{p.title}</Text>
          <Text style={styles.heroSub}>
            {p.since} en çok tercih edilen ve en iyi puan alan salonlar. Sıralama tamamlanan randevulara ve müşteri
            değerlendirmelerine göre hesaplanır.
          </Text>
          <View style={styles.segment} accessibilityRole="tablist">
            {PERIODS.map((x) => {
              const on = x.key === period;
              return (
                <TouchableOpacity
                  key={x.key}
                  style={[styles.segItem, on && styles.segItemOn]}
                  onPress={() => setPeriod(x.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{x.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error && !ranking ? (
          <View style={{ minHeight: 420 }}>
            <LoadError message={error} onRetry={load} skeleton={<CardListSkeleton cards={3} />} />
          </View>
        ) : !ranking ? (
          <CardListSkeleton cards={3} />
        ) : ranking.items.length ? (
          <View style={styles.list}>
            {ranking.items.map((item) => (
              <RankCard key={item.salon.id} item={item} since={p.since} onPress={() => openSalon(item.salon)} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="trophy-outline" size={30} color={colors.faint} />
            <Text style={styles.emptyTitle}>{p.since} için henüz sıralama yok</Text>
            <Text style={styles.emptyText}>
              Bir salonun listeye girmesi için bu dönemde uygulama üzerinden en az {ranking.minCompleted} randevusunun
              tamamlanmış olması gerekir.
            </Text>
          </View>
        )}

        {deals?.length ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>İndirimdeki salonlar</Text>
              <Text style={styles.sectionSub}>{city}</Text>
            </View>
            <FlatList
              horizontal
              data={deals}
              keyExtractor={(x) => x.salon.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => <DealCard item={item} onPress={() => openSalon(item.salon)} />}
            />
          </>
        ) : null}
      </ScrollView>

      <Modal visible={cityPicker} transparent animationType="fade" onRequestClose={() => setCityPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCityPicker(false)}>
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Şehir seçin</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {cities.map((c) => (
                <TouchableOpacity
                  key={c.city}
                  style={styles.pickerRow}
                  onPress={() => {
                    setCity(c.city);
                    setCityPicker(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.pickerCity, c.city === city && { color: colors.primary, fontWeight: "700" }]}>
                    {c.city}
                  </Text>
                  <Text style={styles.muted}>{c.salonCount} salon</Text>
                  {c.city === city ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function RankCard({ item, since, onPress }) {
  const { salon, rank, stats } = item;
  const status = openStatusText(salon);
  const top = rank <= 3;
  return (
    <TouchableOpacity
      style={[styles.card, rank === 1 && styles.cardFirst]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${salon.name}`}
    >
      {rank === 1 && salon.photo ? (
        <Image source={{ uri: salon.photo }} style={styles.cover} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={styles.cardBody}>
        <View style={[styles.rank, top && { backgroundColor: MEDALS[rank - 1] }]}>
          {top ? <Ionicons name="trophy" size={15} color="#fff" /> : <Text style={styles.rankText}>{rank}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {salon.name}
          </Text>
          <View style={styles.ratingRow}>
            {salon.ratingCount ? (
              <>
                <Text style={styles.ratingValue}>
                  {salon.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}
                </Text>
                <Stars value={salon.rating} size={12} />
                <Text style={styles.muted}>({salon.ratingCount})</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.muted}>
            {since} {stats.completedAppointments} randevu
            {stats.periodReviewCount ? ` · ${stats.periodReviewCount} yeni yorum` : ""}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            <Text style={{ color: status.color, fontWeight: "700" }}>{status.label}</Text>
            {[salon.kindLabel, distanceText(salon.distanceKm), salon.district].filter(Boolean).map((t) => ` · ${t}`)}
          </Text>
          {salon.discount ? <Text style={styles.deal}>{upToDiscount(salon.discount.maxPercent)}</Text> : null}
        </View>
        {rank !== 1 && salon.photo ? (
          <Image source={{ uri: salon.photo }} style={styles.thumb} accessibilityIgnoresInvertColors />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function DealCard({ item, onPress }) {
  const { salon, deals } = item;
  return (
    <TouchableOpacity style={styles.dealCard} onPress={onPress} accessibilityRole="button">
      {salon.photo ? (
        <Image source={{ uri: salon.photo }} style={styles.dealImage} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.dealImage, styles.dealImageEmpty]}>
          <Ionicons name="cut-outline" size={26} color={colors.primary} />
        </View>
      )}
      <View style={styles.dealBadge}>
        <Text style={styles.dealBadgeText}>%{deals[0].percent}</Text>
      </View>
      <View style={{ padding: 12 }}>
        <Text style={styles.cardName} numberOfLines={1}>
          {salon.name}
        </Text>
        {deals.slice(0, 2).map((d) => (
          <View key={d.serviceId} style={styles.dealRow}>
            <Text style={styles.dealService} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={styles.oldPrice}>{formatTL(d.listPrice)}</Text>
            <Text style={styles.newPrice}>{formatTL(d.price)}</Text>
          </View>
        ))}
        <Text style={styles.dealDates}>
          {deals[0].activeToday ? "" : "Başlıyor: "}
          {discountRange(deals[0])}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { backgroundColor: colors.background, padding: 18, paddingBottom: 16 },
  cityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
  },
  cityText: { fontSize: 14, fontWeight: "700", color: colors.text },
  heroTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.6, marginTop: 14 },
  heroSub: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: 6 },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginTop: 16 },
  segItem: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segItemOn: { backgroundColor: colors.background, ...shadow, shadowOpacity: 0.08, elevation: 2 },
  segText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  segTextOn: { color: colors.primary, fontWeight: "800" },
  center: { alignItems: "center", padding: 40 },
  retry: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  retryText: { color: colors.primary, fontWeight: "700" },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.background, borderRadius: 16, overflow: "hidden", ...shadow, shadowOpacity: 0.06 },
  cardFirst: { borderWidth: 1.5, borderColor: MEDALS[0] },
  cover: { width: "100%", height: 150, backgroundColor: colors.surface },
  cardBody: { flexDirection: "row", gap: 12, padding: 14, alignItems: "flex-start" },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 14, fontWeight: "800", color: colors.text },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  deal: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 4 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface },
  emptyBox: { alignItems: "center", margin: 16, padding: 24, backgroundColor: colors.background, borderRadius: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 10, textAlign: "center" },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: "center", lineHeight: 20 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: colors.muted },
  dealCard: { width: 250, backgroundColor: colors.background, borderRadius: 16, overflow: "hidden" },
  dealImage: { width: "100%", height: 110, backgroundColor: colors.surface },
  dealImageEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  dealBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dealBadgeText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  dealRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dealService: { flex: 1, fontSize: 13.5, color: colors.text },
  oldPrice: { fontSize: 12, color: colors.muted, textDecorationLine: "line-through" },
  newPrice: { fontSize: 13.5, fontWeight: "800", color: colors.primary },
  dealDates: { fontSize: 12, color: colors.muted, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  picker: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 34,
  },
  pickerTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 8 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerCity: { flex: 1, fontSize: 16, color: colors.text },
});
