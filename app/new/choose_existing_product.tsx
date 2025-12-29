import { useScanFlow } from "@/state/scanFlow";
import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChooseExistingProduct() {
  const router = useRouter();
  const { convenience } = useScanFlow();

  return (
    <SafeAreaView>
      <Text>Choose Existing Product Screen</Text>
      <View>
        <Text>Detected GTIN: {convenience?.gtin ?? '—'}</Text>
      </View>
      <Button title="Create New Product" onPress={() => {router.push('/new/new_product')}} />
    </SafeAreaView>
  )
}