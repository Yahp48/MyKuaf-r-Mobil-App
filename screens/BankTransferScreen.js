import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function BankTransferScreen({ navigation }) {
  const handleCopy = (text) => {
    Clipboard.setString(text);
    Alert.alert('Kopyalandı', `${text}`);
  };

  return (
    <View style={styles.container}>
     
      <LinearGradient colors={['#FF4896', '#5A189A']} style={styles.header}>
  <View style={styles.backButton}>
    <TouchableOpacity onPress={() => navigation.goBack()}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>

    <Text style={styles.headerText}>Banka hesabından para yükle</Text>

    <TouchableOpacity onPress={() => navigation.navigate('WalletScreen')} style={{ marginLeft: 'auto' }}>
      <MaterialIcons name="close" size={24} color="#fff" />
    </TouchableOpacity>
  </View>
</LinearGradient>


      
      <View style={styles.body}>
        <Text style={styles.title}>Para yükleme bilgileri</Text>

        <View style={styles.card}>
          <Text style={styles.label}>IBAN numarası</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>TR11 0006 7010 0000 0234 5672 14</Text>
            <TouchableOpacity onPress={() => handleCopy('TR11 0006 7010 0000 0234 5672 14')}>
              <MaterialIcons name="content-copy" size={22} color="#444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Alıcı hesap adı</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>Y ÖDEME ELEKTRONİK PARA VE ÖDEME HİZMETLERİ A.Ş.</Text>
            <TouchableOpacity onPress={() => handleCopy('Y ÖDEME ELEKTRONİK PARA VE ÖDEME HİZMETLERİ A.Ş.')}>
              <MaterialIcons name="content-copy" size={22} color="#444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
    marginRight: 10,
  },
});
