/* =============================================
   SERMONS.JS — Sermon CRUD Module (Supabase)

   All methods return promises. DB columns use
   snake_case; UI code uses camelCase, so this
   module translates at the boundary.
   ============================================= */

var Sermons = (function () {
	var TABLE = 'sermons';

	// Extract YouTube video ID from any URL format
	function parseYouTubeId(url) {
		if (!url) return null;
		url = url.trim();
		var patterns = [
			/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/,
			/youtu\.be\/([a-zA-Z0-9_-]{11})/,
			/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
			/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
			/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
		];
		for (var i = 0; i < patterns.length; i++) {
			var match = url.match(patterns[i]);
			if (match) return match[1];
		}
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
		return null;
	}

	// DB row → UI object
	function fromRow(row) {
		if (!row) return null;
		return {
			id: row.id,
			title: row.title || '',
			author: row.author || '',
			youtubeUrl: row.youtube_url || '',
			youtubeId: row.youtube_id || null,
			date: row.date || '',
			content: row.content || '',
			createdAt: row.created_at
		};
	}

	// UI object → DB row (for insert/update)
	function toRow(obj) {
		var row = {};
		if ('title' in obj)       row.title = obj.title;
		if ('author' in obj)      row.author = obj.author;
		if ('youtubeUrl' in obj)  row.youtube_url = obj.youtubeUrl;
		if ('date' in obj)        row.date = obj.date || null;
		if ('content' in obj)     row.content = obj.content;
		if ('youtubeUrl' in obj)  row.youtube_id = parseYouTubeId(obj.youtubeUrl);
		return row;
	}

	// Get all sermons sorted by date (newest first)
	function getAll() {
		return sb.from(TABLE)
			.select('*')
			.order('date', { ascending: false, nullsFirst: false })
			.then(function (res) {
				if (res.error) {
					console.error('Sermons.getAll', res.error);
					return [];
				}
				return (res.data || []).map(fromRow);
			});
	}

	function getById(id) {
		return sb.from(TABLE)
			.select('*')
			.eq('id', id)
			.single()
			.then(function (res) {
				if (res.error) return null;
				return fromRow(res.data);
			});
	}

	function save(sermon) {
		return sb.from(TABLE)
			.insert(toRow(sermon))
			.select()
			.single()
			.then(function (res) {
				if (res.error) {
					console.error('Sermons.save', res.error);
					throw res.error;
				}
				return fromRow(res.data);
			});
	}

	function update(id, updates) {
		return sb.from(TABLE)
			.update(toRow(updates))
			.eq('id', id)
			.select()
			.single()
			.then(function (res) {
				if (res.error) {
					console.error('Sermons.update', res.error);
					throw res.error;
				}
				return fromRow(res.data);
			});
	}

	function remove(id) {
		return sb.from(TABLE)
			.delete()
			.eq('id', id)
			.then(function (res) {
				if (res.error) {
					console.error('Sermons.remove', res.error);
					throw res.error;
				}
			});
	}

	return {
		parseYouTubeId: parseYouTubeId,
		getAll: getAll,
		getById: getById,
		save: save,
		update: update,
		remove: remove
	};
})();
