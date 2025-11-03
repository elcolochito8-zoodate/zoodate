import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingDog from '@/components/LoadingDog';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { isSubscribed } = useRevenueCat();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [pet, setPet] = useState<any>(null);
  const [petPhoto, setPetPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener perfil del usuario
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Obtener mascota del usuario
      const { data: petData } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      setPet(petData);

      // Obtener foto de la mascota
      if (petData) {
        const { data: photoData } = await supabase
          .from('pet_photos')
          .select('photo_url')
          .eq('pet_id', petData.id)
          .eq('is_primary', true)
          .single();

        setPetPhoto(photoData?.photo_url || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  if (loading) {
    return <LoadingDog message="Cargando perfil..." />;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>👤 Mi Perfil</Text>
        {isSubscribed && (
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        )}
      </View>

      {/* Pet Card */}
      <View style={styles.content}>
        <View style={styles.petCard}>
          {petPhoto ? (
            <Image source={{ uri: petPhoto }} style={styles.petPhoto} />
          ) : (
            <View style={[styles.petPhoto, styles.petPhotoPlaceholder]}>
              <Text style={styles.placeholderText}>🐾</Text>
            </View>
          )}

          <Text style={styles.petName}>{pet?.name || 'Sin nombre'}</Text>
          <Text style={styles.petBreed}>{pet?.breed || 'Sin raza'}</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Edad</Text>
              <Text style={styles.infoValue}>{pet?.age || 0} años</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Género</Text>
              <Text style={styles.infoValue}>
                {pet?.gender === 'male' ? '♂ Macho' : '♀ Hembra'}
              </Text>
            </View>
          </View>

          {pet?.personality_tags && pet.personality_tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {pet.personality_tags.map((tag: string, index: number) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {pet?.user_intent && (
            <View style={styles.intentContainer}>
              <Text style={styles.intentLabel}>Buscando:</Text>
              <Text style={styles.intentValue}>
                {pet.user_intent === 'breeding' && '💕 Cruza / Monta'}
                {pet.user_intent === 'playdates' && '🎾 Amigos y Juegos'}
                {pet.user_intent === 'open' && '✨ Abierto a todo'}
              </Text>
            </View>
          )}
        </View>

        {/* Owner Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del dueño</Text>
          <View style={styles.infoCard}>
            <Text style={styles.ownerName}>{profile?.name || 'Sin nombre'}</Text>
            <Text style={styles.ownerLocation}>
              📍 {profile?.location_text || 'Sin ubicación'}
            </Text>
            <Text style={styles.ownerEmail}>{profile?.email || 'Sin email'}</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  proBadge: {
    position: 'absolute',
    top: 65,
    right: 20,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  proText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  petCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  petPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 15,
  },
  petPhotoPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 60,
  },
  petName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  petBreed: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 15,
  },
  tag: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  intentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  intentLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  intentValue: {
    fontSize: 14,
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ownerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  ownerLocation: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#999',
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
