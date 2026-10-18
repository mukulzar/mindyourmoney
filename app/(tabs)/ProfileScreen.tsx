import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Profile } from '../../types';

interface Props {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}

export default function ProfileScreen({ profile, onSave, onClose }: Props) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const saveProfile = () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail) return;
    onSave({ name: cleanName, email: cleanEmail });
    onClose();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <Pressable onPress={onClose}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.heading}>Your profile</Text>
        <Text style={styles.subtitle}>Keep your account details up to date.</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Pressable style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F3' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#102B26',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backText: { color: '#B8E5D7', fontSize: 13, fontWeight: '700' },
  headerTitle: { color: '#F7FBF8', fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 34 },
  content: { padding: 24, alignItems: 'stretch' },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#183D35',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  heading: { color: '#18322D', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  label: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE5E0',
    borderRadius: 8,
    color: '#18322D',
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  saveButton: { backgroundColor: '#0F766E', borderRadius: 8, alignItems: 'center', paddingVertical: 13, marginTop: 28 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
