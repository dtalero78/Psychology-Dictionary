import { Tabs } from 'expo-router';
import { Microscope, Settings as SettingsIcon } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a2b48',
        tabBarInactiveTintColor: '#75777e',
        tabBarLabelStyle: { fontWeight: '500', fontSize: 11 },
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#c5c6ce', backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => <Microscope size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
