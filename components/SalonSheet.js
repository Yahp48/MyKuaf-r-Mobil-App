import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DraggableSheet from "./DraggableSheet";
import PhotoViewer from "./PhotoViewer";
import { SheetSkeleton } from "./Skeleton";
import { colors } from "./theme";
import { BUSINESS_PANEL_URL } from "../config";
import { discountOn, discountRange, priceOn, upToDiscount } from "./pricing";
import { useApp } from "../context/AppContext";
import { favoriteApi, salonApi } from "../services/api";
import { useRealtimeEvent } from "../services/realtime";

export const HALF_RATIO = 0.46;

const WEEKDAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const TABS = [
  { key: "overview", label: "Genel bakış" },
  { key: "services", label: "Hizmetler" },
  { key: "team", label: "Ekip" },
  { key: "reviews", label: "Yorumlar" },
];

const tl0 = (n) => `₺${Math.round(Number(n) || 0).toLocaleString("tr-TR")}`;
export const priceRangeText = (r) => (!r ? null : r.min === r.max ? tl0(r.min) : `${tl0(r.min)}–${tl0(r.max)}`);
export const distanceText = (km) =>
  km === undefined || km === null
    ? null
    : km < 1
      ? `${Math.round(km * 1000)} m`
      : `${km.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;

export function openStatusText(s) {
  if (s.isOpenNow === null || s.isOpenNow === undefined)
    return { label: "Çalışma saati bilinmiyor", color: colors.muted, detail: "" };
  if (s.isOpenNow)
    return { label: "Açık", color: colors.success, detail: s.todayHours ? `Kapanış ${s.todayHours.closes}` : "" };
  return { label: "Kapalı", color: colors.danger, detail: s.nextOpen ? `Açılış: ${s.nextOpen.label}` : "" };
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "bugün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

/** TR cep numarasını wa.me biçimine çevirir: 05XX… / 5XX… / +905XX… → 905XX… */
function waNumber(raw) {
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("90")) return d;
  if (d.startsWith("0")) return `9${d}`;
  return `90${d}`;
}

const withScheme = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const prettyUrl = (url) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

export function Stars({ value, size = 13 }) {
  return (
    <View style={{ flexDirection: "row" }} accessibilityLabel={`5 üzerinden ${value} puan`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i - 0.25 ? "star" : value >= i - 0.75 ? "star-half" : "star-outline"}
          size={size}
          color="#F5A623"
        />
      ))}
    </View>
  );
}

/**
 * Haritada salona dokununca açılan kart: önce yarım ekran, yukarı çekince tam ekran.
 * Fotoğraflar, durum, eylemler, sekmeler (genel bakış / hizmetler / ekip / yorumlar).
 */
const SalonSheet = forwardRef(function SalonSheet(
  {
    salon: summary,
    areaHeight,
    topOffset,
    route,
    routeLoading,
    onDirections,
    onBook,
    onClose,
    onFavoriteChange,
    onSnapChange,
  },
  ref,
) {
  const { status } = useApp();
  const sheetRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [picked, setPicked] = useState([]);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [reviews, setReviews] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [reviewViewer, setReviewViewer] = useState(null);
  const [isFavorite, setIsFavorite] = useState(!!summary.isFavorite);

  const salon = detail && detail.id === summary.id ? { ...summary, ...detail } : summary;
  const photos = detail?.photos?.length ? detail.photos : summary.photo ? [summary.photo] : [];

  useImperativeHandle(ref, () => ({ close: () => sheetRef.current?.snapTo("closed") }), []);

  const loadDetail = useCallback(async () => {
    try {
      setDetailError(null);
      const data = await salonApi.detail(summary.id);
      setDetail(data.salon);
      setIsFavorite(!!data.salon.isFavorite);
    } catch (e) {
      setDetailError(e.message);
    }
  }, [summary.id]);

  const loadReviews = useCallback(
    async (page = 1) => {
      setReviewsLoading(true);
      try {
        const data = await salonApi.reviews(summary.id, page);
        setReviews((prev) =>
          page === 1 || !prev ? data : { ...data, items: [...prev.items, ...data.items], summary: data.summary },
        );
      } catch {
        // Yorumlar yüklenemezse bölüm boş kalır; ana bilgiler etkilenmez.
      } finally {
        setReviewsLoading(false);
      }
    },
    [summary.id],
  );

  // Başka salona geçildiğinde içerik sıfırlanır, kart yarım ekrana gelir.
  useEffect(() => {
    setDetail(null);
    setReviews(null);
    setTab("overview");
    setPicked([]);
    setHoursOpen(false);
    setIsFavorite(!!summary.isFavorite);
    sheetRef.current?.scrollToTop();
    if (sheetRef.current?.snap !== "full") sheetRef.current?.snapTo("half");
    loadDetail();
    loadReviews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.id]);

  useRealtimeEvent("salons:changed", (payload) => {
    if (!payload?.salonId || payload.salonId === summary.id) loadDetail();
  });

  const close = () => sheetRef.current?.snapTo("closed");

  const toggleFavorite = async () => {
    if (status !== "signedIn") return;
    const next = !isFavorite;
    setIsFavorite(next);
    onFavoriteChange?.(summary.id, next);
    try {
      await (next ? favoriteApi.addSalon(summary.id) : favoriteApi.removeSalon(summary.id));
    } catch (e) {
      setIsFavorite(!next);
      onFavoriteChange?.(summary.id, !next);
      Alert.alert("Kaydedilemedi", e.message);
    }
  };

  const share = () =>
    Share.share({
      message: [salon.name, salon.address, salon.phone, salon.website].filter(Boolean).join("\n"),
    }).catch(() => {});

  const call = () => salon.phone && Linking.openURL(`tel:${salon.phone}`).catch(() => {});
  const whatsapp = () =>
    salon.whatsapp &&
    Linking.openURL(`https://wa.me/${waNumber(salon.whatsapp)}`).catch(() =>
      Alert.alert("WhatsApp açılamadı", "Cihazınızda WhatsApp yüklü olmayabilir."),
    );
  const website = () => salon.website && Linking.openURL(withScheme(salon.website)).catch(() => {});
  const openInMaps = () => {
    const { latitude: lat, longitude: lng } = salon;
    const label = encodeURIComponent(salon.name);
    const url =
      Platform.OS === "ios" ? `maps://?q=${label}&ll=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {}),
    );
  };

  const book = (extra = {}) => onBook({ salonId: salon.id, salonName: salon.name, serviceIds: picked, ...extra });

  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickedServices = (detail?.services ?? []).filter((s) => picked.includes(s.id));
  // Bugünün fiyatı; kesin tutar randevu gününe göre sunucuda hesaplanır.
  const pickedTotal = pickedServices.reduce((sum, s) => sum + priceOn(s), 0);

  const statusInfo = openStatusText(salon);
  // Rehber kaydı (bookable=false): online randevu yok, yalnızca bilgi ve iletişim
  const bookable = salon.bookable !== false;
  const meta = [salon.kindLabel, priceRangeText(salon.priceRange), distanceText(salon.distanceKm)].filter(Boolean);
  const todayWeekday = ((new Date().getDay() + 6) % 7) + 1;
  const reviewSummary = reviews?.summary;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={2} accessibilityRole="header">
          {salon.name}
          {salon.verified ? (
            <Text accessibilityLabel="Doğrulanmış işletme">
              {" "}
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </Text>
          ) : null}
        </Text>
        <TouchableOpacity onPress={share} style={styles.roundBtn} accessibilityLabel="Paylaş" hitSlop={6}>
          <Ionicons name="share-social-outline" size={19} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={close} style={styles.roundBtn} accessibilityLabel="Kapat" hitSlop={6}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.ratingRow}>
        {salon.ratingCount ? (
          <>
            <Text style={styles.ratingValue}>{salon.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}</Text>
            <Stars value={salon.rating} />
            <Text style={styles.muted}>({salon.ratingCount})</Text>
          </>
        ) : (
          <Text style={styles.muted}>Henüz değerlendirme yok</Text>
        )}
      </View>
      {meta.length ? <Text style={styles.muted}>{meta.join(" · ")}</Text> : null}
      <Text style={styles.statusLine}>
        <Text style={{ color: statusInfo.color, fontWeight: "700" }}>{statusInfo.label}</Text>
        {statusInfo.detail ? <Text style={styles.muted}> · {statusInfo.detail}</Text> : null}
      </Text>
      {bookable && detail?.firstVisitDiscountPercent ? (
        <View style={styles.dealBanner}>
          <Ionicons name="gift-outline" size={15} color={colors.primary} />
          <Text style={styles.dealBannerText}>İlk randevunuza %{detail.firstVisitDiscountPercent} indirim</Text>
        </View>
      ) : null}
      {salon.discount ? (
        <TouchableOpacity
          style={styles.dealBanner}
          onPress={() => {
            setTab("services");
            sheetRef.current?.snapTo("full");
          }}
          accessibilityRole="button"
        >
          <Ionicons name="pricetag" size={15} color={colors.primary} />
          <Text style={styles.dealBannerText}>
            {salon.discount.activeToday
              ? `Seçili hizmetlerde ${upToDiscount(salon.discount.maxPercent)}`
              : `Yakında ${upToDiscount(salon.discount.maxPercent)}`}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const actions = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} key="actions">
      {bookable ? (
        <Chip icon="calendar" label="Randevu al" primary onPress={() => book()} />
      ) : salon.phone ? (
        <Chip icon="call" label="Ara" primary onPress={call} />
      ) : null}
      <Chip
        icon="navigate"
        label={route ? `${route.duration}` : "Yol tarifi"}
        onPress={onDirections}
        loading={routeLoading}
        outlinePrimary
      />
      {bookable && salon.phone ? <Chip icon="call-outline" label="Ara" onPress={call} /> : null}
      {!bookable && salon.website ? <Chip icon="globe-outline" label="Web sitesi" onPress={website} /> : null}
      {salon.whatsapp ? <Chip icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} /> : null}
      {status === "signedIn" ? (
        <Chip
          icon={isFavorite ? "bookmark" : "bookmark-outline"}
          label={isFavorite ? "Kaydedildi" : "Kaydet"}
          onPress={toggleFavorite}
          active={isFavorite}
        />
      ) : null}
      <Chip icon="share-social-outline" label="Paylaş" onPress={share} />
    </ScrollView>
  );

  const gallery = photos.length ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery} key="gallery">
      {photos.map((uri, i) => (
        <TouchableOpacity
          key={`${i}-${uri}`}
          onPress={() => setViewerIndex(i)}
          activeOpacity={0.85}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Fotoğraf ${i + 1} / ${photos.length}`}
        >
          <Image source={{ uri }} style={i === 0 ? styles.photoBig : styles.photo} accessibilityIgnoresInvertColors />
          {i === 0 && photos.length > 1 ? (
            <View style={styles.photoCount}>
              <Ionicons name="images-outline" size={13} color="#fff" />
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </ScrollView>
  ) : (
    <View key="gallery" />
  );

  const tabs = (
    <View style={styles.tabsWrap} key="tabs">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.filter((t) => bookable || t.key === "overview").map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => {
                setTab(t.key);
                if (sheetRef.current?.snap !== "full") sheetRef.current?.snapTo("full");
              }}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const loadingBlock = (
    <View style={styles.centerBlock}>
      {detailError ? (
        <>
          <Text style={styles.muted}>{detailError}</Text>
          <TouchableOpacity onPress={loadDetail} style={styles.retry}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </>
      ) : (
        <SheetSkeleton />
      )}
    </View>
  );

  const overview = (
    <View>
      {!bookable ? (
        <View style={styles.listingBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listingTitle}>Online randevu henüz yok</Text>
            <Text style={styles.mutedSmall}>
              Bu salon MyKuaför'e henüz katılmadı. Randevu için telefonla ulaşabilir veya yol tarifi alabilirsiniz.
            </Text>
            {BUSINESS_PANEL_URL ? (
              <Text
                style={styles.ownerLink}
                onPress={() => Linking.openURL(`${BUSINESS_PANEL_URL}/kayit`).catch(() => {})}
                accessibilityRole="link"
              >
                İşletme sahibi misiniz? Salonunuzu sahiplenin ›
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {route ? (
        <View style={styles.routeBox}>
          <Ionicons name="car-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeMain}>
              {route.duration} · {route.distance}
            </Text>
            <Text style={styles.mutedSmall}>Haritada rota gösteriliyor</Text>
          </View>
          <TouchableOpacity onPress={openInMaps} style={styles.routeBtn} accessibilityRole="button">
            <Text style={styles.routeBtnText}>Navigasyon</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {salon.description ? <Text style={styles.description}>{salon.description}</Text> : null}

      <View style={styles.infoList}>
        <InfoRow icon="time-outline" onPress={() => setHoursOpen((v) => !v)} accessibilityLabel="Çalışma saatleri">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.infoText}>
              <Text style={{ color: statusInfo.color, fontWeight: "700" }}>{statusInfo.label}</Text>
              {statusInfo.detail ? ` · ${statusInfo.detail}` : ""}
            </Text>
            <Ionicons
              name={hoursOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
              style={{ marginLeft: 6 }}
            />
          </View>
          {hoursOpen && detail
            ? detail.workingHours.map((h) => (
                <View key={h.weekday} style={styles.hourRow}>
                  <Text style={[styles.hourDay, h.weekday === todayWeekday && styles.bold]}>{WEEKDAYS[h.weekday]}</Text>
                  <Text
                    style={[
                      styles.hourTime,
                      h.weekday === todayWeekday && styles.bold,
                      h.isClosed && { color: colors.danger },
                    ]}
                  >
                    {h.isClosed ? "Kapalı" : `${h.opens}–${h.closes}`}
                  </Text>
                </View>
              ))
            : null}
        </InfoRow>
        <InfoRow icon="location-outline" onPress={openInMaps} accessibilityLabel="Adresi haritalarda aç">
          <Text style={styles.infoText}>{salon.address}</Text>
          {salon.district || salon.city ? (
            <Text style={styles.mutedSmall}>{[salon.district, salon.city].filter(Boolean).join(", ")}</Text>
          ) : null}
        </InfoRow>
        {salon.website ? (
          <InfoRow icon="globe-outline" onPress={website} accessibilityLabel="Web sitesini aç">
            <Text style={[styles.infoText, styles.link]}>{prettyUrl(salon.website)}</Text>
          </InfoRow>
        ) : null}
        {salon.phone ? (
          <InfoRow icon="call-outline" onPress={call} accessibilityLabel="Salonu ara">
            <Text style={styles.infoText}>{salon.phone}</Text>
          </InfoRow>
        ) : null}
        {salon.whatsapp ? (
          <InfoRow icon="logo-whatsapp" onPress={whatsapp} accessibilityLabel="WhatsApp ile yaz">
            <Text style={styles.infoText}>WhatsApp ile yazın</Text>
            <Text style={styles.mutedSmall}>{salon.whatsapp}</Text>
          </InfoRow>
        ) : null}
        {detail?.booking ? (
          <InfoRow icon="shield-checkmark-outline">
            <Text style={styles.infoText}>Online randevu</Text>
            <Text style={styles.mutedSmall}>
              Randevunuzu saatinden {detail.booking.cancellationWindowHours} saat öncesine kadar uygulamadan iptal
              edebilirsiniz.
            </Text>
          </InfoRow>
        ) : null}
      </View>

      {detail?.services?.length ? (
        <Section title="Hizmetler" action="Tümü" onAction={() => setTab("services")}>
          {detail.services.slice(0, 3).map((s) => (
            <ServiceRow key={s.id} service={s} picked={picked.includes(s.id)} onPress={() => togglePick(s.id)} />
          ))}
        </Section>
      ) : null}

      {salon.source ? (
        <Text
          style={styles.sourceNote}
          onPress={() =>
            salon.source.ref && Linking.openURL(`https://www.openstreetmap.org/${salon.source.ref}`).catch(() => {})
          }
        >
          Salon bilgileri © {salon.source.name} katkıda bulunanları (ODbL). Bilgiler değişmiş olabilir; hata görürseniz
          kaynağında düzeltebilirsiniz.
        </Text>
      ) : null}

      {reviewSummary?.count ? (
        <Section title="Değerlendirmeler" action="Tümü" onAction={() => setTab("reviews")}>
          <ReviewSummary summary={reviewSummary} />
          {reviews.items.slice(0, 2).map((r) => (
            <ReviewItem key={r.id} review={r} onPhoto={(list, i) => setReviewViewer({ list, i })} />
          ))}
        </Section>
      ) : null}
    </View>
  );

  const services = !detail ? (
    loadingBlock
  ) : detail.services.length ? (
    <View style={styles.pad}>
      {detail.packages?.length ? (
        <>
          <Text style={styles.subTitle}>Paketler</Text>
          {detail.packages.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.packageCard}
              onPress={() => book({ packageId: p.id, serviceIds: p.services.map((x) => x.id) })}
              accessibilityRole="button"
              accessibilityLabel={`${p.name} paketi, ${tl0(p.price)}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{p.name}</Text>
                <Text style={styles.mutedSmall}>
                  {p.services.map((x) => x.name).join(" + ")} · {p.durationMinutes} dk
                </Text>
                {p.description ? <Text style={styles.mutedSmall}>{p.description}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                {p.saving > 0 ? <Text style={styles.oldPrice}>{tl0(p.listPrice)}</Text> : null}
                <Text style={[styles.servicePrice, { color: colors.primary }]}>{tl0(p.price)}</Text>
                {p.saving > 0 ? <Text style={styles.saving}>{tl0(p.saving)} tasarruf</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
          <Text style={[styles.subTitle, { marginTop: 18 }]}>Tek tek hizmetler</Text>
        </>
      ) : null}
      <Text style={styles.hint}>Almak istediğiniz hizmetleri seçin, ardından randevu saatini belirleyin.</Text>
      {detail.services.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          picked={picked.includes(s.id)}
          onPress={() => togglePick(s.id)}
          withDescription
        />
      ))}
    </View>
  ) : (
    <Empty icon="cut-outline" text="Bu salon henüz hizmet eklememiş." />
  );

  const team = !detail ? (
    loadingBlock
  ) : detail.staff.length ? (
    <View style={styles.pad}>
      {detail.staff.map((st) => (
        <TouchableOpacity
          key={st.id}
          style={styles.staffRow}
          onPress={() => book({ staffId: st.id })}
          accessibilityRole="button"
          accessibilityLabel={`${st.name} ile randevu al`}
        >
          {st.avatarUrl ? (
            <Image source={{ uri: st.avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials(st.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName}>{st.name}</Text>
            {st.title ? <Text style={styles.mutedSmall}>{st.title}</Text> : null}
            {st.specialties?.length ? (
              <View style={styles.tagRow}>
                {st.specialties.map((t) => (
                  <Text key={t} style={styles.tag}>
                    {t}
                  </Text>
                ))}
              </View>
            ) : null}
            {st.bio ? (
              <Text style={styles.mutedSmall} numberOfLines={2}>
                {st.bio}
              </Text>
            ) : null}
          </View>
          <View style={styles.staffBook}>
            <Text style={styles.staffBookText}>Randevu</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : (
    <Empty icon="people-outline" text="Ekip bilgisi henüz eklenmemiş." />
  );

  const reviewsTab = !reviews ? (
    <SheetSkeleton />
  ) : reviews.summary.count ? (
    <View style={styles.pad}>
      <ReviewSummary summary={reviews.summary} />
      <Text style={styles.hint}>Yorumlar yalnızca bu salonda randevusu tamamlanan müşterilerden gelir.</Text>
      {reviews.items.map((r) => (
        <ReviewItem key={r.id} review={r} onPhoto={(list, i) => setReviewViewer({ list, i })} />
      ))}
      {reviews.hasNextPage ? (
        <TouchableOpacity
          onPress={() => loadReviews(reviews.page + 1)}
          style={styles.moreBtn}
          disabled={reviewsLoading}
        >
          {reviewsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.moreText}>Daha fazla yorum</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  ) : (
    <Empty
      icon="chatbubble-ellipses-outline"
      text="Henüz yorum yok. İlk randevudan sonra müşteriler değerlendirme yapabilir."
    />
  );

  const body = { overview, services, team, reviews: reviewsTab }[tab];

  const footer = () => (
    <View style={styles.footer}>
      <View style={{ flex: 1 }}>
        {pickedServices.length ? (
          <>
            <Text style={styles.footerMain}>{tl0(pickedTotal)}</Text>
            <Text style={styles.mutedSmall}>{pickedServices.length} hizmet seçildi</Text>
          </>
        ) : (
          <>
            <Text style={styles.footerMain} numberOfLines={1}>
              {salon.name}
            </Text>
            <Text style={[styles.mutedSmall, { color: statusInfo.color }]}>
              {statusInfo.label}
              {statusInfo.detail ? <Text style={styles.mutedSmall}> · {statusInfo.detail}</Text> : null}
            </Text>
          </>
        )}
      </View>
      {bookable ? (
        <TouchableOpacity style={styles.footerBtn} onPress={() => book()} accessibilityRole="button">
          <Text style={styles.footerBtnText}>Randevu al</Text>
        </TouchableOpacity>
      ) : salon.phone ? (
        <TouchableOpacity style={styles.footerBtn} onPress={call} accessibilityRole="button">
          <Text style={styles.footerBtnText}>Ara</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <>
      <DraggableSheet
        ref={sheetRef}
        areaHeight={areaHeight}
        topOffset={topOffset}
        halfRatio={HALF_RATIO}
        header={header}
        footer={footer}
        onClose={onClose}
        onSnapChange={onSnapChange}
        stickyHeaderIndices={[2]}
      >
        {[actions, gallery, tabs, <View key="body">{body}</View>]}
      </DraggableSheet>
      <PhotoViewer photos={photos} index={viewerIndex} onClose={() => setViewerIndex(null)} title={salon.name} />
      <PhotoViewer
        photos={reviewViewer?.list ?? []}
        index={reviewViewer ? reviewViewer.i : null}
        onClose={() => setReviewViewer(null)}
        title="Müşteri fotoğrafı"
      />
    </>
  );
});

export default SalonSheet;

function Chip({ icon, label, onPress, primary, outlinePrimary, active, loading }) {
  const fg = primary ? "#fff" : outlinePrimary || active ? colors.primary : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={[styles.chip, primary && styles.chipPrimary, (outlinePrimary || active) && styles.chipOutline]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={17} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ icon, children, onPress, accessibilityLabel }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={styles.infoRow}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={21} color={colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </Wrap>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction} hitSlop={8}>
            <Text style={styles.sectionAction}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ServiceRow({ service, picked, onPress, withDescription }) {
  const deal = discountOn(service);
  return (
    <TouchableOpacity
      style={styles.serviceRow}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked }}
      accessibilityLabel={`${service.name}, ${service.durationMinutes} dakika, ${tl0(deal ? deal.price : service.price)}${deal ? `, yüzde ${deal.percent} indirimli` : ""}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceName}>{service.name}</Text>
        {withDescription && service.description ? (
          <Text style={styles.mutedSmall} numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
        <Text style={styles.mutedSmall}>{service.durationMinutes} dk</Text>
        {service.discount ? (
          <Text style={styles.dealNote}>
            %{service.discount.percent} indirim · {discountRange(service.discount)}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {deal ? <Text style={styles.oldPrice}>{tl0(service.price)}</Text> : null}
        <Text style={[styles.servicePrice, deal && { color: colors.primary }]}>
          {tl0(deal ? deal.price : service.price)}
        </Text>
      </View>
      <View style={[styles.check, picked && styles.checkOn]}>
        {picked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function ReviewSummary({ summary }) {
  const max = Math.max(1, ...summary.distribution.map((d) => d.count));
  return (
    <View style={styles.summary}>
      <View style={styles.summaryLeft}>
        {summary.distribution.map((d) => (
          <View key={d.rating} style={styles.distRow}>
            <Text style={styles.distLabel}>{d.rating}</Text>
            <View style={styles.distTrack}>
              <View style={[styles.distFill, { width: `${(d.count / max) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.summaryRight}>
        <Text style={styles.summaryValue}>{summary.average.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}</Text>
        <Stars value={summary.average} size={14} />
        <Text style={styles.mutedSmall}>{summary.count} değerlendirme</Text>
      </View>
    </View>
  );
}

function ReviewItem({ review, onPhoto }) {
  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <View style={[styles.reviewAvatar]}>
          <Text style={styles.reviewAvatarText}>{initials(review.authorName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{review.authorName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Stars value={review.rating} size={12} />
            <Text style={styles.mutedSmall}>{timeAgo(review.createdAt)}</Text>
          </View>
        </View>
      </View>
      {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
      {review.photos?.length ? (
        <View style={styles.reviewPhotos}>
          {review.photos.map((uri, i) => (
            <TouchableOpacity
              key={uri}
              onPress={() => onPhoto?.(review.photos, i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Yorum fotoğrafı ${i + 1}`}
            >
              <Image source={{ uri }} style={styles.reviewPhoto} accessibilityIgnoresInvertColors />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Empty({ icon, text }) {
  return (
    <View style={styles.centerBlock}>
      <Ionicons name={icon} size={30} color={colors.faint} />
      <Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { flex: 1, fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4, lineHeight: 27 },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  ratingValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
  mutedSmall: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  statusLine: { fontSize: 14, marginTop: 3 },
  listingBox: {
    flexDirection: "row",
    gap: 10,
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  ownerLink: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 6 },
  listingTitle: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  sourceNote: { fontSize: 11.5, color: colors.faint, marginHorizontal: 18, marginTop: 14, lineHeight: 16 },
  dealBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  dealBannerText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  dealNote: { fontSize: 12.5, fontWeight: "600", color: colors.primary, marginTop: 2 },
  oldPrice: { fontSize: 12.5, color: colors.muted, textDecorationLine: "line-through" },
  subTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 8, marginBottom: 6 },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    backgroundColor: "#FFF8FA",
    marginBottom: 8,
  },
  saving: { fontSize: 11.5, fontWeight: "800", color: colors.success, marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  tag: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
  },
  chipPrimary: { backgroundColor: colors.primary },
  chipOutline: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, fontWeight: "600" },
  gallery: { paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  photoBig: { width: 230, height: 150, borderRadius: 14, backgroundColor: colors.surface },
  photo: { width: 120, height: 150, borderRadius: 14, backgroundColor: colors.surface },
  photoCount: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  photoCountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  tabsWrap: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DCDCE0",
    marginTop: 8,
  },
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14.5, fontWeight: "600", color: colors.muted },
  tabTextOn: { color: colors.primary },
  pad: { paddingHorizontal: 18, paddingTop: 6 },
  hint: { fontSize: 13, color: colors.muted, marginVertical: 10, lineHeight: 18 },
  centerBlock: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 32 },
  retry: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  retryText: { color: colors.primary, fontWeight: "700" },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  routeMain: { fontSize: 15, fontWeight: "700", color: colors.text },
  routeBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  routeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  description: { fontSize: 14.5, color: colors.text, lineHeight: 21, paddingHorizontal: 18, paddingTop: 14 },
  infoList: { marginTop: 6 },
  infoRow: {
    flexDirection: "row",
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  link: { color: colors.primary },
  hourRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingRight: 8 },
  hourDay: { fontSize: 14, color: colors.text },
  hourTime: { fontSize: 14, color: colors.text },
  bold: { fontWeight: "700" },
  section: { paddingHorizontal: 18, paddingTop: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  sectionAction: { fontSize: 14, fontWeight: "700", color: colors.primary },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  serviceName: { fontSize: 15, fontWeight: "600", color: colors.text },
  servicePrice: { fontSize: 15, fontWeight: "700", color: colors.text },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  staffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarText: { color: colors.primary, fontWeight: "800", fontSize: 17 },
  staffName: { fontSize: 15.5, fontWeight: "600", color: colors.text },
  staffBook: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  staffBookText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  summary: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 10 },
  summaryLeft: { flex: 1, gap: 4 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distLabel: { width: 10, fontSize: 12, color: colors.muted, textAlign: "right" },
  distTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  distFill: { height: 8, borderRadius: 4, backgroundColor: "#F5A623" },
  summaryRight: { alignItems: "center", minWidth: 96 },
  summaryValue: { fontSize: 40, fontWeight: "300", color: colors.text, lineHeight: 46 },
  review: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { fontWeight: "700", color: colors.muted, fontSize: 13 },
  reviewName: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  reviewPhotos: { flexDirection: "row", gap: 6, marginTop: 8 },
  reviewPhoto: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.surface },
  reviewText: { fontSize: 14.5, color: colors.text, lineHeight: 21, marginTop: 8 },
  moreBtn: {
    marginTop: 14,
    alignSelf: "center",
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  moreText: { color: colors.primary, fontWeight: "700" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DCDCE0",
  },
  footerMain: { fontSize: 16, fontWeight: "700", color: colors.text },
  footerBtn: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
