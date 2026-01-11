import AppWrapper from "@/components/AppWrapper";
import { usePacks } from "@/src/data/hooks/usePacks";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useProductIdentifiers } from "@/src/data/hooks/useProductIdentifiers";
import { useSaveManualPacksChanges } from "@/src/data/hooks/useSaveManualPacksChanges";
import { ChangesFormat } from "@/src/data/packsRepo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Button, Card, DataTable, FAB, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { DatePickerInput } from 'react-native-paper-dates';
import { useSafeAreaInsets } from "react-native-safe-area-context";

const columnFlex = {
  code: 1.4,
  units: 1,
  expiry: 1.2,
};

// Custom editable cell component that matches DataTable.Cell styling
function EditableDataTableCell({ value, onChangeText, maxValue, style }: { value: string; onChangeText: (text: string) => void; maxValue?: number; style?: any }) {
  const theme = useTheme();
  
  const handleTextChange = (text: string) => {
    // Allow empty string for easier editing
    if (text === '') {
      onChangeText(text);
      return;
    }
    
    // Remove all whitespaces and non-numeric characters
    const cleanedText = text.replace(/\s/g, '').replace(/[^0-9]/g, '');
    
    // If nothing left after cleaning, keep empty
    if (cleanedText === '') {
      onChangeText('');
      return;
    }
    
    // Parse as integer
    const numValue = parseInt(cleanedText, 10);
    
    // Validate against constraints
    if (isNaN(numValue)) {
      return; // Don't update if not a valid number
    }
    
    if (numValue < 0) {
      return; // Don't allow negative numbers
    }
    
    if (maxValue !== undefined && numValue > maxValue) {
      onChangeText(maxValue.toString()); // Don't allow values greater than max
      return;
    }
    
    // Update with valid integer value
    onChangeText(numValue.toString());
  };
  
  return (
    <DataTable.Cell style={[styles.tableCell, style]}>
      <TextInput
        value={value}
        onChangeText={handleTextChange}
        keyboardType="numeric"
        style={[
          styles.input,
          {
            color: theme.colors.onSurface,
            backgroundColor: theme.colors.surfaceVariant,
            marginRight: 12,
          }
        ]}
      />
    </DataTable.Cell>
  );
}

// Custom editable date picker cell component
function EditableDatePickerCell({ packId, value, onOpenModal, style }: { packId: string; value: string | null; onOpenModal: (packId: string) => void; style?: any }) {
  const theme = useTheme();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  return (
    <DataTable.Cell style={[styles.tableCell, style]}>
      <TouchableOpacity 
        style={[
          styles.dateInputButton,
          { backgroundColor: theme.colors.surfaceVariant }
        ]}
        onPress={() => onOpenModal(packId)}
      >
        <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>
          {formatDate(value)}
        </Text>
      </TouchableOpacity>
    </DataTable.Cell>
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

  // State to manage pack units
  const [packUnits, setPackUnits] = useState<Record<string, string>>({});
  // State to manage pack dates
  const [packDates, setPackDates] = useState<Record<string, string>>({});
  // State for modal
  const [editingDatePackId, setEditingDatePackId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
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

  const isGS1 = productIdentifiersQ.data?.some(pi => pi.type === "GTIN") ?? false;

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
      <View style={{ flex: 1, gap: 16 }}>
        {productQ.data && packsQ.data && (
          <>
            <Text variant="titleLarge">Edit {productQ.data.name}</Text>

            <Card>
                {packsQ.data.length > 0 && (
                  <Card.Title title="Manage Packs" />
                )}
                {packsQ.data.length > 0 ? (
                  <Card.Content>
                    <DataTable>
                      <DataTable.Header>
                        {packsQ.data.some(pack => pack.ais && pack.ais["21"]) ? (
                          <DataTable.Title style={{ flex: columnFlex.code }}>Serial</DataTable.Title>
                        ) : (
                          <DataTable.Title style={{ flex: columnFlex.code }}>Code</DataTable.Title>
                        )}
                        <DataTable.Title style={{ flex: columnFlex.units }}>Units left</DataTable.Title>
                        <DataTable.Title style={{ flex: columnFlex.expiry }}>Expiry</DataTable.Title>
                      </DataTable.Header>
                      {packsQ.data.map((pack) => (
                        <DataTable.Row key={pack.id}>
                          {packsQ.data.some(pack => pack.ais && pack.ais["21"]) ? (
                            <DataTable.Cell style={{ flex: columnFlex.code }}>{pack.ais ? pack.ais["21"] : "..."}</DataTable.Cell>
                          ) : (
                            <DataTable.Cell style={{ flex: columnFlex.code }}>{productIdentifiersQ.data ? productIdentifiersQ.data[0]?.value.substring(0, 20) || '-' : "..."}</DataTable.Cell>
                          )}

                          <EditableDataTableCell
                            value={packUnits[pack.id] ?? pack.unitsRemaining.toString()}
                          // or:
                            // value={packUnits[pack.id] !== undefined ? packUnits[pack.id] : pack.unitsRemaining.toString()}
                            onChangeText={(text) => handleUnitsChange(pack.id, text)}
                            maxValue={productQ.data?.unitsPerPackDefault}
                            style={{ flex: columnFlex.units }}
                          />
                          {/* Consider a date to be editable when product.canHaveExpiry is true && pack.dateSetManually is true */}
                          {productQ.data?.canHaveExpiry && pack.dateSetManually ? (
                            <EditableDatePickerCell
                              packId={pack.id}
                              value={packDates[pack.id] || pack.expiry}
                              onOpenModal={handleOpenDateModal}
                              style={{ flex: columnFlex.expiry }}
                            />
                          ) : (
                            <DataTable.Cell style={{ flex: columnFlex.expiry }}>
                              {pack.expiry ? new Date(pack.expiry).toLocaleDateString() : 'N/A'}
                            </DataTable.Cell>
                          )}
                        </DataTable.Row>
                      ))}
                    </DataTable>
                  </Card.Content>
                ) : (
                  <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Icon source="package-variant-closed-remove" size={48} color={theme.colors.secondary} />
                    <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>
                      No packs available
                    </Text>
                  </Card.Content>
                )}
            </Card>
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
  tableCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    fontSize: 14,
    minHeight: 40,
  },
  dateInputButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 40,
  },
  modalContainer: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
});