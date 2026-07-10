/**
 * Cosmos DB document shapes, one interface per container. These are the
 * persistence-layer types — domain types stay in @dolmenwood/types and are
 * bridged by the mappers in lib/data/mappers/.
 */

/** Container `catalog_items`, partition key `/itemType`. */
export interface CatalogItemDoc {
  id: string;
  itemType: string;
  name: string;
  weight: number;
  costGp: number | null;
  costSp: number | null;
  costCp: number | null;
  weaponDamageDice: string | null;
  armorAcBonus: number | null;
  qualities: string[];
  size: string | null;
  notes: string | null;
}
