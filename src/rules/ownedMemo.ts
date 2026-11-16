// A memo keyed by an owner object (a music style, a compose def) and then a string (quality plan item d: docs/notes/module-state.md).
// For a memo whose result depends on its owner as well as the key's numbers: keyed by the string alone, a second night's style (or
// a second game's) with the same seed read the first's. Per owner at most `cap` entries, cleared when full; an owner no longer
// used is dropped with it (a WeakMap).
export function ownedMemo<V>(cap: number): (owner: object, key: string, make: () => V) => V {
  const by = new WeakMap<object, Map<string, V>>();
  return (owner, key, make) => {
    let m = by.get(owner);
    if (!m) by.set(owner, (m = new Map()));
    let v = m.get(key);
    if (v === undefined) { if (m.size > cap) m.clear(); m.set(key, (v = make())); }
    return v;
  };
}
