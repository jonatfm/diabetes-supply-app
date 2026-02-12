import AppWrapper from "@/components/AppWrapper";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";

export default function PackForHoliday() {
    const router = useRouter();
    return (
        <AppWrapper>
            <View style={{ marginBottom: 16 }}>
                <Button
                    mode="text" 
                    onPress={() => router.back()} 
                    icon="arrow-left"
                    style={{ alignSelf: 'flex-start' }}
                >
                    Back
                </Button>
            </View>
            <Text>Pack for holiday</Text>
        </AppWrapper>
    )
}