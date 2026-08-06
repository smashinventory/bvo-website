-- ============================================================
-- 012_cms_pages_blog_menus.sql
-- CMS: Pages, Blog Posts, Nav Menus
-- ============================================================

-- ── Pages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  title       VARCHAR(500) NOT NULL,
  content     MEDIUMTEXT,
  meta_title  VARCHAR(255),
  meta_desc   VARCHAR(500),
  og_image    VARCHAR(500),
  is_visible  TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT NOW(),
  updated_at  DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_pages_slug    (slug),
  INDEX idx_pages_visible (is_visible, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed default pages ────────────────────────────────────────
INSERT IGNORE INTO pages (slug, title, content, meta_title, meta_desc, is_visible, sort_order) VALUES
('about-us', 'About Us',
 '<h2>Our Story</h2><p>BathroomVanitiesOutlet.com is your destination for premium bathroom vanities, mirrors, faucets and accessories at outlet prices. We believe every bathroom deserves to be beautiful without breaking the budget.</p><h2>Why Choose Us?</h2><ul><li>Free shipping on every order</li><li>Expert customer support</li><li>Curated selection of quality products</li></ul>',
 'About Us | BathroomVanitiesOutlet.com',
 'Learn about BathroomVanitiesOutlet.com — your destination for premium bathroom vanities at outlet prices with free shipping.',
 1, 10),

('contact-us', 'Contact Us',
 '<h2>Get in Touch</h2><p>Have a question about an order or need help choosing the right vanity? We''re here to help.</p><p><strong>Email:</strong> support@bathroomvanitiesoutlet.com</p><p><strong>Hours:</strong> Monday–Friday, 9am–5pm ET</p>',
 'Contact Us | BathroomVanitiesOutlet.com',
 'Contact BathroomVanitiesOutlet.com for help with orders, product questions, or anything else.',
 1, 20),

('shipping-policy', 'Shipping Policy',
 '<h2>Free Shipping on Every Order</h2><p>We offer free standard shipping on all orders within the contiguous United States. Orders typically ship within 1–3 business days.</p><h2>Delivery Times</h2><p>Standard delivery: 5–10 business days. Freight items (large vanities) may require additional time and white-glove delivery options are available.</p>',
 'Shipping Policy | BathroomVanitiesOutlet.com',
 'Learn about our free shipping policy, delivery times, and freight delivery options.',
 1, 30),

('returns-policy', 'Returns & Refunds',
 '<h2>30-Day Return Policy</h2><p>We want you to love your purchase. If you''re not completely satisfied, you may return most items within 30 days of delivery for a refund or exchange.</p><h2>How to Return</h2><p>Contact our support team to initiate a return. Items must be in original condition and packaging.</p>',
 'Returns & Refunds | BathroomVanitiesOutlet.com',
 'Our 30-day return policy — easy returns and exchanges on most bathroom vanity orders.',
 1, 40),

('privacy-policy', 'Privacy Policy',
 '<h2>Privacy Policy</h2><p>Your privacy is important to us. This policy explains how BathroomVanitiesOutlet.com collects, uses, and protects your personal information.</p><h2>Information We Collect</h2><p>We collect information you provide directly (name, email, shipping address) and automatically (browsing data, cookies) to process orders and improve your experience.</p><h2>Contact</h2><p>Questions about privacy? Email us at privacy@bathroomvanitiesoutlet.com</p>',
 'Privacy Policy | BathroomVanitiesOutlet.com',
 'Read our privacy policy to learn how we collect, use, and protect your personal information.',
 1, 50),

('terms-and-conditions', 'Terms & Conditions',
 '<h2>Terms and Conditions</h2><p>By using BathroomVanitiesOutlet.com, you agree to these terms. Please read them carefully.</p><h2>Use of Site</h2><p>This website is provided for personal, non-commercial use. You may not reproduce, distribute, or exploit any content without written permission.</p>',
 'Terms & Conditions | BathroomVanitiesOutlet.com',
 'Terms and conditions for using BathroomVanitiesOutlet.com.',
 1, 60);


-- ── Blog Posts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  slug           VARCHAR(255) NOT NULL UNIQUE,
  title          VARCHAR(500) NOT NULL,
  content        MEDIUMTEXT,
  excerpt        TEXT,
  featured_image VARCHAR(500),
  author         VARCHAR(255) NOT NULL DEFAULT 'BVO Team',
  tags           VARCHAR(500),
  is_visible     TINYINT(1)   NOT NULL DEFAULT 0,
  published_at   DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT NOW(),
  updated_at     DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_blog_slug            (slug),
  INDEX idx_blog_visible_pub     (is_visible, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Nav Menus ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nav_menus (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  handle     VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nav_menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  menu_id      INT          NOT NULL,
  label        VARCHAR(255) NOT NULL,
  url          VARCHAR(500) NOT NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  is_highlight TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY  (menu_id) REFERENCES nav_menus(id) ON DELETE CASCADE,
  INDEX idx_menu_items_sort (menu_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default menus
INSERT IGNORE INTO nav_menus (name, handle) VALUES
  ('Main Menu', 'main-menu'),
  ('Footer',    'footer');

-- Seed main menu items (mirrors current hardcoded nav)
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order, is_highlight)
SELECT m.id, v.label, v.url, v.sort_order, v.is_highlight
FROM nav_menus m
JOIN (
  SELECT 'Vanities'       AS label, '/collections/bathroom-vanities' AS url, 10 AS sort_order, 0 AS is_highlight UNION ALL
  SELECT 'Mirrors',              '/collections/bathroom-mirrors',              20, 0 UNION ALL
  SELECT 'Faucets',              '/collections/faucets',                       30, 0 UNION ALL
  SELECT 'Accessories',          '/collections/accessories',                   40, 0 UNION ALL
  SELECT 'Bundle Builder',       '/bundle-builder',                            50, 0 UNION ALL
  SELECT 'Sale',                 '/collections/bathroom-vanities?on_sale=1',  60, 1
) v ON m.handle = 'main-menu'
WHERE NOT EXISTS (SELECT 1 FROM nav_menu_items ni WHERE ni.menu_id = m.id LIMIT 1);

-- Seed footer menu items
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order, is_highlight)
SELECT m.id, v.label, v.url, v.sort_order, 0
FROM nav_menus m
JOIN (
  SELECT 'About Us'          AS label, '/pages/about-us'          AS url, 10 AS sort_order UNION ALL
  SELECT 'Contact Us',                 '/pages/contact-us',                20 UNION ALL
  SELECT 'Shipping Policy',            '/pages/shipping-policy',           30 UNION ALL
  SELECT 'Returns & Refunds',          '/pages/returns-policy',            40 UNION ALL
  SELECT 'Privacy Policy',             '/pages/privacy-policy',            50 UNION ALL
  SELECT 'Terms & Conditions',         '/pages/terms-and-conditions',      60
) v ON m.handle = 'footer'
WHERE NOT EXISTS (SELECT 1 FROM nav_menu_items ni WHERE ni.menu_id = m.id LIMIT 1);
