import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CheckBox } from 'react-native-elements';

export default function AddNewCardScreen({ navigation }) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [agreed, setAgreed] = useState(false);

  const isFormValid =
    cardNumber && cardName && expiry && cvv && agreed;

  const handleSubmit = () => {
    if (!isFormValid) return;

    const newCard = {
      id: Date.now().toString(),
      number: `**** **** **** ${cardNumber.slice(-4)}`,
      holder: cardName,
      expiry: expiry,
    };

    navigation.navigate('CreditCardTopupScreen', { newCard });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FF4896", "#5A189A"]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Banka/Kredi kartıyla para yükle</Text>
          <TouchableOpacity onPress={() => navigation.navigate("WalletScreen")}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.title}>Kart bilgilerini gir</Text>
        <Text style={styles.subtitle}>
          Cüzdanım hesabına para yüklemek istediğin kart bilgilerini ekle.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Kart numarası"
          value={cardNumber}
          onChangeText={setCardNumber}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Kart üzerindeki isim"
          value={cardName}
          onChangeText={setCardName}
        />

        <View style={styles.rowInput}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 10 }]}
            placeholder="Son kullanım tarihi"
            value={expiry}
            onChangeText={setExpiry}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="CVV"
            value={cvv}
            onChangeText={setCvv}
            keyboardType="numeric"
            secureTextEntry
          />
        </View>

        <View style={styles.checkboxContainer}>
          <CheckBox
  title="Kartım kaydedilsin"
  checked={agreed}
  onPress={() => setAgreed(!agreed)}
  containerStyle={{ backgroundColor: 'transparent', borderWidth: 0 }}
  textStyle={{ color: '#000', fontSize: 14 }}
/>
          <Text style={styles.checkboxText}>
            Kartım alışverişlerim için Mykuafor ve Cüzdanım'da aydınlatma metni
            kapsamında kaydedilsin.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          disabled={!isFormValid}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>Devam et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  rowInput: {
    flexDirection: 'row',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  checkboxText: {
    flex: 1,
    marginLeft: 10,
    color: '#000',
  },
  button: {
    backgroundColor: '#FF4896',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
