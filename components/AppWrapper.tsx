import { Surface, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppWrapper({ children, bottomEdge=true }: { children: React.ReactNode, bottomEdge?: boolean }) {
  const theme = useTheme();

  return (
    <Surface style={[{ flex: 1 }, {backgroundColor: theme.colors.background}]}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} edges={['top', 'left', 'right', bottomEdge ? "bottom" : "top"]}>
        {children}
      </SafeAreaView>
    </Surface>
  )
}