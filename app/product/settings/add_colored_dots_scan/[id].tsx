import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import { useDatabase } from "@/db";
import { Pack } from "@/db/schema";
import { processImage } from "@/modules/frame-processor-v2/src";
import { detectBarcodeFormat, GS1Data, parseGS1Unified } from "@/scripts/gs1";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useColoredDots } from "@/src/data/hooks/useColoredDots";
import { packsRepo } from "@/src/data/packsRepo";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ActivityIndicator, Button, Card, Chip, Divider, Modal, Portal, Text, useTheme } from "react-native-paper";
import { runOnJS } from "react-native-reanimated";

// Types for scan result handling
type PackWithDots = Pack & { existingDots: string[] | null; newDots: string[] | null };

type ScanResultState = 
  | { type: 'idle' }
  | { type: 'no_packs_found' }
  | { type: 'single_pack_with_dots'; pack: PackWithDots }
  | { type: 'single_pack_without_dots'; pack: PackWithDots }
  | { type: 'multiple_packs_all_with_dots'; packs: PackWithDots[] }
  | { type: 'multiple_packs_some_without_dots'; packsWithDots: PackWithDots[]; packsWithoutDots: PackWithDots[] };

type ScanParams = {
  id: string;
  returnName?: string;
  returnImageUri?: string;
  returnUnitsPerPack?: string;
  returnActive?: string;
  returnCanHaveExpiry?: string;
  returnIsSessionBased?: string;
  returnNominalSessionTimeDays?: string;
  returnUseColoredDots?: string;
};

export default function AddColoredDotsByScanning() {
  const params = useLocalSearchParams<ScanParams>();
  const {
    id: productId,
    returnName,
    returnImageUri,
    returnUnitsPerPack,
    returnActive,
    returnCanHaveExpiry,
    returnIsSessionBased,
    returnNominalSessionTimeDays,
    returnUseColoredDots,
  } = params;
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const theme = useTheme();
  const { db } = useDatabase();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResultState>({ type: 'idle' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // Colored dots settings
  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
  const coloredDots = useColoredDots({ includeInactive: true }).data;

  // Navigate back preserving parent screen state
  const navigateBack = () => {
    router.replace({
      pathname: '/product/settings/[id]',
      params: {
        id: productId,
        name: returnName ?? '',
        photoUri: returnImageUri ?? '',
        unitsPerPack: returnUnitsPerPack ?? '',
        active: returnActive ?? '',
        canHaveExpiry: returnCanHaveExpiry ?? '',
        isSessionBased: returnIsSessionBased ?? '',
        nominalSessionTimeDays: returnNominalSessionTimeDays ?? '',
        useColoredDotsForProduct: returnUseColoredDots ?? '',
      }
    });
  };

  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newZoom = Math.max(0, Math.min(zoom + (e.scale - 1) * 0.05, 1));
      runOnJS(updateZoom)(newZoom);
    });

  // Generate unique dot combination
  const generateDotsForPack = useCallback(async (): Promise<string[] | null> => {
    if (!db || !productId) return null;
    const repo = coloredDotsRepo(db);
    return repo.generateUniqueCombinationForProduct(productId, { includeInactive: false });
  }, [db, productId]);

  // Get existing dot assignment for a pack
  const getExistingDots = useCallback(async (packId: string): Promise<string[] | null> => {
    if (!db) return null;
    const repo = coloredDotsRepo(db);
    const assignment = await repo.getAssignmentByPackId(packId);
    return assignment?.dotIds ?? null;
  }, [db]);

  if (!permission?.granted) {
    return (
      <AppWrapper>
        <View style={{ marginBottom: 16 }}>
          <Button 
            mode="text" 
            onPress={navigateBack} 
            icon="arrow-left"
            style={{ alignSelf: 'flex-start', marginLeft: -8 }}
          >
            Back
          </Button>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Card elevation={2} style={{ padding: 24, alignItems: 'center', maxWidth: 400, }}>
            <Text variant="titleLarge" style={{ marginBottom: 8, textAlign: 'center' }}>Camera Access Required</Text>
            <Text variant="bodyMedium" style={{ marginBottom: 24, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
              Camera permission is required to scan barcodes.
            </Text>
            <Button onPress={() => requestPermission()} mode="contained" icon="camera">
              Grant Permission
            </Button>
          </Card>
        </View>
      </AppWrapper>
    );
  }

  const handleDotLogic = async (rawCode: string, gs1data?: GS1Data | undefined) => {
    if (!db) return;
    
    const ais = gs1data?.fields?.reduce((acc: Record<string, string>, f) => {
      const ai = (f as any).ai;
      const value = (f as any).value;
      if (ai && typeof value === 'string') {
        acc[ai] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    const packs = await packsRepo(db).findMatchingPacks(
      productId,
      rawCode,
      Object.keys(ais || {}).length > 0 ? ais : undefined
    );

    if (!packs || packs.length === 0) {
      setScanResult({ type: 'no_packs_found' });
      return;
    }

    // Fetch existing dots for each pack and generate new dots for those without
    const packsWithDotsInfo: PackWithDots[] = await Promise.all(
      packs.map(async (pack) => {
        const existingDots = await getExistingDots(pack.id);
        const newDots = (!existingDots || existingDots.length === 0) 
          ? await generateDotsForPack() 
          : null;
        return { ...pack, existingDots, newDots };
      })
    );

    if (packs.length === 1) {
      const pack = packsWithDotsInfo[0];
      if (pack.existingDots && pack.existingDots.length > 0) {
        setScanResult({ type: 'single_pack_with_dots', pack });
      } else {
        setScanResult({ type: 'single_pack_without_dots', pack });
      }
    } else {
      const packsWithDots = packsWithDotsInfo.filter(p => p.existingDots && p.existingDots.length > 0);
      const packsWithoutDots = packsWithDotsInfo.filter(p => !p.existingDots || p.existingDots.length === 0);

      if (packsWithoutDots.length === 0) {
        setScanResult({ type: 'multiple_packs_all_with_dots', packs: packsWithDotsInfo });
      } else {
        setScanResult({ 
          type: 'multiple_packs_some_without_dots', 
          packsWithDots, 
          packsWithoutDots 
        });
      }
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsScanning(true);
      setScanResult({ type: 'idle' });
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });

      if (photo) {
        const result = await processImage(photo.uri);

        if (result.success && result.barcodes && result.barcodes.length > 0 && result.barcodes[0].text) {
          const barcode = result.barcodes[0];
          const detected = detectBarcodeFormat(barcode.text);

          setFlashEnabled(false);
          await handleDotLogic(
            result.barcodes[0].text, 
            detected.format === 'GS1' ? parseGS1Unified(barcode.text) : undefined
          );
        } else {
          alert("No valid barcode detected. Please try again.");
        }
      }

      setIsScanning(false);
    }
  };

  // Save dots to a pack
  const saveDotsForPack = async (packId: string, dotIds: string[]) => {
    if (!db) return;
    setIsSaving(true);
    try {
      const repo = coloredDotsRepo(db);
      await repo.setAssignmentForPack(packId, dotIds);
      alert("Color code saved successfully!");
      setScanResult({ type: 'idle' });
      setSelectedPackId(null);
    } catch {
      alert("Failed to save color code. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setScanResult({ type: 'idle' });
    setSelectedPackId(null);
  };

  // Helper to describe pack for user
  const getPackDescription = (pack: Pack) => {
    const parts: string[] = [];
    if (pack.unitsRemaining !== null && pack.unitsRemaining !== undefined) {
      parts.push(`${pack.unitsRemaining} unit${pack.unitsRemaining !== 1 ? 's' : ''} remaining`);
    }
    if (pack.expiry) {
      parts.push(`expires ${pack.expiry}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'No additional info';
  };

  // Check if packs have different unit counts
  const packsHaveDifferentUnits = (packs: Pack[]) => {
    if (packs.length <= 1) return false;
    const first = packs[0].unitsRemaining;
    return packs.some(p => p.unitsRemaining !== first);
  };

  return (
    <AppWrapper>
      <View style={{ marginBottom: 16 }}>
        <Button 
          mode="text" 
          onPress={navigateBack} 
          icon="arrow-left"
          style={{ alignSelf: 'flex-start', marginLeft: -8 }}
        >
          Back
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="headlineLarge" style={{marginBottom: 8}}>Scan to Assign Color Codes</Text>
        <Text variant="bodyMedium" style={{marginBottom: 16, color: theme.colors.onSurfaceVariant}}>
          Scan a barcode to find matching packs and assign color codes for easy identification.
        </Text>
        
        {/* Color dot toggles */}
        {coloredDotsEnabled && coloredDots && coloredDots.length > 0 && (
          <Card elevation={1} style={{ marginBottom: 16 }}>
            <Card.Content style={{ gap: 8 }}>
              <Text variant="labelLarge">Available Colors</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Tap colors to enable/disable them for code generation:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {coloredDots.map((dot) => (
                  <ColoredDot key={dot.id} dotId={dot.id} pressToToggle size={32} />
                ))}
              </View>
            </Card.Content>
          </Card>
        )}
        
        <Card elevation={2} style={{flex: 1, marginBottom: 16, overflow: 'hidden', flexGrow: 1}}>
          <View style={{flexGrow: 1, width: "100%", height: "100%"}}>
            <GestureDetector gesture={pinchGesture}>
              <CameraView
                ref={cameraRef}
                style={{flex: 1, flexGrow: 1, width: "100%"}}
                enableTorch={flashEnabled}
                zoom={zoom}
              />
            </GestureDetector>
          </View>
        </Card>
        <View style={{gap: 12, marginBottom: 32}}>
          <Button icon={flashEnabled ? "flashlight" : "flashlight-off"} mode={flashEnabled ? "contained" : "outlined"} onPress={() => setFlashEnabled(!flashEnabled)}>
            {flashEnabled ? "Flash On" : "Flash Off"}
          </Button>
          <Button icon="camera" loading={isScanning} mode="contained" onPress={takePicture} disabled={isScanning}>
            {isScanning ? "Scanning..." : "Take Picture"}
          </Button>
        </View>
      </View>

      <Portal>
        {/* Modal for scan results */}
        <Modal
          visible={scanResult.type !== 'idle'}
          onDismiss={closeModal}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 20,
            borderRadius: 16,
            maxHeight: '80%',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            {/* Case 5: No pack found */}
            {scanResult.type === 'no_packs_found' && (
              <View style={{ gap: 16 }}>
                <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
                  No Matching Pack Found
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                  This barcode does not match any pack in your inventory for this product. Make sure the pack has been added first.
                </Text>
                <Button mode="contained" onPress={closeModal}>
                  Scan Another
                </Button>
              </View>
            )}

            {/* Case 3: Single pack found, has color codes */}
            {scanResult.type === 'single_pack_with_dots' && (
              <View style={{ gap: 16 }}>
                <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
                  Pack Already Labeled
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                  This pack already has a color code assigned:
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 }}>
                  {scanResult.pack.existingDots?.map((dotId, index) => (
                    <ColoredDot key={index} dotId={dotId} size={48} crossInactive={false} />
                  ))}
                </View>
                <Card elevation={1} style={{ marginBottom: 8 }}>
                  <Card.Content>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {getPackDescription(scanResult.pack)}
                    </Text>
                  </Card.Content>
                </Card>
                <Button mode="contained" onPress={closeModal}>
                  Done
                </Button>
              </View>
            )}

            {/* Case 4: Single pack found, no color codes */}
            {scanResult.type === 'single_pack_without_dots' && (
              <View style={{ gap: 16 }}>
                <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
                  Label This Pack
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                  Apply this color code to your pack:
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 }}>
                  {scanResult.pack.newDots?.map((dotId, index) => (
                    <ColoredDot key={index} dotId={dotId} size={48} />
                  ))}
                </View>
                <Card elevation={1} style={{ marginBottom: 8 }}>
                  <Card.Content>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {getPackDescription(scanResult.pack)}
                    </Text>
                  </Card.Content>
                </Card>
                <View style={{ gap: 8 }}>
                  <Button 
                    mode="contained" 
                    onPress={() => saveDotsForPack(scanResult.pack.id, scanResult.pack.newDots!)}
                    loading={isSaving}
                    disabled={isSaving || !scanResult.pack.newDots}
                    icon="check"
                  >
                    Save Color Code
                  </Button>
                  <Button mode="outlined" onPress={closeModal} disabled={isSaving}>
                    Cancel
                  </Button>
                </View>
              </View>
            )}

            {/* Case 1: Multiple packs found, all with color codes */}
            {scanResult.type === 'multiple_packs_all_with_dots' && (
              <View style={{ gap: 16 }}>
                <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
                  Multiple Packs Already Labeled
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                  {scanResult.packs.length} packs share this barcode. Each already has a color code:
                </Text>
                
                {scanResult.packs.map((pack, index) => (
                  <Card key={pack.id} elevation={1}>
                    <Card.Content style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {pack.existingDots?.map((dotId, dotIndex) => (
                            <ColoredDot key={dotIndex} dotId={dotId} size={32} />
                          ))}
                        </View>
                        <Chip compact>{pack.unitsRemaining} units</Chip>
                      </View>
                      {pack.expiry && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          Expires: {pack.expiry}
                        </Text>
                      )}
                    </Card.Content>
                  </Card>
                ))}

                <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  {packsHaveDifferentUnits(scanResult.packs) 
                    ? "Use the unit count to identify which physical pack you're labeling."
                    : "All packs have the same quantity - check expiry dates to differentiate."}
                </Text>

                <Button mode="contained" onPress={closeModal}>
                  Done
                </Button>
              </View>
            )}

            {/* Case 2: Multiple packs found, some without color codes */}
            {scanResult.type === 'multiple_packs_some_without_dots' && (
              <View style={{ gap: 16 }}>
                <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
                  Select Pack to Label
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                  {packsHaveDifferentUnits(scanResult.packsWithoutDots)
                    ? "Select the pack that matches your physical product's unit count:"
                    : "Select one of the identical packs to label:"}
                </Text>
                
                {scanResult.packsWithDots.length > 0 && (
                  <>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Already labeled ({scanResult.packsWithDots.length}):
                    </Text>
                    {scanResult.packsWithDots.map((pack) => (
                      <Card key={pack.id} elevation={1} style={{ opacity: 0.5 }}>
                        <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {pack.existingDots?.map((dotId, dotIndex) => (
                              <ColoredDot key={dotIndex} dotId={dotId} size={24} crossInactive={false} />
                            ))}
                          </View>
                          <Chip compact>{pack.unitsRemaining} units</Chip>
                        </Card.Content>
                      </Card>
                    ))}
                    <Divider style={{ marginVertical: 4 }} />
                  </>
                )}

                <Text variant="labelLarge">
                  Tap to select ({scanResult.packsWithoutDots.length} need labeling):
                </Text>

                {scanResult.packsWithoutDots.map((pack) => {
                  const isSelected = selectedPackId === pack.id;
                  return (
                    <Pressable key={pack.id} onPress={() => setSelectedPackId(pack.id)}>
                      <Card 
                        elevation={isSelected ? 4 : 1} 
                        style={{ 
                          borderWidth: isSelected ? 2 : 0, 
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                        }}
                      >
                        <Card.Content style={{ gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                              {isSelected && (
                                <View style={{ 
                                  width: 24, height: 24, borderRadius: 12, 
                                  backgroundColor: theme.colors.primary,
                                  justifyContent: 'center', alignItems: 'center',
                                  marginRight: 8
                                }}>
                                  <Text style={{ color: theme.colors.onPrimary, fontSize: 14 }}>✓</Text>
                                </View>
                              )}
                              {pack.newDots?.map((dotId, dotIndex) => (
                                <ColoredDot key={dotIndex} dotId={dotId} size={isSelected ? 40 : 32} />
                              ))}
                            </View>
                            <Chip mode={isSelected ? "flat" : "outlined"}>{pack.unitsRemaining} units</Chip>
                          </View>
                          {pack.expiry && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              Expires: {pack.expiry}
                            </Text>
                          )}
                        </Card.Content>
                      </Card>
                    </Pressable>
                  );
                })}

                <View style={{ gap: 8, marginTop: 8 }}>
                  <Button 
                    mode="contained" 
                    onPress={() => {
                      const selectedPack = scanResult.packsWithoutDots.find(p => p.id === selectedPackId);
                      if (selectedPack && selectedPack.newDots) {
                        saveDotsForPack(selectedPack.id, selectedPack.newDots);
                      }
                    }}
                    loading={isSaving}
                    disabled={isSaving || !selectedPackId}
                    icon="check"
                  >
                    Save Color Code
                  </Button>
                  <Button mode="outlined" onPress={closeModal} disabled={isSaving}>
                    Cancel
                  </Button>
                </View>
              </View>
            )}

            {isSaving && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)' }}>
                <ActivityIndicator size="large" />
              </View>
            )}
          </ScrollView>
        </Modal>
      </Portal>
    </AppWrapper>
  )
}
