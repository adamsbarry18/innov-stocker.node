-- Active: 1715943303504@@127.0.0.1@3306@innov_stocker
-- Innov Stocker SQL Schema
-- Date: 17 Mai 2025

-- Désactiver temporairement les vérifications de clés étrangères pour la création
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Table `user` (Fournie et adaptée)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `uid` VARCHAR(36) DEFAULT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(200) DEFAULT NULL,
    `last_name` VARCHAR(200) DEFAULT NULL,
    `level` INT DEFAULT 1,
    `internal_level` INT DEFAULT 1,
    `internal` TINYINT(1) DEFAULT 0,
    `color` VARCHAR(10) DEFAULT NULL,
    `password_status` VARCHAR(20) DEFAULT 'ACTIVE',
    `password_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `preferences` JSON DEFAULT NULL,
    `authorisation_overrides` VARCHAR(500) DEFAULT NULL,
    `permissions_expire_at` TIMESTAMP NULL DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `google_id` VARCHAR(255) DEFAULT NULL,
    UNIQUE KEY `uid_unique` (`uid`),
    UNIQUE KEY `email_unique` (`email`),
    UNIQUE KEY `google_id_unique` (`google_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `addresses`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `addresses`;

CREATE TABLE `addresses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `street_line1` VARCHAR(255) NOT NULL,
    `street_line2` VARCHAR(255) DEFAULT NULL,
    `city` VARCHAR(255) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `state_province` VARCHAR(255) DEFAULT NULL,
    `country` VARCHAR(255) NOT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `currencies`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `currencies`;

CREATE TABLE `currencies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(3) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `symbol` VARCHAR(10) NOT NULL,
    `exchange_rate_to_company_default` DECIMAL(15, 6) DEFAULT 1.000000,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `code_unique` (`code`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `company`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `company`;

CREATE TABLE `company` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `name` VARCHAR(255) NOT NULL,
    `trading_name` VARCHAR(255) DEFAULT NULL,
    `address_id` INT NOT NULL,
    `vat_number` VARCHAR(50) DEFAULT NULL,
    `siret_number` VARCHAR(50) DEFAULT NULL,
    `registration_number` VARCHAR(100) DEFAULT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `website` VARCHAR(2048) DEFAULT NULL,
    `logo_url` VARCHAR(2048) DEFAULT NULL,
    `default_currency_id` INT NOT NULL,
    `default_vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `fiscal_year_start_month` INT DEFAULT NULL,
    `fiscal_year_start_day` INT DEFAULT NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'Europe/Paris',
    `terms_and_conditions_default_purchase` TEXT DEFAULT NULL,
    `terms_and_conditions_default_sale` TEXT DEFAULT NULL,
    `bank_account_details_for_invoices` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_company_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_company_currency` FOREIGN KEY (`default_currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `product_categories`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `product_categories`;

CREATE TABLE `product_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `image_url` VARCHAR(2048) DEFAULT NULL,
    `parent_category_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `name_unique_by_parent` (`name`, `parent_category_id`),
    CONSTRAINT `fk_product_categories_parent` FOREIGN KEY (`parent_category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_groups`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_groups`;

CREATE TABLE `customer_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `name_unique` (`name`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `suppliers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `suppliers`;

CREATE TABLE `suppliers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `contact_person_name` VARCHAR(255) DEFAULT NULL,
    `email` VARCHAR(255) DEFAULT NULL,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `website` VARCHAR(2048) DEFAULT NULL,
    `vat_number` VARCHAR(50) DEFAULT NULL,
    `siret_number` VARCHAR(50) DEFAULT NULL,
    `default_currency_id` INT NOT NULL,
    `default_payment_terms_days` INT DEFAULT NULL,
    `address_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `email_unique_if_not_null` (`email`),
    CONSTRAINT `fk_suppliers_currency` FOREIGN KEY (`default_currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_suppliers_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_suppliers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_suppliers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customers`;

CREATE TABLE `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `first_name` VARCHAR(255) DEFAULT NULL,
    `last_name` VARCHAR(255) DEFAULT NULL,
    `company_name` VARCHAR(255) DEFAULT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `vat_number` VARCHAR(50) DEFAULT NULL,
    `siret_number` VARCHAR(50) DEFAULT NULL,
    `default_currency_id` INT NOT NULL,
    `default_payment_terms_days` INT DEFAULT NULL,
    `credit_limit` DECIMAL(15, 2) DEFAULT NULL,
    `customer_group_id` INT DEFAULT NULL,
    `billing_address_id` INT NOT NULL,
    `default_shipping_address_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `email_unique` (`email`),
    CONSTRAINT `fk_customers_currency` FOREIGN KEY (`default_currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_customers_group` FOREIGN KEY (`customer_group_id`) REFERENCES `customer_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_customers_billing_address` FOREIGN KEY (`billing_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_customers_shipping_address` FOREIGN KEY (`default_shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_customers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_customers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_shipping_addresses`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_shipping_addresses`;

CREATE TABLE `customer_shipping_addresses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL,
    `address_id` INT NOT NULL,
    `address_label` VARCHAR(255) NOT NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL, -- Ajout de la colonne deleted_time
    CONSTRAINT `fk_csa_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_csa_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `warehouses`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `warehouses`;

CREATE TABLE `warehouses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) DEFAULT NULL,
    `address_id` INT NOT NULL,
    `manager_id` INT DEFAULT NULL,
    `capacity_notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `name_unique` (`name`),
    UNIQUE KEY `code_unique_if_not_null` (`code`),
    CONSTRAINT `fk_warehouses_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_warehouses_manager` FOREIGN KEY (`manager_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_warehouses_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_warehouses_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `shops` (Boutiques/Magasins)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `shops`;

CREATE TABLE `shops` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) DEFAULT NULL,
    `address_id` INT NOT NULL,
    `manager_id` INT DEFAULT NULL,
    `opening_hours_notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `name_unique` (`name`),
    UNIQUE KEY `code_unique_if_not_null` (`code`),
    CONSTRAINT `fk_shops_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_shops_manager` FOREIGN KEY (`manager_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_shops_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_shops_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `products`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `products`;

CREATE TABLE `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sku` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `product_category_id` INT NOT NULL,
    `unit_of_measure` VARCHAR(50) NOT NULL,
    `weight` DECIMAL(10, 3) DEFAULT NULL,
    `weight_unit` VARCHAR(10) DEFAULT NULL,
    `length` DECIMAL(10, 2) DEFAULT NULL,
    `width` DECIMAL(10, 2) DEFAULT NULL,
    `height` DECIMAL(10, 2) DEFAULT NULL,
    `dimension_unit` VARCHAR(10) DEFAULT NULL,
    `barcode_qr_code` VARCHAR(255) DEFAULT NULL,
    `min_stock_level` INT DEFAULT 0,
    `max_stock_level` INT DEFAULT NULL,
    `default_purchase_price` DECIMAL(15, 4) DEFAULT NULL,
    `default_selling_price_ht` DECIMAL(15, 4) DEFAULT NULL,
    `default_vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'active' NOT NULL, -- Possible values: active, inactive, obsolete
    `is_composite_product` TINYINT(1) DEFAULT 0 NOT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `sku_unique` (`sku`),
    UNIQUE KEY `barcode_qr_code_unique_if_not_null` (`barcode_qr_code`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`product_category_id`) REFERENCES `product_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_products_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_products_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ... (Schema for all other tables will follow, respecting dependencies and using user.id for FKs)
-- This is a large schema, I will continue with the next set of tables.
-- Please note that for brevity in this interactive format, I might group some of the remaining tables
-- but the full SQL for each will be generated based on the previous detailed model.

-- -----------------------------------------------------
-- Table `product_images`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `product_images`;

CREATE TABLE `product_images` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `image_url` VARCHAR(2048) NOT NULL,
    `alt_text` VARCHAR(255) DEFAULT NULL,
    `is_primary` TINYINT(1) DEFAULT 0,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `product_variants`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `product_variants`;

CREATE TABLE `product_variants` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `sku_variant` VARCHAR(150) NOT NULL,
    `name_variant` VARCHAR(255) NOT NULL,
    `attributes` JSON NOT NULL,
    `purchase_price` DECIMAL(15, 4) DEFAULT NULL,
    `selling_price_ht` DECIMAL(15, 4) DEFAULT NULL,
    `barcode_qr_code_variant` VARCHAR(255) DEFAULT NULL,
    `min_stock_level_variant` INT DEFAULT 0,
    `max_stock_level_variant` INT DEFAULT NULL,
    `weight_variant` DECIMAL(10, 3) DEFAULT NULL,
    `image_id` INT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `sku_variant_unique` (`sku_variant`),
    UNIQUE KEY `barcode_qr_code_variant_unique_if_not_null` (`barcode_qr_code_variant`),
    CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_product_variants_image` FOREIGN KEY (`image_id`) REFERENCES `product_images` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_product_variants_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_product_variants_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `composite_product_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `composite_product_items`;

CREATE TABLE `composite_product_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `composite_product_id` INT NOT NULL,
    `component_product_id` INT NOT NULL,
    `component_variant_id` INT DEFAULT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `cpi_unique_item` (
        `composite_product_id`,
        `component_product_id`,
        `component_variant_id`
    ),
    CONSTRAINT `fk_cpi_composite_product` FOREIGN KEY (`composite_product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cpi_component_product` FOREIGN KEY (`component_product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_cpi_component_variant` FOREIGN KEY (`component_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `product_suppliers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `product_suppliers`;

CREATE TABLE `product_suppliers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT DEFAULT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `supplier_id` INT NOT NULL,
    `supplier_product_code` VARCHAR(100) DEFAULT NULL,
    `purchase_price` DECIMAL(15, 4) NOT NULL,
    `currency_id` INT NOT NULL,
    `is_default_supplier` TINYINT(1) DEFAULT 0,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `product_supplier_unique` (
        `product_id`,
        `product_variant_id`,
        `supplier_id`
    ),
    CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ps_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ps_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ps_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_movements`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `stock_movements`;

CREATE TABLE `stock_movements` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `warehouse_id` INT DEFAULT NULL,
    `shop_id` INT DEFAULT NULL,
    `movement_type` VARCHAR(30) NOT NULL, -- Possible values: purchase_reception, sale_delivery, customer_return, supplier_return, inventory_adjustment_in, inventory_adjustment_out, stock_transfer_out, stock_transfer_in, manual_entry_in, manual_entry_out, production_in, production_out
    `quantity` DECIMAL(15, 3) NOT NULL,
    `movement_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `unit_cost_at_movement` DECIMAL(15, 4) DEFAULT NULL,
    `user_id` INT DEFAULT NULL,
    `reference_document_type` VARCHAR(50) DEFAULT NULL,
    `reference_document_id` BIGINT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sm_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sm_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sm_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sm_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `inventory_sessions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `inventory_sessions`;

CREATE TABLE `inventory_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `warehouse_id` INT DEFAULT NULL,
    `shop_id` INT DEFAULT NULL,
    `start_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `end_date` TIMESTAMP NULL DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'pending' NOT NULL, -- Possible values: pending, in_progress, completed, cancelled
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `validated_by_user_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_is_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_is_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_is_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_is_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_is_validated_by` FOREIGN KEY (`validated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `inventory_session_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `inventory_session_items`;

CREATE TABLE `inventory_session_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `inventory_session_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `theoretical_quantity` DECIMAL(15, 3) NOT NULL,
    `counted_quantity` DECIMAL(15, 3) NOT NULL,
    `variance_quantity` DECIMAL(15, 3) DEFAULT 0.000, -- Application to calculate: counted - theoretical
    `unit_cost_at_inventory` DECIMAL(15, 4) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `inventory_item_unique` (
        `inventory_session_id`,
        `product_id`,
        `product_variant_id`
    ),
    CONSTRAINT `fk_isi_session` FOREIGN KEY (`inventory_session_id`) REFERENCES `inventory_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_isi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_isi_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_transfers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `stock_transfers`;

CREATE TABLE `stock_transfers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transfer_number` VARCHAR(50) NOT NULL,
    `source_warehouse_id` INT DEFAULT NULL,
    `source_shop_id` INT DEFAULT NULL,
    `destination_warehouse_id` INT DEFAULT NULL,
    `destination_shop_id` INT DEFAULT NULL,
    `status` VARCHAR(25) DEFAULT 'pending' NOT NULL, -- Possible values: pending, in_transit, partially_received, received, cancelled
    `requested_by_user_id` INT NOT NULL,
    `shipped_by_user_id` INT DEFAULT NULL,
    `received_by_user_id` INT DEFAULT NULL,
    `request_date` DATE NOT NULL,
    `ship_date` DATE DEFAULT NULL,
    `receive_date` DATE DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `transfer_number_unique` (`transfer_number`),
    CONSTRAINT `fk_st_source_warehouse` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_st_source_shop` FOREIGN KEY (`source_shop_id`) REFERENCES `shops` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_st_dest_warehouse` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_st_dest_shop` FOREIGN KEY (`destination_shop_id`) REFERENCES `shops` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_st_requested_by` FOREIGN KEY (`requested_by_user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_st_shipped_by` FOREIGN KEY (`shipped_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_st_received_by` FOREIGN KEY (`received_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `stock_transfer_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `stock_transfer_items`;

CREATE TABLE `stock_transfer_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `stock_transfer_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `quantity_requested` DECIMAL(15, 3) NOT NULL,
    `quantity_shipped` DECIMAL(15, 3) DEFAULT 0.000,
    `quantity_received` DECIMAL(15, 3) DEFAULT 0.000,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sti_transfer` FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sti_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sti_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- =====================================================
-- MODULE ACHATS
-- =====================================================

-- -----------------------------------------------------
-- Table `purchase_orders`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `purchase_orders`;

CREATE TABLE `purchase_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_number` VARCHAR(50) NOT NULL,
    `supplier_id` INT NOT NULL,
    `order_date` DATE NOT NULL,
    `expected_delivery_date` DATE DEFAULT NULL,
    `status` VARCHAR(30) DEFAULT 'draft' NOT NULL, -- Possible values: draft, pending_approval, approved, sent_to_supplier, partially_received, fully_received, cancelled
    `currency_id` INT NOT NULL,
    `total_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_vat_amount` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_amount_ttc` DECIMAL(15, 4) DEFAULT 0.0000,
    `shipping_address_id` INT DEFAULT NULL,
    `warehouse_id_for_delivery` INT DEFAULT NULL,
    `shop_id_for_delivery` INT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `approved_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL, -- Added for consistency with Model pattern
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `order_number_unique` (`order_number`),
    CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_po_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_po_shipping_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_po_warehouse` FOREIGN KEY (`warehouse_id_for_delivery`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_po_shop` FOREIGN KEY (`shop_id_for_delivery`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_po_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_po_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_po_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_order_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `purchase_order_items`;

CREATE TABLE `purchase_order_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `purchase_order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_ht` DECIMAL(15, 4) NOT NULL,
    `vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `total_line_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `quantity_received` DECIMAL(15, 3) DEFAULT 0.000,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_poi_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_poi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_poi_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_receptions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `purchase_receptions`;

CREATE TABLE `purchase_receptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `reception_number` VARCHAR(50) NOT NULL,
    `purchase_order_id` INT DEFAULT NULL,
    `supplier_id` INT NOT NULL,
    `reception_date` DATE NOT NULL,
    `warehouse_id` INT DEFAULT NULL,
    `shop_id` INT DEFAULT NULL,
    `received_by_user_id` INT NOT NULL,
    `updated_by_user_id` INT DEFAULT NULL, -- Added for consistency with Model pattern
    `status` VARCHAR(30) DEFAULT 'complete' NOT NULL, -- Possible values: partial, complete, pending_quality_check
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `reception_number_unique` (`reception_number`),
    CONSTRAINT `fk_pr_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_pr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pr_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pr_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pr_received_by` FOREIGN KEY (`received_by_user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pr_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `purchase_reception_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `purchase_reception_items`;

CREATE TABLE `purchase_reception_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `purchase_reception_id` INT NOT NULL,
    `purchase_order_item_id` BIGINT DEFAULT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `quantity_ordered` DECIMAL(15, 3) DEFAULT NULL,
    `quantity_received` DECIMAL(15, 3) NOT NULL,
    `lot_number` VARCHAR(100) DEFAULT NULL,
    `expiry_date` DATE DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_pri_reception` FOREIGN KEY (`purchase_reception_id`) REFERENCES `purchase_receptions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pri_order_item` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_pri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pri_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `supplier_invoices`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `supplier_invoices`;

CREATE TABLE `supplier_invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_number` VARCHAR(100) NOT NULL,
    `supplier_id` INT NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE DEFAULT NULL,
    `currency_id` INT NOT NULL,
    `total_amount_ht` DECIMAL(15, 4) NOT NULL,
    `total_vat_amount` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_amount_ttc` DECIMAL(15, 4) NOT NULL,
    `amount_paid` DECIMAL(15, 4) DEFAULT 0.0000 NOT NULL,
    `status` VARCHAR(25) DEFAULT 'pending_payment' NOT NULL, -- Possible values: draft, pending_payment, partially_paid, paid, cancelled
    `notes` TEXT DEFAULT NULL,
    `file_attachment_url` VARCHAR(2048) DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `supplier_invoice_number_unique` (
        `supplier_id`,
        `invoice_number`
    ),
    CONSTRAINT `fk_si_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_si_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_si_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_si_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `supplier_invoice_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `supplier_invoice_items`;

CREATE TABLE `supplier_invoice_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `supplier_invoice_id` INT NOT NULL,
    `product_id` INT DEFAULT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_ht` DECIMAL(15, 4) NOT NULL,
    `vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `total_line_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `purchase_reception_item_id` BIGINT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_sii_invoice` FOREIGN KEY (`supplier_invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sii_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_sii_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_sii_reception_item` FOREIGN KEY (`purchase_reception_item_id`) REFERENCES `purchase_reception_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `supplier_invoice_purchase_order_links`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `supplier_invoice_purchase_order_links`;

CREATE TABLE `supplier_invoice_purchase_order_links` (
    `supplier_invoice_id` INT NOT NULL,
    `purchase_order_id` INT NOT NULL,
    PRIMARY KEY (
        `supplier_invoice_id`,
        `purchase_order_id`
    ),
    CONSTRAINT `fk_si_po_link_invoice` FOREIGN KEY (`supplier_invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_si_po_link_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `supplier_returns`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `supplier_returns`;

CREATE TABLE `supplier_returns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `return_number` VARCHAR(50) NOT NULL,
    `supplier_id` INT NOT NULL,
    `return_date` DATE NOT NULL,
    `status` VARCHAR(30) DEFAULT 'requested' NOT NULL, -- Possible values: requested, approved, shipped, received_by_supplier, refunded, exchanged, cancelled
    `reason` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `return_number_unique` (`return_number`),
    CONSTRAINT `fk_sr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sr_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `supplier_return_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `supplier_return_items`;

CREATE TABLE `supplier_return_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `supplier_return_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_at_return` DECIMAL(15, 4) DEFAULT NULL,
    `purchase_reception_item_id` BIGINT DEFAULT NULL,
    CONSTRAINT `fk_sri_return` FOREIGN KEY (`supplier_return_id`) REFERENCES `supplier_returns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sri_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_sri_reception_item` FOREIGN KEY (`purchase_reception_item_id`) REFERENCES `purchase_reception_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- =====================================================
-- MODULE VENTES
-- =====================================================

-- -----------------------------------------------------
-- Table `quotes` (Devis)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `quotes`;

CREATE TABLE `quotes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `quote_number` VARCHAR(50) NOT NULL,
    `customer_id` INT NOT NULL,
    `issue_date` DATE NOT NULL,
    `expiry_date` DATE DEFAULT NULL,
    `status` VARCHAR(30) DEFAULT 'draft' NOT NULL, -- Possible values: draft, sent, accepted, refused, cancelled, converted_to_order
    `currency_id` INT NOT NULL,
    `total_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_vat_amount` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_amount_ttc` DECIMAL(15, 4) DEFAULT 0.0000,
    `shipping_address_id` INT DEFAULT NULL,
    `billing_address_id` INT NOT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL, -- Added for consistency with Model pattern
    `notes` TEXT DEFAULT NULL,
    `terms_and_conditions` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `quote_number_unique` (`quote_number`),
    CONSTRAINT `fk_q_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_q_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_q_shipping_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_q_billing_address` FOREIGN KEY (`billing_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_q_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_q_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `quote_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `quote_items`;

CREATE TABLE `quote_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `quote_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_ht` DECIMAL(15, 4) NOT NULL,
    `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
    `vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `total_line_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_qi_quote` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_qi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_qi_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `sales_orders`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `sales_orders`;

CREATE TABLE `sales_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_number` VARCHAR(50) NOT NULL,
    `customer_id` INT NOT NULL,
    `quote_id` INT DEFAULT NULL,
    `order_date` DATE NOT NULL,
    `status` VARCHAR(30) DEFAULT 'draft' NOT NULL, -- Possible values: draft, pending_approval, approved, pending_payment, payment_received, in_preparation, partially_shipped, fully_shipped, invoiced, cancelled
    `currency_id` INT NOT NULL,
    `total_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_vat_amount` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_amount_ttc` DECIMAL(15, 4) DEFAULT 0.0000,
    `shipping_fees_ht` DECIMAL(15, 4) DEFAULT 0.0000,
    `shipping_address_id` INT NOT NULL,
    `billing_address_id` INT NOT NULL,
    `dispatch_warehouse_id` INT DEFAULT NULL,
    `dispatch_shop_id` INT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL, -- Added for consistency with Model pattern
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `order_number_unique` (`order_number`),
    CONSTRAINT `fk_so_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_so_quote` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_so_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_so_shipping_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_so_billing_address` FOREIGN KEY (`billing_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_so_warehouse` FOREIGN KEY (`dispatch_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_so_shop` FOREIGN KEY (`dispatch_shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_so_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_so_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `sales_order_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `sales_order_items`;

CREATE TABLE `sales_order_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `sales_order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_ht` DECIMAL(15, 4) NOT NULL,
    `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
    `vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `total_line_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `quantity_shipped` DECIMAL(15, 3) DEFAULT 0.000,
    `quantity_invoiced` DECIMAL(15, 3) DEFAULT 0.000,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_soi_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_soi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_soi_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `deliveries` (Bons de livraison)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `deliveries`;

CREATE TABLE `deliveries` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `delivery_number` VARCHAR(50) NOT NULL,
    `sales_order_id` INT NOT NULL,
    `delivery_date` DATE NOT NULL,
    `status` VARCHAR(25) DEFAULT 'in_preparation' NOT NULL, -- Possible values: in_preparation, shipped, delivered, cancelled
    `shipping_address_id` INT NOT NULL,
    `carrier_name` VARCHAR(255) DEFAULT NULL,
    `tracking_number` VARCHAR(100) DEFAULT NULL,
    `dispatch_warehouse_id` INT DEFAULT NULL,
    `dispatch_shop_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,    UNIQUE KEY `delivery_number_unique` (`delivery_number`),
    CONSTRAINT `fk_d_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_d_shipping_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_d_warehouse` FOREIGN KEY (`dispatch_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_d_shop` FOREIGN KEY (`dispatch_shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_d_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_d_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `delivery_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `delivery_items`;

CREATE TABLE `delivery_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `delivery_id` INT NOT NULL,
    `sales_order_item_id` BIGINT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `quantity_shipped` DECIMAL(15, 3) NOT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_di_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_di_order_item` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_di_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_di_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_invoices`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_invoices`;

CREATE TABLE `customer_invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_number` VARCHAR(50) NOT NULL,
    `customer_id` INT NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'draft' NOT NULL, -- Possible values: draft, sent, partially_paid, paid, overdue, cancelled, voided
    `currency_id` INT NOT NULL,
    `total_amount_ht` DECIMAL(15, 4) NOT NULL,
    `total_vat_amount` DECIMAL(15, 4) DEFAULT 0.0000,
    `total_amount_ttc` DECIMAL(15, 4) NOT NULL,
    `amount_paid` DECIMAL(15, 4) DEFAULT 0.0000 NOT NULL,
    `billing_address_id` INT NOT NULL,
    `shipping_address_id` INT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `updated_by_user_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `terms_and_conditions` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `invoice_number_unique` (`invoice_number`),
    CONSTRAINT `fk_ci_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_billing_address` FOREIGN KEY (`billing_address_id`) REFERENCES `addresses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_shipping_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_invoice_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_invoice_items`;

CREATE TABLE `customer_invoice_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `customer_invoice_id` INT NOT NULL,
    `product_id` INT DEFAULT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_ht` DECIMAL(15, 4) NOT NULL,
    `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
    `vat_rate_percentage` DECIMAL(5, 2) DEFAULT NULL,
    `total_line_amount_ht` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `delivery_item_id` BIGINT DEFAULT NULL,
    `sales_order_item_id` BIGINT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_cii_invoice` FOREIGN KEY (`customer_invoice_id`) REFERENCES `customer_invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cii_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cii_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cii_delivery_item` FOREIGN KEY (`delivery_item_id`) REFERENCES `delivery_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cii_order_item` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_invoice_sales_order_links`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_invoice_sales_order_links`;

CREATE TABLE `customer_invoice_sales_order_links` (
    `customer_invoice_id` INT NOT NULL,
    `sales_order_id` INT NOT NULL,
    PRIMARY KEY (
        `customer_invoice_id`,
        `sales_order_id`
    ),
    CONSTRAINT `fk_ci_so_link_invoice` FOREIGN KEY (`customer_invoice_id`) REFERENCES `customer_invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ci_so_link_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_returns` (RMA)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_returns`;

CREATE TABLE `customer_returns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `return_number` VARCHAR(50) NOT NULL,
    `customer_id` INT NOT NULL,
    `sales_order_id` INT DEFAULT NULL,
    `customer_invoice_id` INT DEFAULT NULL,
    `return_date` DATE NOT NULL,
    `status` VARCHAR(30) DEFAULT 'requested' NOT NULL, -- Possible values: requested, approved, pending_reception, received, inspected, refunded, exchanged, rejected, cancelled
    `reason` TEXT DEFAULT NULL,
    `created_by_user_id` INT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `return_number_unique` (`return_number`),
    CONSTRAINT `fk_cr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_cr_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cr_invoice` FOREIGN KEY (`customer_invoice_id`) REFERENCES `customer_invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cr_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `customer_return_items`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `customer_return_items`;

CREATE TABLE `customer_return_items` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `customer_return_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_variant_id` INT DEFAULT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price_at_return` DECIMAL(15, 4) DEFAULT NULL,
    `condition` VARCHAR(20) DEFAULT NULL, -- Possible values: new, used, damaged
    `action_taken` VARCHAR(30) DEFAULT 'pending_inspection' -- Possible values: restock, discard, repair, pending_inspection
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- =====================================================
-- MODULE FINANCES
-- =====================================================

-- -----------------------------------------------------
-- Table `payment_methods`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `payment_methods`;

CREATE TABLE `payment_methods` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL, -- Possible values: cash, bank_transfer, check, card, other
    `is_active` TINYINT(1) DEFAULT 1,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `name_unique` (`name`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `bank_accounts`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `bank_accounts`;

CREATE TABLE `bank_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_name` VARCHAR(255) NOT NULL,
    `bank_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(100) DEFAULT NULL,
    `iban` VARCHAR(50) DEFAULT NULL,
    `swift_bic` VARCHAR(20) DEFAULT NULL,
    `currency_id` INT NOT NULL,
    `initial_balance` DECIMAL(15, 4) DEFAULT 0.0000,
    `current_balance` DECIMAL(15, 4) DEFAULT 0.0000,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `account_name_unique` (`account_name`),
    UNIQUE KEY `iban_unique_if_not_null` (`iban`),
    CONSTRAINT `fk_ba_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `cash_registers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `cash_registers`;

CREATE TABLE `cash_registers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `shop_id` INT DEFAULT NULL,
    `currency_id` INT NOT NULL,
    `current_balance` DECIMAL(15, 4) DEFAULT 0.0000,
    `is_active` TINYINT(1) DEFAULT 1,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `name_unique` (`name`),
    CONSTRAINT `fk_cr_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_cr_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `cash_register_sessions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `cash_register_sessions`;

CREATE TABLE `cash_register_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cash_register_id` INT NOT NULL,
    `opened_by_user_id` INT NOT NULL,
    `closed_by_user_id` INT DEFAULT NULL,
    `opening_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `closing_timestamp` TIMESTAMP NULL DEFAULT NULL,
    `opening_balance` DECIMAL(15, 4) NOT NULL,
    `closing_balance_theoretical` DECIMAL(15, 4) DEFAULT NULL,
    `closing_balance_actual` DECIMAL(15, 4) DEFAULT NULL,
    `difference_amount` DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
    `status` VARCHAR(10) DEFAULT 'open' NOT NULL, -- Possible values: open, closed
    `notes` TEXT DEFAULT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_crs_register` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_crs_opened_by` FOREIGN KEY (`opened_by_user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_crs_closed_by` FOREIGN KEY (`closed_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `payments`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `payments`;

CREATE TABLE `payments` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `payment_date` DATE NOT NULL,
    `amount` DECIMAL(15, 4) NOT NULL,
    `currency_id` INT NOT NULL,
    `payment_method_id` INT NOT NULL,
    `direction` VARCHAR(10) NOT NULL, -- Possible values: inbound, outbound
    `customer_id` INT DEFAULT NULL,
    `supplier_id` INT DEFAULT NULL,
    `customer_invoice_id` INT DEFAULT NULL,
    `supplier_invoice_id` INT DEFAULT NULL,
    `sales_order_id` INT DEFAULT NULL,
    `purchase_order_id` INT DEFAULT NULL,
    `bank_account_id` INT DEFAULT NULL,
    `cash_register_session_id` INT DEFAULT NULL,
    `reference_number` VARCHAR(255) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `recorded_by_user_id` INT NOT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_p_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_p_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_p_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_customer_invoice` FOREIGN KEY (`customer_invoice_id`) REFERENCES `customer_invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_supplier_invoice` FOREIGN KEY (`supplier_invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_sales_order` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_bank_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_cash_session` FOREIGN KEY (`cash_register_session_id`) REFERENCES `cash_register_sessions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_p_recorded_by` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `cash_register_transactions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `cash_register_transactions`;

CREATE TABLE `cash_register_transactions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `cash_register_session_id` INT NOT NULL,
    `transaction_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `type` VARCHAR(30) NOT NULL, -- Possible values: cash_in_pos_sale, cash_out_expense, cash_in_other, cash_out_other, cash_deposit_to_bank, cash_withdrawal_from_bank
    `amount` DECIMAL(15, 4) NOT NULL,
    `description` TEXT NOT NULL,
    `payment_method_id` INT DEFAULT NULL, -- Utile si une dépense est faite par un autre moyen depuis la caisse (rare)
    `related_sales_order_id` INT DEFAULT NULL,
    `user_id` INT NOT NULL,
    `deleted_time` TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT `fk_crt_session` FOREIGN KEY (`cash_register_session_id`) REFERENCES `cash_register_sessions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_crt_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_crt_order` FOREIGN KEY (`related_sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_crt_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `user_activity_logs`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user_activity_logs`;

CREATE TABLE `user_activity_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT DEFAULT NULL,
    `action_type` VARCHAR(255) NOT NULL,
    `entity_type` VARCHAR(100) DEFAULT NULL,
    `entity_id` INT DEFAULT NULL,
    `details_before` JSON DEFAULT NULL,
    `details_after` JSON DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` TEXT DEFAULT NULL,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- Index sur user_id et timestamp pour recherches rapides
CREATE INDEX `idx_user_activity_user_time` ON `user_activity_logs` (`user_id`, `timestamp`);

CREATE INDEX `idx_user_activity_entity` ON `user_activity_logs` (`entity_type`, `entity_id`);

-- -----------------------------------------------------
-- Table `notifications`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `notifications`;

CREATE TABLE `notifications` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` TINYINT(1) DEFAULT 0 NOT NULL,
    `read_at` TIMESTAMP NULL DEFAULT NULL,
    `related_entity_type` VARCHAR(100) DEFAULT NULL,
    `related_entity_id` VARCHAR(100) DEFAULT NULL,
    `link_url` VARCHAR(2048) DEFAULT NULL,
    `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT `fk_n_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (
    `user_id`,
    `is_read`,
    `created_time`
);

-- Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 1;
