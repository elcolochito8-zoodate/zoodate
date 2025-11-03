import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';

export default function Step1Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

     

      {/* Contenido principal */}
      <View style={styles.content}>
        <Text style={styles.title}>
          ¿Buscas el match perfecto para tu mejor amigo?
        </Text>

        <Text style={styles.subtitle}>
          Sabemos lo difícil que es encontrar el compañero ideal. En ZooDate,
          conectamos dueños como tú para crear historias inolvidables.
        </Text>

        <Text style={styles.subtitle}>
          ¡Empecemos por presentar a tu estrella!
        </Text>

        {/* Animación de perro bailando */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('@/assets/animations/_Dancing_ dog 2x20.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
      </View>

      {/* Botón de acción */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(onboarding)/step2-basic-info')}
        >
          <Text style={styles.buttonText}>Presentar a mi mascota</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 15,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  animation: {
    width: 300,
    height: 300,
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
