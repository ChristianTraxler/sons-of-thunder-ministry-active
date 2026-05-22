/* =============================================
   SETTINGS.JS — Site Settings Module (Supabase)

   The `site_settings` table holds a single row
   with id = 1. Reads are public; writes require
   an authenticated admin session.
   ============================================= */

var Settings = (function () {
	var TABLE = 'site_settings';
	var ROW_ID = 1;

	// Fields exposed to the UI — keep in sync with the DB schema
	var FIELDS = [
		'hero_title', 'hero_subtitle',
		'mission_text', 'about_text',
		'verse_text', 'verse_reference',
		'contact_first_name', 'contact_last_name',
		'contact_email', 'contact_phone', 'contact_address',
		'facebook_url', 'instagram_url', 'youtube_url',
		'donation_enabled', 'donation_url'
	];

	function get() {
		return sb.from(TABLE)
			.select('*')
			.eq('id', ROW_ID)
			.single()
			.then(function (res) {
				if (res.error) {
					console.error('Settings.get', res.error);
					return null;
				}
				return res.data;
			});
	}

	// Partial update — only the keys in `patch` are written
	function update(patch) {
		var clean = {};
		FIELDS.forEach(function (key) {
			if (key in patch) clean[key] = patch[key];
		});
		clean.updated_at = new Date().toISOString();

		return sb.from(TABLE)
			.update(clean)
			.eq('id', ROW_ID)
			.select()
			.single()
			.then(function (res) {
				if (res.error) {
					console.error('Settings.update', res.error);
					throw res.error;
				}
				return res.data;
			});
	}

	return {
		FIELDS: FIELDS,
		get: get,
		update: update
	};
})();
