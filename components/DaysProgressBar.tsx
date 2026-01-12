import { View } from "react-native";

export default function DaysProgressBar({totalDays, currentDay, colorBackground, colorForeground}: {totalDays: number; currentDay: number; colorBackground?: string; colorForeground?: string}) {
  return (
    <View style={{flexDirection: "row", width: "100%", gap: 4, borderRadius: 6, overflow: 'hidden', padding: 2}}>
      {Array.from({length: totalDays}).map((_, idx) => (
        <View key={idx} style={{
          height: 12,
          flex: 1,
          backgroundColor: idx < currentDay ? (colorForeground || 'green') : (colorBackground || 'lightgray'),
          borderRadius: 3,
        }}>
        </View>
      ))}
    </View>
  )
}