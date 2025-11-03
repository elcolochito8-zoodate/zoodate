import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoadingDog from '@/components/LoadingDog';
import ErrorDog from '@/components/ErrorDog';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

interface Pet {
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
  location_text?: string;
  distance?: number;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { isSubscribed } = useRevenueCat();
  const [pets, setPets] = useState<Pet[]>([]);
  const [filteredPets, setFilteredPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBreed, setSelectedBreed] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // Lista de razas disponibles
  const breeds = [
    'Todas las razas',
    'Labrador',
    'Golden Retriever',
    'Pastor Alemán',
    'Bulldog Francés',
    'Beagle',
    'Poodle',
    'Chihuahua',
    'Yorkshire Terrier',
    'Husky Siberiano',
    'Border Collie',
    'Mestizo',
    'Otro',
  ];

  useEffect(() => {
    loadPets();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [selectedBreed, selectedLocation, searchText, pets]);

  const loadPets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener todas las mascotas activas (excepto la del usuario)
      const { data: petsData, error } = await supabase
        .from('pets')
        .select(`
          id,
          name,
          age,
          breed,
          bio,
          species,
          gender,
          user_intent,
          personality_tags,
          profiles!inner(location_text)
        `)
        .eq('is_active', true)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Obtener fotos de las mascotas
      const petsWithPhotos = await Promise.all(
        (petsData || []).map(async (pet: any) => {
          const { data: photo } = await supabase
            .from('pet_photos')
            .select('photo_url')
            .eq('pet_id', pet.id)
            .eq('is_primary', true)
            .single();

          return {
            id: pet.id,
            name: pet.name,
            age: pet.age,
            breed: pet.breed,
            bio: pet.bio || '',
            species: pet.species,
            gender: pet.gender,
            photo_url: photo?.photo_url,
            personality_tags: pet.personality_tags || [],
            user_intent: pet.user_intent,
            location_text: pet.profiles?.location_text || 'Desconocido',
            distance: Math.random() * 10, // TODO: Calcular distancia real
          };
        })
      );

      setPets(petsWithPhotos);
      setFilteredPets(petsWithPhotos);
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...pets];

    // Filtrar por raza
    if (selectedBreed && selectedBreed !== 'Todas las razas') {
      filtered = filtered.filter((pet) => pet.breed === selectedBreed);
    }

    // Filtrar por ubicación
    if (selectedLocation) {
      filtered = filtered.filter((pet) =>
        pet.location_text?.toLowerCase().includes(selectedLocation.toLowerCase())
      );
    }

    // Filtrar por búsqueda de texto
    if (searchText) {
      filtered = filtered.filter(
        (pet) =>
          pet.name.toLowerCase().includes(searchText.toLowerCase()) ||
          pet.breed.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredPets(filtered);
  };

  const clearFilters = () => {
    setSelectedBreed('');
    setSelectedLocation('');
    setSearchText('');
  };

  const renderPetCard = ({ item }: { item: Pet }) => (
    <TouchableOpacity
      style={styles.petCard}
      onPress={() => {
        router.push(`/pet/${item.id}`);
      }}
    >
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.petImage} />
      ) : (
        <View style={[styles.petImage, styles.petImagePlaceholder]}>
          <Text style={styles.placeholderText}>🐾</Text>
        </View>
      )}

      <View style={styles.petInfo}>
        <View style={styles.petHeader}>
          <Text style={styles.petName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.petGender}>{item.gender === 'male' ? '♂' : '♀'}</Text>
        </View>

        <Text style={styles.petBreed} numberOfLines={1}>
          {item.breed}
        </Text>

        <View style={styles.petFooter}>
          <Text style={styles.petAge}>{item.age} años</Text>
          <Text style={styles.petLocation} numberOfLines={1}>
            📍 {item.location_text}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingDog message="Cargando mascotas..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header con búsqueda y filtros */}
      <View style={styles.header}>
        <Text style={styles.logo}>🐾 ZooDate</Text>
        {isSubscribed && (
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o raza..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Text style={styles.filterButtonText}>
              🔍 Filtros
              {(selectedBreed || selectedLocation) && ' •'}
            </Text>
          </TouchableOpacity>

          {(selectedBreed || selectedLocation) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.resultsCount}>
          {filteredPets.length} {filteredPets.length === 1 ? 'mascota' : 'mascotas'}
        </Text>
      </View>

      {/* Grid de mascotas */}
      {filteredPets.length === 0 ? (
        <ErrorDog
          title="No hay mascotas"
          message={
            selectedBreed || selectedLocation
              ? 'No encontramos mascotas con estos filtros. Intenta cambiarlos.'
              : 'No hay mascotas disponibles por ahora.'
          }
          onRetry={loadPets}
          retryText="Actualizar"
        />
      ) : (
        <FlatList
          data={filteredPets}
          renderItem={renderPetCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de filtros */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Filtro por raza */}
              <Text style={styles.filterTitle}>Raza</Text>
              <View style={styles.filterOptions}>
                {breeds.map((breed) => (
                  <TouchableOpacity
                    key={breed}
                    style={[
                      styles.filterOption,
                      selectedBreed === breed && styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedBreed(breed === 'Todas las razas' ? '' : breed);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedBreed === breed && styles.filterOptionTextActive,
                      ]}
                    >
                      {breed}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Filtro por ubicación */}
              <Text style={styles.filterTitle}>Ubicación</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Ej: Madrid, Barcelona..."
                value={selectedLocation}
                onChangeText={setSelectedLocation}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Aplicar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    position: 'relative',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
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
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  grid: {
    padding: 10,
  },
  petCard: {
    flex: 1,
    margin: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  petImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#F0F0F0',
  },
  petImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
  petInfo: {
    padding: 10,
  },
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  petName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  petGender: {
    fontSize: 18,
    color: '#FF6B6B',
    marginLeft: 4,
  },
  petBreed: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  petFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petAge: {
    fontSize: 12,
    color: '#999',
  },
  petLocation: {
    fontSize: 12,
    color: '#999',
    flex: 1,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 24,
    color: '#999',
  },
  modalScroll: {
    padding: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterOptionActive: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FF6B6B',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextActive: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  filterInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  applyButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
