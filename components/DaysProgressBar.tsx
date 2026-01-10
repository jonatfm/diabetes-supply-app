import { View } from "react-native";

export default function DaysProgressBar({totalDays, currentDay, colorBackground, colorForeground}: {totalDays: number; currentDay: number; colorBackground?: string; colorForeground?: string}) {
  return (
    <View style={{flexDirection: "row", width: "100%", gap: 3, borderRadius: 4, overflow: 'hidden'}}>
      {Array.from({length: totalDays}).map((_, idx) => (
        <View key={idx} style={{
          height: 10,
          flex: 1,
          backgroundColor: idx < currentDay ? (colorForeground || 'green') : (colorBackground || 'lightgray'),
        }}>
        </View>
      ))}
    </View>
  )
}