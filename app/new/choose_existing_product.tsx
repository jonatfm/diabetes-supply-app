import { useRouter } from "expo-router";
import { Button, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChooseExistingProduct() {
  const router = useRouter();

  return (
    <SafeAreaView>
      <Text>Choose Existing Product Screen</Text>
      <Button title="Create New Product" onPress={() => {router.push('/new/new_product')}} />
    </SafeAreaView>
  )
}