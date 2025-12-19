import { Link } from 'expo-router';
import { Button, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView>
      <Text>DiaSupply</Text>
      <Link href="/scan" asChild>
        <Button title="Scan Item" onPress={() => {}} />
      </Link>
    </SafeAreaView>
  );
}
