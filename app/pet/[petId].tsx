import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingDog from '@/components/LoadingDog';
import PaywallModal from '@/components/PaywallModal';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

interface PetDetail {
  id: string;
  name: string;
  age: number;
  breed: string;
  bio: string;
  species: string;
  gender: string;
  photo_url?: string;
  personality_tags?: string[];
  user_intent?: string;
  has_pedigree?: boolean;
  is_neutered?: boolean;
  owner_name?: string;
  owner_email?: string;
  location_text?: string;
  user_id: string;
}

export default function PetDetailScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const router = useRouter();
  const { isSubscribed, checkSubscription } = useRevenueCat();
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserPetId, setCurrentUserPetId] = useState<string | null>(null);
  const [existingMatchId, setExistingMatchId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    loadPetDetail();
  }, [petId]);

  const loadPetDetail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener mascota del usuario actual
      const { data: userPet } = await supabase
        .from('pets')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      setCurrentUserPetId(userPet?.id || null);

      // Obtener detalles de la mascota
      const { data: petData, error } = await supabase
        .from('pets')
        .select(`
          *,
          profiles!inner(name, email, location_text)
        `)
        .eq('id', petId)
        .single();

      if (error) throw error;

      // Obtener foto
      const { data: photo } = await supabase
        .from('pet_photos')
        .select('photo_url')
        .eq('pet_id', petId)
        .eq('is_primary', true)
        .single();

      setPet({
        id: petData.id,
        name: petData.name,
        age: petData.age,
        breed: petData.breed,
        bio: petData.bio || '',
        species: petData.species,
        gender: petData.gender,
        photo_url: photo?.photo_url,
        personality_tags: petData.personality_tags || [],
        user_intent: petData.user_intent,
        has_pedigree: petData.has_pedigree,
        is_neutered: petData.is_neutered,
        owner_name: petData.profiles?.name,
        owner_email: petData.profiles?.email,
        location_text: petData.profiles?.location_text,
        user_id: petData.user_id,
      });

      // Verificar si ya existe un match entre estas mascotas
      if (userPet) {
        const { data: match } = await supabase
          .from('matches')
          .select('id')
          .or(`and(pet_1_id.eq.${userPet.id},pet_2_id.eq.${petId}),and(pet_1_id.eq.${petId},pet_2_id.eq.${userPet.id})`)
          .single();

        setExistingMatchId(match?.id || null);
      }
    } catch (error) {
      console.error('Error loading pet detail:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la mascota');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentUserPetId || !pet) return;

    try {
      // Si ya existe un match, ir directamente al chat
      if (existingMatchId) {
        router.push(`/chat/${existingMatchId}`);
        return;
      }

      // Verificar si el usuario tiene suscripción activa
      if (!isSubscribed) {
        // Mostrar el paywall
        setShowPaywall(true);
        return;
      }

      // Proceder con el contacto
      // Si no existe match, verificar si hay likes mutuos
      const { data: myLike } = await supabase
        .from('likes')
        .select('*')
        .eq('liker_pet_id', currentUserPetId)
        .eq('liked_pet_id', pet.id)
        .eq('is_like', true)
        .single();

      const { data: theirLike } = await supabase
        .from('likes')
        .select('*')
        .eq('liker_pet_id', pet.id)
        .eq('liked_pet_id', currentUserPetId)
        .eq('is_like', true)
        .single();

      // Si hay likes mutuos pero no match, crear el match
      if (myLike && theirLike) {
        const { data: newMatch } = await supabase
          .from('matches')
          .insert({
            pet_1_id: currentUserPetId,
            pet_2_id: pet.id,
          })
          .select()
          .single();

        if (newMatch) {
          router.push(`/chat/${newMatch.id}`);
        }
      } else {
        // Si no hay match, mostrar información de contacto del dueño
        Alert.alert(
          'Contactar dueño',
          `Puedes contactar al dueño de ${pet.name} por email:\n\n${pet.owner_email}`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Enviar email',
              onPress: () => {
                Linking.openURL(`mailto:${pet.owner_email}?subject=Interesado en ${pet.name}`);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error handling message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const handlePurchaseSuccess = async () => {
    await checkSubscription();
    // Si se activó el paywall desde el botón de desbloquear email, simplemente cerrar el modal
    // El email se mostrará automáticamente al actualizar isSubscribed
    setShowPaywall(false);
  };

  const getIntentLabel = (intent?: string) => {
    switch (intent) {
      case 'breeding':
        return '💕 Busca cruza / monta';
      case 'playdates':
        return '🎾 Busca amigos y juegos';
      case 'open':
        return '✨ Abierto a todo';
      default:
        return '';
    }
  };

  if (loading) {
    return <LoadingDog message="Cargando perfil..." />;
  }

  if (!pet) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No se encontró la mascota</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con botón atrás */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Foto principal */}
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.mainPhoto} />
        ) : (
          <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
            <Text style={styles.placeholderText}>🐾</Text>
          </View>
        )}

        {/* Información básica */}
        <View style={styles.section}>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{pet.name}</Text>
            <Text style={styles.gender}>{pet.gender === 'male' ? '♂' : '♀'}</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Raza</Text>
              <Text style={styles.infoValue}>{pet.breed}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Edad</Text>
              <Text style={styles.infoValue}>{pet.age} años</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ubicación</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                📍 {pet.location_text}
              </Text>
            </View>
          </View>
        </View>

        {/* Intención */}
        {pet.user_intent && (
          <View style={styles.section}>
            <View style={styles.intentBanner}>
              <Text style={styles.intentText}>{getIntentLabel(pet.user_intent)}</Text>
            </View>
          </View>
        )}

        {/* Personalidad */}
        {pet.personality_tags && pet.personality_tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personalidad</Text>
            <View style={styles.tagsContainer}>
              {pet.personality_tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Descripción */}
        {pet.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acerca de {pet.name}</Text>
            <Text style={styles.bioText}>{pet.bio}</Text>
          </View>
        )}

        {/* Características adicionales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Características</Text>
          <View style={styles.characteristicsContainer}>
            <View style={styles.characteristic}>
              <Text style={styles.characteristicIcon}>
                {pet.has_pedigree ? '✅' : '❌'}
              </Text>
              <Text style={styles.characteristicText}>Tiene pedigrí</Text>
            </View>
            <View style={styles.characteristic}>
              <Text style={styles.characteristicIcon}>
                {pet.is_neutered ? '✅' : '❌'}
              </Text>
              <Text style={styles.characteristicText}>Está castrado/esterilizado</Text>
            </View>
          </View>
        </View>

        {/* Información del dueño */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dueño</Text>
          <View style={styles.ownerCard}>
            <Text style={styles.ownerName}>{pet.owner_name}</Text>

            {isSubscribed ? (
              <Text style={styles.ownerEmail}>{pet.owner_email}</Text>
            ) : (
              <View>
                <View style={styles.blurredEmailContainer}>
                  <Text style={styles.blurredEmail}>••••••@••••••.com</Text>
                </View>
                <TouchableOpacity
                  style={styles.unlockButton}
                  onPress={() => setShowPaywall(true)}
                >
                  <Text style={styles.unlockButtonText}>🔓 Desbloquear contacto Premium</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botón flotante de enviar mensaje */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.messageButton} onPress={handleSendMessage}>
          <Text style={styles.messageButtonText}>
            {existingMatchId ? '💬 Ir al chat' : '✉️ Contactar dueño'}
          </Text>
        </TouchableOpacity>
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#FF6B6B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  mainPhoto: {
    width: '100%',
    height: 400,
    backgroundColor: '#F0F0F0',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 80,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  gender: {
    fontSize: 28,
    color: '#FF6B6B',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  intentBanner: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  intentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  bioText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  characteristicsContainer: {
    gap: 12,
  },
  characteristic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  characteristicIcon: {
    fontSize: 20,
  },
  characteristicText: {
    fontSize: 16,
    color: '#666',
  },
  ownerCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  ownerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#666',
  },
  blurredEmailContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  blurredEmail: {
    fontSize: 14,
    color: '#999',
    letterSpacing: 2,
  },
  unlockButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  messageButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
});
