import { TextInput, useTheme } from "react-native-paper";

// Custom NumberInput function based on the TextInput
export default function NumberInput({
    value,
    onChangeText,
    maxValue,
    minValue,
    label,
}: {
    value: number|null;
    onChangeText: (number: number|null) => void;
    maxValue?: number;
    minValue?: number;
    label?: string
}) {
    const theme = useTheme();

    const handleTextChange = (text: string) => {
        // Clean up text using regex (only numbers allowed)
        const cleanedText = text.replace(/\s/g, "").replace(/[^0-9]/g, "");

        // No numbers in TextInput: Return empty string
        if (cleanedText === "") {
            onChangeText(null);
            return;
        }

        // Convert to integer base 10
        const numValue = parseInt(cleanedText, 10);

        // Return if (somehow) Not-a-Number
        if (isNaN(numValue)) {
            return;
        }

        // Ceil to max value
        if (maxValue !== undefined && numValue > maxValue) {
            onChangeText(maxValue);
            return;
        }

        // Floor to min value
        if (minValue !== undefined && numValue < minValue) {
            onChangeText(minValue);
            return;
        }

        // If everything is fine, return the cleaned text
        onChangeText(numValue);
    }

    return (
        <TextInput
            value={value !== null ? value.toString() : ""}
            onChangeText={handleTextChange}
            keyboardType="numeric"
            style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                fontSize: 14,
                minHeight: 30,
                minWidth: 70,
                textAlign: "center",
                borderWidth: 2,
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.primary,
            }}

            label={label}
        />
    );
}