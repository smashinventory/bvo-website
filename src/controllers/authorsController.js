'use strict';
/**
 * authorsController.js — /authors/:slug
 *
 * One page per author: photo, credential line, bio, and the guides they
 * wrote. It exists for two reasons that pull in the same direction.
 *
 * FOR READERS, it answers "who is telling me this". The guides give
 * opinionated advice about where to spend money on a renovation; a name
 * with a face and a track record behind it is the difference between
 * advice and copy.
 *
 * FOR SEARCH, it is the destination for the byline link and the `url` on
 * the Person in each guide's Article schema. An author with no page is a
 * string; an author with a page is an entity that can be linked to,
 * cited, and connected to the Organization.
 *
 * ⚠️ NOT INDEXED WHEN EMPTY. An author with no visible guides renders a
 * page with a bio and nothing else, which is a thin page in Google's
 * sense. The template emits noindex in that case. This matters more than
 * it looks: a site that has just lost ~70% of its organic traffic cannot
 * afford to add thin pages to the index while trying to recover.
 */

const { bvoPool } = require('../config/database');
const sd          = require('../utils/structuredData');

/* Shared with the inspiration controller so the byline, the profile page
   and the JSON-LD cannot disagree about what an author is. */
const AUTHOR_COLUMNS =
  'id, slug, name, credential, bio, image_base, image_alt, same_as';

/**
 * Look an author up by slug. Returns null when absent or hidden.
 * Fails SOFT: a missing `authors` table (migration not yet run) must not
 * take the guide pages down with it, so the caller gets null and renders
 * without a byline.
 */
async function bySlug(slug) {
  try {
    const [[row]] = await bvoPool.query(
      `SELECT ${AUTHOR_COLUMNS} FROM authors WHERE slug = ? AND is_visible = 1`,
      [slug]
    );
    return row || null;
  } catch {
    return null;
  }
}

/** Same, by id — the join key on pages.author_id. */
async function byId(id) {
  if (!id) return null;
  try {
    const [[row]] = await bvoPool.query(
      `SELECT ${AUTHOR_COLUMNS} FROM authors WHERE id = ? AND is_visible = 1`,
      [id]
    );
    return row || null;
  } catch {
    return null;
  }
}

/* same_as is one URL per line in the DB. Anything that is not an http(s)
   URL is dropped rather than rendered — this value reaches both an href
   and a JSON-LD sameAs, and an unvalidated string in either is a hole. */
function sameAsList(raw) {
  return String(raw || '')
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => /^https?:\/\/[^\s"'<>]+$/i.test(s));
}

exports.bySlug = bySlug;
exports.byId   = byId;
exports.sameAsList = sameAsList;

exports.profile = async (req, res) => {
  const siteUrl = process.env.SITE_URL || 'https://www.bathroomvanitiesoutlet.com';

  try {
    const author = await bySlug(req.params.slug);
    if (!author) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
      });
    }

    /* The guides they wrote. Ordered newest first where a publish date
       exists, so the page leads with current work. */
    let guides = [];
    try {
      const [rows] = await bvoPool.query(
        `SELECT slug, title, meta_desc, og_image, published_at
         FROM   pages
         WHERE  author_id = ? AND page_type = 'inspiration' AND is_visible = 1
         ORDER  BY published_at DESC, sort_order ASC, id ASC
         LIMIT  60`,
        [author.id]
      );
      guides = rows;
    } catch { guides = []; }

    const links = sameAsList(author.same_as);

    /* Person JSON-LD. worksFor ties the author to the Organization, which
       is what makes the two entities one graph rather than two strings. */
    /* ⚠️ THIS NEVER RENDERED EITHER. Same cause as the guide pages: it was
       passed to res.render as `script:`, and express-ejs-layouts wipes
       that local and refills it only from <script> tags found in the
       rendered view (express-layouts.js:98-99, `layout extractScripts`
       is on in server.js:504). Author pages have been serving with no
       structured data since they shipped.

       Now emitted by views/pages/author.ejs from the `jsonLd` local, and
       joined to the shared graph so worksFor resolves by @id to the one
       OnlineStore node instead of declaring a third copy of the company.

       The Person's own fields are unchanged. Its @id matches the one the
       guide pages use for the same author, so Google resolves the byline
       on an article and this profile page to a single entity. */
    const _person = {
      '@type': 'Person',
      '@id':   `${siteUrl}/authors/${author.slug}#person`,
      name:    author.name,
      url:     `${siteUrl}/authors/${author.slug}`,
      ...(author.image_base ? { image: `${siteUrl}${author.image_base}-320.png` } : {}),
      ...(author.credential ? { jobTitle: String(author.credential).split('·')[0].trim() } : {}),
      worksFor: sd.ref(sd.ID.organization),
      ...(links.length ? { sameAs: links } : {}),
    };

    /* ⚠️ NO BREADCRUMB NODE HERE, DELIBERATELY. The first version of this
       emitted Home > Authors > <name>, and both halves of that were
       wrong:

         * views/pages/author.ejs renders NO visible breadcrumb trail, and
           Google requires BreadcrumbList to describe markup the user can
           actually see. Inventing a trail to look more organised is a
           guidelines violation, not a free win.
         * there is no public /authors index to link to. The only route is
           /admin/authors (src/routes/admin.js:133), so the middle crumb
           would have pointed at a 404.

       If a visible trail is ever added to this template, add the node
       then - and only then. */
    const jsonLd = sd.scriptTag(sd.pageGraph({
      url:      `/authors/${author.slug}`,
      name:     author.name,
      settings: res.locals.settings,
      nodes:    [_person],
    }));

    res.render('pages/author', {
      layout:       'layouts/main',
      pageTitle:    `${author.name} | BathroomVanitiesOutlet.com`,
      metaDesc:     author.credential
        || `${author.name}, writing on bathroom renovation for BathroomVanitiesOutlet.com.`,
      canonicalUrl: `${siteUrl}/authors/${author.slug}`,
      /* ⚠️ Thin-page guard — see the header comment. The layout's local is
         a BOOLEAN called `noindex`, not a robots string; it emits
         <meta name="robots" content="noindex,follow"> itself. Checked in
         views/layouts/main.ejs rather than assumed — the first draft of
         this file passed `robots: 'noindex,follow'`, which the layout
         ignores silently, so the thin-page guard would have done nothing
         while looking correct. */
      noindex:      guides.length === 0,
      style:        '',
      jsonLd,
      author,
      links,
      guides,
    });
  } catch (err) {
    console.error('[authors] profile failed:', err.message);
    res.status(500).render('pages/404', {
      pageTitle: 'Something went wrong | BathroomVanitiesOutlet.com',
    });
  }
};


/* ══════════════════════════════════════════════════════════════════════
   ADMIN — list, create, edit
   ══════════════════════════════════════════════════════════════════════
   NO DELETE, deliberately. pages.author_id carries no foreign key (same
   reasoning as sample_redemptions.customer_id: a cascade would make
   deleting a row the way to erase attribution). Without one, deleting an
   author silently orphans every article pointing at them - the byline
   vanishes and the Article schema quietly falls back to Organization,
   with nothing to indicate why. `is_visible` does the same job
   reversibly: hide the author, keep the link intact.
*/

exports.adminList = async (req, res) => {
  try {
    const [rows] = await bvoPool.query(
      `SELECT a.id, a.slug, a.name, a.credential, a.is_visible, a.image_base,
              COUNT(p.id) AS guide_count
       FROM   authors a
       LEFT   JOIN pages p ON p.author_id = a.id
                          AND p.page_type = 'inspiration' AND p.is_visible = 1
       GROUP  BY a.id
       ORDER  BY a.name`
    );
    res.render('pages/admin/authors', {
      layout: 'layouts/admin', pageTitle: 'Authors | BVO Admin',
      activePage: 'authors', authors: rows, flash: req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    /* The table may not exist yet if the migration has not been run. Say
       so plainly instead of showing an empty list that looks like "no
       authors" - those are very different problems. */
    console.error('[authors] adminList:', err.message);
    res.render('pages/admin/authors', {
      layout: 'layouts/admin', pageTitle: 'Authors | BVO Admin',
      activePage: 'authors', authors: [],
      flash: { type: 'error', msg: 'Could not read the authors table. Has migrations/2026-10-05_authors_RUNME.sql been run?' },
    });
  }
};

exports.adminNew = (req, res) => {
  res.render('pages/admin/author-edit', {
    layout: 'layouts/admin', pageTitle: 'New Author | BVO Admin',
    activePage: 'authors', author: null, flash: null,
  });
};

exports.adminEdit = async (req, res) => {
  try {
    const [[author]] = await bvoPool.query('SELECT * FROM authors WHERE id = ?', [req.params.id]);
    if (!author) return res.redirect('/admin/authors');
    res.render('pages/admin/author-edit', {
      layout: 'layouts/admin', pageTitle: `Edit: ${author.name} | BVO Admin`,
      activePage: 'authors', author, flash: req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[authors] adminEdit:', err.message);
    res.redirect('/admin/authors');
  }
};

/* Shared by create and update so the two cannot validate differently. */
function _formValues(body) {
  const b = body || {};
  const vis = Array.isArray(b.is_visible) ? b.is_visible[b.is_visible.length - 1] : b.is_visible;
  return {
    name:       String(b.name || '').trim(),
    slug:       String(b.slug || b.name || '').trim().toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120),
    credential: String(b.credential || '').trim(),
    bio:        String(b.bio || ''),
    image_base: String(b.image_base || '').trim(),
    image_alt:  String(b.image_alt || '').trim(),
    /* One URL per line, http(s) only. This value reaches an href AND a
       JSON-LD sameAs, so anything else is dropped rather than stored. */
    same_as:    sameAsList(b.same_as).join('\n'),
    is_visible: (vis === 'true' || vis === '1') ? 1 : 0,
  };
}

exports.adminSave = async (req, res) => {
  const id = req.params.id || null;
  const v  = _formValues(req.body);

  if (!v.name || !v.slug) {
    return res.status(422).render('pages/admin/author-edit', {
      layout: 'layouts/admin', pageTitle: id ? 'Edit Author | BVO Admin' : 'New Author | BVO Admin',
      activePage: 'authors', author: { ...(req.body || {}), id },
      flash: { type: 'error', msg: 'Name is required.' },
    });
  }

  try {
    if (id) {
      await bvoPool.query(
        `UPDATE authors SET slug=?, name=?, credential=?, bio=?, image_base=?,
         image_alt=?, same_as=?, is_visible=? WHERE id=?`,
        [v.slug, v.name, v.credential, v.bio, v.image_base, v.image_alt, v.same_as, v.is_visible, id]
      );
    } else {
      await bvoPool.query(
        `INSERT INTO authors (slug, name, credential, bio, image_base, image_alt, same_as, is_visible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.slug, v.name, v.credential, v.bio, v.image_base, v.image_alt, v.same_as, v.is_visible]
      );
    }
    req.session.flash = { type: 'success', msg: `Author saved.` };
    res.redirect('/admin/authors');
  } catch (err) {
    const dup = err && err.code === 'ER_DUP_ENTRY';
    console.error('[authors] adminSave:', err.message);
    res.status(dup ? 422 : 500).render('pages/admin/author-edit', {
      layout: 'layouts/admin', pageTitle: 'Edit Author | BVO Admin',
      activePage: 'authors', author: { ...(req.body || {}), id },
      flash: { type: 'error', msg: dup
        ? `The slug "${v.slug}" is already used by another author.`
        : 'Could not save — check the server log.' },
    });
  }
};
