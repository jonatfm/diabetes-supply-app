import AppWrapper from "@/components/AppWrapper";
import { Product } from "@/db/schema";
import { useScanFlow } from "@/state/scanFlow";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { Button, Text } from "react-native-paper";

export default function ChooseExistingProduct() {
  const router = useRouter();
  const { convenience } = useScanFlow();
  const [prods, setProds] = useState<Product[]>([]);


  return (
    <AppWrapper>
      <Text variant="headlineLarge">Couldn't match this product</Text>
      <Text variant="bodyMedium">Please select the product from the list below or create a new one.</Text>
      <ScrollView style={{ flex: 1, marginVertical: 16 }}>
        
      </ScrollView>
      <Button icon="plus" mode="contained" onPress={() => {router.push('/new/new_product')}}>
        Create New Product
      </Button>
    </AppWrapper>
  )
}