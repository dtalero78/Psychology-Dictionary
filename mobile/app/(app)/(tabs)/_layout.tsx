import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0070c9',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#e0e0e0' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Projects', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔬</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }} />
    </Tabs>
  );
}
