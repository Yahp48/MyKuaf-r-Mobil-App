import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export default function CreditCardTopupScreen({ navigation }) {
  const route = useRoute();

  const [cards, setCards] = useState([
    {
      id: '1',
      number: '**** **** **** 8413',
      holder: 'Yahya Demir',
      expiry: '12/27',
    },
  ]);

  useEffect(() => {
    if (route.params?.newCard) {
      setCards((prev) => [...prev, route.params.newCard]);
    }
  }, [route.params?.newCard]);

  const handleDelete = (id) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF4896', '#5A189A']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Banka/Kredi kartıyla para yükle</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WalletScreen')}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body}>
        <Text style={styles.title}>Kart seç</Text>
        <Text style={styles.desc}>
          Para yüklemek için kayıtlı kartlarından birini seçebilir veya yeni bir kart ile devam edebilirsin.
        </Text>

        {cards.map((card) => (
          <View key={card.id} style={styles.cardBox}>
            <View>
              <Text style={styles.cardText}>{card.number}</Text>
              <Text style={styles.cardSubText}>{card.holder} • {card.expiry}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(card.id)}>
              <MaterialIcons name="delete" size={24} color="#900" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => navigation.navigate('AddNewCardScreen')}
        >
          <View style={styles.optionLeft}>
            <FontAwesome name="credit-card" size={20} color="#800080" />
            <Text style={styles.optionText}>Yeni kart ile devam et</Text>
          </View>
          <MaterialIcons name="chevron-right" size={28} color="#000" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 10 },
  desc: { fontSize: 14, color: '#555', marginBottom: 20 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#000',
  },
  cardBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  cardSubText: { fontSize: 14, color: '#666' },
});
