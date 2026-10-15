import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Monument, useMonuments } from '../../constants/monumentData';

export default function PersonalizeMonumentsScreen() {
  const router = useRouter();
  const { customMonuments, loading, addCustomMonument, updateCustomMonument, deleteCustomMonument } = useMonuments();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [significance, setSignificance] = useState('');
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

  const editMonument = (monument: Monument) => {
    setEditingId(monument.id);
    setName(monument.name);
    setLocation(monument.location);
    setSignificance(monument.significance);
    setImageUri(typeof monument.image === 'string' || typeof monument.image === 'number' ? monument.image : null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setLocation('');
    setSignificance('');
    setImageUri(null);
  };

  const saveMonument = async () => {
    if (!name || !location || !significance || imageUri === null) {
      alert('Please fill out all fields and select an image.');
      return;
    }

    try {
      let finalPath: string | number = imageUri;
      if (typeof imageUri === 'string' && !imageUri.startsWith(FileSystem.documentDirectory!)) {
        const fileName = imageUri.split('/').pop();
        finalPath = FileSystem.documentDirectory + (fileName || `custom_mon_${Date.now()}.jpg`);
        await FileSystem.copyAsync({
          from: imageUri,
          to: finalPath
        });
      }

      const newMon: Monument = {
        id: editingId || Date.now().toString(),
        name,
        location,
        significance,
        image: finalPath,
      };

      if (editingId) {
        await updateCustomMonument(newMon);
        alert('Monument updated successfully!');
      } else {
        await addCustomMonument(newMon);
        alert('Monument saved successfully!');
      }
      
      cancelEdit();
    } catch (e) {
      alert('Error saving monument.');
      console.error(e);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Personalize Monuments</Text>
      <Text style={styles.subtitle}>Add places you have visited.</Text>

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

        <TextInput style={styles.input} placeholder="Name (e.g. Eiffel Tower)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Location (e.g. Paris, France)" value={location} onChangeText={setLocation} />
        <TextInput style={styles.input} placeholder="Fact/Significance (e.g. Built in 1889)" value={significance} onChangeText={setSignificance} />

        <TouchableOpacity style={styles.saveBtn} onPress={saveMonument}>
          <Text style={styles.saveBtnText}>{editingId ? 'Update Monument' : 'Save Monument'}</Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
            <Text style={styles.cancelBtnText}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your Custom Monuments</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : customMonuments.length === 0 ? (
        <Text style={styles.emptyText}>No custom monuments added yet.</Text>
      ) : (
        customMonuments.map(mon => (
          <View key={mon.id} style={styles.charRow}>
            {typeof mon.image === 'string' ? (
               mon.image.startsWith('file://') ? (
                 <Image source={{ uri: mon.image }} style={styles.charImage} />
               ) : (
                 <Text style={styles.emojiImage}>{mon.image}</Text>
               )
            ) : (
               <Image source={mon.image} style={styles.charImage} />
            )}
            <View style={styles.charDetails}>
              <Text style={styles.charName}>{mon.name}</Text>
              <Text style={styles.charSub}>{mon.location}</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => editMonument(mon)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCustomMonument(mon.id)} style={styles.deleteBtn}>
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
  emojiImage: {
    fontSize: 30,
    width: 50,
    marginRight: 15,
    textAlign: 'center',
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
