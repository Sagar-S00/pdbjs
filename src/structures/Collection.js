export class Collection extends Map {
  find(fn) {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return val;
    }
    return undefined;
  }

  filter(fn) {
    const results = new Collection();
    for (const [key, val] of this) {
      if (fn(val, key, this)) results.set(key, val);
    }
    return results;
  }

  map(fn) {
    const results = [];
    for (const [key, val] of this) {
      results.push(fn(val, key, this));
    }
    return results;
  }
}
