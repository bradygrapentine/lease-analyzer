export function at<T>(arr: readonly T[], index: number): T {
  const v = arr[index];
  if (v === undefined) throw new Error(`expected element at index ${index}`);
  return v;
}

export function defined<T>(v: T | undefined | null, label = 'value'): T {
  if (v === undefined || v === null) throw new Error(`expected ${label} to be defined`);
  return v;
}
