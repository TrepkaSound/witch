import { describe, expect, it } from "vitest";
import { MUSHROOM_KINDS, addIngredient, collectMushroom, depositMushrooms, newCauldronInventory, newCauldronStock, recipeKey, tutorialTrip, type Recipe } from "./cauldron";

describe("commutative mushroom recipes", () => {
  it("has one recipe for every unordered three of its mushrooms, including repeats", () => {
    const keys = new Set<string>();
    for (const a of MUSHROOM_KINDS) for (const b of MUSHROOM_KINDS) for (const c of MUSHROOM_KINDS) {
      const key = recipeKey([a, b, c]);
      keys.add(key);
      expect(recipeKey([c, a, b])).toBe(key);
      expect(recipeKey([b, c, a])).toBe(key);
      expect(recipeKey([b, a, c])).toBe(key);
    }
    const n = MUSHROOM_KINDS.length;
    expect(keys.size).toBe(n * (n + 1) * (n + 2) / 6); // (56 of 6 kinds)
  });

  it.each<[Recipe, string]>([
    [["A", "A", "A"], "superhot"], [["B", "A", "A"], "orbit"],
    [["B", "A", "B"], "drift"], [["B", "B", "B"], "mirrorFloor"],
  ])("retains Ed's tutorial mapping for %j", (recipe, trip) => {
    expect(tutorialTrip(recipe)).toBe(trip);
  });

  it("does not invent assignments for biome recipes", () => {
    expect(tutorialTrip(["A", "north", "A"])).toBeUndefined();
  });
});

describe("hidden bag and kitchen baskets", () => {
  it("collects without a capacity limit and transfers each kind without loss", () => {
    const inventory = newCauldronInventory();
    for (const kind of MUSHROOM_KINDS) collectMushroom(inventory, kind);
    for (let i = 0; i < 10000; i++) collectMushroom(inventory, "A");
    depositMushrooms(inventory);
    for (const kind of MUSHROOM_KINDS) {
      expect(inventory.bag[kind]).toBe(0);
      expect(inventory.baskets[kind]).toBe(kind === "A" ? 10001 : 1);
    }
    depositMushrooms(inventory);
    expect(inventory.baskets.A).toBe(10001);
    collectMushroom(inventory, "A");
    depositMushrooms(inventory);
    expect(inventory.baskets.A).toBe(10002);
  });

  it("uses one per press and brews on exactly the third, then starts a fresh brew", () => {
    const inventory = newCauldronInventory();
    inventory.baskets.A = 3;
    inventory.baskets.B = 1;
    expect(addIngredient(inventory, "A")).toBeNull();
    expect(addIngredient(inventory, "north")).toBeNull();
    expect(inventory.ingredients).toEqual(["A"]);
    expect(addIngredient(inventory, "B")).toBeNull();
    const recipe = addIngredient(inventory, "A");
    expect(recipe).toEqual(["A", "B", "A"]);
    expect(tutorialTrip(recipe!)).toBe("orbit");
    expect(inventory.ingredients).toEqual([]);
    expect(inventory.baskets.A).toBe(1);
    expect(addIngredient(inventory, "A")).toBeNull();
    expect(recipe).toEqual(["A", "B", "A"]);
  });

  it("keeps separately allocated witch inventories independent", () => {
    const a = newCauldronInventory(), b = newCauldronInventory();
    collectMushroom(a, "B");
    depositMushrooms(a);
    addIngredient(a, "B");
    expect(b).toEqual(newCauldronInventory());
  });

  it("keeps visitors' bags separate while sharing the host's baskets and partial pot", () => {
    const stock = newCauldronStock();
    const host = newCauldronInventory(stock), guest = newCauldronInventory(stock);
    collectMushroom(host, "B");
    collectMushroom(guest, "B");
    collectMushroom(guest, "B");
    depositMushrooms(host);
    expect(guest.bag.B).toBe(2);
    expect(guest.baskets.B).toBe(1);
    expect(addIngredient(host, "B")).toBeNull();
    expect(guest.ingredients).toEqual(["B"]);
    depositMushrooms(guest);
    expect(addIngredient(guest, "B")).toBeNull();
    expect(addIngredient(host, "B")).toEqual(["B", "B", "B"]);
    expect(stock.ingredients).toEqual([]);
    expect(guest.ingredients).toEqual([]);
    expect(stock.baskets.B).toBe(0);
    // Another treehouse does not share this stock.
    expect(newCauldronInventory().baskets.B).toBe(0);
  });

});
