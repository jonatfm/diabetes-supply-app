import AppWrapper from '@/components/AppWrapper';
import { useAppSetting } from '@/src/data/hooks/useAppSetting';
import { useColoredDots } from '@/src/data/hooks/useColoredDots';
import { useCreateColoredDot } from '@/src/data/hooks/useCreateColoredDot';
import { useExportDatabase } from '@/src/data/hooks/useExportDatabase';
import { useImportDatabase } from '@/src/data/hooks/useImportDatabase';
import { useUpsertAppSetting } from '@/src/data/hooks/useUpsertAppSetting';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Dialog, Divider, Icon, Portal, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import ColoredDot from '../../components/ColoredDot';

export default function Settings() {
  const theme = useTheme();
  const exportMutation = useExportDatabase();
  const importMutation = useImportDatabase();
  
  const [isImportDialogVisible, setIsImportDialogVisible] = useState(false);
  const [isImportConfirmDialogVisible, setIsImportConfirmDialogVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarError, setSnackbarError] = useState(false);

  // App settings
  const upsertAppSetting = useUpsertAppSetting();
  // Colored dots
  const coloredDotsEnabledSetting = useAppSetting<boolean>('coloredDotsEnabled').data;
  const coloredDots = useColoredDots({includeInactive: true}).data;
  const createColoredDotM = useCreateColoredDot();
  const [isCreateNewColorDialogVisible, setIsCreateNewColorDialogVisible] = useState(false);
  const [newDotColor, setNewDotColor] = useState('');

  const saveNewColoredDot = () => {
    if (!newDotColor) return;
    createColoredDotM.mutate(
      { color: newDotColor.toLowerCase() },
      {
        onSuccess: () => {
          setNewDotColor('');
          setIsCreateNewColorDialogVisible(false);
        }
      }
    );
  };

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage('Database exported successfully!');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleImportPress = () => {
    setIsImportDialogVisible(true);
  };

  const handleImportConfirm = () => {
    setIsImportDialogVisible(false);
    setIsImportConfirmDialogVisible(true);
  };

  const handleImportFinal = async () => {
    setIsImportConfirmDialogVisible(false);
    try {
      const result = await importMutation.mutateAsync();
      setSnackbarError(false);
      const stats = result.stats;
      const parts = [
        `${stats.products} products`,
        `${stats.packs} packs`,
      ];
      if (stats.coloredDots > 0) {
        parts.push(`${stats.coloredDots} colored dots`);
      }
      if (stats.appSettings > 0) {
        parts.push(`${stats.appSettings} settings`);
      }
      if (stats.imagesRestored > 0) {
        parts.push(`${stats.imagesRestored} images`);
      }
      setSnackbarMessage(`Import successful! Restored ${parts.join(', ')}.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <AppWrapper>
      <ScrollView>
        <Text variant="headlineLarge" style={{ marginBottom: 24 }}>Settings</Text>

        {/* Color dots management section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Colored Dots</Text>
        <Card style={{ marginBottom: 24 }}>
          <Card.Content style={{ gap: 12 }}>
            <Text variant="titleMedium">Use colored dots</Text>
            <Text>You can use colored dot stickers to physically mark your items and easily identify them at a glance.</Text>
            <SegmentedButtons
              value={coloredDotsEnabledSetting ? 'enabled' : 'disabled'}
              onValueChange={(value) => {
                upsertAppSetting.mutate({key: "coloredDotsEnabled", value: value === 'enabled'})
              }}
              buttons={[
                {
                  value: 'enabled',
                  label: 'Yes',
                  icon: 'check',
                },
                {
                  value: 'disabled',
                  label: 'No',
                  icon: 'close',
                }
              ]}
            />
            {coloredDotsEnabledSetting && coloredDots && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
                {coloredDots.map((dot) => (
                  <ColoredDot 
                    key={dot.id}
                    dotId={dot.id}
                    pressToToggle
                  />
                ))}
                <Pressable onPress={() => setIsCreateNewColorDialogVisible(true)} style={{width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 1000}}>
                  <Icon source="plus-circle-outline" size={32} color={"white"} />
                </Pressable>
                <Portal>
                  <Dialog visible={isCreateNewColorDialogVisible} onDismiss={() => setIsCreateNewColorDialogVisible(false)}>
                    <Dialog.Title>Add new color</Dialog.Title>
                    <Dialog.Content>
                      <Text>Add a new colored dot you have present physically to mark your items.</Text>
                      <TextInput
                        label="Color (name or hex code)"
                        value={newDotColor}
                        onChangeText={text => setNewDotColor(text)}
                      />
                    </Dialog.Content>
                    <Dialog.Actions>
                      <Button onPress={() => setIsCreateNewColorDialogVisible(false)}>Cancel</Button>
                      <Button disabled={!newDotColor} onPress={saveNewColoredDot}>Save</Button>
                    </Dialog.Actions>
                  </Dialog>
                </Portal>
              </View>
            )}
          </Card.Content>
        </Card>


        {/* Data Management Section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Data Management</Text>        
        <Card style={{ marginBottom: 24 }}>
          <Card.Content>
            {/* Export Section */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24, 
                  backgroundColor: theme.colors.primaryContainer,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16
                }}
              >
                <Icon source="database-export" size={24} color={theme.colors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Export Database</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  Create a backup of all your data including products, packs, and images.
                </Text>
              </View>
            </View>
            
            <Button 
              mode="contained" 
              icon="export" 
              onPress={handleExport}
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending}
              style={{ marginBottom: 16 }}
            >
              Export Backup
            </Button>

            <Divider style={{ marginVertical: 16 }} />

            {/* Import Section */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24, 
                  backgroundColor: theme.colors.errorContainer,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16
                }}
              >
                <Icon source="database-import" size={24} color={theme.colors.onErrorContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Import Database</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  Restore data from a backup file. This will replace all existing data.
                </Text>
              </View>
            </View>

            {/* Warning Card */}
            <Card 
              style={{ 
                backgroundColor: theme.colors.errorContainer, 
                marginBottom: 16 
              }}
            >
              <Card.Content style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Icon source="alert" size={20} color={theme.colors.error} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                    Warning: Destructive Action
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, marginTop: 4 }}>
                    Importing a backup will permanently delete all your current data including products, inventory, history, and sessions. This action cannot be undone.
                  </Text>
                </View>
              </Card.Content>
            </Card>

            <Button 
              mode="outlined" 
              icon="import"
              onPress={handleImportPress}
              loading={importMutation.isPending}
              disabled={importMutation.isPending}
              textColor={theme.colors.error}
              style={{ borderColor: theme.colors.error }}
            >
              Import Backup
            </Button>
          </Card.Content>
        </Card>

        {/* About Section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>About</Text>
        
        <Card style={{ marginBottom: 24 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24, 
                  backgroundColor: theme.colors.surfaceVariant,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16
                }}
              >
                <Icon source="information" size={24} color={theme.colors.onSurfaceVariant} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Diabetes Supply Tracker</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  Version 1.0.0
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        {/* First Import Warning Dialog */}
        <Dialog visible={isImportDialogVisible} onDismiss={() => setIsImportDialogVisible(false)}>
          <Dialog.Icon icon="alert-circle" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center' }}>Import Database?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: 16 }}>
              You are about to import a database backup. This will:
            </Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon source="close-circle" size={20} color={theme.colors.error} />
                <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error }}>
                  Delete ALL your current products
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon source="close-circle" size={20} color={theme.colors.error} />
                <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error }}>
                  Delete ALL your inventory and packs
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon source="close-circle" size={20} color={theme.colors.error} />
                <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error }}>
                  Delete ALL your history and sessions
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon source="close-circle" size={20} color={theme.colors.error} />
                <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error }}>
                  Delete ALL your saved images
                </Text>
              </View>
            </View>
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 16, fontWeight: 'bold' }}>
              This action cannot be undone!
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsImportDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={handleImportConfirm} 
              textColor={theme.colors.error}
            >
              I Understand, Continue
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Second Import Confirmation Dialog */}
        <Dialog visible={isImportConfirmDialogVisible} onDismiss={() => setIsImportConfirmDialogVisible(false)}>
          <Dialog.Icon icon="alert-octagon" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center', color: theme.colors.error }}>
            Final Confirmation
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              Are you absolutely sure you want to proceed?
            </Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', color: theme.colors.error }}>
              All your current data will be permanently lost.
            </Text>
            <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 16, color: theme.colors.secondary }}>
              After clicking "Import Now", you will be prompted to select your backup file.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsImportConfirmDialogVisible(false)}>Go Back</Button>
            <Button 
              onPress={handleImportFinal} 
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
            >
              Import Now
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={4000}
        style={{ 
          backgroundColor: snackbarError ? theme.colors.errorContainer : theme.colors.secondaryContainer 
        }}
      >
        <Text style={{ color: snackbarError ? theme.colors.onErrorContainer : theme.colors.onSecondaryContainer }}>
          {snackbarMessage}
        </Text>
      </Snackbar>
    </AppWrapper>
  );
}
