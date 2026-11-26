import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { AntDesign as Icon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function AboutScreen({ navigation }) {
  const appVersion = "2.1.4";
  const buildNumber = "247";
  const { state } = useApp();
    const cartCount = state.cartItems.length;

  const teamMembers = [
    { name: "Ahmet Yılmaz", role: "Kurucu & CEO", icon: "user-tie" },
    { name: "Ayşe Demir", role: "CTO", icon: "laptop-code" },
    { name: "Mehmet Kaya", role: "Tasarım Direktörü", icon: "paint-brush" },
    { name: "Fatma Öz", role: "Ürün Müdürü", icon: "chart-line" }
  ];

  const achievements = [
    { title: "50,000+", subtitle: "Aktif Kullanıcı", icon: "users" },
    { title: "1,200+", subtitle: "Kayıtlı Kuaför", icon: "store" },
    { title: "100,000+", subtitle: "Tamamlanan Randevu", icon: "calendar-check" },
    { title: "4.8/5", subtitle: "Uygulama Puanı", icon: "star" }
  ];

  const socialLinks = [
    { name: "Website", url: "https://womanhair.com", icon: "globe" },
    { name: "Instagram", url: "https://instagram.com/womanhair", icon: "instagram" },
    { name: "Facebook", url: "https://facebook.com/womanhair", icon: "facebook" },
    { name: "Twitter", url: "https://twitter.com/womanhair", icon: "twitter" },
    { name: "LinkedIn", url: "https://linkedin.com/company/womanhair", icon: "linkedin" }
  ];

  const openLink = (url) => {
    Linking.openURL(url);
  };

  const AchievementCard = ({ achievement }) => (
    <View style={styles.achievementCard}>
      <FontAwesome5 name={achievement.icon} size={24} color="#FF4896" />
      <Text style={styles.achievementTitle}>{achievement.title}</Text>
      <Text style={styles.achievementSubtitle}>{achievement.subtitle}</Text>
    </View>
  );

  const TeamMemberCard = ({ member }) => (
    <View style={styles.teamMemberCard}>
      <View style={styles.memberAvatar}>
        <FontAwesome5 name={member.icon} size={20} color="#FF4896" />
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{member.role}</Text>
      </View>
    </View>
  );

  const SocialLinkCard = ({ link }) => (
    <TouchableOpacity
      style={styles.socialLinkCard}
      onPress={() => openLink(link.url)}
    >
      <FontAwesome5 name={link.icon} size={20} color="#FF4896" />
      <Text style={styles.socialLinkText}>{link.name}</Text>
      <FontAwesome6 name="external-link-alt" size={12} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
     
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>HAKKINDA</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <FontAwesome6 name="bell" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        
        <View style={styles.appInfoCard}>
          <View style={styles.appIcon}>
            <Text style={styles.appIconText}>W</Text>
          </View>
          <Text style={styles.appName}>Woman Hair Design</Text>
          <Text style={styles.appTagline}>Güzelliğinizi Keşfedin</Text>
          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>Sürüm {appVersion} (Build {buildNumber})</Text>
          </View>
        </View>

      
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Misyonumuz</Text>
          <Text style={styles.missionText}>
            Woman Hair Design olarak, kadınların güzellik ihtiyaçlarını karşılamak ve 
            en kaliteli kuaför hizmetlerine kolay erişim sağlamak için buradayız. 
            Teknoloji ile güzelliği birleştirerek, her kadının kendini özel hissetmesini sağlıyoruz.
          </Text>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Başarılarımız</Text>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement, index) => (
              <AchievementCard key={index} achievement={achievement} />
            ))}
          </View>
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Özelliklerimiz</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <FontAwesome6 name="map-marker-alt" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Konum tabanlı kuaför arama</Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome6 name="calendar-alt" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Online randevu alma</Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome6 name="star" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Gerçek kullanıcı değerlendirmeleri</Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome6 name="credit-card" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Güvenli ödeme sistemi</Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome6 name="bell" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Randevu hatırlatmaları</Text>
            </View>
            <View style={styles.featureItem}>
              <FontAwesome6 name="heart" size={16} color="#FF4896" />
              <Text style={styles.featureText}>Favori kuaförler</Text>
            </View>
          </View>
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Ekibimiz</Text>
          <Text style={styles.teamDescription}>
            Tutkulu ve deneyimli ekibimiz, size en iyi deneyimi sunmak için çalışıyor.
          </Text>
          <View style={styles.teamGrid}>
            {teamMembers.map((member, index) => (
              <TeamMemberCard key={index} member={member} />
            ))}
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Bizi Takip Edin</Text>
          <View style={styles.socialLinksContainer}>
            {socialLinks.map((link, index) => (
              <SocialLinkCard key={index} link={link} />
            ))}
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Yasal</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity style={styles.legalLink}>
              <FontAwesome6 name="file-contract" size={16} color="#FF4896" />
              <Text style={styles.legalLinkText}>Kullanım Şartları</Text>
              <FontAwesome6 name="chevron-right" size={12} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalLink}>
              <FontAwesome6 name="shield-alt" size={16} color="#FF4896" />
              <Text style={styles.legalLinkText}>Gizlilik Politikası</Text>
              <FontAwesome6 name="chevron-right" size={12} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalLink}>
              <FontAwesome6 name="cookie-bite" size={16} color="#FF4896" />
              <Text style={styles.legalLinkText}>Çerez Politikası</Text>
              <FontAwesome6 name="chevron-right" size={12} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 İletişim</Text>
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <FontAwesome6 name="envelope" size={16} color="#FF4896" />
              <Text style={styles.contactText}>info@womanhair.com</Text>
            </View>
            <View style={styles.contactItem}>
              <FontAwesome6 name="phone" size={16} color="#FF4896" />
              <Text style={styles.contactText}>0850 123 45 67</Text>
            </View>
            <View style={styles.contactItem}>
              <FontAwesome6 name="map-marker-alt" size={16} color="#FF4896" />
              <Text style={styles.contactText}>İstanbul, Türkiye</Text>
            </View>
          </View>
        </View>

       
        <View style={styles.copyrightSection}>
          <Text style={styles.copyrightText}>
            © 2025 Woman Hair Design. Tüm hakları saklıdır.
          </Text>
          <Text style={styles.copyrightSubtext}>
            Made with ❤️ in Turkey
          </Text>
        </View>
      </ScrollView>

      
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => navigation.navigate("Appointments")}
          style={styles.navButton}
        >
          <FontAwesome5 name="calendar-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Randevular</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Home")}
          style={styles.navButton}
        >
          <FontAwesome5 name="map-marked-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Harita</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Shop")}
          style={styles.navButton}
        >
          <FontAwesome5 name="shopping-bag" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
          <Text style={styles.navText}>Mağaza</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Profile")}
          style={styles.navButton}
        >
          <FontAwesome6 name="user" size={24} color="#fff" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FF4896",
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logo: { color: "white", fontSize: 18, fontWeight: "bold" },
  content: { flex: 1, paddingBottom: 80 },
  appInfoCard: {
    backgroundColor: "#fff",
    margin: 15,
    borderRadius: 15,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#FF4896",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  appIconText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  appTagline: {
    fontSize: 16,
    color: "#666",
    marginBottom: 15,
  },
  versionInfo: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  missionText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    textAlign: "justify",
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  achievementCard: {
    width: "48%",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
    marginBottom: 2,
  },
  achievementSubtitle: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  featuresList: {},
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  featureText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
  },
  teamDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    textAlign: "center",
  },
  teamGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  teamMemberCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  memberRole: {
    fontSize: 10,
    color: "#666",
  },
  socialLinksContainer: {},
  socialLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  socialLinkText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
    flex: 1,
  },
  legalLinks: {},
  legalLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  legalLinkText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
    flex: 1,
  },
  contactInfo: {},
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
  },
  copyrightSection: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  copyrightText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 5,
  },
  copyrightSubtext: {
    fontSize: 12,
    color: "#FF4896",
    textAlign: "center",
    fontWeight: "500",
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FF4896',
    height: 70,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  navText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: '#e00061',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF4896',
  },
  navCartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});