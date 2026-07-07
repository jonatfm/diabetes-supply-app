import AppWrapper from '@/components/AppWrapper';
import NumberInput from '@/components/NumberInput';
import { useDatabase } from '@/db';
import { useAppSetting } from '@/src/data/hooks/useAppSetting';
import { useColoredDots } from '@/src/data/hooks/useColoredDots';
import { useCreateColoredDot } from '@/src/data/hooks/useCreateColoredDot';
import { useExportDatabase } from '@/src/data/hooks/useExportDatabase';
import { GoogleDriveBackupFrequency, useGoogleDriveBackups, useRestoreLatestGoogleDriveBackup, useUploadGoogleDriveBackup } from '@/src/data/hooks/useGoogleDriveBackup';
import { ImportPreview, useConfirmImportDatabase, usePreviewImportDatabase } from '@/src/data/hooks/useImportDatabase';
import { BackupFrequency, getLocalBackupDirectoryUri, useCreateLocalBackup, useLocalBackups, useRestoreLatestLocalBackup, useShareLatestLocalBackup } from '@/src/data/hooks/useLocalBackup';
import { useRefreshNotifications } from '@/src/data/hooks/useRefreshNotifications';
import { useUpsertAppSetting } from '@/src/data/hooks/useUpsertAppSetting';
import { qk } from '@/src/data/queryKeys';
import { connectGoogleDriveOAuth, disconnectGoogleDriveOAuth, getGoogleDriveOAuthRedirectUri, refreshGoogleDriveAccessToken } from '@/src/services/googleDriveOAuthService';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Dialog, Divider, Icon, Portal, SegmentedButtons, Snackbar, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import ColoredDot from '../../components/ColoredDot';

export default function Settings() {
  const theme = useTheme();
  const { db, ready: dbReady } = useDatabase();
  const queryClient = useQueryClient();
  const exportMutation = useExportDatabase();
  const importPreviewMutation = usePreviewImportDatabase();
  const importConfirmMutation = useConfirmImportDatabase();
  
  const [isImportConfirmDialogVisible, setIsImportConfirmDialogVisible] = useState(false);
  const [isExportDialogVisible, setIsExportDialogVisible] = useState(false);
  const [isDriveRestoreDialogVisible, setIsDriveRestoreDialogVisible] = useState(false);
  const [isLocalRestoreDialogVisible, setIsLocalRestoreDialogVisible] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarError, setSnackbarError] = useState(false);
  const [googleDriveClientIdInput, setGoogleDriveClientIdInput] = useState('');
  const [googleDriveRedirectUriInput, setGoogleDriveRedirectUriInput] = useState(getGoogleDriveOAuthRedirectUri());
  const [googleDriveAccessTokenInput, setGoogleDriveAccessTokenInput] = useState('');
  const [googleDriveFolderIdInput, setGoogleDriveFolderIdInput] = useState('');
  const [googleDriveRetentionInput, setGoogleDriveRetentionInput] = useState<number | null>(5);
  const [localBackupRetentionInput, setLocalBackupRetentionInput] = useState<number | null>(5);

  // App settings
  const upsertAppSetting = useUpsertAppSetting();
  const refreshNotificationsM = useRefreshNotifications();
  // Notifications / "App Warnings"
  const appWarningsEnabledSetting = useAppSetting<boolean>("appWarningsEnabled").data;
  const expiryApproachingWarningEnabledSetting = useAppSetting<boolean>("expiryApproachingWarningEnabled").data;
  const expiryApproachingDaysSetting = useAppSetting<number|null>("expiryApproachingDays").data;
  const runningOutWarningEnabledSetting = useAppSetting<boolean>("runningOutWarningEnabled").data;
  const runningOutDaysSetting = useAppSetting<number|null>("runningOutDays").data;
  const localBackupFrequencySetting = useAppSetting<BackupFrequency>("localBackupFrequency").data ?? "manual";
  const localBackupRetentionCountSetting = useAppSetting<number>("localBackupRetentionCount").data ?? 5;
  const localBackupsQ = useLocalBackups();
  const createLocalBackupM = useCreateLocalBackup(localBackupRetentionCountSetting);
  const restoreLatestLocalBackupM = useRestoreLatestLocalBackup();
  const shareLatestLocalBackupM = useShareLatestLocalBackup();
  const googleDriveAdvancedEnabledSetting = useAppSetting<boolean>("googleDriveBackupAdvancedEnabled").data ?? false;
  const googleDriveAccessTokenSetting = useAppSetting<string>("googleDriveAccessToken").data;
  const googleDriveRefreshTokenSetting = useAppSetting<string>("googleDriveRefreshToken").data;
  const googleDriveAccessTokenExpiresAtSetting = useAppSetting<number | null>("googleDriveAccessTokenExpiresAt").data;
  const googleDriveOAuthClientIdSetting = useAppSetting<string>("googleDriveOAuthClientId").data;
  const googleDriveOAuthRedirectUriSetting = useAppSetting<string>("googleDriveOAuthRedirectUri").data;
  const googleDriveFolderIdSetting = useAppSetting<string>("googleDriveFolderId").data;
  const googleDriveBackupFrequencySetting = useAppSetting<GoogleDriveBackupFrequency>("googleDriveBackupFrequency").data ?? "manual";
  const googleDriveBackupRetentionCountSetting = useAppSetting<number>("googleDriveBackupRetentionCount").data ?? 5;
  const googleDriveBackupsQ = useGoogleDriveBackups(googleDriveAccessTokenSetting, googleDriveFolderIdSetting, googleDriveRefreshTokenSetting);
  const uploadGoogleDriveBackupM = useUploadGoogleDriveBackup(
    googleDriveAccessTokenSetting,
    googleDriveFolderIdSetting,
    googleDriveBackupRetentionCountSetting,
  );
  const restoreLatestGoogleDriveBackupM = useRestoreLatestGoogleDriveBackup(googleDriveAccessTokenSetting, googleDriveFolderIdSetting, googleDriveRefreshTokenSetting);
  const hasGoogleDriveCredentials = !!googleDriveAccessTokenSetting?.trim() || !!googleDriveRefreshTokenSetting?.trim();
  // Colored dots
  const coloredDotsEnabledSetting = useAppSetting<boolean>('coloredDotsEnabled').data;
  const coloredDots = useColoredDots({includeInactive: true}).data;
  const createColoredDotM = useCreateColoredDot();
  const [isCreateNewColorDialogVisible, setIsCreateNewColorDialogVisible] = useState(false);
  const [newDotColor, setNewDotColor] = useState('');
  // Holiday function
  const holidayFunctionEnabledSetting = useAppSetting<boolean>('holidayFunctionEnabled').data;

  useEffect(() => {
    setGoogleDriveClientIdInput(googleDriveOAuthClientIdSetting ?? '');
    setGoogleDriveRedirectUriInput(googleDriveOAuthRedirectUriSetting ?? getGoogleDriveOAuthRedirectUri());
    setGoogleDriveAccessTokenInput(googleDriveAccessTokenSetting ?? '');
    setGoogleDriveFolderIdInput(googleDriveFolderIdSetting ?? '');
    setGoogleDriveRetentionInput(googleDriveBackupRetentionCountSetting);
    setLocalBackupRetentionInput(localBackupRetentionCountSetting);
  }, [googleDriveAccessTokenSetting, googleDriveBackupRetentionCountSetting, googleDriveFolderIdSetting, googleDriveOAuthClientIdSetting, googleDriveOAuthRedirectUriSetting, localBackupRetentionCountSetting]);

  const refreshGoogleDriveSettingsQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.appSetting("googleDriveAccessToken") }),
      queryClient.invalidateQueries({ queryKey: qk.appSetting("googleDriveRefreshToken") }),
      queryClient.invalidateQueries({ queryKey: qk.appSetting("googleDriveAccessTokenExpiresAt") }),
      queryClient.invalidateQueries({ queryKey: qk.appSetting("googleDriveOAuthClientId") }),
      queryClient.invalidateQueries({ queryKey: qk.appSetting("googleDriveOAuthRedirectUri") }),
      queryClient.invalidateQueries({ queryKey: ["googleDriveBackups"] }),
    ]);
  }, [queryClient]);

  const saveNewColoredDot = useCallback(() => {
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
  }, [newDotColor, createColoredDotM]);

  const handleRefreshNotifications = useCallback(async () => {
    try {
      const result = await refreshNotificationsM.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage(`Scheduled ${result.scheduled} inventory notifications.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Notification scheduling failed');
    }
  }, [refreshNotificationsM]);

  const handleExportPress = useCallback(() => {
    setIsExportDialogVisible(true);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExportDialogVisible(false);
    try {
      await exportMutation.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage('Database exported successfully!');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Export failed');
    }
  }, [exportMutation]);

  const handleImportPress = useCallback(async () => {
    try {
      const preview = await importPreviewMutation.mutateAsync();
      setImportPreview(preview);
      setIsImportConfirmDialogVisible(true);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Import preview failed');
    }
  }, [importPreviewMutation]);

  const handleImportFinal = useCallback(async () => {
    if (!importPreview) return;
    setIsImportConfirmDialogVisible(false);
    try {
      const result = await importConfirmMutation.mutateAsync(importPreview);
      setImportPreview(null);
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
  }, [importConfirmMutation, importPreview]);

  const handleSaveGoogleDriveSettings = useCallback(async () => {
    try {
      await Promise.all([
        upsertAppSetting.mutateAsync({
          key: "googleDriveOAuthClientId",
          value: googleDriveClientIdInput.trim(),
        }),
        upsertAppSetting.mutateAsync({
          key: "googleDriveOAuthRedirectUri",
          value: googleDriveRedirectUriInput.trim(),
        }),
        upsertAppSetting.mutateAsync({
          key: "googleDriveAccessToken",
          value: googleDriveAccessTokenInput.trim(),
        }),
        upsertAppSetting.mutateAsync({
          key: "googleDriveFolderId",
          value: googleDriveFolderIdInput.trim(),
        }),
        upsertAppSetting.mutateAsync({
          key: "googleDriveBackupRetentionCount",
          value: googleDriveRetentionInput ?? 5,
        }),
      ]);
      setSnackbarError(false);
      setSnackbarMessage('Google Drive backup settings saved.');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Failed to save Google Drive settings');
    }
  }, [googleDriveAccessTokenInput, googleDriveClientIdInput, googleDriveFolderIdInput, googleDriveRedirectUriInput, googleDriveRetentionInput, upsertAppSetting]);

  const handleConnectGoogleDrive = useCallback(async () => {
    if (!db || !dbReady) {
      setSnackbarError(true);
      setSnackbarMessage('Database not ready');
      return;
    }

    try {
      await connectGoogleDriveOAuth({
        db,
        clientId: googleDriveClientIdInput,
        redirectUri: googleDriveRedirectUriInput,
      });
      await refreshGoogleDriveSettingsQueries();
      setSnackbarError(false);
      setSnackbarMessage('Google Drive connected. Refresh token stored locally.');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Google Drive sign-in failed');
    }
  }, [db, dbReady, googleDriveClientIdInput, googleDriveRedirectUriInput, refreshGoogleDriveSettingsQueries]);

  const handleRefreshGoogleDriveToken = useCallback(async () => {
    if (!db || !dbReady) {
      setSnackbarError(true);
      setSnackbarMessage('Database not ready');
      return;
    }

    try {
      await refreshGoogleDriveAccessToken({
        db,
        clientId: googleDriveClientIdInput,
        refreshToken: googleDriveRefreshTokenSetting,
      });
      await refreshGoogleDriveSettingsQueries();
      setSnackbarError(false);
      setSnackbarMessage('Google Drive access token refreshed.');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Google Drive token refresh failed');
    }
  }, [db, dbReady, googleDriveClientIdInput, googleDriveRefreshTokenSetting, refreshGoogleDriveSettingsQueries]);

  const handleDisconnectGoogleDrive = useCallback(async () => {
    if (!db || !dbReady) {
      setSnackbarError(true);
      setSnackbarMessage('Database not ready');
      return;
    }

    try {
      await disconnectGoogleDriveOAuth(db);
      await refreshGoogleDriveSettingsQueries();
      setSnackbarError(false);
      setSnackbarMessage('Google Drive disconnected locally.');
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Google Drive disconnect failed');
    }
  }, [db, dbReady, refreshGoogleDriveSettingsQueries]);

  const handleSaveLocalBackupSettings = useCallback(async () => {
    try {
      await upsertAppSetting.mutateAsync({
        key: "localBackupRetentionCount",
        value: localBackupRetentionInput ?? 5,
      });
      setSnackbarError(false);
      setSnackbarMessage("Local backup settings saved.");
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : "Failed to save local backup settings");
    }
  }, [localBackupRetentionInput, upsertAppSetting]);

  const handleCreateLocalBackup = useCallback(async () => {
    try {
      const result = await createLocalBackupM.mutateAsync();
      await localBackupsQ.refetch();
      setSnackbarError(false);
      setSnackbarMessage(`Created ${result.backup.name}. Pruned ${result.pruned.length} old backups.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : "Local backup failed");
    }
  }, [createLocalBackupM, localBackupsQ]);

  const handleShareLatestLocalBackup = useCallback(async () => {
    try {
      const latest = await shareLatestLocalBackupM.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage(`Shared ${latest.name}.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : "Failed to share local backup");
    }
  }, [shareLatestLocalBackupM]);

  const handleRestoreLatestLocalBackup = useCallback(async () => {
    setIsLocalRestoreDialogVisible(false);
    try {
      const result = await restoreLatestLocalBackupM.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage(`Restored local backup with ${result.stats.products} products and ${result.stats.packs} packs.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : "Local backup restore failed");
    }
  }, [restoreLatestLocalBackupM]);

  const handleUploadGoogleDriveBackup = useCallback(async () => {
    try {
      const uploaded = await uploadGoogleDriveBackupM.mutateAsync();
      await googleDriveBackupsQ.refetch();
      setSnackbarError(false);
      setSnackbarMessage(`Uploaded ${uploaded.uploaded.name} to Google Drive. Pruned ${uploaded.pruned.length} old backups.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Google Drive upload failed');
    }
  }, [googleDriveBackupsQ, uploadGoogleDriveBackupM]);

  const handleRestoreLatestDriveBackup = useCallback(async () => {
    setIsDriveRestoreDialogVisible(false);
    try {
      const result = await restoreLatestGoogleDriveBackupM.mutateAsync();
      setSnackbarError(false);
      setSnackbarMessage(`Restored Google Drive backup with ${result.stats.products} products and ${result.stats.packs} packs.`);
    } catch (err) {
      setSnackbarError(true);
      setSnackbarMessage(err instanceof Error ? err.message : 'Google Drive restore failed');
    }
  }, [restoreLatestGoogleDriveBackupM]);

  return (
    <AppWrapper bottomEdge={false}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text variant="headlineLarge" style={{ marginBottom: 24 }}>Settings</Text>

        {/* App warnings / Notifications section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Notifications</Text>
        <Card elevation={1} style={{marginBottom: 24}}>
          <Card.Content style={{gap: 12}}>
            <Text variant="titleMedium">Use notifications</Text>
            <Text>Toggle and manage notifications that notify you about important stock changes, such as when you are running low or when items are about to expire.</Text>
            <SegmentedButtons
              value={appWarningsEnabledSetting ? 'enabled' : 'disabled'}
              onValueChange={(value) => {
                upsertAppSetting.mutate({key: "appWarningsEnabled", value: value === 'enabled'})
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
            {appWarningsEnabledSetting && (
              <>
                <View>
                  <Text variant="titleMedium">Expiry approaching warning</Text>
                  <Text variant="bodySmall">Get notified when items are about to expire.</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ marginRight: 8 }} variant="labelLarge">
                      {expiryApproachingWarningEnabledSetting ? "Enabled" : "Disabled"}
                    </Text>
                    <Switch
                      value={expiryApproachingWarningEnabledSetting ?? false}
                      onValueChange={(value) => {
                        if (!expiryApproachingDaysSetting) {
                          upsertAppSetting.mutate({ key: "expiryApproachingDays", value: 7 });
                        }
                        upsertAppSetting.mutate({ key: "expiryApproachingWarningEnabled", value })
                      }}
                    />
                  </View>
                  {expiryApproachingWarningEnabledSetting && (
                    <NumberInput
                      value={expiryApproachingDaysSetting ?? null}
                      onChangeText={(value) => {
                        upsertAppSetting.mutate({key: "expiryApproachingDays", value})
                      }}
                      label="Days before expiry to notify"
                      style={{ width: 200, marginTop: 8 }}
                      minValue={0}
                    />
                  )}
                </View>

                <View>
                  <Text variant="titleMedium">Running out warning</Text>
                  <Text>Get notified when items are running out of stock.</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ marginRight: 8 }} variant="labelLarge">
                      {runningOutWarningEnabledSetting ? "Enabled" : "Disabled"}
                    </Text>
                    <Switch
                      value={runningOutWarningEnabledSetting ?? false}
                      onValueChange={(value) => {
                        if (!runningOutDaysSetting) {
                          upsertAppSetting.mutate({ key: "runningOutDays", value: 3 });
                        }
                        upsertAppSetting.mutate({ key: "runningOutWarningEnabled", value })
                      }}
                    />
                  </View>
                  {runningOutWarningEnabledSetting && (
                    <NumberInput
                      value={runningOutDaysSetting ?? null}
                      onChangeText={(value) => {
                        upsertAppSetting.mutate({key: "runningOutDays", value})
                      }}
                      label="Days before running out to notify"
                      style={{ width: 200, marginTop: 8 }}
                      minValue={0}
                    />
                  )}
                </View>

                <Button
                  mode="contained-tonal"
                  icon="bell"
                  onPress={handleRefreshNotifications}
                  loading={refreshNotificationsM.isPending}
                  disabled={refreshNotificationsM.isPending}
                >
                  Refresh notification schedule
                </Button>
              </>
            )}
          </Card.Content>
        </Card>


        {/* Color dots management section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Colored Dots</Text>
        <Card elevation={1} style={{ marginBottom: 24 }}>
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

        {/* Toggle holiday mode, manage holiday items */}
        <Text variant="titleLarge" style={{marginBottom: 12}}>Holiday Function</Text>
        <Card elevation={1} style={{marginBottom: 24}}>
          <Card.Content style={{gap: 12}}>
            <Text variant="titleMedium">Use holiday function</Text>
            <Text>Set up the holiday mode to get a list of items you need to take with you on your trip.</Text>
            <SegmentedButtons
              value={holidayFunctionEnabledSetting ? "enabled": "disabled"}
              onValueChange={(value) => {
                upsertAppSetting.mutate({key: "holidayFunctionEnabled", value: value === "enabled"})
              }}
              buttons={[
                {
                  value: "enabled",
                  label: "Yes",
                  icon: "beach"
                },
                {
                  value: "disabled",
                  label: "No",
                  icon: "close"
                }
              ]}
            />
            {/*
            {db && holidayFunctionEnabledSetting && (
              <>
                <Text variant="titleMedium">Select products to include in the holiday mode</Text>
                {allProductsQ.data && (
                  <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8}}>
                    {allProductsQ.data.map((product) => {
                      const selected = product.requiredForHoliday;
                      return (
                        <Chip
                          key={product.id}
                          selected={selected}
                          mode={selected ? "flat" : "outlined"}
                          icon={selected ? "check" : "plus"}
                          onPress={() => {
                            updateProductM.mutate({
                              productId: product.id,
                              requiredForHoliday: !selected
                            });
                          }}
                        >{product.name}</Chip>
                      )
                    })}
                  </View>
                )}
              </>
            )}
            */}
          </Card.Content>
        </Card>
        

        {/* Data Management Section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Data Management</Text>        
        <Card elevation={1} style={{ marginBottom: 24 }}>
          <Card.Content style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.primaryContainer,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                }}
              >
                <Icon source="folder-clock" size={24} color={theme.colors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Automatic Local Backups</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  App-private JSON backups using the same export format. No account or network required.
                </Text>
              </View>
            </View>

            <SegmentedButtons
              value={localBackupFrequencySetting}
              onValueChange={(value) => {
                upsertAppSetting.mutate({
                  key: "localBackupFrequency",
                  value: value as BackupFrequency,
                });
              }}
              buttons={[
                { value: "manual", label: "Manual" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <NumberInput
              label="Backups to keep"
              value={localBackupRetentionInput}
              onChangeText={setLocalBackupRetentionInput}
              minValue={1}
              style={{ width: 200 }}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
              Stored in app data: {getLocalBackupDirectoryUri()}
            </Text>
            <Button
              mode="outlined"
              icon="content-save"
              onPress={handleSaveLocalBackupSettings}
              disabled={upsertAppSetting.isPending}
              loading={upsertAppSetting.isPending}
            >
              Save Local Backup Settings
            </Button>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                mode="contained"
                icon="database-plus"
                onPress={handleCreateLocalBackup}
                disabled={createLocalBackupM.isPending}
                loading={createLocalBackupM.isPending}
              >
                Create Backup
              </Button>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={() => localBackupsQ.refetch()}
                disabled={localBackupsQ.isFetching}
                loading={localBackupsQ.isFetching}
              >
                Check Local
              </Button>
              <Button
                mode="outlined"
                icon="share-variant"
                onPress={handleShareLatestLocalBackup}
                disabled={!localBackupsQ.data?.length || shareLatestLocalBackupM.isPending}
                loading={shareLatestLocalBackupM.isPending}
              >
                Share Latest
              </Button>
              <Button
                mode="outlined"
                icon="database-import"
                textColor={theme.colors.error}
                onPress={() => setIsLocalRestoreDialogVisible(true)}
                disabled={!localBackupsQ.data?.length || restoreLatestLocalBackupM.isPending}
                loading={restoreLatestLocalBackupM.isPending}
              >
                Restore Latest
              </Button>
            </View>

            {localBackupsQ.data && localBackupsQ.data.length > 0 ? (
              <View style={{ gap: 4 }}>
                <Text variant="labelLarge">Latest local backup</Text>
                <Text>{localBackupsQ.data[0].name}</Text>
                {localBackupsQ.data[0].modifiedTime ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                    Modified {new Date(localBackupsQ.data[0].modifiedTime).toLocaleString()}
                  </Text>
                ) : null}
                <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                  {localBackupsQ.data.length} backup{localBackupsQ.data.length === 1 ? "" : "s"} stored locally.
                </Text>
              </View>
            ) : (
              <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                No local backups have been created yet.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card elevation={1} style={{ marginBottom: 24 }}>
          <Card.Content style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Advanced Google Drive Backup</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  Untested cloud backup for custom OAuth setups. Keep disabled unless you are actively testing it.
                </Text>
              </View>
              <Switch
                value={googleDriveAdvancedEnabledSetting}
                onValueChange={(value) => {
                  upsertAppSetting.mutate({
                    key: "googleDriveBackupAdvancedEnabled",
                    value,
                  });
                }}
              />
            </View>
          </Card.Content>
        </Card>

        {googleDriveAdvancedEnabledSetting ? (
        <Card elevation={1} style={{ marginBottom: 24 }}>
          <Card.Content style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.primaryContainer,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                }}
              >
                <Icon source="google-drive" size={24} color={theme.colors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Google Drive Backup</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 2 }}>
                  Optional unencrypted cloud backup using the same JSON backup format.
                </Text>
              </View>
            </View>

            <TextInput
              label="Google OAuth client ID"
              value={googleDriveClientIdInput}
              onChangeText={setGoogleDriveClientIdInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Required for Google sign-in"
            />
            <TextInput
              label="OAuth redirect URI"
              value={googleDriveRedirectUriInput}
              onChangeText={setGoogleDriveRedirectUriInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
              Add this redirect URI to your Google OAuth client. The app requests Drive file access with offline access so Google can return a refresh token.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                mode="contained"
                icon="login"
                onPress={handleConnectGoogleDrive}
                disabled={!googleDriveClientIdInput.trim() || !dbReady}
              >
                Connect Google Drive
              </Button>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={handleRefreshGoogleDriveToken}
                disabled={!googleDriveRefreshTokenSetting || !dbReady}
              >
                Refresh Token
              </Button>
              <Button
                mode="outlined"
                icon="logout"
                onPress={handleDisconnectGoogleDrive}
                disabled={(!googleDriveRefreshTokenSetting && !googleDriveAccessTokenSetting) || !dbReady}
              >
                Disconnect
              </Button>
            </View>
            {(googleDriveRefreshTokenSetting || googleDriveAccessTokenSetting) ? (
              <View style={{ gap: 2 }}>
                <Text variant="labelLarge">Drive status: connected</Text>
                {googleDriveAccessTokenExpiresAtSetting ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                    Access token expires {new Date(googleDriveAccessTokenExpiresAtSetting).toLocaleString()}
                  </Text>
                ) : (
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                    Access token expiry is unknown. OAuth refresh will update it after the next refresh.
                  </Text>
                )}
              </View>
            ) : null}
            <TextInput
              label="Google Drive access token (advanced fallback)"
              value={googleDriveAccessTokenInput}
              onChangeText={setGoogleDriveAccessTokenInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
              Optional manual fallback for a token with Google Drive file access. OAuth refresh tokens are preferred because access tokens expire.
            </Text>
            <TextInput
              label="Google Drive folder ID"
              value={googleDriveFolderIdInput}
              onChangeText={setGoogleDriveFolderIdInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Optional, leave blank for Drive root"
            />
            <SegmentedButtons
              value={googleDriveBackupFrequencySetting}
              onValueChange={(value) => {
                upsertAppSetting.mutate({
                  key: "googleDriveBackupFrequency",
                  value: value as GoogleDriveBackupFrequency,
                });
              }}
              buttons={[
                { value: "manual", label: "Manual" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <NumberInput
              label="Backups to keep"
              value={googleDriveRetentionInput}
              onChangeText={setGoogleDriveRetentionInput}
              minValue={1}
              style={{ width: 200 }}
            />
            <Button
              mode="outlined"
              icon="content-save"
              onPress={handleSaveGoogleDriveSettings}
              disabled={upsertAppSetting.isPending}
              loading={upsertAppSetting.isPending}
            >
              Save Drive Settings
            </Button>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                mode="contained"
                icon="cloud-upload"
                onPress={handleUploadGoogleDriveBackup}
                disabled={!hasGoogleDriveCredentials || uploadGoogleDriveBackupM.isPending}
                loading={uploadGoogleDriveBackupM.isPending}
              >
                Upload Backup
              </Button>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={() => googleDriveBackupsQ.refetch()}
                disabled={!hasGoogleDriveCredentials || googleDriveBackupsQ.isFetching}
                loading={googleDriveBackupsQ.isFetching}
              >
                Check Drive
              </Button>
              <Button
                mode="outlined"
                icon="cloud-download"
                textColor={theme.colors.error}
                onPress={() => setIsDriveRestoreDialogVisible(true)}
                disabled={!hasGoogleDriveCredentials || restoreLatestGoogleDriveBackupM.isPending}
                loading={restoreLatestGoogleDriveBackupM.isPending}
              >
                Restore Latest
              </Button>
            </View>

            {googleDriveBackupsQ.data && googleDriveBackupsQ.data.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text variant="labelLarge">Latest Drive backup</Text>
                <Text>{googleDriveBackupsQ.data[0].name}</Text>
                {googleDriveBackupsQ.data[0].modifiedTime && (
                  <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                    Modified {new Date(googleDriveBackupsQ.data[0].modifiedTime).toLocaleString()}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
        ) : null}

        <Card elevation={1} style={{ marginBottom: 24 }}>
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
              onPress={handleExportPress}
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
              loading={importPreviewMutation.isPending || importConfirmMutation.isPending}
              disabled={importPreviewMutation.isPending || importConfirmMutation.isPending}
              textColor={theme.colors.error}
              style={{ borderColor: theme.colors.error }}
            >
              Import Backup
            </Button>
          </Card.Content>
        </Card>

        {/* About Section */}
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>About</Text>
        
        <Card elevation={1} style={{ marginBottom: 24 }}>
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
        <Dialog visible={isExportDialogVisible} onDismiss={() => setIsExportDialogVisible(false)}>
          <Dialog.Icon icon="shield-alert" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center' }}>Export Unencrypted Backup?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              The backup file is plain JSON. It can include product names, images, inventory history, settings, and trip plans.
            </Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', color: theme.colors.error }}>
              Store it somewhere private.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsExportDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              icon="export"
              onPress={handleExport}
              loading={exportMutation.isPending}
              disabled={exportMutation.isPending}
            >
              Export
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Import Preview and Confirmation Dialog */}
        <Dialog visible={isImportConfirmDialogVisible} onDismiss={() => setIsImportConfirmDialogVisible(false)}>
          <Dialog.Icon icon="alert-octagon" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center', color: theme.colors.error }}>
            Import Preview
          </Dialog.Title>
          <Dialog.Content>
            {importPreview && (
              <View style={{ gap: 8 }}>
                <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
                  {importPreview.fileName}
                </Text>
                <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.colors.secondary }}>
                  Version {importPreview.version}{importPreview.exportedAt ? `, exported ${new Date(importPreview.exportedAt).toLocaleString()}` : ""}
                </Text>
                <View style={{ gap: 4, marginTop: 8 }}>
                  <Text>{importPreview.stats.products} products</Text>
                  <Text>{importPreview.stats.packs} packs</Text>
                  <Text>{importPreview.stats.stockEvents} history events</Text>
                  <Text>{importPreview.stats.sessions} sessions</Text>
                  <Text>{importPreview.stats.holidays} trips</Text>
                  <Text>{importPreview.stats.images} images</Text>
                  <Text>{importPreview.stats.appSettings} settings</Text>
                </View>
                <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', color: theme.colors.error }}>
                  Importing this backup will permanently replace all current local data.
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsImportConfirmDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={handleImportFinal} 
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              loading={importConfirmMutation.isPending}
              disabled={importConfirmMutation.isPending || !importPreview}
            >
              Import Now
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isLocalRestoreDialogVisible} onDismiss={() => setIsLocalRestoreDialogVisible(false)}>
          <Dialog.Icon icon="folder-alert" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center', color: theme.colors.error }}>
            Restore Latest Local Backup?
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              This will restore the latest automatic local backup and replace all current local data.
            </Text>
            {localBackupsQ.data?.[0] && (
              <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 12, color: theme.colors.secondary }}>
                Latest: {localBackupsQ.data[0].name}
              </Text>
            )}
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', color: theme.colors.error }}>
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsLocalRestoreDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              onPress={handleRestoreLatestLocalBackup}
              loading={restoreLatestLocalBackupM.isPending}
              disabled={restoreLatestLocalBackupM.isPending}
            >
              Restore
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isDriveRestoreDialogVisible} onDismiss={() => setIsDriveRestoreDialogVisible(false)}>
          <Dialog.Icon icon="cloud-alert" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: 'center', color: theme.colors.error }}>
            Restore Latest Drive Backup?
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              This will download the latest app backup found in Google Drive and replace all current local data.
            </Text>
            {googleDriveBackupsQ.data?.[0] && (
              <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 12, color: theme.colors.secondary }}>
                Latest: {googleDriveBackupsQ.data[0].name}
              </Text>
            )}
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', color: theme.colors.error }}>
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDriveRestoreDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              onPress={handleRestoreLatestDriveBackup}
              loading={restoreLatestGoogleDriveBackupM.isPending}
              disabled={restoreLatestGoogleDriveBackupM.isPending}
            >
              Restore
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
