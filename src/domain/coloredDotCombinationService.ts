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

function randomCombinationOfSize(dotIds: string[], size: number) {
  return shuffleInPlace([...dotIds]).slice(0, size).sort();
}

function forEachCombinationOfSize(
  dotIds: string[],
  size: number,
  visit: (combination: string[]) => boolean,
) {
  const walk = (start: number, path: string[]): boolean => {
    if (path.length === size) {
      return visit([...path]);
    }

    for (let index = start; index <= dotIds.length - (size - path.length); index++) {
      path.push(dotIds[index]);
      if (walk(index + 1, path)) {
        return true;
      }
      path.pop();
    }

    return false;
  };

  return walk(0, []);
}

export function generateUniqueDotCombination(params: {
  dotIds: string[];
  usedKeys: Set<string>;
}): string[] | null {
  const dotIds = [...params.dotIds].sort();
  if (dotIds.length === 0) {
    return [];
  }

  for (let size = 1; size <= dotIds.length; size++) {
    const maxRandomAttempts = Math.min(dotIds.length * dotIds.length, 128);
    for (let attempt = 0; attempt < maxRandomAttempts; attempt++) {
      const combination = randomCombinationOfSize(dotIds, size);
      if (!params.usedKeys.has(canonicalDotCombinationKey(combination))) {
        return shuffleInPlace(combination);
      }
    }

    let found: string[] | null = null;
    forEachCombinationOfSize(dotIds, size, (combination) => {
      if (!params.usedKeys.has(canonicalDotCombinationKey(combination))) {
        found = combination;
        return true;
      }

      return false;
    });

    if (found) {
      return shuffleInPlace(found);
    }
  }

  return null;
}
