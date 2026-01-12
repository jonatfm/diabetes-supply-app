import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import { useDatabase } from "@/db";
import { GS1_AI_SPECS } from "@/scripts/gs1";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useColoredDots } from "@/src/data/hooks/useColoredDots";
import { usePacks } from "@/src/data/hooks/usePacks";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useProductIdentifiers } from "@/src/data/hooks/useProductIdentifiers";
import { useSaveManualPacksChanges } from "@/src/data/hooks/useSaveManualPacksChanges";
import { ChangesFormat } from "@/src/data/packsRepo";
import Clipboard from '@react-native-clipboard/clipboard';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Button, Card, Divider, FAB, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { DatePickerInput } from 'react-native-paper-dates';
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PackColoredDots = {
  [packId: string]: string[];
};

// Editable units input component
function EditableUnitsInput({ 
  value, 
  onChangeText, 
  maxValue 
}: { 
  value: string; 
  onChangeText: (text: string) => void; 
  maxValue?: number;
}) {
  const theme = useTheme();
  
  const handleTextChange = (text: string) => {
    if (text === '') {
      onChangeText(text);
      return;
    }
    
    const cleanedText = text.replace(/\s/g, '').replace(/[^0-9]/g, '');
    
    if (cleanedText === '') {
      onChangeText('');
      return;
    }
    
    const numValue = parseInt(cleanedText, 10);
    
    if (isNaN(numValue) || numValue < 0) {
      return;
    }
    
    if (maxValue !== undefined && numValue > maxValue) {
      onChangeText(maxValue.toString());
      return;
    }
    
    onChangeText(numValue.toString());
  };
  
  return (
    <TextInput
      value={value}
      onChangeText={handleTextChange}
      keyboardType="numeric"
      style={[
        styles.editableInput,
        {
          color: theme.colors.onSurface,
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.primary,
        }
      ]}
    />
  );
}

// Editable date button component
function EditableDateButton({ 
  value, 
  onPress 
}: { 
  value: string | null; 
  onPress: () => void;
}) {
  const theme = useTheme();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  return (
    <TouchableOpacity 
      style={[
        styles.editableDateButton,
        { 
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.primary,
        }
      ]}
      onPress={onPress}
    >
      <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>
        {formatDate(value)}
      </Text>
      <Icon source="calendar" size={18} color={theme.colors.primary} />
    </TouchableOpacity>
  );
}

// Field row component for consistent styling
function FieldRow({ 
  label, 
  children 
}: { 
  label: string; 
  children: React.ReactNode;
}) {
  const theme = useTheme();
  
  return (
    <View style={styles.fieldRow}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, minWidth: 80 }}>
        {label}
      </Text>
      <View style={styles.fieldValue}>
        {children}
      </View>
    </View>
  );
}


export default function EditProductPage() {
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const theme = useTheme();
  const productQ = useProduct(id);
  const packsQ = usePacks(id);
  const productIdentifiersQ = useProductIdentifiers(id);
  const saveChangesQ = useSaveManualPacksChanges(id);
  const [changes, setChanges] = useState<ChangesFormat>({});
  const { db } = useDatabase();
  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
  const coloredDots = useColoredDots({includeInactive: true}).data;

  // State to manage pack units
  const [packUnits, setPackUnits] = useState<Record<string, string>>({});
  // State to manage pack dates
  const [packDates, setPackDates] = useState<Record<string, string>>({});
  // State for date modal
  const [editingDatePackId, setEditingDatePackId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  // State for colored dots
  const [packColoredDots, setPackColoredDots] = useState<PackColoredDots>({});
  const [anyPackHasColoredDots, setAnyPackHasColoredDots] = useState<boolean>(false);
  // State for colored dots modal
  const [editingColorPackId, setEditingColorPackId] = useState<string | null>(null);
  const [generatedDots, setGeneratedDots] = useState<string[] | null>(null);
  // State for show more modal
  const [showMorePackId, setShowMorePackId] = useState<string | null>(null);
  const [showMoreModalVisible, setShowMoreModalVisible] = useState<boolean>(false);
  
  const insets = useSafeAreaInsets();
  const [fabBottom, setFabBottom] = useState(16 + insets.bottom);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const keyboardHeight = e.endCoordinates?.height ?? 0;
      setFabBottom(keyboardHeight + insets.bottom);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setFabBottom(insets.bottom);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  // Load colored dots for all packs
  useEffect(() => {
    const loadColoredDots = async () => {
      if (!packsQ.data || !db) {
        setAnyPackHasColoredDots(false);
        setPackColoredDots({});
        return;
      }
      
      const dotsMap: PackColoredDots = {};
      let hasAny = false;
      
      for (const pack of packsQ.data) {
        if (pack.id) {
          const assignment = await coloredDotsRepo(db).getAssignmentByPackId(pack.id);
          if (assignment && assignment.dotIds) {
            dotsMap[pack.id] = assignment.dotIds;
            hasAny = true;
          }
        }
      }
      
      setPackColoredDots(dotsMap);
      setAnyPackHasColoredDots(hasAny);
    };

    loadColoredDots();
  }, [packsQ.data, db]);

  // Generate dots for color modal
  const generateDotsForPack = useCallback(async () => {
    if (!db || !id) return;
    const combo = await coloredDotsRepo(db).generateUniqueCombinationForProduct(id);
    setGeneratedDots(combo);
  }, [db, id, coloredDots, coloredDotsEnabled]);

  // Regenerate dots when modal opens and colors change
  useEffect(() => {
    if (editingColorPackId && coloredDots) {
      generateDotsForPack();
    }
  }, [editingColorPackId, coloredDots, generateDotsForPack]);

  // Save all changes to the "changes" state before submitting
  const saveChanges = (packId: string, changesForPack: { unitsRemaining: number | null; expiry: string | null }) => {
    // Check if there are actual changes, if not, remove from changes state
    for (const key in changesForPack) {
      if (changesForPack[key as keyof typeof changesForPack] === null) {
        // No change for this field
        continue;
      }
      const pack = packsQ.data?.find(p => p.id === packId);
      if (pack) {
        if (key === 'unitsRemaining' && changesForPack.unitsRemaining === pack.unitsRemaining) {
          changesForPack.unitsRemaining = null;
        }
        if (key === 'expiry' && changesForPack.expiry === pack.expiry) {
          changesForPack.expiry = null;
        }
      }
    }

    // If no actual changes, remove from state
    if (Object.values(changesForPack).every(value => value === null)) {
      const updatedChanges = { ...changes };
      delete updatedChanges[packId];
      setChanges(updatedChanges);
      return;
    }

    // Otherwise,
    setChanges(prev => ({
      ...prev,
      [packId]: {
        ...prev[packId],
        ...changesForPack,
      },
    }));
  }

  const submitChanges = async () => {
    if (!packsQ.data) return;

    saveChangesQ.mutate(changes);
    setChanges({});
    router.back();
  }

  // Initialize pack units when data loads
  if (packsQ.data && Object.keys(packUnits).length === 0) {
    const initialUnits: Record<string, string> = {};
    const initialDates: Record<string, string> = {};
    packsQ.data.forEach(pack => {
      initialUnits[pack.id] = pack.unitsRemaining.toString();
      if (pack.expiry) {
        initialDates[pack.id] = pack.expiry;
      }
    });
    setPackUnits(initialUnits);
    setPackDates(initialDates);
  }

  const handleUnitsChange = (packId: string, value: string) => {
    setPackUnits(prev => ({ ...prev, [packId]: value }));
    // Only save changes if value is not empty
    if (value !== '') {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        saveChanges(packId, { unitsRemaining: numValue, expiry: null });
      }
    } else {
      // Clear changes for this pack when field is empty
      const updatedChanges = { ...changes };
      delete updatedChanges[packId];
      setChanges(updatedChanges);
    }
  };

  const handleOpenDateModal = (packId: string) => {
    const currentDate = packDates[packId] ? new Date(packDates[packId]) : undefined;
    setSelectedDate(currentDate);
    setEditingDatePackId(packId);
  };

  const handleSaveDate = () => {
    if (editingDatePackId && selectedDate) {
      const dateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      setPackDates(prev => ({ ...prev, [editingDatePackId]: dateString }));
      saveChanges(editingDatePackId, { unitsRemaining: null, expiry: dateString });
    }
    setEditingDatePackId(null);
  };

  const handleOpenColorModal = async (packId: string) => {
    setEditingColorPackId(packId);
    await generateDotsForPack();
  };

  const handleSaveColoredDots = async () => {
    if (!editingColorPackId || !generatedDots || !db) return;
    
    await coloredDotsRepo(db).setAssignmentForPack(editingColorPackId, generatedDots);
    
    // Update local state
    setPackColoredDots(prev => ({
      ...prev,
      [editingColorPackId]: generatedDots
    }));
    setAnyPackHasColoredDots(true);
    
    setEditingColorPackId(null);
    setGeneratedDots(null);
  };

  const handleShowMore = (packId: string) => {
    const pack = packsQ.data?.find(p => p.id === packId);
    setShowMorePackId(packId);
    setShowMoreModalVisible(true);
  };

  const isGS1 = productIdentifiersQ.data?.some(pi => pi.type === "GTIN") ?? false;
  const hasSerialNumbers = packsQ.data?.some(pack => pack.ais && pack.ais["21"]) ?? false;

  // Get identifier display value for a pack
  const getPackIdentifier = (pack: any) => {
    if (hasSerialNumbers) {
      return pack.ais ? pack.ais["21"] : "...";
    }
    return productIdentifiersQ.data ? productIdentifiersQ.data[0]?.value.substring(0, 20) || '-' : "...";
  };

  return (
    <AppWrapper>
      <View style={{ marginBottom: 16 }}>
        <Button 
          mode="text" 
          onPress={() => router.back()} 
          icon="arrow-left"
          style={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        {(productQ.isPending || packsQ.isPending) ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Loading packs...</Text>
          </View>
        ) : productQ.data && packsQ.data && (
          <>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>Edit {productQ.data.name}</Text>

            {packsQ.data.length > 0 ? (
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
              >
                {packsQ.data.map((pack, index) => {
                  const isDateEditable = productQ.data?.canHaveExpiry && pack.dateSetManually;
                  const showColoredDots = anyPackHasColoredDots || productQ.data?.useColoredDots;
                  
                  return (
                    <Card key={pack.id} style={styles.packCard}>
                      <Card.Content style={styles.packCardContent}>
                        {/* Pack header with identifier */}
                        <View style={styles.packHeader}>
                          <View style={styles.packTitleRow}>
                            <Icon source="package-variant" size={20} color={theme.colors.primary} />
                            <Text variant="titleMedium" style={{ marginLeft: 8 }}>
                              Pack {index + 1}
                            </Text>
                          </View>
                          <Text 
                            variant="bodySmall" 
                            style={{ color: theme.colors.onSurfaceVariant }}
                            numberOfLines={1}
                          >
                            {hasSerialNumbers ? 'Serial: ' : 'Code: '}{getPackIdentifier(pack)}
                          </Text>
                        </View>

                        <Divider />

                        {/* Units field - always editable */}
                        <FieldRow label="Units left">
                          <EditableUnitsInput
                            value={packUnits[pack.id] ?? pack.unitsRemaining.toString()}
                            onChangeText={(text) => handleUnitsChange(pack.id, text)}
                            maxValue={productQ.data?.unitsPerPackDefault}
                          />
                          {productQ.data?.unitsPerPackDefault && (
                            <Text 
                              variant="bodySmall" 
                              style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}
                            >
                              / {productQ.data.unitsPerPackDefault}
                            </Text>
                          )}
                        </FieldRow>

                        {/* Expiry field - conditionally editable */}
                        <FieldRow label="Expiry">
                          {isDateEditable ? (
                            <EditableDateButton
                              value={packDates[pack.id] || pack.expiry}
                              onPress={() => handleOpenDateModal(pack.id)}
                            />
                          ) : (
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                              {pack.expiry ? new Date(pack.expiry).toLocaleDateString('de-DE') : 'N/A'}
                            </Text>
                          )}
                        </FieldRow>

                        {/* Colored dots field - conditionally shown */}
                        {showColoredDots && (
                          <FieldRow label="Colors">
                            {productQ.data?.useColoredDots && coloredDotsEnabled ? (
                              packColoredDots[pack.id] && packColoredDots[pack.id].length > 0 ? (
                                <View style={styles.colorDotsRow}>
                                  {packColoredDots[pack.id].map((dotId, dotIndex) => (
                                    <ColoredDot key={dotIndex} dotId={dotId} size={20} crossInactive={false} />
                                  ))}
                                </View>
                              ) : (
                                <TouchableOpacity 
                                  style={[
                                    styles.addColorButton,
                                    { 
                                      borderColor: theme.colors.primary,
                                      backgroundColor: theme.colors.surfaceVariant,
                                    }
                                  ]}
                                  onPress={() => handleOpenColorModal(pack.id)}
                                >
                                  <Icon source="plus" size={16} color={theme.colors.primary} />
                                  <Text 
                                    variant="labelSmall" 
                                    style={{ color: theme.colors.primary, marginLeft: 4 }}
                                  >
                                    Assign Colors
                                  </Text>
                                </TouchableOpacity>
                              )
                            ) : (
                              packColoredDots[pack.id] && packColoredDots[pack.id].length > 0 ? (
                                <View style={styles.colorDotsRow}>
                                  {packColoredDots[pack.id].map((dotId, dotIndex) => (
                                    <ColoredDot key={dotIndex} dotId={dotId} size={20} />
                                  ))}
                                </View>
                              ) : (
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                  —
                                </Text>
                              )
                            )}
                          </FieldRow>
                        )}

                        {/* Show AIs conditionally */}
                        {isGS1 && pack.ais && Object.keys(pack.ais).length > 0 && (
                          <View>
                            <Button onPress={() => handleShowMore(pack.id)}>Show more</Button>
                          </View>
                        )}
                      </Card.Content>
                    </Card>
                  );
                })}
              </ScrollView>
            ) : (
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyCardContent}>
                  <Icon source="package-variant-closed-remove" size={48} color={theme.colors.secondary} />
                  <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.secondary }}>
                    No packs available
                  </Text>
                </Card.Content>
              </Card>
            )}
          </>
        )}
      </View>

      <Portal>
        <Modal
          visible={editingDatePackId !== null}
          onDismiss={() => setEditingDatePackId(null)}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <Text variant="headlineSmall" style={{ marginBottom: 16 }}>Select Expiry Date</Text>
          <DatePickerInput
            locale="de"
            value={selectedDate}
            onChange={setSelectedDate}
            inputMode="start"
            mode="outlined"
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button 
              mode="outlined" 
              onPress={() => setEditingDatePackId(null)}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSaveDate}
              style={{ flex: 1 }}
            >
              Save
            </Button>
          </View>
        </Modal>

        <Modal
          visible={editingColorPackId !== null}
          onDismiss={() => {
            setEditingColorPackId(null);
            setGeneratedDots(null);
          }}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <Text variant="headlineSmall" style={{ marginBottom: 16 }}>Assign Colored Dots</Text>
          
          {coloredDots && coloredDots.length > 0 ? (
            <>
              <Card style={{ marginBottom: 16 }}>
                <Card.Content>
                  <Text variant="labelLarge" style={{ marginBottom: 8 }}>Available Colors</Text>
                  <Text variant="bodySmall" style={{ marginBottom: 8 }}>
                    Please check that you have these colors on your sticker sheets. You can toggle them by pressing a color.
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {coloredDots.map((dot) => (
                      <ColoredDot key={dot.id} dotId={dot.id} pressToToggle />
                    ))}
                  </View>
                </Card.Content>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <Card.Content>
                  <Text variant="labelLarge" style={{ marginBottom: 8 }}>Label your pack as such:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {generatedDots && generatedDots.length > 0 ? (
                      generatedDots.map((dotId, index) => (
                        <ColoredDot key={index} dotId={dotId} size={32} />
                      ))
                    ) : (
                      <Text variant="bodySmall">Generating combination...</Text>
                    )}
                  </View>
                </Card.Content>
              </Card>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setEditingColorPackId(null);
                    setGeneratedDots(null);
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={handleSaveColoredDots}
                  style={{ flex: 1 }}
                  disabled={!generatedDots || generatedDots.length === 0}
                >
                  Save
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                No colored dots are configured. Please add colored dots in settings first.
              </Text>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setEditingColorPackId(null);
                  setGeneratedDots(null);
                }}
              >
                Close
              </Button>
            </>
          )}
        </Modal>

        <Modal
          visible={showMoreModalVisible}
          onDismiss={() => setShowMoreModalVisible(false)}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <Card>
            <Card.Title title="Pack Identifiers" />
            <Card.Content>
              {Object.entries(packsQ.data?.find(p => p.id === showMorePackId)?.ais || {}).map(([ai, value]) => {
                const spec = GS1_AI_SPECS[ai];
                const name = spec?.name || `AI ${ai}`;
                return (
                  <View key={ai} style={{borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant, paddingBottom: 8, marginBottom: 8}}>
                    <Text variant="labelSmall" style={{ color: theme.colors.secondary, marginBottom: 4 }}>
                      {name} ({ai})
                    </Text>
                    <Pressable onPress={() => {Clipboard.setString(value)}} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                        {value}
                      </Text>
                      <Icon source="content-copy" size={12} color={theme.colors.primary} />
                    </Pressable>
                  </View>
                ) 
              })}
            </Card.Content>
          </Card>
        </Modal>
      </Portal>


      {changes && Object.keys(changes).length > 0 && (
        <FAB
          icon="content-save"
          style={{position: 'absolute', right: 16, bottom: fabBottom}}
          size="large"
          onPress={submitChanges}
        />
      )}
    </AppWrapper>
  );
}

const styles = StyleSheet.create({
  packCard: {
    marginHorizontal: 2,
    elevation: 1,
  },
  packCardContent: {
    gap: 12,
  },
  packHeader: {
    gap: 4,
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  fieldValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editableInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 40,
    minWidth: 70,
    textAlign: 'center',
    borderWidth: 2,
  },
  editableDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 40,
    minWidth: 120,
    borderWidth: 2,
    gap: 8,
  },
  colorDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addColorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptyCard: {
    marginHorizontal: 2,
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  modalContainer: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
});