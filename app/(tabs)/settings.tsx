import AppWrapper from '@/components/AppWrapper';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function Settings() {
  return (
    <AppWrapper>
      <Text variant="headlineLarge">Settings</Text>
      <View style={{ marginTop: 16 }}>
        <Text>Settings screen content goes here</Text>
      </View>
    </AppWrapper>
  );
}
