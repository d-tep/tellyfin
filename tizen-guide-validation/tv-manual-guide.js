/* Samsung remote support for the shared guide controls. */
(function () {
    'use strict';
    var picker = null;
    var inputViewport = null;
    var editingInput = null;
    var keyboardWasOpen = false;
    var inputSelector = '.manual-guide-toolbar input, form.manual-guide-dialog input:not([type=checkbox]), #searchTextInput';
    // Any field that can open Samsung's keyboard, including sign-in and server address fields.
    var keyboardSelector = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color]), textarea';
    function guideInput(target) {
        return target && target.matches && target.matches(inputSelector);
    }
    function keyboardInput(target) {
        return target && target.matches && target.matches(keyboardSelector);
    }
    function prepareInput(input) {
        if (!input.hasAttribute('data-tv-select-to-edit') && !input.readOnly) {
            input.setAttribute('data-tv-select-to-edit', '');
            input.readOnly = true;
        }
    }
    function prepareInputs(root) {
        if (guideInput(root)) prepareInput(root);
        root.querySelectorAll(inputSelector).forEach(prepareInput);
    }
    function finishEditing() {
        if (!editingInput) return;
        var input = editingInput;
        editingInput = null;
        keyboardWasOpen = false;
        input.readOnly = true;
        if (document.activeElement === input) {
            input.blur();
            input.focus();
        }
    }
    function startEditing(input) {
        if (input.disabled) return;
        input.blur();
        editingInput = input;
        input.readOnly = false;
        input.focus();
    }
    function updateInputViewport() {
        if (!inputViewport) return;
        if (editingInput && window.innerHeight < inputViewport.height - 100) keyboardWasOpen = true;
        else if (editingInput && keyboardWasOpen) finishEditing();
        var input = document.activeElement;
        if (!keyboardInput(input) && window.innerHeight >= inputViewport.height) {
            document.documentElement.classList.remove('manual-guide-input-active');
            document.documentElement.style.removeProperty('--manual-guide-input-font-size');
            inputViewport = null;
            return;
        }
        var dialog = guideInput(input) && input.closest('form.manual-guide-dialog');
        if (dialog && window.innerHeight < inputViewport.height) {
            var frame = dialog.getBoundingClientRect();
            var field = input.getBoundingClientRect();
            if (field.top < frame.top + 12) dialog.scrollTop += field.top - frame.top - 12;
            else if (field.bottom > frame.bottom - 12) dialog.scrollTop += field.bottom - frame.bottom + 12;
        }
    }
    document.addEventListener('focusin', function (event) {
        if (!keyboardInput(event.target)) return;
        if (guideInput(event.target)) prepareInput(event.target);
        if (!inputViewport) {
            var root = document.documentElement;
            // Samsung's IME crosses Jellyfin's height-based font breakpoints.
            inputViewport = { height: window.innerHeight };
            root.style.setProperty('--manual-guide-input-font-size', getComputedStyle(root).fontSize);
            root.classList.add('manual-guide-input-active');
        }
        requestAnimationFrame(updateInputViewport);
    }, true);
    document.addEventListener('focusout', function (event) {
        if (event.target === editingInput) {
            editingInput.readOnly = true;
            editingInput = null;
            keyboardWasOpen = false;
        }
        setTimeout(updateInputViewport, 0);
    });
    window.addEventListener('resize', function () {
        requestAnimationFrame(updateInputViewport);
    });
    // Keep the sign-in screen plain instead of showing the server's custom splash image.
    document.addEventListener('pageshow', function (event) {
        var page = event.target;
        if (page && page.id === 'loginPage' && page.classList) page.classList.remove('backdropPage');
    }, true);
    var inputObserver = new MutationObserver(function (records) {
        records.forEach(function (record) {
            Array.prototype.forEach.call(record.addedNodes, function (node) {
                if (node.nodeType === 1) prepareInputs(node);
            });
        });
    });
    inputObserver.observe(document.body, { childList: true, subtree: true });
    prepareInputs(document);
    function closePicker(restore) {
        if (!picker) return;
        var select = picker.select;
        picker.remove(); picker = null;
        if (restore && select.isConnected) select.focus();
    }
    function openPicker(select) {
        if (select.disabled) return;
        closePicker(false);
        var overlay = document.createElement('div');
        overlay.className = 'manual-guide-overlay manual-guide-picker';
        overlay.select = select;
        var panel = document.createElement('div');
        panel.className = 'manual-guide-dialog focuscontainer';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
        var label = select.closest('label');
        panel.setAttribute('aria-label', label ? label.firstChild.textContent : 'Choose channel');
        Array.from(select.options).forEach(function (option) {
            var button = document.createElement('button');
            button.type = 'button'; button.textContent = option.textContent; button.disabled = option.disabled;
            button.setAttribute('aria-pressed', option.selected ? 'true' : 'false');
            button.addEventListener('click', function () {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closePicker(true);
            });
            panel.appendChild(button);
        });
        overlay.appendChild(panel); document.body.appendChild(overlay); picker = overlay;
        var selected = panel.querySelector('[aria-pressed=true]:not(:disabled)') || panel.querySelector('button:not(:disabled)');
        if (selected) { selected.focus(); selected.scrollIntoView({ block: 'nearest' }); }
    }
    function visibleRows(guide) {
        return Array.from(guide.querySelectorAll('.programGrid .channelPrograms')).filter(function (row) {
            return !row.classList.contains('manual-guide-filter-hidden') && row.getClientRects().length && row.getBoundingClientRect().height > 0;
        });
    }
    function channelHeader(guide, row) {
        return Array.from(guide.querySelectorAll('.guide-channelHeaderCell')).find(function (header) {
            return header.getAttribute('data-id') === row.getAttribute('data-channelid');
        });
    }
    function focusRow(guide, row, source, preferHeader) {
        var header = channelHeader(guide, row);
        if (preferHeader && header) { header.focus(); return; }
        var programGrid = guide.querySelector('.programGrid');
        var grid = programGrid.getBoundingClientRect();
        var previous = source.getBoundingClientRect();
        // Anchor to the visible start of the current cell; a long program's centre can be hours ahead.
        var anchor = Math.max(grid.left + 1, Math.min(grid.right - 1, previous.left + 1));
        var candidates = Array.from(row.querySelectorAll('button:not(:disabled):not([hidden]), a[href], .focusable')).filter(function (button) {
            var rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(button).visibility !== 'hidden';
        });
        var selected = null;
        var distance = Infinity;
        candidates.forEach(function (button) {
            var rect = button.getBoundingClientRect();
            var delta = anchor < rect.left ? rect.left - anchor : anchor > rect.right ? anchor - rect.right : 0;
            if (delta < distance) { distance = delta; selected = button; }
        });
        var target = selected || header;
        if (!target) return;
        var scrollLeft = programGrid.scrollLeft;
        try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
        if (selected && programGrid.scrollLeft !== scrollLeft) programGrid.scrollLeft = scrollLeft;
    }
    function navigateGuide(target, key) {
        if (key !== 'ArrowUp' && key !== 'ArrowDown') return false;
        var guide = target.closest('.tvguide');
        if (!guide) return false;
        var toolbar = target.closest('.manual-guide-toolbar');
        var rows = visibleRows(guide);
        if (toolbar) {
            if (key === 'ArrowUp') {
                var date = guide.querySelector('.guide-date-tab-button.emby-tab-button-active') || guide.querySelector('.guide-date-tab-button');
                if (date) date.focus();
            } else if (rows.length) focusRow(guide, rows[0], target, false);
            return true;
        }
        var row = target.closest('.channelPrograms');
        var header = target.closest('.guide-channelHeaderCell');
        if (!row && !header) return false;
        var id = row ? row.getAttribute('data-channelid') : header.getAttribute('data-id');
        var index = rows.findIndex(function (entry) { return entry.getAttribute('data-channelid') === id; });
        if (index < 0 || (index === 0 && key === 'ArrowUp')) {
            var search = guide.querySelector('.manual-guide-search');
            if (search) search.focus();
        } else {
            var next = rows[index + (key === 'ArrowUp' ? -1 : 1)];
            if (next) focusRow(guide, next, target, !!header);
        }
        return true;
    }
    function isBack(event) {
        return event.key === 'Escape' || event.key === 'GoBack' || event.key === 'BrowserBack' || event.keyCode === 10009;
    }
    document.addEventListener('mousedown', function (event) {
        if (event.target.closest('.manual-guide-toolbar select, .manual-guide-dialog select')) event.preventDefault();
    }, true);
    document.addEventListener('click', function (event) {
        if (guideInput(event.target) && event.target.hasAttribute('data-tv-select-to-edit')) {
            if (event.target.readOnly) startEditing(event.target);
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        var select = event.target.closest('.manual-guide-toolbar select, .manual-guide-dialog select');
        if (select) { event.preventDefault(); event.stopImmediatePropagation(); openPicker(select); }
    }, true);
    document.addEventListener('keydown', function (event) {
        var key = event.key;
        if (guideInput(event.target) && event.target.hasAttribute('data-tv-select-to-edit')) {
            if (event.target.readOnly && key === 'Enter') {
                startEditing(event.target);
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
            if (event.target === editingInput && (isBack(event) || event.keyCode === 65376 || event.keyCode === 65385)) {
                finishEditing();
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
            if (event.target === editingInput && key.indexOf('Arrow') === 0) return;
        }
        if (picker) {
            if (isBack(event)) { closePicker(true); }
            else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Tab') {
                var choices = Array.from(picker.querySelectorAll('button:not(:disabled)'));
                var index = choices.indexOf(document.activeElement);
                var step = key === 'ArrowUp' || (key === 'Tab' && event.shiftKey) ? -1 : 1;
                var next = choices[Math.max(0, Math.min(choices.length - 1, index + step))];
                if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); }
            } else if (key === 'Enter') { document.activeElement.click(); }
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        var form = document.querySelector('form.manual-guide-dialog');
        if (form && isBack(event) && key !== 'Escape') {
            form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        var target = event.target;
        if (target.matches('.manual-guide-toolbar select, .manual-guide-dialog select') && key === 'Enter') {
            openPicker(target); event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (!form && navigateGuide(target, key)) {
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        var toolbar = target.closest('.manual-guide-toolbar');
        if (toolbar && (key === 'ArrowLeft' || key === 'ArrowRight')) {
            var tools = Array.from(toolbar.querySelectorAll('input:not(:disabled), select:not(:disabled), button:not(:disabled):not([hidden])'));
            var position = tools.indexOf(target);
            var tool = tools[Math.max(0, Math.min(tools.length - 1, position + (key === 'ArrowLeft' ? -1 : 1)))];
            if (tool) tool.focus();
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (form && form.contains(target) && (key === 'ArrowUp' || key === 'ArrowDown')) {
            var controls = Array.from(form.querySelectorAll('input:not(:disabled), select:not(:disabled), button:not(:disabled)'));
            var current = controls.indexOf(target);
            var control = controls[Math.max(0, Math.min(controls.length - 1, current + (key === 'ArrowUp' ? -1 : 1)))];
            if (control) { control.focus(); control.scrollIntoView({ block: 'nearest' }); }
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    // Samsung's native scroller can retain stale centering dimensions after
    // filtering. Keep the actual focused row inside the visible guide viewport.
    document.addEventListener('focusin', function (event) {
        var scroller = event.target.closest('.guideVerticalScroller.scrollY');
        if (!scroller) return;
        var slider = scroller.querySelector('.scrollSlider');
        if (slider && getComputedStyle(slider).transform !== 'none') return;
        var frame = scroller.getBoundingClientRect();
        var focused = event.target.getBoundingClientRect();
        if (focused.top < frame.top) scroller.scrollTop += focused.top - frame.top;
        else if (focused.bottom > frame.bottom) scroller.scrollTop += focused.bottom - frame.bottom;
    });
    window.addEventListener('hashchange', function () { closePicker(false); });
    window.addEventListener('popstate', function () { closePicker(false); });
    document.addEventListener('viewbeforeshow', function () { closePicker(false); });
    document.addEventListener('viewbeforehide', function (event) {
        var view = event.target;
        if (view.matches && (view.matches('.tvguide') || view.querySelector('.tvGuideHeader'))) closePicker(false);
    });
})();
