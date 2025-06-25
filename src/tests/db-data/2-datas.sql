-- Initialisation des données pour Innov Stocker
-- Date: 17 Mai 2025

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Table user
-- -----------------------------------------------------
INSERT INTO `user` (id, email, password, first_name, last_name, level, internal_level, internal, color, password_status, password_time, preferences, authorisation_overrides, permissions_expire_at, is_active, google_id, created_time, updated_time) VALUES 
(1, 'user.test1@example.com', '$2b$10$L0G.mEOfoi02sUuw6SlCC.pMDRcw2qRI01u..e5jrE4S4takXAHae', 'Admin', 'Test', 5, 1, 1, '#000000', 'ACTIVE', CURRENT_TIMESTAMP, '{"theme":"dark"}', NULL, NULL, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'user.test2@example.com', '$2b$10$L0G.mEOfoi02sUuw6SlCC.pMDRcw2qRI01u..e5jrE4S4takXAHae', 'User', 'Test', 3, 1, 1, '#123456', 'ACTIVE', CURRENT_TIMESTAMP, '{"theme":"light"}', NULL, NULL, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'expired.user@example.com', '$2b$10$KWc6fmG0ZMycrHCD/1jZr.X2PZFBlmXe1OkqgwAXu3DOdG4jZzzj2', 'Expired', 'User', 1, 1, 0, '#FF0000', 'EXPIRED', '2000-01-01 00:00:00', '{"theme":"expired"}', NULL, NULL, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table addresses
-- -----------------------------------------------------
INSERT INTO addresses (id, street_line1, street_line2, city, postal_code, state_province, country, notes, created_time, updated_time) VALUES
(1, '1 Rue de la Paix', NULL, 'Paris', '75001', 'Île-de-France', 'France', 'Adresse principale entreprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '10 Avenue des Champs-Élysées', 'Etage 3', 'Paris', '75008', 'Île-de-France', 'France', 'Fournisseur HighTech', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '25 Rue de la Liberté', NULL, 'Lyon', '69002', 'Auvergne-Rhône-Alpes', 'France', 'Fournisseur Office Supplies', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, '101 Boulevard Saint-Germain', NULL, 'Paris', '75006', 'Île-de-France', 'France', 'Client A - Facturation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, '102 Boulevard Saint-Michel', NULL, 'Paris', '75005', 'Île-de-France', 'France', 'Client A - Livraison Principale', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, '5 Place Bellecour', NULL, 'Lyon', '69002', 'Auvergne-Rhône-Alpes', 'France', 'Client B - Facturation & Livraison', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 'Z.I. Le Sud', 'Lot 15', 'Marseille', '13000', 'Provence-Alpes-Côte Azur', 'France', 'Entrepôt Principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 'Parc Activités du Nord', 'Bâtiment C', 'Lille', '59000', 'Hauts-de-France', 'France', 'Entrepôt Secondaire', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 'Centre Commercial Grand Ouest', 'Cellule 12', 'Nantes', '44000', 'Pays de la Loire', 'France', 'Boutique Ouest', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 'Rue Piétonne Centrale', 'Numéro 5B', 'Strasbourg', '67000', 'Grand Est', 'France', 'Boutique Est', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table currencies
-- -----------------------------------------------------
INSERT INTO currencies (id, code, name, symbol, exchange_rate_to_company_default, is_active, created_time, updated_time) VALUES
(1, 'EUR', 'Euro', '€', 1.000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'USD', 'Dollar Américain', '$', 0.920000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'GBP', 'Livre Sterling', '£', 1.170000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table company
-- -----------------------------------------------------
INSERT INTO company (id, name, trading_name, address_id, vat_number, siret_number, registration_number, email, phone_number, website, logo_url, default_currency_id, default_vat_rate_percentage, fiscal_year_start_month, fiscal_year_start_day, timezone, terms_and_conditions_default_purchase, terms_and_conditions_default_sale, bank_account_details_for_invoices, created_time, updated_time, deleted_time) VALUES
(1, 'Innov Stocker SARL', 'InnovStocker', 1, 'FR123456789', '12345678900012', 'RCS Paris B 123 456 789', 'contact@innovstocker.com', '0123456789', 'https://www.innovstocker.com', 'https://www.innovstocker.com/logo.png', 1, 20.00, 1, 1, 'Europe/Paris', 'Paiement à 30 jours.', 'Paiement à réception de facture.', 'Banque Innov - FR76 XXXX XXXX XXXX XXXX XXXX XXX - BIC INOVFRPP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table product_categories
-- -----------------------------------------------------
INSERT INTO product_categories (id, name, description, image_url, parent_category_id, created_time, updated_time, deleted_time) VALUES
(1, 'Électronique', 'Appareils électroniques et gadgets', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'Informatique', 'Matériel informatique et logiciels', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'Smartphones', 'Téléphones intelligents et accessoires', 'categories/smartphones.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(4, 'Ordinateurs Portables', 'Laptops pour usage pro et personnel', 'categories/laptops.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table customer_groups
-- -----------------------------------------------------
INSERT INTO customer_groups (id, name, description, discount_percentage, created_time, updated_time, deleted_time) VALUES
(1, 'Particuliers', 'Clients individuels', 0.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'Professionnels', 'Clients entreprises et professionnels', 5.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table suppliers
-- -----------------------------------------------------
INSERT INTO suppliers (id, name, contact_person_name, email, phone_number, website, vat_number, siret_number, default_currency_id, default_payment_terms_days, address_id, notes, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'Fournisseur HighTech Global', 'Sophie Martin', 'sophie.martin@hightechglobal.com', '0198765432', 'https://hightechglobal.com', 'FR987654321', '98765432100011', 1, 30, 2, 'Fournisseur principal pour électronique', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'Office Supplies Express', 'Paul Durand', 'paul.durand@officesupplies.com', '0456789123', 'https://officesupplies.com', 'FR123123123', '12312312300022', 1, 45, 3, 'Fournitures de bureau et consommables', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'Global Components Inc.', 'Alice Johnson', 'alice.j@globalcomponents.com', '0712345678', 'https://globalcomponents.com', 'FR456789012', '45678901200033', 1, 60, 2, 'Fournisseur de composants électroniques', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table customers
-- -----------------------------------------------------
INSERT INTO customers (id, first_name, last_name, company_name, email, phone_number, vat_number, siret_number, default_currency_id, default_payment_terms_days, credit_limit, customer_group_id, billing_address_id, default_shipping_address_id, notes, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'Jean', 'Dupont', NULL, 'jean.dupont@email.com', '0612345678', NULL, NULL, 1, 0, NULL, 1, 4, 5, 'Client fidèle', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, NULL, NULL, 'Entreprise ABC SARL', 'contact@entreprise-abc.com', '0123456789', 'FRABC123456', 'ABC12345600011', 1, 30, 5000.00, 2, 6, 6, 'Client professionnel régulier', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'Client', 'AvecDependances', 'ClientDependant SARL', 'client.dependant@example.com', '0700000000', NULL, NULL, 1, 15, 1000.00, 1, 4, 5, 'Client pour tests de dépendances', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table customer_shipping_addresses
-- -----------------------------------------------------
INSERT INTO customer_shipping_addresses (id, customer_id, address_id, address_label, is_default, created_time, updated_time) VALUES
(1, 1, 5, 'Domicile Principal', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 2, 6, 'Siège Social', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 3, 5, 'Adresse de livraison dépendante', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table warehouses
-- -----------------------------------------------------
INSERT INTO warehouses (id, name, code, address_id, manager_id, capacity_notes, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'Entrepôt Principal Paris Sud', 'WHS-PAR-SUD', 7, 1, 'Capacité 1000m2, 3 quais de chargement', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'Entrepôt Secondaire Lille Nord', 'WHS-LIL-NOR', 8, 2, 'Capacité 500m2, 1 quai', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table shops
-- -----------------------------------------------------
INSERT INTO shops (id, name, code, address_id, manager_id, opening_hours_notes, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'Boutique InnovStocker Nantes', 'SHOP-NTE', 9, 2, 'Ouvert du Lundi au Samedi 9h-19h', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'Boutique InnovStocker Strasbourg', 'SHOP-STR', 10, 2, 'Ouvert du Mardi au Samedi 10h-18h', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table products
-- -----------------------------------------------------
INSERT INTO products (id, sku, name, description, product_category_id, unit_of_measure, weight, weight_unit, length, width, height, dimension_unit, barcode_qr_code, min_stock_level, max_stock_level, default_purchase_price, default_selling_price_ht, default_vat_rate_percentage, status, is_composite_product, notes, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'PROD-SP-001', 'Smartphone Modèle X', 'Dernier smartphone haute performance', 3, 'pièce', 0.180, 'kg', 15.0, 7.0, 0.8, 'cm', '1234567890123', 10, 100, 350.0000, 499.9900, 20.00, 'active', 0, 'Version 128GB Noir', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'PROD-LP-001', 'Ordinateur Portable Pro 15"', 'Ordinateur portable puissant pour professionnels', 4, 'pièce', 1.800, 'kg', 35.0, 25.0, 1.8, 'cm', '9876543210987', 5, 50, 700.0000, 999.5000, 20.00, 'active', 0, 'SSD 512GB, 16GB RAM', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'PROD-ACC-001', 'Chargeur USB-C Rapide', 'Chargeur universel USB-C 65W', 1, 'pièce', 0.100, 'kg', 5.0, 5.0, 3.0, 'cm', '1122334455667', 20, 200, 10.0000, 24.9000, 20.00, 'active', 0, NULL, 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(4, 'PROD-KIT-001', 'Kit Télétravail Essentiel', 'Kit comprenant souris, clavier et webcam', 2, 'kit', 1.200, 'kg', NULL, NULL, NULL, NULL, 'KIT0000000001', 5, 30, 45.0000, 79.9000, 20.00, 'active', 1, 'Idéal pour le bureau à domicile', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(5, 'PROD-MSE-001', 'Souris Ergonomique Sans Fil', 'Souris confortable pour usage quotidien', 2, 'pièce', 0.085, 'kg', 10.5, 6.5, 3.8, 'cm', 'BAR-MSE-001', 15, 150, 8.0000, 19.9000, 20.00, 'active', 0, NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(6, 'PROD-KBD-001', 'Clavier Mécanique Compact', 'Clavier mécanique TKL, rétroéclairé', 2, 'pièce', 0.650, 'kg', 35.5, 12.8, 3.5, 'cm', 'BAR-KBD-001', 10, 80, 25.0000, 49.9000, 20.00, 'active', 0, 'Switches bleus', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(7, 'PROD-WBC-001', 'Webcam HD 1080p', 'Webcam avec microphone intégré pour visioconférences', 1, 'pièce', 0.120, 'kg', 8.0, 3.5, 5.0, 'cm', 'BAR-WBC-001', 20, 100, 12.0000, 29.9000, 20.00, 'active', 0, NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(8, 'PROD-CBL-001', 'Câble HDMI 2.1', 'Câble HDMI haute vitesse 2.1, 2 mètres', 1, 'pièce', 0.050, 'kg', 200.0, 1.0, 0.5, 'cm', 'CBL-HDMI-001', 50, 500, 5.0000, 12.5000, 20.00, 'active', 0, NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);
-- -----------------------------------------------------
-- Table product_images
-- -----------------------------------------------------
INSERT INTO product_images (id, product_id, image_url, alt_text, is_primary, created_time, updated_time) VALUES
(1, 1, 'products/prod_sp_001_main.jpg', 'Smartphone Modèle X vue de face', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, 'products/prod_sp_001_angle.jpg', 'Smartphone Modèle X vue angle', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 2, 'products/prod_lp_001_main.jpg', 'Ordinateur Portable Pro 15" ouvert', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table product_variants
-- -----------------------------------------------------
INSERT INTO product_variants (id, product_id, sku_variant, name_variant, attributes, purchase_price, selling_price_ht, barcode_qr_code_variant, min_stock_level_variant, max_stock_level_variant, weight_variant, image_id, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 1, 'PROD-SP-001-BLU', 'Smartphone Modèle X - Bleu', '{"couleur": "Bleu", "stockage": "128GB"}', 355.0000, 509.9900, '1234567890124', 5, 50, 0.180, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 1, 'PROD-SP-001-GRN', 'Smartphone Modèle X - Vert', '{"couleur": "Vert", "stockage": "256GB"}', 380.0000, 549.9900, '1234567890125', 3, 30, 0.182, NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table composite_product_items
-- -----------------------------------------------------
INSERT INTO composite_product_items (id, composite_product_id, component_product_id, component_variant_id, quantity, created_time, updated_time) VALUES
(1, 4, 5, NULL, 1.000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 4, 6, NULL, 1.000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 4, 7, NULL, 1.000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table product_suppliers
-- -----------------------------------------------------
INSERT INTO product_suppliers (id, product_id, product_variant_id, supplier_id, supplier_product_code, purchase_price, currency_id, is_default_supplier, created_time, updated_time) VALUES
(1, 1, NULL, 1, 'SUP001-SPX', 350.0000, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 2, NULL, 1, 'SUP001-LPP', 700.0000, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 3, NULL, 2, 'OS0023-CHGR', 9.5000, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table stock_movements
-- -----------------------------------------------------
INSERT INTO stock_movements (id, product_id, product_variant_id, warehouse_id, shop_id, movement_type, quantity, movement_date, unit_cost_at_movement, user_id, reference_document_type, reference_document_id, notes) VALUES
(1, 1, NULL, 1, NULL, 'inventory_adjustment_in', 50.000, '2025-01-10 10:00:00', 350.0000, 1, 'INITIAL_STOCK', NULL, 'Stock initial Smartphone Modèle X'),
(2, 2, NULL, 1, NULL, 'inventory_adjustment_in', 25.000, '2025-01-10 10:05:00', 700.0000, 1, 'INITIAL_STOCK', NULL, 'Stock initial Ordinateur Portable Pro 15"'),
(3, 1, 1, 2, NULL, 'inventory_adjustment_in', 20.000, '2025-01-10 10:10:00', 355.0000, 1, 'INITIAL_STOCK', NULL, 'Stock initial Smartphone Modèle X - Bleu'),
(4, 3, NULL, 1, NULL, 'inventory_adjustment_in', 100.000, '2025-01-10 10:15:00', 10.0000, 1, 'INITIAL_STOCK', NULL, 'Stock initial Chargeur USB-C');

-- -----------------------------------------------------
-- Table payment_methods
-- -----------------------------------------------------
INSERT INTO payment_methods (id, name, type, is_active, created_time, updated_time) VALUES
(1, 'Espèces', 'cash', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Carte Bancaire', 'card', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Virement Bancaire', 'bank_transfer', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Chèque', 'check', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table purchase_orders
-- -----------------------------------------------------
INSERT INTO purchase_orders (id, order_number, supplier_id, order_date, expected_delivery_date, status, currency_id, total_amount_ht, total_vat_amount, total_amount_ttc, shipping_address_id, warehouse_id_for_delivery, shop_id_for_delivery, created_by_user_id, approved_by_user_id, notes, created_time, updated_time, deleted_time) VALUES
(1, 'PO-2025-00001', 1, '2025-05-01', '2025-05-15', 'approved', 1, 10500.0000, 2100.0000, 12600.0000, 7, 1, NULL, 2, 1, 'Commande réapprovisionnement smartphones', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'PO-2025-00002', 2, '2025-05-05', '2025-05-20', 'sent_to_supplier', 1, 190.0000, 38.0000, 228.0000, 7, 1, NULL, 2, 1, 'Commande fournitures bureau approuvée et envoyée', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table purchase_order_items
-- -----------------------------------------------------
INSERT INTO purchase_order_items (id, purchase_order_id, product_id, product_variant_id, description, quantity, unit_price_ht, vat_rate_percentage, total_line_amount_ht, quantity_received) VALUES
(1, 1, 1, NULL, 'Smartphone Modèle X 128GB Noir', 30.000, 350.0000, 20.00, 10500.0000, 0.000),
(2, 2, 3, NULL, 'Chargeur USB-C Rapide', 20.000, 9.5000, 20.00, 190.0000, 0.000);

-- -----------------------------------------------------
-- Table quotes
-- -----------------------------------------------------
INSERT INTO quotes (id, quote_number, customer_id, issue_date, expiry_date, status, currency_id, total_amount_ht, total_vat_amount, total_amount_ttc, shipping_address_id, billing_address_id, created_by_user_id, notes, terms_and_conditions, created_time, updated_time, deleted_time) VALUES
(1, 'QT-2025-00001', 1, '2025-04-15', '2025-05-15', 'accepted', 1, 999.0000, 199.8000, 1198.8000, 5, 4, 2, 'Devis pour un portable et un chargeur', 'Valable 30 jours.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'QT-2025-00002', 2, '2025-04-20', '2025-05-20', 'sent', 1, 159.8000, 31.9600, 191.7600, 6, 6, 2, 'Devis pour 2 kits télétravail', 'Valable 30 jours, paiement à la commande.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table quote_items
-- -----------------------------------------------------
INSERT INTO quote_items (id, quote_id, product_id, product_variant_id, description, quantity, unit_price_ht, discount_percentage, vat_rate_percentage, total_line_amount_ht) VALUES
(1, 1, 2, NULL, 'Ordinateur Portable Pro 15"', 1.000, 975.0000, 0.00, 20.00, 975.0000),
(2, 1, 3, NULL, 'Chargeur USB-C Rapide', 1.000, 24.0000, 0.00, 20.00, 24.0000),
(3, 2, 4, NULL, 'Kit Télétravail Essentiel', 2.000, 79.9000, 0.00, 20.00, 159.8000);

-- -----------------------------------------------------
-- Table sales_orders
-- -----------------------------------------------------
INSERT INTO sales_orders (id, order_number, customer_id, quote_id, order_date, status, currency_id, total_amount_ht, total_vat_amount, total_amount_ttc, shipping_fees_ht, shipping_address_id, billing_address_id, dispatch_warehouse_id, dispatch_shop_id, created_by_user_id, notes, created_time, updated_time, deleted_time) VALUES
(1, 'SO-2025-00001', 1, 1, '2025-05-10', 'approved', 1, 1009.0000, 201.8000, 1210.8000, 10.0000, 5, 4, 1, NULL, 2, 'Vente suite devis QT-2025-00001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'SO-2025-00002', 2, NULL, '2025-05-12', 'in_preparation', 1, 1999.0000, 399.8000, 2398.8000, 25.0000, 6, 6, 1, NULL, 2, 'Vente 2 Laptops Entreprise ABC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'SO-2025-00003', 1, NULL, '2025-05-29', 'approved', 1, 100.0000, 20.0000, 120.0000, 0.0000, 5, 4, 1, NULL, 1, 'Commande pour tests de livraison', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(4, 'SO-2025-00004', 1, NULL, '2025-05-30', 'approved', 1, 600.0000, 120.0000, 720.0000, 0.0000, 5, 4, 1, NULL, 1, 'Commande pour tests de livraison d''articles', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(5, 'SO-2025-00005', 1, NULL, '2025-05-30', 'approved', 1, 150.0000, 30.0000, 180.0000, 0.0000, 5, 4, 1, NULL, 1, 'Commande pour ajout d''article de livraison', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(6, 'SO-2025-00006', 3, NULL, '2025-06-15', 'approved', 1, 200.0000, 40.0000, 240.0000, 0.0000, 5, 4, 1, NULL, 1, 'Commande pour client avec dépendances', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table sales_order_items
-- -----------------------------------------------------
INSERT INTO sales_order_items (id, sales_order_id, product_id, product_variant_id, description, quantity, unit_price_ht, discount_percentage, vat_rate_percentage, total_line_amount_ht, quantity_shipped, quantity_invoiced) VALUES
(1, 1, 2, NULL, 'Ordinateur Portable Pro 15"', 1.000, 975.0000, 0.00, 20.00, 975.0000, 0.000, 0.000),
(2, 1, 3, NULL, 'Chargeur USB-C Rapide', 1.000, 24.0000, 0.00, 20.00, 24.0000, 0.000, 0.000),
(3, 2, 2, NULL, 'Ordinateur Portable Pro 15"', 2.000, 999.5000, 0.00, 20.00, 1999.0000, 0.000, 0.000),
(4, 3, 1, NULL, 'Smartphone Modèle X', 5.000, 100.0000, 0.00, 20.00, 500.0000, 0.000, 0.000),
(5, 3, 3, NULL, 'Chargeur USB-C Rapide', 10.000, 10.0000, 0.00, 20.00, 100.0000, 0.000, 0.000),
(6, 4, 1, NULL, 'Smartphone Modèle X pour test livraison', 10.000, 100.0000, 0.00, 20.00, 1000.0000, 0.000, 0.000),
(7, 4, 3, NULL, 'Chargeur USB-C Rapide pour test livraison', 10.000, 10.0000, 0.00, 20.00, 100.0000, 0.000, 0.000),
(8, 5, 1, NULL, 'Smartphone Modèle X pour nouvel article de livraison', 3.000, 50.0000, 0.00, 20.00, 150.0000, 0.000, 0.000),
(9, 5, 3, NULL, 'Chargeur USB-C Rapide pour nouvel article de livraison', 5.000, 10.0000, 0.00, 20.00, 50.0000, 0.000, 0.000),
(10, 4, 1, NULL, 'Nouvel article pour test livraison', 5.000, 100.0000, 0.00, 20.00, 500.0000, 0.000, 0.000),
(11, 6, 1, NULL, 'Smartphone Modèle X pour client dépendant', 1.000, 200.0000, 0.00, 20.00, 200.0000, 0.000, 0.000);

-- -----------------------------------------------------
-- Table purchase_receptions
-- -----------------------------------------------------
INSERT INTO purchase_receptions (id, reception_number, purchase_order_id, supplier_id, reception_date, warehouse_id, shop_id, received_by_user_id, status, notes, created_time, updated_time) VALUES
(1, 'REC-2025-00001', 1, 1, '2025-05-14', 1, NULL, 1, 'complete', 'Réception complète PO-2025-00001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'REC-2025-00002', 2, 2, '2025-05-18', 1, NULL, 1, 'partial', 'Réception partielle PO-2025-00002, manque 5 chargeurs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'REC-2025-00003', 2, 2, '2025-05-20', 1, NULL, 1, 'pending_quality_check', 'Réception en attente de contrôle qualité pour tests', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table purchase_reception_items
-- -----------------------------------------------------
INSERT INTO purchase_reception_items (id, purchase_reception_id, purchase_order_item_id, product_id, product_variant_id, quantity_ordered, quantity_received, lot_number, expiry_date, notes) VALUES
(1, 1, 1, 1, NULL, 30.000, 25.000, 'LOT-SPX-20250514', NULL, 'Tous les smartphones OK'),
(2, 2, 2, 3, NULL, 20.000, 10.000, 'LOT-CHG-20250518', NULL, '5 chargeurs en attente'),
(3, 3, 2, 3, NULL, 20.000, 5.000, 'LOT-CHG-20250520', NULL, 'Item initial pour tests de modification');

-- -----------------------------------------------------
-- Table supplier_invoices
-- -----------------------------------------------------
INSERT INTO supplier_invoices (id, invoice_number, supplier_id, invoice_date, due_date, currency_id, total_amount_ht, total_vat_amount, total_amount_ttc, status, notes, file_attachment_url, created_by_user_id, updated_by_user_id, created_time, updated_time, deleted_time) VALUES
(1, 'INV-SUP-HIGHTECH-05-001', 1, '2025-05-15', '2025-06-14', 1, 10500.0000, 2100.0000, 12600.0000, 'pending_payment', 'Facture pour PO-2025-00001', 'invoices/supplier/INV-SUP-HIGHTECH-05-001.pdf', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'INV-SUP-OFFICE-05-001', 2, '2025-05-19', '2025-07-03', 1, 142.5000, 28.5000, 171.0000, 'pending_payment', 'Facture pour 15 chargeurs de PO-2025-00002', 'invoices/supplier/INV-SUP-OFFICE-05-001.pdf', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table supplier_invoice_items
-- -----------------------------------------------------
INSERT INTO supplier_invoice_items (id, supplier_invoice_id, product_id, product_variant_id, description, quantity, unit_price_ht, vat_rate_percentage, total_line_amount_ht, purchase_reception_item_id) VALUES
(1, 1, 1, NULL, 'Smartphone Modèle X 128GB Noir (Facturé)', 30.000, 350.0000, 20.00, 10500.0000, 1),
(2, 2, 3, NULL, 'Chargeur USB-C Rapide (Facturé)', 15.000, 9.5000, 20.00, 142.5000, 2);

-- -----------------------------------------------------
-- Table supplier_invoice_purchase_order_links
-- -----------------------------------------------------
INSERT INTO supplier_invoice_purchase_order_links (supplier_invoice_id, purchase_order_id) VALUES
(1, 1),
(2, 2);

-- -----------------------------------------------------
-- Table deliveries
-- -----------------------------------------------------
INSERT INTO deliveries (id, delivery_number, sales_order_id, delivery_date, status, shipping_address_id, carrier_name, tracking_number, created_by_user_id, dispatch_warehouse_id, dispatch_shop_id, notes, created_time, updated_time) VALUES
(1, 'DL-2025-00001', 1, '2025-05-11', 'shipped', 5, 'Chronopost', 'XY123456789FR', 1, 1, NULL, 'Livraison commande SO-2025-00001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'DL-2025-00002', 2, '2025-05-13', 'in_preparation', 6, NULL, NULL, 1, 1, NULL, 'Préparation Laptops Entreprise ABC (SO-2025-00002)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'DL-2025-00003', 4, '2025-05-30', 'pending', 5, NULL, NULL, 1, 1, NULL, 'Livraison pour tests d''articles (SO-2025-00004)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'DL-2025-00004', 4, '2025-05-30', 'shipped', 5, 'Colissimo', 'TRK987654321', 1, 1, NULL, 'Livraison expédiée pour tests de statut', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table delivery_items
-- -----------------------------------------------------
INSERT INTO delivery_items (id, delivery_id, sales_order_item_id, product_id, product_variant_id, quantity_shipped) VALUES
(1, 1, 1, 2, NULL, 1.000), -- Ordinateur Portable from SO1
(2, 1, 2, 3, NULL, 1.000), -- Chargeur from SO1
(3, 2, 3, 2, NULL, 1.000), -- 1 des 2 Laptops from SO2
(4, 3, 6, 1, NULL, 2.000), -- Smartphone Modèle X from SO4
(5, 3, 7, 3, NULL, 5.000), -- Chargeur USB-C Rapide from SO4
(6, 4, 6, 1, NULL, 3.000), -- Smartphone Modèle X from SO4 (partiellement livré)
(7, 3, 8, 1, NULL, 1.000); -- Smartphone Modèle X from SO5 (pour test d'ajout)

-- -----------------------------------------------------
-- Table customer_invoices
-- -----------------------------------------------------
INSERT INTO customer_invoices (id, invoice_number, customer_id, invoice_date, due_date, status, currency_id, total_amount_ht, total_vat_amount, total_amount_ttc, amount_paid, billing_address_id, created_by_user_id, notes, terms_and_conditions, created_time, updated_time, deleted_time) VALUES
(1, 'INV-CUST-2025-00001', 1, '2025-05-11', '2025-05-26', 'sent', 1, 1009.0000, 201.8000, 1210.8000, 0.0000, 4, 2, 'Facture pour SO-2025-00001', 'Paiement sous 15 jours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, 'INV-CUST-2025-00002', 2, '2025-05-14', '2025-06-13', 'draft', 1, 1024.5000, 204.9000, 1229.4000, 0.0000, 6, 2, 'Facture pour 1 Laptop de SO-2025-00002 + port', 'Paiement sous 30 jours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, 'INV-CUST-2025-00003', 3, '2025-06-16', '2025-07-01', 'sent', 1, 200.0000, 40.0000, 240.0000, 0.0000, 4, 1, 'Facture pour client avec dépendances', 'Paiement sous 15 jours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- -----------------------------------------------------
-- Table customer_invoice_items
-- -----------------------------------------------------
INSERT INTO customer_invoice_items (id, customer_invoice_id, product_id, product_variant_id, description, quantity, unit_price_ht, discount_percentage, vat_rate_percentage, total_line_amount_ht, delivery_item_id, sales_order_item_id) VALUES
(1, 1, 2, NULL, 'Ordinateur Portable Pro 15" (Facturé)', 1.000, 975.0000, 0.00, 20.00, 975.0000, 1, 1),
(2, 1, 3, NULL, 'Chargeur USB-C Rapide (Facturé)', 1.000, 24.0000, 0.00, 20.00, 24.0000, 2, 2),
(3, 1, NULL, NULL, 'Frais de port', 1.000, 10.0000, 0.00, 20.00, 10.0000, NULL, NULL),
(4, 2, 2, NULL, 'Ordinateur Portable Pro 15" (Facturé)', 1.000, 999.5000, 0.00, 20.00, 999.5000, 3, 3),
(5, 2, NULL, NULL, 'Frais de port (partiel)', 1.000, 25.0000, 0.00, 20.00, 25.0000, NULL, NULL),
(6, 3, 1, NULL, 'Smartphone Modèle X (Facturé pour client dépendant)', 1.000, 200.0000, 0.00, 20.00, 200.0000, NULL, 11);

-- -----------------------------------------------------
-- Table customer_invoice_sales_order_links
-- -----------------------------------------------------
INSERT INTO customer_invoice_sales_order_links (customer_invoice_id, sales_order_id) VALUES
(1, 1),
(2, 2);

-- -----------------------------------------------------
-- Table supplier_returns
-- -----------------------------------------------------
INSERT INTO supplier_returns (id, return_number, supplier_id, return_date, status, reason, notes, source_warehouse_id, source_shop_id, supplier_rma_number, created_by_user_id, shipped_by_user_id, processed_by_user_id, updated_by_user_id, created_time, updated_time) VALUES
(1, 'RET-SUP-2025-001', 1, '2025-05-20', 'approved_by_supplier', 'Produit défectueux à la réception', 'Retour de 2 smartphones du lot LOT-SPX-20250514', 1, NULL, 'RMA-SUP-001', 2, NULL, NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'RET-SUP-2025-002', 2, '2025-05-22', 'shipped_to_supplier', 'Erreur de référence', 'Retour de 3 chargeurs non commandés', NULL, 1, NULL, 1, 1, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'RET-SUP-2025-003', 1, '2025-05-25', 'completed', 'Changement d''avis client', 'Retour complet et avoir émis', 1, NULL, 'RMA-SUP-002', 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table supplier_return_items
-- -----------------------------------------------------
INSERT INTO supplier_return_items (id, supplier_return_id, product_id, product_variant_id, quantity, quantity_shipped, quantity_received, unit_price_at_return, purchase_reception_item_id) VALUES
(1, 1, 1, NULL, 2.000, 0.000, 0.000, 350.0000, 1),
(2, 2, 3, NULL, 3.000, 0.000, 0.000, 9.5000, 2);

-- -----------------------------------------------------
-- Table customer_returns
-- -----------------------------------------------------
INSERT INTO customer_returns (id, return_number, customer_id, sales_order_id, customer_invoice_id, return_date, status, reason, created_by_user_id, notes, created_time, updated_time) VALUES
(1, 'RMA-CUST-2025-001', 1, 1, 1, '2025-05-25', 'received_complete', 'Ne convient pas', 2, 'Client souhaite échanger contre un autre modèle', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'RMA-CUST-2025-002', 2, 2, 2, '2025-05-28', 'pending_reception', 'Panne au déballage', 1, 'Laptop ne démarre pas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'RMA-CUST-2025-003', 1, NULL, NULL, '2025-06-10', 'refunded', 'Remboursement effectué', 1, 'Retour avec remboursement déjà traité pour test de suppression', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table customer_return_items
-- -----------------------------------------------------
INSERT INTO customer_return_items (id, customer_return_id, product_id, product_variant_id, quantity, unit_price_at_return, `condition`, action_taken) VALUES
(1, 1, 2, NULL, 1.000, 975.0000, 'new', 'pending_inspection'), -- Retour Ordinateur Portable
(2, 2, 2, NULL, 1.000, 999.5000, 'damaged', 'repair'),      -- Retour autre Ordinateur Portable
(3, 3, 3, NULL, 1.000, 24.9000, 'new', 'refund_approved'); -- Article pour retour 3

-- -----------------------------------------------------
-- Table inventory_sessions
-- -----------------------------------------------------
INSERT INTO inventory_sessions (id, warehouse_id, shop_id, start_date, end_date, status, created_by_user_id, validated_by_user_id, notes, created_time, updated_time) VALUES
(1, 1, NULL, '2025-06-01 08:00:00', '2025-06-01 17:00:00', 'completed', 1, 1, 'Inventaire annuel Entrepôt Principal Paris Sud - Terminé', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, NULL, 1, '2025-06-05 09:00:00', NULL, 'in_progress', 2, NULL, 'Inventaire tournant Boutique Nantes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table inventory_session_items
-- -----------------------------------------------------
INSERT INTO inventory_session_items (id, inventory_session_id, product_id, product_variant_id, theoretical_quantity, counted_quantity, variance_quantity, unit_cost_at_inventory, notes) VALUES
(1, 1, 1, NULL, 27.000, 26.000, -1.000, 350.0000, '1 Smartphone X manquant (théorique après ventes/retours)'),
(2, 1, 3, NULL, 80.000, 80.000, 0.000, 9.5000, 'Chargeurs OK (théorique après ventes/retours)');

-- -----------------------------------------------------
-- Table stock_transfers
-- -----------------------------------------------------
INSERT INTO stock_transfers (id, transfer_number, source_warehouse_id, source_shop_id, destination_warehouse_id, destination_shop_id, status, requested_by_user_id, shipped_by_user_id, received_by_user_id, request_date, ship_date, receive_date, notes, created_time, updated_time) VALUES
(1, 'TRF-2025-001', 1, NULL, NULL, 1, 'in_transit', 2, 1, NULL, '2025-06-02', '2025-06-03', NULL, 'Transfert de chargeurs vers boutique Nantes - Expédié', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'TRF-2025-002', 2, NULL, 1, NULL, 'received', 1, 1, 1, '2025-06-03', '2025-06-04', '2025-06-05', 'Rapatriement variantes smartphone vers Paris - Reçu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table stock_transfer_items
-- -----------------------------------------------------
INSERT INTO stock_transfer_items (id, stock_transfer_id, product_id, product_variant_id, quantity_requested, quantity_shipped, quantity_received) VALUES
(1, 1, 3, NULL, 20.000, 20.000, 0.000),
(2, 2, 1, 1, 10.000, 10.000, 10.000);

-- -----------------------------------------------------
-- Table bank_accounts
-- -----------------------------------------------------
INSERT INTO bank_accounts (id, account_name, bank_name, account_number, iban, swift_bic, currency_id, initial_balance, current_balance, created_time, updated_time) VALUES
(1, 'Compte Courant InnovStocker EUR', 'Banque Innov', '00112233445', 'FR7600112233445566778899A01', 'INOVFRPPXXX', 1, 10000.0000, 10000.0000 - 12600.0000 , CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), -- -12600 from payment 2
(2, 'Compte USD InnovStocker', 'Banque Innov International', 'USD99887766', 'FR7600112233445566778899B02', 'INOVFRPPXXX', 2, 5000.0000, 5000.0000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table cash_registers
-- -----------------------------------------------------
INSERT INTO cash_registers (id, name, shop_id, currency_id, current_balance, is_active, created_time, updated_time) VALUES
(1, 'Caisse Principale Nantes', 1, 1, 200.0000 + 611.9880 + 29.9000 - 5.5000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), -- + payment 1 + cash_transac 1 - cash_transac 2
(2, 'Caisse Secondaire Strasbourg', 2, 1, 150.0000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- -----------------------------------------------------
-- Table cash_register_sessions
-- -----------------------------------------------------
INSERT INTO cash_register_sessions (id, cash_register_id, opened_by_user_id, closed_by_user_id, opening_timestamp, closing_timestamp, opening_balance, closing_balance_theoretical, closing_balance_actual, difference_amount, status, notes) VALUES
(1, 1, 2, NULL, '2025-05-17 08:45:00', NULL, 200.0000, NULL, NULL, 0.0000,'open', 'Session du matin Nantes'),
(2, 2, 1, 1, '2025-05-16 09:00:00', '2025-05-16 18:30:00', 150.0000, 450.5000, 450.0000, -0.5000, 'closed', 'Session Strasbourg 16/05');

-- -----------------------------------------------------
-- Table payments
-- -----------------------------------------------------
INSERT INTO payments (id, payment_date, amount, currency_id, payment_method_id, direction, customer_id, supplier_id, customer_invoice_id, supplier_invoice_id, sales_order_id, purchase_order_id, bank_account_id, cash_register_session_id, reference_number, notes, recorded_by_user_id, created_time, updated_time, related_return_id) VALUES
(1, '2025-05-20', 611.9880, 1, 2, 'inbound', 1, NULL, 1, NULL, 1, NULL, NULL, 1, 'CB-TXN-001', 'Paiement CB Smartphone Dupont', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(2, '2025-05-22', 12600.0000, 1, 3, 'outbound', NULL, 1, NULL, 1, NULL, 1, 1, NULL, 'VIR-SUP-001', 'Paiement virement Hightech PO1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(3, '2025-05-23', 171.0000, 1, 3, 'outbound', NULL, 2, NULL, 2, NULL, 2, 1, NULL, 'VIR-SUP-002', 'Paiement virement Office Supplies Fact 2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(4, '2025-05-24', 500.0000, 1, 1, 'inbound', 2, NULL, 2, NULL, 2, NULL, NULL, 1, 'CASH-ACOMPTE-ABC', 'Acompte espèces Entreprise ABC Fact 2', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
(5, '2025-06-11', 24.9000, 1, 1, 'inbound', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'REFUND-RMA-003', 'Remboursement pour retour RMA-CUST-2025-003', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 3);


-- -----------------------------------------------------
-- Table cash_register_transactions
-- -----------------------------------------------------
INSERT INTO cash_register_transactions (id, cash_register_session_id, transaction_timestamp, type, amount, description, payment_method_id, related_sales_order_id, user_id) VALUES
(1, 1, '2025-05-17 10:15:00', 'cash_in_pos_sale', 29.9000, 'Vente directe petit accessoire', 1, NULL, 2),
(2, 1, '2025-05-17 11:00:00', 'cash_out_expense', -5.5000, 'Achat timbres poste', 1, NULL, 2),
(3, 1, '2025-05-24 14:00:00', 'cash_in_other', 500.0000, 'Acompte reçu Entreprise ABC (Paiement ID 4)', 1, 2, 2); -- Lié au paiement 4

-- -----------------------------------------------------
-- Table user_activity_logs
-- -----------------------------------------------------
INSERT INTO user_activity_logs (id, user_id, action_type, entity_type, entity_id, details, ip_address, timestamp) VALUES
(1, 1, 'LOGIN_SUCCESS', 'USER', '1', NULL, '127.0.0.1', CURRENT_TIMESTAMP),
(2, 2, 'CREATE', 'PRODUCT', '1', '{"name": "Smartphone Modèle X", "sku": "PROD-SP-001"}', '192.168.1.10', CURRENT_TIMESTAMP),
(3, 1, 'UPDATE', 'COMPANY', '1', '{"name": "Innov Stocker SARL"}', '127.0.0.1', '2025-05-10 10:00:00'),
(4, 2, 'VIEW', 'SUPPLIER', NULL, NULL, '192.168.1.10', '2025-05-11 11:00:00');

-- -----------------------------------------------------
-- Table notifications
-- -----------------------------------------------------
INSERT INTO notifications (id, user_id, type, message, is_read, entity_type, entity_id, link_url, created_time) VALUES
(1, 1, 'info', 'Le produit "Smartphone Modèle X - Bleu" (PROD-SP-001-BLU) est en stock bas (3 restants).', 0, 'product_variant', '1', '/products/1/variants/1', CURRENT_TIMESTAMP),
(2, 2, 'info', 'Nouvelle commande client SO-2025-00002 reçue de Entreprise ABC SARL.', 0, 'sales_order', '2', '/sales-orders/2', CURRENT_TIMESTAMP),
(3, 1, 'info', 'La facture INV-SUP-HIGHTECH-05-001 arrive à échéance le 2025-06-14.', 0, 'supplier_invoice', '1', '/supplier-invoices/1', '2025-06-01 09:00:00'),
(4, 2, 'info', 'Le devis QT-2025-00001 pour Jean Dupont a été accepté.', 1, 'quote', '1', '/quotes/1', '2025-05-09 12:00:00');

SET FOREIGN_KEY_CHECKS = 1;