<?php
/**
 * Template Name: Landing Page
 * Description: Minimal landing page template — paste your static HTML into the <main> section.
 *
 * Install: copy to your active theme folder (wp-content/themes/your-theme/) and
 * then create a WP Page and choose this template in Page Attributes.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php wp_title( '' ); ?></title>
  <?php wp_head(); ?>
  <style>
    /* Minimal reset for landing pages; remove if your theme provides styles */
    html,body{height:100%;margin:0}
    main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  </style>
</head>
<body <?php body_class(); ?>>
  <?php
  // Optional: include header markup from the theme (uncomment if desired)
  // get_header();
  ?>
  <main>
    <!-- Paste your static HTML below -->
    <section id="hero" style="width:100%;max-width:1200px;padding:48px;text-align:center">
      <h1>Welcome to Our Site</h1>
      <p>Replace this content with your landing page HTML.</p>
    </section>
  </main>
  <?php
  // Optional: include footer markup from the theme (uncomment if desired)
  // get_footer();
  wp_footer();
  ?>
</body>
</html>
