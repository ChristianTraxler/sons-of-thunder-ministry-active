/* =============================================
   EVENTS.JS — Event CRUD Module (Supabase)

   All methods return promises. DB columns use
   snake_case; UI code uses camelCase, so this
   module translates at the boundary.

   Also exposes formatting helpers used by both
   the admin list and the public event cards.
   ============================================= */

var Events = (function () {
	var TABLE = 'events';

	// DB row → UI object
	function fromRow(row) {
		if (!row) return null;
		return {
			id: row.id,
			title: row.title || '',
			eventDate: row.event_date || '',
			startTime: row.start_time || '',
			endTime: row.end_time || '',
			location: row.location || '',
			description: row.description || '',
			linkUrl: row.link_url || '',
			category: row.category || 'church',
			createdAt: row.created_at
		};
	}

	// UI object → DB row (for insert/update)
	function toRow(obj) {
		var row = {};
		if ('title' in obj)       row.title = obj.title;
		if ('eventDate' in obj)   row.event_date = obj.eventDate || null;
		if ('startTime' in obj)   row.start_time = obj.startTime || null;
		if ('endTime' in obj)     row.end_time = obj.endTime || null;
		if ('location' in obj)    row.location = obj.location || null;
		if ('description' in obj) row.description = obj.description || null;
		if ('linkUrl' in obj)     row.link_url = obj.linkUrl || null;
		if ('category' in obj)    row.category = obj.category;
		return row;
	}

	// "Today" in America/New_York as YYYY-MM-DD
	function todayNY() {
		var parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/New_York',
			year: 'numeric', month: '2-digit', day: '2-digit'
		}).format(new Date());
		return parts; // en-CA already produces YYYY-MM-DD
	}

	function getAll() {
		return sb.from(TABLE)
			.select('*')
			.order('event_date', { ascending: true })
			.then(function (res) {
				if (res.error) { console.error('Events.getAll', res.error); return []; }
				return (res.data || []).map(fromRow);
			});
	}

	function getUpcoming(limit) {
		var q = sb.from(TABLE)
			.select('*')
			.gte('event_date', todayNY())
			.order('event_date', { ascending: true });
		if (typeof limit === 'number') q = q.limit(limit);
		return q.then(function (res) {
			if (res.error) { console.error('Events.getUpcoming', res.error); return []; }
			return (res.data || []).map(fromRow);
		});
	}

	function getPast() {
		return sb.from(TABLE)
			.select('*')
			.lt('event_date', todayNY())
			.order('event_date', { ascending: false })
			.then(function (res) {
				if (res.error) { console.error('Events.getPast', res.error); return []; }
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

	function save(event) {
		return sb.from(TABLE)
			.insert(toRow(event))
			.select()
			.single()
			.then(function (res) {
				if (res.error) { console.error('Events.save', res.error); throw res.error; }
				return fromRow(res.data);
			});
	}

	function update(id, patch) {
		return sb.from(TABLE)
			.update(toRow(patch))
			.eq('id', id)
			.select()
			.single()
			.then(function (res) {
				if (res.error) { console.error('Events.update', res.error); throw res.error; }
				return fromRow(res.data);
			});
	}

	function remove(id) {
		return sb.from(TABLE)
			.delete()
			.eq('id', id)
			.then(function (res) {
				if (res.error) { console.error('Events.remove', res.error); throw res.error; }
			});
	}

	// ---- Formatting helpers ----

	function formatDate(ymd) {
		if (!ymd) return '';
		var d = new Date(ymd + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
		});
	}

	function formatDateBadge(ymd) {
		if (!ymd) return { month: '', day: '' };
		var d = new Date(ymd + 'T00:00:00');
		return {
			month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
			day: String(d.getDate())
		};
	}

	function formatTime(hms) {
		if (!hms) return '';
		// hms is "HH:MM" or "HH:MM:SS"
		var parts = hms.split(':');
		var h = parseInt(parts[0], 10);
		var m = parts[1] || '00';
		var suffix = h >= 12 ? 'PM' : 'AM';
		var h12 = h % 12 === 0 ? 12 : h % 12;
		return h12 + ':' + m + ' ' + suffix;
	}

	function formatTimeRange(start, end) {
		if (!start && !end) return 'All day';
		if (start && !end)  return formatTime(start);
		if (!start && end)  return 'Until ' + formatTime(end);
		return formatTime(start) + ' – ' + formatTime(end);
	}

	return {
		todayNY: todayNY,
		getAll: getAll,
		getUpcoming: getUpcoming,
		getPast: getPast,
		getById: getById,
		save: save,
		update: update,
		remove: remove,
		formatDate: formatDate,
		formatDateBadge: formatDateBadge,
		formatTime: formatTime,
		formatTimeRange: formatTimeRange
	};
})();
