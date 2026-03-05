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
		{ divider: true },
		{ cmd: 'undo', icon: '\u21A9', title: 'Undo' },
		{ cmd: 'redo', icon: '\u21AA', title: 'Redo' }
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
