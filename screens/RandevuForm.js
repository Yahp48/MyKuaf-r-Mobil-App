
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const RandevuForm = ({ navigation, route }) => {
  const { salonName, sehir } = route.params; 

  const [ad, setAd] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [tarih, setTarih] = useState('');
  const [saat, setSaat] = useState('');
  const [personel, setPersonel] = useState('');

  const handleSubmit = () => {
    const randevuData = {
      ad,
      email,
      telefon,
      tarih,
      saat,
      personel,
      sehir,
      kuafor: salonName,
    };

    fetch('http://192.168.187.117:5000/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(randevuData),
    })
      .then((response) => response.json())
      .then((data) => {
        alert('Randevunuz başarıyla kaydedildi');
        navigation.goBack();
      })
      .catch((error) => {
        console.error(error);
        alert('Bir hata oluştu. Lütfen tekrar deneyin.');
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Randevu Al</Text>

      <TextInput style={styles.input} placeholder="Ad Soyad" value={ad} onChangeText={setAd} />
      <TextInput style={styles.input} placeholder="Telefon" value={telefon} onChangeText={setTelefon} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Tarih" value={tarih} onChangeText={setTarih} />
      <TextInput style={styles.input} placeholder="Saat" value={saat} onChangeText={setSaat} />
      <TextInput style={styles.input} placeholder="Personel" value={personel} onChangeText={setPersonel} />

      <TextInput
        style={styles.input}
        value={salonName}
        editable={false}
        selectTextOnFocus={false}
      />
      <TextInput
        style={styles.input}
        value={sehir}
        editable={false}
        selectTextOnFocus={false}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Randevu Al</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 15,
    paddingLeft: 10,
    borderRadius: 5,
  },
  submitButton: {
    backgroundColor: '#FF4896',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default RandevuForm;