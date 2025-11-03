import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import LottieView from 'lottie-react-native';
import { requestNotificationPermissions } from '@/lib/notifications';

// Helper function para convertir base64 a ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function Step6Location() {
  const router = useRouter();
  const { data, updateData, resetData } = useOnboarding();
  const [ownerName, setOwnerName] = useState(data.ownerName);
  const [cityName, setCityName] = useState(data.location.cityName);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const getLocation = async () => {
    setLocationLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación');
      setLocationLoading(false);
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocoding para obtener ciudad
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const city = address.city || address.region || 'Ciudad';
        setCityName(city);
        updateData({
          location: { latitude, longitude, cityName: city },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'No pudimos obtener tu ubicación');
    }

    setLocationLoading(false);
  };

  const handleFinish = async () => {
    if (!ownerName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }
    if (!cityName.trim()) {
      Alert.alert('Ubicación requerida', 'Por favor ingresa tu ciudad o usa tu ubicación actual');
      return;
    }

    setLoading(true);

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('No user found');

      const userId = user.data.user.id;
      const userEmail = user.data.user.email || '';

      // 1. Crear o actualizar perfil del usuario
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail,
          name: ownerName.trim(),
          location_text: cityName.trim(),
          ...(data.location.latitude && data.location.longitude && {
            location: `POINT(${data.location.longitude} ${data.location.latitude})`,
          }),
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      // 2. Subir foto a Storage
      let photoUrl = null;
      if (data.profilePhotoUri) {
        const fileExt = data.profilePhotoUri.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(data.profilePhotoUri, {
          encoding: 'base64',
        });

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pet-photos')
          .upload(fileName, base64ToArrayBuffer(base64), {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('pet-photos')
          .getPublicUrl(uploadData.path);

        photoUrl = urlData.publicUrl;
      }

      // 3. Crear mascota
      // Calcular edad total en años
      // Si tiene menos de 1 año (0 años y algunos meses), guardarlo como 1 año
      let totalAge = data.ageYears;
      if (data.ageMonths >= 12) {
        totalAge += Math.floor(data.ageMonths / 12);
      }
      // Si el perro tiene 0 años pero tiene meses, asignar 1 año
      if (totalAge === 0 && data.ageMonths > 0) {
        totalAge = 1;
      }

      // Log para debug
      console.log('Creating pet with data:', {
        name: data.petName,
        breed: data.breed,
        gender: data.gender,
        age: totalAge,
        ageYears: data.ageYears,
        ageMonths: data.ageMonths,
      });

      const { data: petData, error: petError } = await supabase
        .from('pets')
        .insert({
          user_id: userId,
          name: data.petName,
          breed: data.breed,
          gender: data.gender,
          age: totalAge, // Edad en años (INTEGER)
          species: 'dog', // Por ahora solo perros
          bio: `${data.personalityTags.join(', ')}`,
          user_intent: data.userIntent,
          personality_tags: data.personalityTags,
          is_active: true,
        })
        .select()
        .single();

      if (petError) {
        console.error('Error creating pet:', petError);
        throw petError;
      }

      console.log('Pet created successfully:', petData);

      // 4. Crear foto de perfil si existe
      if (photoUrl && petData) {
        const { error: photoError } = await supabase.from('pet_photos').insert({
          pet_id: petData.id,
          photo_url: photoUrl,
          photo_order: 1,
          is_primary: true,
        });

        if (photoError) throw photoError;
      }

      // Limpiar datos del onboarding
      resetData();

      // Solicitar permisos de notificaciones
      Alert.alert(
        '¡Felicidades! 🎉',
        `${data.petName} está listo para encontrar su match perfecto`,
        [
          {
            text: 'Continuar',
            onPress: async () => {
              // Solicitar permisos de notificaciones
              Alert.alert(
                '🔔 Activa las notificaciones',
                'Recibe alertas cuando tengas un nuevo match o mensaje. ¡No te pierdas ninguna oportunidad!',
                [
                  {
                    text: 'Ahora no',
                    style: 'cancel',
                    onPress: () => router.replace('/(tabs)'),
                  },
                  {
                    text: 'Activar',
                    onPress: async () => {
                      await requestNotificationPermissions();
                      router.replace('/(tabs)');
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving data:', error);
      Alert.alert('Error', error.message || 'No pudimos guardar los datos. Inténtalo de nuevo.');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Atrás</Text>
            </TouchableOpacity>
            <Text style={styles.stepIndicator}>Paso 6 de 6</Text>

            {/* Animación del globo */}
            <View style={styles.animationContainer}>
              <LottieView
                source={require('@/assets/animations/Globe.json')}
                autoPlay
                loop
                style={styles.animation}
              />
            </View>

            <Text style={styles.title}>¡Último paso! ¿Dónde podemos encontraros?</Text>
            <Text style={styles.subtitle}>
              Necesitamos tu ubicación para mostrarte los perfiles más cercanos. Tu dirección exacta nunca será compartida.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.content}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Tu nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="ej: Juan"
                value={ownerName}
                onChangeText={setOwnerName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                placeholder="ej: Madrid"
                value={cityName}
                onChangeText={setCityName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={getLocation}
              disabled={loading || locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator color="#FF6B6B" />
              ) : (
                <>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationButtonText}>Usar mi ubicación actual</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🔒</Text>
              <Text style={styles.infoText}>
                Tu privacidad es importante. Solo mostraremos la distancia aproximada a otros usuarios.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleFinish}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  Descubrir Matches para {data.petName} 🎉
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  animationContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  animation: {
    width: 150,
    height: 150,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  content: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginBottom: 20,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 30,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
