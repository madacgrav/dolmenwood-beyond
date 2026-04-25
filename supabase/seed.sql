-- Seed data for catalog_items
-- Generated from extracted-data/equipment.json
-- Run after migrations via: supabase db reset

-- ============================================================
-- WEAPONS (20 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, weapon_damage_dice, qualities, size) values
  ('Battle axe',        'weapon', 100,  7,    '1d8',  array['Melee'],                                                  'Medium'),
  ('Club',              'weapon',  20,  3,    '1d4',  array['Melee'],                                                  'Medium'),
  ('Crossbow',          'weapon',  50, 30,    '1d8',  array['Armour Piercing','Missile (80/160/240)','Reload','Two-handed'], 'Medium'),
  ('Dagger',            'weapon',  10,  3,    '1d4',  array['Melee','Missile (10/20/30)'],                             'Small'),
  ('Hand axe',          'weapon',  20,  4,    '1d6',  array['Melee','Missile (10/20/30)'],                             'Small'),
  ('Holy water vial',   'weapon',  10, 25,    '1d8',  array['Missile (10/30/50)','Splash'],                            'Small'),
  ('Lance',             'weapon', 100,  5,    '1d6',  array['Brace','Charge','Melee','Reach'],                         'Large'),
  ('Longbow',           'weapon',  40, 40,    '1d6',  array['Missile (70/140/210)','Two-handed'],                      'Large'),
  ('Longsword',         'weapon',  30, 10,    '1d8',  array['Melee'],                                                  'Medium'),
  ('Mace',              'weapon',  40,  5,    '1d6',  array['Melee'],                                                  'Medium'),
  ('Oil flask (burning)','weapon', 10,  1,    '1d8',  array['Missile (10/30/50)','Splash'],                            'Small'),
  ('Polearm',           'weapon', 140,  7,    '1d10', array['Brace','Melee','Reach','Two-handed'],                     'Large'),
  ('Shortbow',          'weapon',  20, 25,    '1d6',  array['Missile (50/100/150)','Two-handed'],                      'Medium'),
  ('Shortsword',        'weapon',  20,  7,    '1d6',  array['Melee'],                                                  'Medium'),
  ('Sling',             'weapon',  10,  2,    '1d4',  array['Missile (40/80/160)'],                                    'Small'),
  ('Spear',             'weapon',  30,  3,    '1d6',  array['Brace','Melee','Missile (20/40/60)'],                     'Medium'),
  ('Staff',             'weapon',  40,  2,    '1d4',  array['Melee','Two-handed'],                                     'Medium'),
  ('Torch (flaming)',   'weapon',  10,  null, '1d4',  array['Melee'],                                                  'Medium'),
  ('Two-handed sword',  'weapon', 140, 15,    '1d10', array['Melee','Two-handed'],                                     'Large'),
  ('War hammer',        'weapon',  40,  5,    '1d6',  array['Melee'],                                                  'Medium');

-- ============================================================
-- ARMOUR (8 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, armor_ac_bonus, size, notes) values
  ('Unarmoured', 'armor',   0,    0,  10, 'None',  null),
  ('Leather',    'armor', 200,   20,  12, 'Light', null),
  ('Bark',       'armor', 300,   30,  13, 'Light', 'Usually only made and worn by mosslings'),
  ('Chainmail',  'armor', 400,   40,  14, 'Medium',null),
  ('Pinecone',   'armor', 400,   50,  15, 'Medium','Usually only made and worn by mosslings'),
  ('Plate mail', 'armor', 500,   60,  16, 'Heavy', null),
  ('Full plate', 'armor', 700, 1000,  17, 'Heavy', null),
  ('Shield',     'armor', 100,   10,   1, 'None',  'AC bonus');

-- ============================================================
-- AMMUNITION (3 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Arrows (quiver of 20)',  'ammo', 20,  5,    null),
  ('Quarrels (case of 20)',  'ammo', 20, 10,    null),
  ('Sling stones',           'ammo',  1,  0,    'Per stone, free');

-- ============================================================
-- ADVENTURING GEAR — Containers (12 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Backpack',              'gear',  50,   4,  'Capacity: 400 coins'),
  ('Barrel',                'gear',  70,   1,  'Capacity: 320 pints'),
  ('Belt pouch',            'gear',  10,   1,  'Capacity: 50 coins'),
  ('Bucket',                'gear',  20,   1,  'Capacity: 40 pints'),
  ('Casket (iron, large)',  'gear', 400,  30,  'Capacity: 800 coins'),
  ('Casket (iron, small)',  'gear', 100,  10,  'Capacity: 250 coins'),
  ('Chest (wooden, large)', 'gear', 200,   5,  'Capacity: 1000 coins'),
  ('Chest (wooden, small)', 'gear',  50,   1,  'Capacity: 300 coins'),
  ('Sack',                  'gear',   5,   1,  'Capacity: 600 coins'),
  ('Scroll case',           'gear',   5,   1,  'Capacity: 1 scroll'),
  ('Vial (glass)',          'gear',   1,   1,  'Capacity: 1/2 pint'),
  ('Waterskin',             'gear',  50,   1,  'Weight when full; capacity: 2 pints');

-- ============================================================
-- ADVENTURING GEAR — Light (6 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Candles (10)',        'gear', 20,  1, '2 coins each'),
  ('Lantern (hooded)',    'gear', 20,  5, null),
  ('Lantern (bullseye)',  'gear', 20, 10, null),
  ('Oil (flask)',         'gear', 10,  1, null),
  ('Tinder box',         'gear', 10,  3, null),
  ('Torches (3)',         'gear', 30,  1, '10 coins each');

-- ============================================================
-- ADVENTURING GEAR — Camping & Travel (7 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Bedroll',                    'gear', 70,   2, null),
  ('Cooking pots',               'gear', 100,  3, null),
  ('Firewood (bundle, 8 hours)', 'gear', 200,  1, null),
  ('Fishing rod and tackle',     'gear',  50,  4, null),
  ('Rations (preserved, 1 day)', 'gear',  20,  2, null),
  ('Rations (fresh, 1 day)',     'gear',  20,  1, null),
  ('Tent',                       'gear',  20, 20, null);

-- ============================================================
-- ADVENTURING GEAR — Holy Items (4 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Holy symbol (gold)',   'gear', 20, 100, null),
  ('Holy symbol (silver)', 'gear', 20,  25, '+1 bonus to turning attempt roll'),
  ('Holy symbol (wooden)', 'gear', 10,   5, null),
  ('Holy water (vial)',    'gear', 10,  25, null);

-- ============================================================
-- ADVENTURING GEAR — Tools (31 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Bell (miniature)',              'gear',   1,   1, null),
  ('Block and tackle',              'gear',  50,   5, null),
  ('Caltrops (bag of 20)',          'gear',  20,   1, '1 coin each'),
  ('Chain (10ft)',                  'gear', 100,  30, null),
  ('Chalk (10 sticks)',             'gear',  10,   1, '1 coin each'),
  ('Chisel',                        'gear',  20,   2, null),
  ('Crowbar',                       'gear',  50,  10, null),
  ('Grappling hook',                'gear',  40,  20, null),
  ('Hammer (small)',                'gear',  30,   2, null),
  ('Hammer (sledgehammer)',         'gear', 100,   5, null),
  ('Ink (vial)',                    'gear',   5,   1, null),
  ('Iron spikes (12)',              'gear',  60,   1, '5 coins each'),
  ('Lock',                          'gear',  10,  20, null),
  ('Magnifying glass',              'gear',   5,   3, null),
  ('Manacles',                      'gear',  60,  15, null),
  ('Marbles (bag of 20)',           'gear',  20,   1, '1 coin each'),
  ('Mining pick',                   'gear', 100,   3, null),
  ('Mirror (small)',                'gear',  50,   5, null),
  ('Musical instrument (stringed)', 'gear',  50,  20, null),
  ('Musical instrument (wind)',     'gear',  20,   5, null),
  ('Paper or parchment (2 sheets)', 'gear',   0,   1, null),
  ('Pole (10ft long, wooden)',      'gear',  70,   1, null),
  ('Quill',                         'gear',   1,   1, null),
  ('Rope (50ft)',                   'gear', 100,   1, null),
  ('Rope ladder (25ft)',            'gear', 200,   5, null),
  ('Saw',                           'gear',  20,   1, null),
  ('Shovel',                        'gear',  50,   2, null),
  ('Spell book (blank)',            'gear',  50, 100, 'Holds up to 3 spells'),
  ('Thieves'' tools',               'gear',  10,  25, null),
  ('Twine (100ft ball)',            'gear',  10,   1, null),
  ('Whistle',                       'gear',   1,   1, null);

-- ============================================================
-- ADVENTURING GEAR — Clothing (6 items)
-- ============================================================
insert into public.catalog_items (name, item_type, weight, cost_gp, notes) values
  ('Clothes, common',     'gear', 30,   1, null),
  ('Clothes, extravagant','gear', 60, 100, null),
  ('Clothes, fine',       'gear', 40,  20, null),
  ('Habit, friar''s',     'gear', 30,   2, null),
  ('Robes, ritual',       'gear', 30,  10, null),
  ('Winter cloak',        'gear', 20,   2, null);
