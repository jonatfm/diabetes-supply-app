import { withLayoutContext } from "expo-router";
import { createMaterialBottomTabNavigator } from "react-native-paper/react-navigation";

const { Navigator } = createMaterialBottomTabNavigator();

export const MaterialBottomTabs = withLayoutContext(Navigator);

export default function TabLayout() {
    return (
        <MaterialBottomTabs>
            <MaterialBottomTabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: "home",
                }}
            />
            <MaterialBottomTabs.Screen
                name="holidayScreen"
                options={{
                    title: "Plan Holiday",
                    tabBarIcon: "beach",
                }}
            />
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
