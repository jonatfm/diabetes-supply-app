import { useGetColoredDot } from "@/src/data/hooks/useGetColoredDot";
import { useSetColoredDotActive } from "@/src/data/hooks/useSetColoredDotActive";
import { Pressable, View } from "react-native";

const isColorTooRed = (color?: string): boolean => {
  if (!color) return false;
  if (color.includes("red")) return true;
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r > 150 && r > g + 50 && r > b + 50;
  }
  return false;
};

export default function ColoredDot(
  { dotId, size = 36, borderWidth = 2, pressToToggle = false, crossInactive = true }: { dotId: string; size?: number; borderWidth?: number; pressToToggle?: boolean; crossInactive?: boolean }
) {
  const coloredDotQ = useGetColoredDot(dotId);
  const setColoredDotActiveM = useSetColoredDotActive();

  const diameter = size;
  const bw = borderWidth;
  const innerDiameter = Math.max(0, diameter - 2 * bw);
  const diagonal = Math.sqrt(2) * innerDiameter;
  const tooRed = isColorTooRed(coloredDotQ.data?.color);
  const borderColor = !coloredDotQ.data?.active ? (tooRed ? "black" : "red") : "white";

  return (
    <Pressable disabled={!pressToToggle} onPress={() => {
      if (coloredDotQ.data) {
        setColoredDotActiveM.mutate({ id: dotId, active: !coloredDotQ.data.active });
      }
    }}>
      <View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: coloredDotQ.data?.color,
          borderWidth: bw,
          borderColor,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!coloredDotQ.data?.active && crossInactive && (
          <View
            style={{
              position: "absolute",
              width: diagonal,
              height: bw,
              left: (diameter - diagonal) / 2,
              top: (diameter - bw) / 2,
              transform: [{ rotate: "45deg" }],
              backgroundColor: borderColor,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}