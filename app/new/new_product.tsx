import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddNewProduct() {
  const router = useRouter();

  const handleSaveProduct = () => {
    // logic to save product to db later
    router.push("/new/add_pack");
  };

  return (
    <SafeAreaView>
      <Text>Add New Product Screen</Text>
      <View>
        <Text>Name: </Text>
        <Text>Brand: </Text>
        <Text>Category: </Text>
        <Text>Units per pack: </Text>
        <Text>Picture: </Text>
        <Button title="Take Picture" />
        <Button title="Save Product" onPress={handleSaveProduct} />
      </View>
    </SafeAreaView>
  )
}