/* =============================================
   RICH-EDITOR.JS — ContentEditable Rich Text Editor
   ============================================= */

var RichEditor = (function () {
	var editor = null;
	var toolbar = null;

	var toolbarButtons = [
		{ cmd: 'bold', icon: '<strong>B</strong>', title: 'Bold' },
		{ cmd: 'italic', icon: '<em>I</em>', title: 'Italic' },
		{ cmd: 'underline', icon: '<u>U</u>', title: 'Underline' },
		{ cmd: 'strikeThrough', icon: '<s>S</s>', title: 'Strikethrough' },
		{ divider: true },
		{ cmd: 'insertUnorderedList', icon: '&#8226;', title: 'Bullet List' },
		{ cmd: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
		{ divider: true },
		{ cmd: 'justifyLeft', icon: '\u2261', title: 'Align Left' },
		{ cmd: 'justifyCenter', icon: '\u2263', title: 'Align Center' },
		{ cmd: 'justifyRight', icon: '\u2262', title: 'Align Right' },
		{ divider: true },
		{ cmd: 'formatBlock', value: 'BLOCKQUOTE', icon: '\u201C', title: 'Quote' },
		{ highlight: true },
		{ divider: true },
		{ cmd: 'undo', icon: '\u21A9', title: 'Undo' },
		{ cmd: 'redo', icon: '\u21AA', title: 'Redo' }
	];

	var highlightColors = [
		{ color: '#ffe066', label: 'Yellow' },
		{ color: '#ffa94d', label: 'Orange' },
		{ color: '#ff6b6b', label: 'Red' },
		{ color: '#da77f2', label: 'Purple' },
		{ color: '#74c0fc', label: 'Blue' },
		{ color: '#69db7c', label: 'Green' },
		{ color: '#fcc2d7', label: 'Pink' },
		{ color: '#ffffff', label: 'White' },
		{ color: null, label: 'Remove' }
	];

	function init(wrapperId) {
		var wrapper = document.getElementById(wrapperId);
		if (!wrapper) return;

		// Build toolbar
		toolbar = document.createElement('div');
		toolbar.className = 'editor-toolbar';

		toolbarButtons.forEach(function (btn) {
			if (btn.divider) {
				var div = document.createElement('span');
				div.className = 'toolbar-divider';
				toolbar.appendChild(div);
				return;
			}

			if (btn.highlight) {
				buildHighlightPicker(toolbar);
				return;
			}

			var button = document.createElement('button');
			button.type = 'button';
			button.innerHTML = btn.icon;
			button.title = btn.title;
			button.setAttribute('data-cmd', btn.cmd);
			if (btn.value) button.setAttribute('data-value', btn.value);
			button.addEventListener('mousedown', function (e) {
				e.preventDefault(); // Prevent losing focus from editor
			});
			button.addEventListener('click', function () {
				execCommand(btn.cmd, btn.value || null);
				updateActiveStates();
			});
			toolbar.appendChild(button);
		});

		// Build editor area
		editor = document.createElement('div');
		editor.className = 'editor-content';
		editor.contentEditable = 'true';
		editor.setAttribute('data-placeholder', 'Write your sermon content here...');

		editor.addEventListener('input', updateActiveStates);
		editor.addEventListener('keyup', updateActiveStates);
		editor.addEventListener('mouseup', updateActiveStates);

		wrapper.appendChild(toolbar);
		wrapper.appendChild(editor);
	}

	function buildHighlightPicker(parentEl) {
		var container = document.createElement('div');
		container.className = 'highlight-picker';

		var toggleBtn = document.createElement('button');
		toggleBtn.type = 'button';
		toggleBtn.className = 'highlight-toggle';
		toggleBtn.title = 'Highlight Color';
		toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
			+ '<span class="highlight-swatch" style="background:#ffe066;"></span>';
		toggleBtn.addEventListener('mousedown', function (e) {
			e.preventDefault();
		});
		toggleBtn.addEventListener('click', function () {
			dropdown.classList.toggle('open');
		});

		var dropdown = document.createElement('div');
		dropdown.className = 'highlight-dropdown';

		highlightColors.forEach(function (item) {
			var swatch = document.createElement('button');
			swatch.type = 'button';
			swatch.className = 'highlight-color-btn';
			swatch.title = item.label;
			if (item.color) {
				swatch.style.background = item.color;
			} else {
				swatch.innerHTML = '&times;';
				swatch.classList.add('highlight-remove');
			}
			swatch.addEventListener('mousedown', function (e) {
				e.preventDefault();
			});
			swatch.addEventListener('click', function () {
				if (item.color) {
					document.execCommand('hiliteColor', false, item.color);
					toggleBtn.querySelector('.highlight-swatch').style.background = item.color;
				} else {
					document.execCommand('removeFormat', false, null);
				}
				dropdown.classList.remove('open');
				editor.focus();
			});
			dropdown.appendChild(swatch);
		});

		container.appendChild(toggleBtn);
		container.appendChild(dropdown);
		parentEl.appendChild(container);

		// Close dropdown when clicking outside
		document.addEventListener('click', function (e) {
			if (!container.contains(e.target)) {
				dropdown.classList.remove('open');
			}
		});
	}

	function execCommand(cmd, value) {
		if (cmd === 'formatBlock' && value) {
			// Toggle blockquote off if already active
			var block = document.queryCommandValue('formatBlock');
			if (block.toLowerCase() === value.toLowerCase()) {
				document.execCommand('formatBlock', false, 'P');
			} else {
				document.execCommand('formatBlock', false, value);
			}
		} else {
			document.execCommand(cmd, false, value);
		}
		editor.focus();
	}

	function updateActiveStates() {
		if (!toolbar) return;
		var buttons = toolbar.querySelectorAll('button[data-cmd]');
		buttons.forEach(function (btn) {
			var cmd = btn.getAttribute('data-cmd');
			if (cmd === 'formatBlock') {
				var val = btn.getAttribute('data-value');
				var current = document.queryCommandValue('formatBlock');
				btn.classList.toggle('active', current.toLowerCase() === val.toLowerCase());
			} else if (['bold', 'italic', 'underline', 'strikeThrough',
				'insertUnorderedList', 'insertOrderedList',
				'justifyLeft', 'justifyCenter', 'justifyRight'].indexOf(cmd) !== -1) {
				btn.classList.toggle('active', document.queryCommandState(cmd));
			}
		});
	}

	function getContent() {
		return editor ? editor.innerHTML : '';
	}

	function setContent(html) {
		if (editor) editor.innerHTML = html || '';
	}

	function clear() {
		if (editor) editor.innerHTML = '';
	}

	return {
		init: init,
		getContent: getContent,
		setContent: setContent,
		clear: clear
	};
})();
