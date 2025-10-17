
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Image } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';

const personnelData = [
  { id: '1', name: 'Zeynep', image: require('../assets/personel1.png'), disabledDates: ['2024-05-05', '2024-05-10'] },
  { id: '2', name: 'Elif', image: require('../assets/personel2.png'), disabledDates: ['2024-05-06'] },
  { id: '3', name: 'Ayşe', image: require('../assets/personel3.png'), disabledDates: ['2024-05-07'] },
  { id: '4', name: 'Fatma', image: require('../assets/personel4.png'), disabledDates: [] },
];

const services = [
  { name: 'Saç Kesimi', price: 150 },
  { name: 'Boya', price: 300 },
  { name: 'Fön', price: 100 },
  { name: 'Bakım', price: 250 },
  { name: 'Saç Şekillendirme', price: 200 },
];

const times = ['10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00'];

export default function CalendarScreen({ navigation, route }) {
  const { salonName, sehir } = route.params;  

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);

  const toggleService = (serviceName) => {
    if (selectedServices.includes(serviceName)) {
      setSelectedServices(selectedServices.filter((item) => item !== serviceName));
    } else {
      setSelectedServices([...selectedServices, serviceName]);
    }
  };

  const isDateDisabled = (date) => {
    if (!selectedPersonnel) return false;
    return selectedPersonnel.disabledDates.includes(date);
  };

  const canSubmit = selectedPersonnel && selectedDate && selectedServices.length > 0 && selectedTime;

  const handleContinue = () => {
    if (!selectedPersonnel || !selectedDate || selectedServices.length === 0 || !selectedTime) {
      alert("Lütfen tüm seçimleri yapınız.");
      return;
    }
    const totalPrice = selectedServices.reduce((total, serviceName) => {
      const service = services.find((s) => s.name === serviceName);
      return total + (service ? service.price : 0);
    }, 0);

    navigation.navigate("PaymentScreen", {
      selectedPersonnel,
      selectedServices,
      selectedDate,
      selectedTime,
      totalPrice,
      salonName,
      sehir,
    });
  };

  const renderPersonnelItem = ({ item }) => (
    <TouchableOpacity style={styles.personnelItem} onPress={() => setSelectedPersonnel(item)}>
      <Image source={item.image} style={styles.personnelImage} />
      <Text style={styles.personnelName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#FF4896', '#5A189A']} style={styles.header}>
        <Text style={styles.headerTitle}>Randevu Al</Text>
      </LinearGradient>

      <FlatList
        data={personnelData}
        renderItem={renderPersonnelItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.personnelSlider}
      />

      <Calendar
        onDayPress={(day) => {
          if (!isDateDisabled(day.dateString)) {
            setSelectedDate(day.dateString);
          }
        }}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: '#FF4896' },
          ...selectedPersonnel?.disabledDates.reduce((acc, date) => {
            acc[date] = { disabled: true, disableTouchEvent: true };
            return acc;
          }, {}),
        }}
        theme={{ todayTextColor: '#FF4896', arrowColor: '#FF4896' }}
        style={{ marginTop: 20 }}
      />

      <Text style={styles.sectionTitle}>Hizmet Seç</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesContainer}>
        {services.map((service, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.serviceButton, selectedServices.includes(service.name) && styles.selectedServiceButton]}
            onPress={() => toggleService(service.name)}
          >
            <Text style={[styles.serviceText, selectedServices.includes(service.name) && styles.selectedServiceText]}>
              {service.name} ({service.price} TL)
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Saat Seç</Text>
      <View style={styles.timesContainer}>
        {times.map((time, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.timeButton, selectedTime === time && styles.selectedTimeButton]}
            onPress={() => setSelectedTime(time)}
          >
            <Text style={[styles.timeText, selectedTime === time && styles.selectedTimeText]}>{time}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>
          Toplam: {selectedServices.reduce((total, serviceName) => {
            const service = services.find((s) => s.name === serviceName);
            return total + (service ? service.price : 0);
          }, 0)} TL
        </Text>

        <TouchableOpacity
          style={[styles.continueButton, !canSubmit && { backgroundColor: '#ccc' }]}
          onPress={handleContinue}
          disabled={!canSubmit}
        >
          <Text style={styles.continueButtonText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  personnelSlider: { marginVertical: 20, paddingHorizontal: 10 },
  personnelItem: { alignItems: 'center', marginRight: 20 },
  personnelImage: { width: 60, height: 60, borderRadius: 30, marginBottom: 5 },
  personnelName: { fontSize: 14, color: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginLeft: 20 },
  servicesContainer: { marginTop: 10, paddingLeft: 20 },
  serviceButton: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 20, marginRight: 10 },
  selectedServiceButton: { backgroundColor: '#FF4896' },
  serviceText: { fontSize: 16, color: '#555' },
  selectedServiceText: { color: '#fff', fontWeight: 'bold' },
  timesContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 20 },
  timeButton: { backgroundColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, margin: 8 },
  selectedTimeButton: { backgroundColor: '#FF4896' },
  timeText: { fontSize: 16, color: '#555' },
  selectedTimeText: { color: '#fff', fontWeight: 'bold' },
  totalContainer: { padding: 20, alignItems: 'center' },
  totalText: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  continueButton: { backgroundColor: '#FF4896', padding: 15, borderRadius: 10 },
  continueButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
