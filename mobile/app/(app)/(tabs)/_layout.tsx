import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a2b48',
        tabBarInactiveTintColor: '#75777e',
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#c5c6ce', backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Projects', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔬</Text> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }}
      />
    </Tabs>
  );
}
