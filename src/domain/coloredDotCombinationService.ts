export function canonicalDotCombinationKey(dotIds: string[]) {
  return [...dotIds].sort().join(",");
}

function shuffleInPlace<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function combinationFromMask(dotIds: string[], mask: number) {
  const result: string[] = [];
  for (let index = 0; index < dotIds.length; index++) {
    if (mask & (1 << index)) {
      result.push(dotIds[index]);
    }
  }

  return result;
}

export function generateUniqueDotCombination(params: {
  dotIds: string[];
  usedKeys: Set<string>;
}): string[] | null {
  const dotIds = [...params.dotIds].sort();
  if (dotIds.length === 0) {
    return [];
  }

  if (dotIds.length < 31) {
    const totalCombinations = (1 << dotIds.length) - 1;
    const availableCount = totalCombinations - params.usedKeys.size;
    if (availableCount <= 0) {
      return null;
    }

    const maxRandomAttempts = Math.min(availableCount * 2, 128);
    for (let attempt = 0; attempt < maxRandomAttempts; attempt++) {
      const mask = 1 + Math.floor(Math.random() * totalCombinations);
      const combination = combinationFromMask(dotIds, mask);
      if (!params.usedKeys.has(canonicalDotCombinationKey(combination))) {
        return shuffleInPlace(combination);
      }
    }

    const offset = Math.floor(Math.random() * totalCombinations);
    for (let step = 0; step < totalCombinations; step++) {
      const mask = 1 + ((offset + step) % totalCombinations);
      const combination = combinationFromMask(dotIds, mask);
      if (!params.usedKeys.has(canonicalDotCombinationKey(combination))) {
        return shuffleInPlace(combination);
      }
    }

    return null;
  }

  const shuffledDots = shuffleInPlace([...dotIds]);
  for (let size = 1; size <= shuffledDots.length; size++) {
    const combination = shuffledDots.slice(0, size);
    if (!params.usedKeys.has(canonicalDotCombinationKey(combination))) {
      return shuffleInPlace(combination);
    }
  }

  return null;
}
