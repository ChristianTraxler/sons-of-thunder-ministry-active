/* =============================================
   SITE-SETTINGS-LOADER.JS — Public-site settings

   Reads the single site_settings row from
   Supabase and applies it to DOM elements
   tagged with:

     data-setting="key"        → overrides textContent
     data-setting-link="key"   → sets href; hides element when empty
     data-setting-donation     → special handling for the donation button
                                 (honors donation_enabled + donation_url)

   Fallback: hardcoded HTML stays in place if
   the fetch fails or a setting is empty.
   ============================================= */

(function () {
	if (typeof sb === 'undefined') return;

	sb.from('site_settings')
		.select('*')
		.eq('id', 1)
		.single()
		.then(function (res) {
			if (res.error || !res.data) return;
			apply(res.data);
		});

	function apply(row) {
		// ---- Text overrides ----
		document.querySelectorAll('[data-setting]').forEach(function (el) {
			var key = el.getAttribute('data-setting');
			var val = row[key];
			if (val != null && String(val).trim() !== '') {
				el.textContent = val;
				if (el.hasAttribute('data-setting-hide-when-empty')) {
					el.style.display = '';
				}
			} else if (el.hasAttribute('data-setting-hide-when-empty')) {
				el.style.display = 'none';
			}
		});

		// ---- Link elements with optional show/hide ----
		document.querySelectorAll('[data-setting-link]').forEach(function (el) {
			var key = el.getAttribute('data-setting-link');
			var val = row[key];
			if (val && String(val).trim() !== '') {
				var href = String(val).trim();
				if (key === 'contact_email' && href.indexOf('mailto:') !== 0) {
					href = 'mailto:' + href;
				} else if (key === 'contact_phone') {
					href = 'tel:' + href.replace(/[^0-9+]/g, '');
				}
				el.setAttribute('href', href);
				el.style.display = '';
			} else if (el.hasAttribute('data-setting-hide-when-empty')) {
				el.style.display = 'none';
			}
		});

		// ---- Donation button ----
		document.querySelectorAll('[data-setting-donation]').forEach(function (el) {
			var enabled = !!row.donation_enabled;
			var url = (row.donation_url || '').trim();
			if (enabled && url) {
				el.setAttribute('href', url);
				el.onclick = null;
				if (/^https?:/i.test(url)) {
					el.setAttribute('target', '_blank');
					el.setAttribute('rel', 'noopener');
				} else {
					el.removeAttribute('target');
					el.removeAttribute('rel');
				}
			} else {
				el.setAttribute('href', '#');
				el.onclick = function (e) { e.preventDefault(); };
				el.removeAttribute('target');
				el.removeAttribute('rel');
			}
		});
	}
})();
