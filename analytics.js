// Anonymous usage counts, sent to GoatCounter (https://www.goatcounter.com).
//
// What is sent: a page-view or an event name, the referrer (or ?ref= tag) and
// the screen width. GoatCounter derives country and browser itself and stores
// no IP address and sets no cookie.
// What is never sent: slide text, file names, share-target text or anything
// from the query string other than a short ?ref= tag.
//
// Nothing is sent when: no endpoint is configured, the page runs on localhost
// or file://, the browser signals Do Not Track or Global Privacy Control, the
// visitor switched it off in About, or the browser is automated.
(function () {
    'use strict';

    var OFF_KEY = 'slideforge-analytics';
    var config = window.SLIDEFORGE_CONFIG || {};
    var endpoint = config.analyticsEndpoint || '';

    // Remembers the visitor's choice for this page even when storage is blocked.
    var offThisPage = false;

    function storedOff() {
        if (offThisPage) return true;
        try {
            return localStorage.getItem(OFF_KEY) === 'off';
        } catch (error) {
            return false;
        }
    }

    function browserOptedOut() {
        return navigator.doNotTrack === '1' ||
            window.doNotTrack === '1' ||
            navigator.globalPrivacyControl === true;
    }

    function localOrFile() {
        var host = location.hostname;
        return location.protocol === 'file:' ||
            host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '' ||
            /\.localhost$/.test(host) || /\.test$/.test(host) ||
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    }

    function configured() {
        return Boolean(endpoint) && !localOrFile();
    }

    function enabled() {
        return configured() && !browserOptedOut() && !storedOff() && navigator.webdriver !== true;
    }

    function referrer() {
        var tag = '';
        try {
            var params = new URLSearchParams(location.search);
            tag = (params.get('ref') || params.get('utm_source') || '').slice(0, 60);
        } catch (error) {
            tag = '';
        }
        if (tag) return tag;
        try {
            var ref = document.referrer;
            if (ref && new URL(ref).origin !== location.origin) return ref;
        } catch (error) {
            // Fall through: no referrer.
        }
        return '';
    }

    function send(params) {
        var query = [];
        Object.keys(params).forEach(function (key) {
            if (params[key] !== '' && params[key] != null) {
                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        });
        query.push('rnd=' + Math.random().toString(36).slice(2, 8));
        var url = endpoint + '?' + query.join('&');

        try {
            if (navigator.sendBeacon && navigator.sendBeacon(url)) return;
        } catch (error) {
            // Fall back to fetch below.
        }
        try {
            fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, credentials: 'omit' })
                .catch(function () {});
        } catch (error) {
            // Counting must never break the app.
        }
    }

    function pageview() {
        if (!enabled()) return;
        send({ p: '/', t: 'SlideForge', r: referrer(), s: window.screen ? window.screen.width : '', b: 0 });
    }

    // Event names are fixed strings chosen in script.js; they never contain user text.
    function track(name) {
        if (!enabled() || typeof name !== 'string' || !/^[a-z0-9-]{1,40}$/.test(name)) return;
        send({ p: name, t: name, e: 'true', s: window.screen ? window.screen.width : '', b: 0 });
    }

    function setEnabled(on) {
        offThisPage = !on;
        try {
            if (on) localStorage.removeItem(OFF_KEY);
            else localStorage.setItem(OFF_KEY, 'off');
        } catch (error) {
            // Storage blocked: the choice lasts until the page closes.
        }
    }

    window.SlideForgeAnalytics = {
        track: track,
        pageview: pageview,
        setEnabled: setEnabled,
        enabled: enabled,
        configured: configured,
        browserOptedOut: browserOptedOut,
        isOff: storedOff
    };

    pageview();

    window.addEventListener('appinstalled', function () { track('install'); });
}());
