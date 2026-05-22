/* =============================================
   EVENTS-ADMIN.JS — Admin Calendar of Events

   Binds the Content-tab events list, add/edit
   modal, and delete flow. Reuses the existing
   RichEditor for the description field and the
   existing delete modal for confirmations.
   ============================================= */

var EventsAdmin = (function () {
	var listEl, addBtn, modal, modalTitle;
	var titleInput, dateInput, startInput, endInput, locInput, linkInput;
	var categoryRadios;
	var cancelBtn, saveBtn;
	var editor; // RichEditor instance id (string)
	var editingId = null;
	var deletingId = null;
	var showToast, openDeleteModal;

	var viewYear = null;    // integer, e.g., 2026
	var viewMonth = null;   // 0-indexed, 0 = January
	var allEventsCache = [];
	var calGridEl, calTitleEl, calPrevBtn, calNextBtn, calTodayBtn;

	function init(opts) {
		showToast = opts.showToast;
		openDeleteModal = opts.openDeleteModal;

		listEl       = document.getElementById('eventsAdminList');
		addBtn        = document.getElementById('addEventBtn');
		modal        = document.getElementById('eventModal');
		modalTitle   = document.getElementById('eventModalTitle');
		titleInput   = document.getElementById('evTitle');
		dateInput    = document.getElementById('evDate');
		startInput   = document.getElementById('evStart');
		endInput     = document.getElementById('evEnd');
		locInput     = document.getElementById('evLocation');
		linkInput    = document.getElementById('evLink');
		categoryRadios = document.getElementsByName('evCategory');
		cancelBtn    = document.getElementById('evCancelBtn');
		saveBtn      = document.getElementById('evSaveBtn');

		editor = RichEditor.init('evEditorWrapper', { placeholder: 'Describe the event here\u2026' });

		calGridEl    = document.getElementById('calGrid');
		calTitleEl   = document.getElementById('calTitle');
		calPrevBtn   = document.getElementById('calPrevBtn');
		calNextBtn   = document.getElementById('calNextBtn');
		calTodayBtn  = document.getElementById('calTodayBtn');

		var now = new Date();
		viewYear = now.getFullYear();
		viewMonth = now.getMonth();

		calPrevBtn.addEventListener('click', function () { shiftMonth(-1); });
		calNextBtn.addEventListener('click', function () { shiftMonth(1); });
		calTodayBtn.addEventListener('click', function () {
			var t = new Date();
			viewYear = t.getFullYear();
			viewMonth = t.getMonth();
			renderAll();
		});

		addBtn.addEventListener('click', function () { openModal('add'); });
		cancelBtn.addEventListener('click', closeModal);
		saveBtn.addEventListener('click', onSave);

		modal.addEventListener('click', function (e) {
			if (e.target === modal) closeModal();
		});

		renderAll();
	}

	function escapeHtml(str) {
		var d = document.createElement('div');
		d.textContent = str == null ? '' : str;
		return d.innerHTML;
	}

	function getSelectedCategory() {
		for (var i = 0; i < categoryRadios.length; i++) {
			if (categoryRadios[i].checked) return categoryRadios[i].value;
		}
		return 'church';
	}

	function setSelectedCategory(value) {
		var target = value === 'track' ? 'track' : 'church';
		for (var i = 0; i < categoryRadios.length; i++) {
			categoryRadios[i].checked = (categoryRadios[i].value === target);
		}
	}

	function categoryLabel(value) {
		return value === 'track' ? 'Track' : 'Church';
	}

	function pad(n) { return n < 10 ? '0' + n : '' + n; }

	function escapeAttr(str) {
		return escapeHtml(str).replace(/"/g, '&quot;');
	}

	function renderAll() {
		listEl.innerHTML = '<p class="sidebar-empty">Loading\u2026</p>';
		if (calGridEl) calGridEl.innerHTML = '';
		Events.getAll().then(function (events) {
			allEventsCache = events || [];
			renderCalendar();
			renderListFromCache();
		});
	}

	function renderListFromCache() {
		var today = Events.todayNY();
		var upcoming = [];
		var past = [];
		allEventsCache.forEach(function (ev) {
			if (ev.eventDate && ev.eventDate >= today) upcoming.push(ev);
			else past.push(ev);
		});
		past.sort(function (a, b) { return (a.eventDate < b.eventDate) ? 1 : -1; });

		if (upcoming.length === 0 && past.length === 0) {
			listEl.innerHTML = '<p class="sidebar-empty">No events yet. Click Add Event to create one.</p>';
			return;
		}
		var html = '';
		if (upcoming.length > 0) {
			html += '<div class="events-admin-subhead">Upcoming</div>';
			upcoming.forEach(function (ev) { html += rowHtml(ev, false); });
		}
		if (past.length > 0) {
			html += '<div class="events-admin-subhead events-admin-subhead-past">Past Events</div>';
			past.forEach(function (ev) { html += rowHtml(ev, true); });
		}
		listEl.innerHTML = html;

		listEl.querySelectorAll('.btn-edit-event').forEach(function (btn) {
			btn.addEventListener('click', function () {
				openModal('edit', { id: btn.getAttribute('data-id') });
			});
		});
		listEl.querySelectorAll('.btn-delete-event').forEach(function (btn) {
			btn.addEventListener('click', function () {
				onDelete(btn.getAttribute('data-id'));
			});
		});
	}

	function rowHtml(ev, isPast) {
		var dateStr = Events.formatDate(ev.eventDate);
		var timeStr = Events.formatTimeRange(ev.startTime, ev.endTime);
		var meta = dateStr + (timeStr && timeStr !== 'All day' ? ' · ' + timeStr : '');
		if (ev.location) meta += ' · ' + escapeHtml(ev.location);
		var catClass = ev.category === 'track' ? 'is-track' : 'is-church';
		var catBadge = '<span class="event-category-badge ' + catClass + '">' + categoryLabel(ev.category) + '</span>';
		return '<div class="events-admin-item' + (isPast ? ' is-past' : '') + '">'
			+ '<div class="events-admin-item-main">'
			+ '<h4>' + catBadge + escapeHtml(ev.title) + '</h4>'
			+ '<div class="events-admin-meta">' + meta + '</div>'
			+ '</div>'
			+ '<div class="events-admin-actions">'
			+ '<button class="btn-edit-event" data-id="' + ev.id + '">Edit</button>'
			+ '<button class="btn-delete-event" data-id="' + ev.id + '">Delete</button>'
			+ '</div></div>';
	}

	function openModal(mode, opts) {
		opts = opts || {};
		editingId = null;
		if (mode === 'edit' && opts.id) {
			Events.getById(opts.id).then(function (ev) {
				if (!ev) return;
				editingId = opts.id;
				titleInput.value = ev.title;
				dateInput.value = ev.eventDate || '';
				startInput.value = ev.startTime ? ev.startTime.substring(0, 5) : '';
				endInput.value = ev.endTime ? ev.endTime.substring(0, 5) : '';
				locInput.value = ev.location || '';
				linkInput.value = ev.linkUrl || '';
				setSelectedCategory(ev.category || 'church');
				editor.setContent(ev.description || '');
				modalTitle.textContent = 'Edit Event';
				saveBtn.textContent = 'Update Event';
				modal.classList.add('active');
			});
		} else {
			titleInput.value = '';
			dateInput.value = opts.preFillDate || Events.todayNY();
			startInput.value = '';
			endInput.value = '';
			locInput.value = '';
			linkInput.value = '';
			setSelectedCategory('church');
			editor.clear();
			modalTitle.textContent = 'Add Event';
			saveBtn.textContent = 'Save Event';
			modal.classList.add('active');
		}
	}

	function closeModal() {
		modal.classList.remove('active');
	}

	function onSave() {
		var title = titleInput.value.trim();
		var date  = dateInput.value;
		if (!title) { titleInput.focus(); showToast('Title is required', 'error'); return; }
		if (!date)  { dateInput.focus();  showToast('Date is required',  'error'); return; }

		var start = startInput.value;
		var end   = endInput.value;
		if (start && end && end < start) {
			showToast('End time must be after start time', 'error');
			return;
		}

		var data = {
			title: title,
			eventDate: date,
			startTime: start || null,
			endTime: end || null,
			location: locInput.value.trim(),
			description: editor.getContent(),
			linkUrl: linkInput.value.trim(),
			category: getSelectedCategory()
		};

		saveBtn.disabled = true;
		var op = editingId
			? Events.update(editingId, data).then(function () { showToast('Event updated'); })
			: Events.save(data).then(function () { showToast('Event saved'); });

		op.then(function () {
			closeModal();
			renderAll();
		}).catch(function (err) {
			showToast(err.message || 'Save failed', 'error');
		}).then(function () {
			saveBtn.disabled = false;
		});
	}

	function onDelete(id) {
		deletingId = id;
		Events.getById(id).then(function (ev) {
			var title = ev ? ev.title : 'this event';
			openDeleteModal({
				title: 'Delete Event',
				message: 'Are you sure you want to delete "' + title + '"? This cannot be undone.',
				onConfirm: function () {
					Events.remove(deletingId).then(function () {
						deletingId = null;
						showToast('Event deleted');
						renderAll();
					}).catch(function (err) {
						showToast(err.message || 'Delete failed', 'error');
					});
				}
			});
		});
	}

	function shiftMonth(delta) {
		viewMonth += delta;
		if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
		else if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
		renderCalendar();
	}

	function renderCalendar() {
		if (!calGridEl || !calTitleEl) return;

		var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
		calTitleEl.textContent = monthNames[viewMonth] + ' ' + viewYear;

		var firstOfMonth = new Date(viewYear, viewMonth, 1);
		var startOffset = firstOfMonth.getDay(); // 0 = Sunday
		var gridStart = new Date(viewYear, viewMonth, 1 - startOffset);

		var todayStr = Events.todayNY();

		// Index events by eventDate (YYYY-MM-DD)
		var byDate = {};
		allEventsCache.forEach(function (ev) {
			if (!ev.eventDate) return;
			if (!byDate[ev.eventDate]) byDate[ev.eventDate] = [];
			byDate[ev.eventDate].push(ev);
		});

		var cellsHtml = '';
		for (var i = 0; i < 42; i++) {
			var d = new Date(gridStart);
			d.setDate(gridStart.getDate() + i);
			var y = d.getFullYear();
			var m = d.getMonth();
			var day = d.getDate();
			var ymd = y + '-' + pad(m + 1) + '-' + pad(day);

			var classes = ['cal-cell'];
			if (m !== viewMonth) classes.push('is-other-month');
			if (ymd === todayStr) classes.push('is-today');

			var cellEvents = byDate[ymd] || [];
			var chipsHtml = '';
			var visibleChips = cellEvents.slice(0, 2);
			visibleChips.forEach(function (ev) {
				var chipClass = ev.category === 'track' ? 'cal-chip is-track' : 'cal-chip is-church';
				chipsHtml += '<button class="' + chipClass + '" data-id="' + ev.id + '" type="button" title="' + escapeAttr(ev.title) + '">' + escapeHtml(ev.title) + '</button>';
			});
			if (cellEvents.length > 2) {
				chipsHtml += '<div class="cal-chip-more">+' + (cellEvents.length - 2) + ' more</div>';
			}

			cellsHtml += '<div class="' + classes.join(' ') + '" data-date="' + ymd + '">'
				+ '<div class="cal-cell-day">' + day + '</div>'
				+ '<div class="cal-cell-events">' + chipsHtml + '</div>'
				+ '</div>';
		}
		calGridEl.innerHTML = cellsHtml;

		// Chip clicks → edit
		calGridEl.querySelectorAll('.cal-chip').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.stopPropagation();
				openModal('edit', { id: btn.getAttribute('data-id') });
			});
		});

		// Cell clicks (on empty area) → add with pre-filled date
		calGridEl.querySelectorAll('.cal-cell').forEach(function (cell) {
			cell.addEventListener('click', function () {
				openModal('add', { preFillDate: cell.getAttribute('data-date') });
			});
		});
	}

	return { init: init };
})();
