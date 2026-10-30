'use strict';

/* /privacy-choices — the "Your Privacy Choices" page linked from the footer.
 *
 * GET shows the current state and one button. POST records the choice and
 * redirects back (POST-redirect-GET, so a refresh does not resubmit).
 * The POST carries _csrf like every other form; the global guard checks it.
 *
 * See src/services/adPrivacy.js for what the choice actually does.
 */

const adPrivacy = require('../services/adPrivacy');

function render(req, res, saved) {
  const st = adPrivacy.status(req);
  res.render('pages/privacy-choices', {
    pageTitle: 'Your Privacy Choices | BathroomVanitiesOutlet.com',
    metaDesc:  'Opt out of sharing your browsing activity with advertising partners.',
    noindex:   true,
    optedOut:  st.optedOut,
    gpc:       st.gpc,
    cookie:    st.cookie,
    saved:     saved || '',
  });
}

exports.page = (req, res) => {
  const s = String(req.query.saved || '');
  render(req, res, s === 'out' || s === 'in' ? s : '');
};

exports.submit = (req, res) => {
  const choice = String((req.body && req.body.choice) || '');
  if (choice === 'optout') {
    adPrivacy.setOptOut(req, res, true);
    return res.redirect(303, '/privacy-choices?saved=out');
  }
  if (choice === 'optin') {
    adPrivacy.setOptOut(req, res, false);
    return res.redirect(303, '/privacy-choices?saved=in');
  }
  return res.redirect(303, '/privacy-choices');
};
