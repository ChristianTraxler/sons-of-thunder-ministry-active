/* =============================================
   SERMONS.JS — Sermon CRUD Module
   localStorage key: sot_sermons (JSON array)
   ============================================= */

var Sermons = (function () {
	var STORAGE_KEY = 'sot_sermons';

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
		// If it's just an 11-char string, treat as video ID
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
		return null;
	}

	// Get all sermons sorted by date (newest first)
	function getAll() {
		var data = localStorage.getItem(STORAGE_KEY);
		var sermons = data ? JSON.parse(data) : [];
		sermons.sort(function (a, b) {
			return new Date(b.date) - new Date(a.date);
		});
		return sermons;
	}

	// Get a single sermon by ID
	function getById(id) {
		var sermons = getAll();
		for (var i = 0; i < sermons.length; i++) {
			if (sermons[i].id === id) return sermons[i];
		}
		return null;
	}

	// Save a new sermon
	function save(sermon) {
		var sermons = getAll();
		sermon.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
		sermon.youtubeId = parseYouTubeId(sermon.youtubeUrl);
		sermon.createdAt = new Date().toISOString();
		sermons.push(sermon);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sermons));
		return sermon;
	}

	// Update an existing sermon
	function update(id, updates) {
		var sermons = getAll();
		for (var i = 0; i < sermons.length; i++) {
			if (sermons[i].id === id) {
				for (var key in updates) {
					sermons[i][key] = updates[key];
				}
				sermons[i].youtubeId = parseYouTubeId(sermons[i].youtubeUrl);
				sermons[i].updatedAt = new Date().toISOString();
				localStorage.setItem(STORAGE_KEY, JSON.stringify(sermons));
				return sermons[i];
			}
		}
		return null;
	}

	// Remove a sermon by ID
	function remove(id) {
		var sermons = getAll();
		var filtered = sermons.filter(function (s) { return s.id !== id; });
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
