import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Character, useCharacters } from '../../constants/data';

export default function PersonalizeScreen() {
  const router = useRouter();
  const { customCharacters, loading, addCustomCharacter, updateCustomCharacter, deleteCustomCharacter } = useCharacters();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('');
  const [hobby, setHobby] = useState('');
  const [like, setLike] = useState('');
  const [dislike, setDislike] = useState('');
  const [imageUri, setImageUri] = useState<string | number | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const editCharacter = (char: Character) => {
    setEditingId(char.id);
    setName(char.name);
    setProfession(char.profession);
    setFavoriteColor(char.favoriteColor);
    setHobby(char.traits.find(t => t.type === 'hobby')?.value || '');
    setLike(char.traits.find(t => t.type === 'like')?.value || '');
    setDislike(char.traits.find(t => t.type === 'dislike')?.value || '');
    setImageUri(typeof char.image === 'string' || typeof char.image === 'number' ? char.image : null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setProfession('');
    setFavoriteColor('');
    setHobby('');
    setLike('');
    setDislike('');
    setImageUri(null);
  };

  const saveCharacter = async () => {
    if (!name || !profession || !favoriteColor || !hobby || !like || !dislike || imageUri === null) {
      alert('Please fill out all fields and select an image.');
      return;
    }

    try {
      let finalPath: string | number = imageUri;
      if (typeof imageUri === 'string' && !imageUri.startsWith(FileSystem.documentDirectory!)) {
        const fileName = imageUri.split('/').pop();
        finalPath = FileSystem.documentDirectory + (fileName || `custom_${Date.now()}.jpg`);
        await FileSystem.copyAsync({
          from: imageUri,
          to: finalPath
        });
      }

      const newChar: Character = {
        id: editingId || Date.now().toString(),
        name,
        profession,
        favoriteColor,
        image: finalPath, // Store the permanent file path or a bundled asset reference
        traits: [
          { type: 'hobby', value: hobby },
          { type: 'like', value: like },
          { type: 'dislike', value: dislike }
        ]
      };

      if (editingId) {
        await updateCustomCharacter(newChar);
        alert('Character updated successfully!');
      } else {
        await addCustomCharacter(newChar);
        alert('Character saved successfully!');
      }
      
      cancelEdit();
    } catch (e) {
      alert('Error saving character.');
      console.error(e);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Personalize Characters</Text>
      <Text style={styles.subtitle}>Add friends, family, or caregivers to the game.</Text>

      <View style={styles.formCard}>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri !== null ? (
            typeof imageUri === 'string' ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <Image source={imageUri} style={styles.previewImage} />
            )
          ) : (
            <Text style={styles.imagePickerText}>Tap to Add Photo</Text>
          )}
        </TouchableOpacity>

        <TextInput style={styles.input} placeholder="Name (e.g. John)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Profession (e.g. Doctor)" value={profession} onChangeText={setProfession} />
        <TextInput style={styles.input} placeholder="Favorite Color (e.g. Blue)" value={favoriteColor} onChangeText={setFavoriteColor} />
        <TextInput style={styles.input} placeholder="A Hobby (e.g. fishing)" value={hobby} onChangeText={setHobby} />
        <TextInput style={styles.input} placeholder="A Like (e.g. pizza)" value={like} onChangeText={setLike} />
        <TextInput style={styles.input} placeholder="A Dislike (e.g. spiders)" value={dislike} onChangeText={setDislike} />

        <TouchableOpacity style={styles.saveBtn} onPress={saveCharacter}>
          <Text style={styles.saveBtnText}>{editingId ? 'Update Character' : 'Save Character'}</Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
            <Text style={styles.cancelBtnText}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your Custom Characters</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : customCharacters.length === 0 ? (
        <Text style={styles.emptyText}>No custom characters added yet.</Text>
      ) : (
        customCharacters.map(char => (
          <View key={char.id} style={styles.charRow}>
            {typeof char.image === 'string' ? (
              <Image source={{ uri: char.image }} style={styles.charImage} />
            ) : (
              <Image source={char.image} style={styles.charImage} />
            )}
            <View style={styles.charDetails}>
              <Text style={styles.charName}>{char.name}</Text>
              <Text style={styles.charSub}>{char.profession}</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => editCharacter(char)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCustomCharacter(char.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  imagePicker: {
    width: 120,
    height: 120,
    backgroundColor: '#E5E5EA',
    borderRadius: 60,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  previewImage: {
    width: 120,
    height: 120,
  },
  imagePickerText: {
    color: '#007AFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F2F2F7',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  cancelBtn: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  charImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  charDetails: {
    flex: 1,
  },
  charName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  charSub: {
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  editBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  deleteBtn: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
