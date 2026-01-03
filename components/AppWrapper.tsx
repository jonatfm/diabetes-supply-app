import { Surface, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <Surface style={[{ flex: 1, padding: 16 }, {backgroundColor: theme.colors.background}]}>
      <SafeAreaView style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </Surface>
  )
}