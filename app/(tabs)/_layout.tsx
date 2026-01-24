import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { withLayoutContext } from "expo-router";
import { createMaterialBottomTabNavigator } from "react-native-paper/react-navigation";

const { Navigator } = createMaterialBottomTabNavigator();
export const MaterialBottomTabs = withLayoutContext(Navigator);

export default function TabLayout() {
    const holidayFunctionEnabled = useAppSetting<boolean>('holidayFunctionEnabled').data;

    return (
        <MaterialBottomTabs>
            <MaterialBottomTabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: "home",
                }}
            />
            <MaterialBottomTabs.Protected guard={holidayFunctionEnabled === true}>
                <MaterialBottomTabs.Screen
                name="holidayScreen"
                options={{ title: "Plan Holiday", tabBarIcon: "beach" }}
                />
            </MaterialBottomTabs.Protected>
            <MaterialBottomTabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                    tabBarIcon: "cog",
                }}
            />
        </MaterialBottomTabs>
    );
}
