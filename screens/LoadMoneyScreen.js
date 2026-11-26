import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome as FontAwesome } from '@expo/vector-icons';
import { MaterialIcons as MaterialIcons } from '@expo/vector-icons';

export default function LoadMoneyScreen({ navigation }) {
  return (
    <View style={styles.container}>
      
      <LinearGradient colors={['#FF4896', '#5A189A']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Para yükle</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      
      <View style={styles.body}>
        <Text style={styles.question}>Nasıl Para Yüklemek İstersin?</Text>

        <View style={styles.optionsContainer}>
          
          <TouchableOpacity style={styles.optionButton} onPress={() => navigation.navigate('BankTransferScreen')}>
            <View style={styles.optionLeft}>
              <MaterialCommunityIcons name="bank" size={30} color="#800080" />
              <Text style={styles.optionText}>Banka hesabından</Text>
            </View>
            <MaterialIcons name="chevron-right" size={28} color="#000" />
          </TouchableOpacity>
          

          
          <TouchableOpacity style={styles.optionButton} onPress={() => navigation.navigate('CreditCardTopupScreen')}>
            <View style={styles.optionLeft}>
              <FontAwesome name="credit-card" size={30} color="#800080" />
              <Text style={styles.optionText}>Banka / kredi kartıyla</Text>
            </View>
            <MaterialIcons name="chevron-right" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
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
    fontSize: 25,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  question: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 60,
  },
  optionsContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    paddingTop: 13,
    paddingBottom: 13,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 25,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 18,
    marginLeft: 15,
    color: '#000',
  },
});
