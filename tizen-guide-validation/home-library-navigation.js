/* TV home navigation: Home, Shows, Movies and Live TV. */
(function () {
    'use strict';
    var activeSlider = null;
    var activeAccount = '';
    var activeClient = null;
    var loading = false;
    var expectedLinks = -1;
    var generation = 0;
    var scheduled = false;
    var headerSizing = null;
    var disposed = false;
    var animationFrame = 0;

    function fitHeader(slider) {
        var header = slider.closest('.skinHeader');
        var container = slider.closest('.headerTabs');
        var left = header.querySelector('.headerLeft');
        var right = header.querySelector('.headerRight');
        if (!left || !right) return;
        if (!headerSizing || headerSizing.container !== container) {
            headerSizing = {container:container, tabs:slider.parentNode,
                maxWidth:container.style.maxWidth, width:slider.parentNode.style.width};
        }
        var bounds = header.getBoundingClientRect();
        var center = bounds.left + bounds.width / 2;
        // headerLeft stretches into the unused space; measure its visible
        // children so that empty flex space does not collapse the tab strip.
        var occupiedLeft = bounds.left;
        Array.prototype.forEach.call(left.children, function (child) {
            var rect = child.getBoundingClientRect();
            if (rect.width && rect.height) occupiedLeft = Math.max(occupiedLeft, rect.right);
        });
        var room = Math.min(center - occupiedLeft,
            right.getBoundingClientRect().left - center);
        var width = Math.max(200, Math.floor(2 * (room - 24))) + 'px';
        if (container.style.maxWidth !== width) {
            container.style.maxWidth = width;
            slider.parentNode.style.width = '100%';
            if (slider.parentNode.refresh) slider.parentNode.refresh();
        }
    }

    function accountKey(client) {
        return client.serverId() + ':' + client.getCurrentUserId();
    }

    function isHome() {
        return /^#\/?home(?:[?]|$)/.test(window.location.hash);
    }

    function rowCards(row) {
        return Array.prototype.filter.call(row.children, function (card) {
            return card.matches('.card:not(:disabled):not([tabindex="-1"])') &&
                card.getClientRects().length && getComputedStyle(card).visibility !== 'hidden';
        });
    }

    function nextHomeRow(event) {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
            (event.key !== 'ArrowRight' && event.keyCode !== 39) ||
            !document.documentElement.classList.contains('layout-tv') || !isHome()) return;
        if (Array.prototype.some.call(document.querySelectorAll('.manual-guide-overlay, dialog[open], .dialogContainer'), function (dialog) {
            return dialog.getClientRects().length;
        })) return;
        var card = event.target;
        if (!card.matches || !card.matches('.card')) return;
        var row = card.closest('.itemsContainer');
        var home = row && row.closest('.homeSectionsContainer');
        if (!home) return;
        var cards = rowCards(row);
        if (!cards.length || cards[cards.length - 1] !== card) return;
        var rows = Array.prototype.slice.call(home.querySelectorAll('.itemsContainer'));
        for (var i = rows.indexOf(row) + 1; i < rows.length; i++) {
            var next = rowCards(rows[i])[0];
            if (next) {
                next.focus();
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
        }
    }

    function hideFavourites(slider) {
        var tabs = Array.prototype.filter.call(slider.children, function (tab) {
            return !tab.hasAttribute('data-home-library');
        });
        var favourites = tabs[1];
        if (favourites && !favourites.hasAttribute('data-hidden-favourites')) {
            favourites.setAttribute('data-hidden-favourites', favourites.classList.contains('hide') ? 'hidden' : 'visible');
            favourites.classList.add('hide');
        }
    }

    function removeLinks(slider) {
        if (!slider) return;
        Array.prototype.forEach.call(slider.querySelectorAll('[data-hidden-favourites]'), function (tab) {
            if (tab.getAttribute('data-hidden-favourites') === 'visible') tab.classList.remove('hide');
            tab.removeAttribute('data-hidden-favourites');
        });
        Array.prototype.forEach.call(slider.querySelectorAll('[data-home-library]'), function (link) {
            link.parentNode.removeChild(link);
        });
        if (headerSizing) {
            headerSizing.container.style.maxWidth = headerSizing.maxWidth;
            headerSizing.tabs.style.width = headerSizing.width;
            headerSizing = null;
        }
    }

    function sync() {
        var client = window.ApiClient;
        var router = window.Emby && window.Emby.Page;
        var slider = document.querySelector('.skinHeader .emby-tabs-slider');
        if (!document.documentElement.classList.contains('layout-tv') || !isHome() ||
            !client || !client.getCurrentUserId() || !router || !slider) {
            if (activeSlider) {
                generation++;
                removeLinks(activeSlider);
                activeSlider = null;
                activeAccount = '';
                activeClient = null;
                loading = false;
                expectedLinks = -1;
            }
            return;
        }

        hideFavourites(slider);
        var account = accountKey(client);
        if (slider === activeSlider && account === activeAccount && client === activeClient &&
            (loading || (expectedLinks >= 0 && slider.querySelectorAll('[data-home-library]').length === expectedLinks))) {
            fitHeader(slider);
            return;
        }
        removeLinks(activeSlider);
        activeSlider = slider;
        activeAccount = account;
        activeClient = client;
        loading = true;
        expectedLinks = -1;
        var request = ++generation;
        var userId = client.getCurrentUserId();
        client.getJSON(client.getUrl('Users/' + encodeURIComponent(userId) + '/Views'))
            .then(function (result) {
                if (request !== generation) return;
                loading = false;
                if (!isHome() || !slider.isConnected ||
                    window.ApiClient !== client || accountKey(client) !== account) {
                    activeSlider = null;
                    activeAccount = '';
                    activeClient = null;
                    return;
                }
                removeLinks(slider);
                hideFavourites(slider);
                (result.Items || []).filter(function (view) {
                    return view.CollectionType === 'tvshows' || view.CollectionType === 'movies' || view.CollectionType === 'livetv';
                }).sort(function (a, b) {
                    var order = {tvshows: 0, movies: 1, livetv: 2};
                    return order[a.CollectionType] - order[b.CollectionType];
                }).forEach(function (view) {
                    if (!view.Id || !view.Name) return;
                    var route = router.getRouteUrl(view);
                    var link = document.createElement('a');
                    link.className = 'emby-tab-button emby-button show-focus homeLibraryShortcut';
                    link.setAttribute('data-home-library', view.Id);
                    link.setAttribute('href', route);
                    var label = document.createElement('div');
                    label.className = 'emby-button-foreground';
                    label.textContent = view.Name;
                    link.appendChild(label);
                    link.addEventListener('click', function (event) {
                        // Library links use the router without selecting a home content panel.
                        event.preventDefault();
                        event.stopPropagation();
                        if (window.ApiClient === client && accountKey(client) === account) {
                            router.show(route);
                        }
                    });
                    slider.appendChild(link);
                });
                expectedLinks = slider.querySelectorAll('[data-home-library]').length;
                var tabs = slider.parentNode;
                fitHeader(slider);
                if (tabs.refresh) tabs.refresh();
            })
            .catch(function () {
                // A later navigation or reconnect may retry a failed request.
                if (request === generation) {
                    activeSlider = null;
                    activeAccount = '';
                    activeClient = null;
                    loading = false;
                    expectedLinks = -1;
                }
            });
    }

    function schedule() {
        if (scheduled || disposed) return;
        scheduled = true;
        animationFrame = requestAnimationFrame(function () { scheduled = false; sync(); });
    }

    function start() {
        var observer = new MutationObserver(function (records) {
            if (records.some(function (record) {
                if (record.target.nodeType === 1 && record.target.closest('.skinHeader')) return true;
                return Array.prototype.some.call(record.addedNodes, function (node) {
                    return node.nodeType === 1 && (node.matches('.skinHeader') || node.querySelector('.skinHeader'));
                });
            })) schedule();
        });
        observer.observe(document.body, {childList:true, subtree:true});
        window.addEventListener('hashchange', schedule);
        window.addEventListener('resize', schedule);
        document.addEventListener('keydown', nextHomeRow, true);
        var poll = setInterval(schedule, 2000);
        window.addEventListener('pagehide', function (event) {
            // Jellyfin also emits bubbling pagehide events for individual views.
            // Only disposing the top document should stop this app-wide helper.
            if (event.target !== window && event.target !== document) return;
            disposed = true;
            generation++;
            observer.disconnect();
            clearInterval(poll);
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('hashchange', schedule);
            window.removeEventListener('resize', schedule);
            document.removeEventListener('keydown', nextHomeRow, true);
            removeLinks(activeSlider);
        });
        sync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, {once:true});
    } else {
        start();
    }
})();
