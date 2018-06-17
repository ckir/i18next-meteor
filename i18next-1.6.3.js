// i18next, v1.6.3
// Copyright (c)2013 Jan Mühlemann (jamuhl).
// Distributed under MIT license
// http://i18next.com
(function() {

    const root = this
        , $ = (root.hasOwnProperty('jQuery') && root.jQuery)  || (root.hasOwnProperty('Zepto') && root.Zepto )
        , i18n = {};

    let currentLng
        , resStore = {}
        , replacementCounter = 0
        , languages = [];


    // Export the i18next object for **CommonJS**. 
    // If we're not in CommonJS, add `i18n` to the
    // global object or to jquery.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = i18n;
    } else {
        if ($) {
            $.i18n = $.i18n || i18n;
        }

        root.i18n = root.i18n || i18n;
    }
    // defaults
    const o = {
        lng: undefined,
        load: 'all',
        preload: [],
        lowerCaseLng: false,
        returnObjectTrees: false,
        fallbackLng: 'dev',
        fallbackNS: [],
        detectLngQS: 'setLng',
        ns: String('translation'),
        fallbackOnNull: true,
        fallbackToDefaultNS: false,
        nsSeparator: ':',
        keySeparator: '.',
        selectorAttr: 'data-i18n',
        debug: false,

        resGetPath: 'locales/__lng__/__ns__.json',
        resPostPath: 'locales/add/__lng__/__ns__',

        getAsync: true,
        postAsync: true,

        resStore: undefined,
        useLocalStorage: false,
        localStorageExpirationTime: 7*24*60*60*1000,

        dynamicLoad: false,
        sendMissing: false,
        sendMissingTo: 'fallback', // current | all
        sendType: 'POST',

        interpolationPrefix: '__',
        interpolationSuffix: '__',
        reusePrefix: '$t(',
        reuseSuffix: ')',
        pluralSuffix: '_plural',
        pluralNotFound: ['plural_not_found', Math.random()].join(''),
        contextNotFound: ['context_not_found', Math.random()].join(''),
        escapeInterpolation: false,

        setJqueryExt: true,
        defaultValueFromContent: true,
        useDataAttrOptions: false,
        cookieExpirationTime: undefined,
        useCookie: true,
        cookieName: 'i18next',

        postProcess: undefined,
        parseMissingKey: undefined
    };

    // it interesting if author means target =  Object.assign({}, target, source);
    // TODO: check places where _extend is used
    function _extend(target, source) {
        if (!source || typeof source === 'function') {
            return target;
        }

        for (let attr in source) {
            if(source.hasOwnProperty(attr)) {
                target[attr] = source[attr];
            }
        }
        return target;
    }

    function _each(object, callback, args) {
        const length = object.length,
            isObj = length === undefined || typeof object === "function";

        if (args) {
            if (isObj) {
                for (let name in object) {
                    if (object.hasOwnProperty(name) && callback.apply(object[name], args) === false) {
                        break;
                    }
                }
            } else {
                for (let i = 0 ; i < length; ) {
                    if (callback.apply(object[i++], args) === false) {
                        break;
                    }
                }
            }

        // A special, fast, case for the most common use of each
        } else {
            if (isObj) {
                for (let name in object) {
                    if (object.hasOwnProperty(name) && callback.call(object[name], name, object[name]) === false) {
                        break;
                    }
                }
            } else {
                for (let i = 0 ; i < length; ) {
                    if (callback.call(object[i], i, object[i++]) === false) {
                        break;
                    }
                }
            }
        }

        return object;
    }

    const _entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };

    function _escape(data) {
        if (typeof data === 'string') {
            return data.replace(/[&<>"'\/]/g, function (s) {
                return _entityMap[s];
            });
        }else{
            return data;
        }
    }

    function _ajax(options) {

        // v0.5.0 of https://github.com/goloroden/http.js
        const getXhr = function (callback) {
            // Use the native XHR object if the browser supports it.
            if (window.XMLHttpRequest) {
                return callback(null, new XMLHttpRequest());
            } else if (window.ActiveXObject) {
                // In Internet Explorer check for ActiveX versions of the XHR object.
                try {
                    return callback(null, new ActiveXObject("Msxml2.XMLHTTP"));
                } catch (e) {
                    return callback(null, new ActiveXObject("Microsoft.XMLHTTP"));
                }
            }

            // If no XHR support was found, throw an error.
            return callback(new Error());
        };

        const encodeUsingUrlEncoding = function (data) {
            if(typeof data === 'string') {
                return data;
            }

            const result = [];
            for(const dataItem in data) {
                if(data.hasOwnProperty(dataItem)) {
                    result.push(encodeURIComponent(dataItem) + '=' + encodeURIComponent(data[dataItem]));
                }
            }

            return result.join('&');
        };

        // THIS CODE IS UNUSED
        // const utf8 = function (text) {
        //     text = text.replace(/\r\n/g, '\n');
        //     let result = '';
        //
        //     for(let i = 0; i < text.length; i++) {
        //         const c = text.charCodeAt(i);
        //
        //         if(c < 128) {
        //                 result += String.fromCharCode(c);
        //         } else if((c > 127) && (c < 2048)) {
        //                 result += String.fromCharCode((c >> 6) | 192);
        //                 result += String.fromCharCode((c & 63) | 128);
        //         } else {
        //                 result += String.fromCharCode((c >> 12) | 224);
        //                 result += String.fromCharCode(((c >> 6) & 63) | 128);
        //                 result += String.fromCharCode((c & 63) | 128);
        //         }
        //     }
        //
        //     return result;
        // };

        // THIS CODE IS UNUSED
        // const base64 = function (text) {
        //     const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        //
        //     text = utf8(text);
        //     let result = '',
        //             chr1, chr2, chr3,
        //             enc1, enc2, enc3, enc4,
        //             i = 0;
        //
        //     do {
        //         chr1 = text.charCodeAt(i++);
        //         chr2 = text.charCodeAt(i++);
        //         chr3 = text.charCodeAt(i++);
        //
        //         enc1 = chr1 >> 2;
        //         enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        //         enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        //         enc4 = chr3 & 63;
        //
        //         if(isNaN(chr2)) {
        //             enc3 = enc4 = 64;
        //         } else if(isNaN(chr3)) {
        //             enc4 = 64;
        //         }
        //
        //         result +=
        //             keyStr.charAt(enc1) +
        //             keyStr.charAt(enc2) +
        //             keyStr.charAt(enc3) +
        //             keyStr.charAt(enc4);
        //         chr1 = chr2 = chr3 = '';
        //         enc1 = enc2 = enc3 = enc4 = '';
        //     } while(i < text.length);
        //
        //     return result;
        // };

        const mergeHeaders = function () {
            // Use the first header object as base.
            const result = arguments[0];

            // Iterate through the remaining header objects and add them.
            for(let i = 1; i < arguments.length; i++) {
                const currentHeaders = arguments[i];
                for(const header in currentHeaders) {
                    if(currentHeaders.hasOwnProperty(header)) {
                        result[header] = currentHeaders[header];
                    }
                }
            }

            // Return the merged headers.
            return result;
        };

        // Why this library create own ajax function?
        // it can use axios or if jQuery is dependency it has own ajax
        const ajax = function (method, url, options, callback) {
            // Adjust parameters.
            if(typeof options === 'function') {
                callback = options;
                options = {};
            }

            // Set default parameter values.
            options.cache = options.cache || false;
            options.data = options.data || {};
            options.headers = options.headers || {};
            options.jsonp = options.jsonp || false;
            options.async = options.async === undefined ? true : options.async;

            // Merge the various header objects.
            const headers = mergeHeaders({
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
            }, ajax.headers, options.headers);

            // Encode the data according to the content-type.
            let payload;
            if (headers['content-type'] === 'application/json') {
                payload = JSON.stringify(options.data);
            } else {
                payload = encodeUsingUrlEncoding(options.data);
            }

            // Specially prepare GET requests: Setup the query string, handle caching and make a JSONP call
            // if neccessary.
            if(method === 'GET') {
                // Setup the query string.
                let queryString = [];            // TODO: in my opinion it is very bad idea, better use lib to querystring
                if(payload) {
                    queryString.push(payload);
                    payload = null;
                }

                // Handle caching.
                if(!options.cache) {
                    queryString.push('_=' + (new Date()).getTime());
                }

                // If neccessary prepare the query string for a JSONP call.
                if(options.jsonp) {
                    queryString.push('callback=' + options.jsonp);
                    queryString.push('jsonp=' + options.jsonp);
                }

                // Merge the query string and attach it to the url.
                queryString = queryString.join('&');
                if (queryString.length > 1) {
                    if (url.indexOf('?') > -1) {
                        url += '&' + queryString;
                    } else {
                        url += '?' + queryString;
                    }
                }

                // Make a JSONP call if neccessary.
                if(options.jsonp) {
                    const head = document.getElementsByTagName('head')[0];
                    const script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = url;
                    head.appendChild(script);
                    return;
                }
            }

            // Since we got here, it is no JSONP request, so make a normal XHR request.
            getXhr(function (err, xhr) {
                if(err) return callback(err);

                // Open the request.
                xhr.open(method, url, options.async);

                // Set the request headers.
                for(const header in headers) {
                    if(headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header, headers[header]);
                    }
                }

                // Handle the request events.
                xhr.onreadystatechange = function () {
                    if(xhr.readyState === 4) {
                        const data = xhr.responseText || '';

                        // If no callback is given, return.
                        if(!callback) {
                            return;
                        }

                        // Return an object that provides access to the data as text and JSON.
                        callback(xhr.status, {
                            text: function () {
                                return data;
                            },

                            json: function () {
                                return JSON.parse(data);
                            }
                        });
                    }
                };

                // Actually send the XHR request.
                xhr.send(payload);
            });
        };

        // Define the external interface.
        // most of these methods are not used and not documented in readme
        const http = {
            // authBasic: function (username, password) {
            //     ajax.headers['Authorization'] = 'Basic ' + base64(username + ':' + password);
            // },

            // connect: function (url, options, callback) {
            //     return ajax('CONNECT', url, options, callback);
            // },

            // del: function (url, options, callback) {
            //     return ajax('DELETE', url, options, callback);
            // },

            get: function (url, options, callback) {
                return ajax('GET', url, options, callback);
            },

            head: function (url, options, callback) {
                return ajax('HEAD', url, options, callback);
            },

            headers: function (headers) {
                ajax.headers = headers || {};
            },

            // isAllowed: function (url, verb, callback) {
            //     this.options(url, function (status, data) {
            //         callback(data.text().indexOf(verb) !== -1);
            //     });
            // },

            // options: function (url, options, callback) {
            //     return ajax('OPTIONS', url, options, callback);
            // },

            // patch: function (url, options, callback) {
            //     return ajax('PATCH', url, options, callback);
            // },

            // post: function (url, options, callback) {
            //     return ajax('POST', url, options, callback);
            // },

            // put: function (url, options, callback) {
            //     return ajax('PUT', url, options, callback);
            // },

            // trace: function (url, options, callback) {
            //     return ajax('TRACE', url, options, callback);
            // }
        };


        const method = options.type ? options.type.toLowerCase() : 'get';

        http[method](options.url, options, function (status, data) {
            if (status === 200) {
                options.success(data.json(), status, null);
            } else {
                options.error(data.text(), status, null);
            }
        });
    }

    // there are libs for cookies, it it really necessary to have it in this library
    // TODO: i propose to remove this code and add dependency or divide it on some files, this file is too long
    const _cookie = {
        create: function(name,value,minutes) {
            let expires;
            const date = new Date();
            if (minutes && date.hasOwnProperty('toGMTString')) {
                date.setTime(date.getTime()+(minutes*60*1000));
                expires = "; expires="+date.toGMTString();
            }
            else expires = "";
            document.cookie = name+"="+value+expires+"; path=/";
        },

        read: function(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for(let i=0;i < ca.length;i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1,c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
            }
            return null;
        },

        remove: function(name) {
            this.create(name,"",-1);
        }
    };

    const cookie_noop = {
        create: function(name,value,minutes) {},
        read: function() { return null; },
        remove: function(name) {}
    };



    // move dependent functions to a container so that
    // they can be overriden easier in no jquery environment (node.js)
    const f = {
        extend: $ ? $.extend : _extend, // I propose using Object.assign
        each: $ ? $.each : _each, // I propose using .forEach
        ajax: $ ? $.ajax : _ajax, // I propose using axios
        cookie: typeof document !== 'undefined' ? _cookie : cookie_noop,
        detectLanguage: detectLanguage,
        escape: _escape,
        log: function(str) {
            if (o.debug && typeof console !== "undefined") console.log(str);
        },
        toLanguages: function(lng) {
            const languages = [];
            if (typeof lng === 'string' && lng.indexOf('-') > -1) {
                const parts = lng.split('-');

                lng = o.lowerCaseLng ?
                    parts[0].toLowerCase() +  '-' + parts[1].toLowerCase() :
                    parts[0].toLowerCase() +  '-' + parts[1].toUpperCase();

                if (o.load !== 'unspecific') languages.push(lng);
                if (o.load !== 'current') languages.push(parts[0]);
            } else {
                languages.push(lng);
            }

            if (languages.indexOf(o.fallbackLng) === -1 && o.fallbackLng) languages.push(o.fallbackLng);

            return languages;
        },
        // TODO: can author of this code explain wat this regexp should do?
        regexEscape: function(str) {
            return str.replace(/[\-\[\]\/{}()*+?.\\^$|]/g, "\\$&"); // remember that [\.] is identical that [.]
        }
    };
    function init(options, cb) {

        if (typeof options === 'function') {
            cb = options;
            options = {};
        }
        options = options || {};

        // override defaults with passed in options
        f.extend(o, options);

        // create namespace object if namespace is passed in as string
        if (typeof o.ns === 'string') {
            o.ns = { namespaces: [o.ns], defaultNs: o.ns};
        }

        // fallback namespaces
        if (typeof o.fallbackNS === 'string') {
            o.fallbackNS = [o.fallbackNS];
        }

        // escape prefix/suffix
        o.interpolationPrefixEscaped = f.regexEscape(o.interpolationPrefix);
        o.interpolationSuffixEscaped = f.regexEscape(o.interpolationSuffix);

        if (!o.lng) o.lng = f.detectLanguage();
        if (o.lng) {
            // set cookie with lng set (as detectLanguage will set cookie on need)
            if (o.useCookie) f.cookie.create(o.cookieName, o.lng, o.cookieExpirationTime);
        } else {
            o.lng =  o.fallbackLng;
            if (o.useCookie) f.cookie.remove(o.cookieName);
        }

        languages = f.toLanguages(o.lng);
        currentLng = languages[0];
        f.log('currentLng set to: ' + currentLng);

        pluralExtensions.setCurrentLng(currentLng);

        // add JQuery extensions
        if ($ && o.setJqueryExt) addJqueryFunct();

        // jQuery deferred
        let deferred;
        if ($ && $.hasOwnProperty('Deferred')) {
            deferred = $.Deferred();
        }

        // return immidiatly if res are passed in
        if (o.resStore) {
            resStore = o.resStore;
            if (cb) cb(translate);
            if (deferred) deferred.resolve();
            if (deferred && deferred.hasOwnProperty('promise')) return deferred.promise();
            return;
        }

        // languages to load
        const lngsToLoad = f.toLanguages(o.lng);
        if (typeof o.preload === 'string') o.preload = [o.preload];
        for (let i = 0, l = o.preload.length; i < l; i++) {
            const pres = f.toLanguages(o.preload[i]);
            for (let y = 0, len = pres.length; y < len; y++) {
                if (lngsToLoad.indexOf(pres[y]) < 0) {
                    lngsToLoad.push(pres[y]);
                }
            }
        }

        // else load them
        i18n.sync.load(lngsToLoad, o, function(err, store) {
            resStore = store;

            if (cb) cb(translate);
            if (deferred) deferred.resolve();
        });

        if (deferred && deferred.hasOwnProperty('promise')) return deferred.promise();
    }
    function preload(lngs, cb) {
        if (typeof lngs === 'string') lngs = [lngs];
        for (let i = 0, l = lngs.length; i < l; i++) {
            if (o.preload.indexOf(lngs[i]) < 0) {
                o.preload.push(lngs[i]);
            }
        }
        return init(cb);
    }

    function addResourceBundle(lng, ns, resources) {
        if (typeof ns !== 'string') {
            resources = ns;
            ns = o.ns.defaultNs;
        } else if (o.ns.namespaces.indexOf(ns) < 0) {
            o.ns.namespaces.push(ns);
        }

        resStore[lng] = resStore[lng] || {};
        resStore[lng][ns] = resStore[lng][ns] || {};

        f.extend(resStore[lng][ns], resources);
    }

    // TODO: how should work this function?
    // this function has no sense bacause o.ns is string not object
    // i changed o.ns = 'translation' to o.ns = String('translation') to make this function useful
    function setDefaultNamespace(ns) {
        o.ns.defaultNs = ns;
    }

    function loadNamespace(namespace, cb) {
        loadNamespaces([namespace], cb);
    }

    function loadNamespaces(namespaces, cb) {
        const opts = {
            dynamicLoad: o.dynamicLoad,
            resGetPath: o.resGetPath,
            getAsync: o.getAsync,
            customLoad: o.customLoad,
            ns: { namespaces: namespaces, defaultNs: ''} /* new namespaces to load */
        };

        // languages to load
        const lngsToLoad = f.toLanguages(o.lng);
        if (typeof o.preload === 'string') o.preload = [o.preload];
        for (let i = 0, l = o.preload.length; i < l; i++) {
            const pres = f.toLanguages(o.preload[i]);
            for (let y = 0, len = pres.length; y < len; y++) {
                if (lngsToLoad.indexOf(pres[y]) < 0) {
                    lngsToLoad.push(pres[y]);
                }
            }
        }

        // check if we have to load
        const lngNeedLoad = [];
        for (let a = 0, lenA = lngsToLoad.length; a < lenA; a++) {
            let needLoad = false;
            const resSet = resStore[lngsToLoad[a]];
            if (resSet) {
                for (let b = 0, lenB = namespaces.length; b < lenB; b++) {
                    if (!resSet[namespaces[b]]) needLoad = true;
                }
            } else {
                needLoad = true;
            }

            if (needLoad) lngNeedLoad.push(lngsToLoad[a]);
        }

        if (lngNeedLoad.length) {
            i18n.sync._fetch(lngNeedLoad, opts, function(err, store) {
                let todo = namespaces.length * lngNeedLoad.length;

                // load each file individual
                f.each(namespaces, function(nsIndex, nsValue) {

                    // append namespace to namespace array
                    if (o.ns.namespaces.indexOf(nsValue) < 0) {
                        o.ns.namespaces.push(nsValue);
                    }

                    f.each(lngNeedLoad, function(lngIndex, lngValue) {
                        resStore[lngValue] = resStore[lngValue] || {};
                        resStore[lngValue][nsValue] = store[lngValue][nsValue];

                        todo--; // wait for all done befor callback
                        if (todo === 0 && cb) {
                            if (o.useLocalStorage) i18n.sync._storeLocal(resStore);
                            cb();
                        }
                    });
                });
            });
        } else {
            if (cb) cb();
        }
    }

    function setLng(lng, cb) {
        return init({lng: lng}, cb);
    }

    function lng() {
        return currentLng;
    }
    function addJqueryFunct() {
        // $.t shortcut
        $.t = $.t || translate;

        // what is ele?
        function parse(ele, key, options) {
            if (key.length === 0) return;

            let attr = 'text';

            if (key.indexOf('[') === 0) {
                const parts = key.split(']');
                key = parts[1];
                attr = parts[0].substr(1, parts[0].length-1);
            }

            if (key.indexOf(';') === key.length-1) {
                key = key.substr(0, key.length-2);
            }

            let optionsToUse;
            if (attr === 'html' && ele.hasOwnProperty('html')) {
                optionsToUse = o.defaultValueFromContent ? $.extend({ defaultValue: ele.html() }, options) : options;
                ele.html($.t(key, optionsToUse));
            }
            else if (attr === 'text') {
                optionsToUse = o.defaultValueFromContent ? $.extend({ defaultValue: ele.text() }, options) : options;
                ele.text($.t(key, optionsToUse));
            } else if(ele.hasOwnProperty('attr')) {
                optionsToUse = o.defaultValueFromContent ? $.extend({ defaultValue: ele.attr(attr) }, options) : options;
                ele.attr(attr, $.t(key, optionsToUse));
            } else {
                throw new Error('Problem with parsing');
            }
        }

        function localize(ele, options) {
            if(ele.hasOwnProperty('attr')) {
                const key = ele.attr(o.selectorAttr);
                if (!key) return;

                let target = ele
                    , targetSelector = ele.data("i18n-target");
                if (targetSelector) {
                    target = ele.find(targetSelector) || ele;
                }

                if (!options && o.useDataAttrOptions === true) {
                    options = ele.data("i18n-options");
                }
                options = options || {};

                if (key.indexOf(';') >= 0) {
                    let keys = key.split(';');

                    $.each(keys, function (m, k) {
                        if (k !== '') parse(target, k, options);
                    });

                } else {
                    parse(target, key, options);
                }

                if (o.useDataAttrOptions === true) ele.data("i18n-options", options);
            } else {
                throw new Error('first argument has not method attr');
            }
        }

        if($.hasOwnProperty('fn')) {
            // fn
            $.fn.i18n = function (options) {
                return this.each(function () {
                    // localize element itself
                    localize($(this), options);

                    // localize childs
                    const elements = $(this).find('[' + o.selectorAttr + ']');
                    elements.each(function () {
                        localize($(this), options);
                    });
                });
            };
        }
    }
    function applyReplacement(str, replacementHash, nestedKey, options) {
        if (!str) return str;

        options = options || replacementHash; // first call uses replacement hash combined with options
        if (str.indexOf(options.interpolationPrefix || o.interpolationPrefix) < 0) return str;

        const prefix = options.interpolationPrefix ? f.regexEscape(options.interpolationPrefix) : o.interpolationPrefixEscaped
          , suffix = options.interpolationSuffix ? f.regexEscape(options.interpolationSuffix) : o.interpolationSuffixEscaped
          , unEscapingSuffix = 'HTML'+suffix;

        f.each(replacementHash, function(key, value) {
            const nextKey = nestedKey ? nestedKey + o.keySeparator + key : key;
            if (typeof value === 'object' && value !== null) {
                str = applyReplacement(str, value, nextKey, options);
            } else {
                if (options.escapeInterpolation || o.escapeInterpolation) {
                    str = str.replace(new RegExp([prefix, nextKey, unEscapingSuffix].join(''), 'g'), value);
                    str = str.replace(new RegExp([prefix, nextKey, suffix].join(''), 'g'), f.escape(value));
                } else {
                    str = str.replace(new RegExp([prefix, nextKey, suffix].join(''), 'g'), value);
                }
                // str = options.escapeInterpolation;
            }
        });
        return str;
    }

    // append it to functions
    f.applyReplacement = applyReplacement;

    function applyReuse(translated, options) {
        const comma = ',';
        const options_open = '{';
        const options_close = '}';

        let opts = f.extend({}, options);
        delete opts.postProcess;

        while (translated.indexOf(o.reusePrefix) !== -1) {
            replacementCounter++;
            if (o.hasOwnProperty('maxRecursion') && replacementCounter > o.maxRecursion) { break; } // safety net for too much recursion, <-- commented by @gustawdaniel - but o has not property maxRecursion
            const index_of_opening = translated.lastIndexOf(o.reusePrefix);
            const index_of_end_of_closing = translated.indexOf(o.reuseSuffix, index_of_opening) + o.reuseSuffix.length;
            const token = translated.substring(index_of_opening, index_of_end_of_closing);
            let token_without_symbols = token.replace(o.reusePrefix, '').replace(o.reuseSuffix, '');


            if (token_without_symbols.indexOf(comma) !== -1) {
                const index_of_token_end_of_closing = token_without_symbols.indexOf(comma);
                if (token_without_symbols.indexOf(options_open, index_of_token_end_of_closing) !== -1
                    && token_without_symbols.indexOf(options_close, index_of_token_end_of_closing) !== -1) {
                    let index_of_opts_opening = token_without_symbols.indexOf(options_open, index_of_token_end_of_closing);
                    const index_of_opts_end_of_closing = token_without_symbols.indexOf(options_close, index_of_opts_opening) + options_close.length;
                    try {
                        opts = f.extend(opts, JSON.parse(token_without_symbols.substring(index_of_opts_opening, index_of_opts_end_of_closing)));
                        token_without_symbols = token_without_symbols.substring(0, index_of_token_end_of_closing);
                    } catch (e) {
                    }
                }
            }

            const translated_token = _translate(token_without_symbols, opts);
            translated = translated.replace(token, translated_token);
        }
        return translated;
    }

    function hasContext(options) {
        return (options.context && typeof options.context === 'string');
    }

    function needsPlural(options) {
        return (options.count !== undefined && typeof options.count !== 'string' && options.count !== 1);
    }

    function exists(key, options) {
        options = options || {};

        const notFound = options.defaultValue || key
            , found = _find(key, options);

        return found !== undefined || found === notFound;
    }

    function translate(key, options) {
        replacementCounter = 0;
        return _translate.apply(null, arguments);
    }

    function _injectSprintfProcessor() {

        const values = [];

        // mh: build array from second argument onwards
        for (let i = 1; i < arguments.length; i++) {
            values.push(arguments[i]);
        }

        return {
            postProcess: 'sprintf',
            sprintf:     values
        };
    }

    function _translate(key, options) {

        if (typeof options === 'string') {
            // mh: gettext like sprintf syntax found, automatically create sprintf processor
            options = _injectSprintfProcessor.apply(null, arguments);
        } else {
            options = options || {};
        }


        let parts
            , lngs = options.lng ? f.toLanguages(options.lng) : languages
            , notFound = options.defaultValue || key
            , ns = options.ns || o.ns.defaultNs
            , found = _find(key, options);

        // split ns and key
        if (key.indexOf(o.nsSeparator) > -1) {
            parts = key.split(o.nsSeparator);
            ns = parts[0];
            key = parts[1];
        }

        if (found === undefined && o.sendMissing) {
            if (options.lng) {
                sync.postMissing(lngs[0], ns, key, notFound, lngs);
            } else {
                sync.postMissing(o.lng, ns, key, notFound, lngs);
            }
        }

        const postProcessor = options.postProcess || o.postProcess;
        if (found !== undefined && postProcessor) {
            if (postProcessors[postProcessor]) {
                found = postProcessors[postProcessor](found, key, options);
            }
        }

        // process notFound if function exists
        let splitNotFound = notFound;
        if (notFound.indexOf(o.nsSeparator) > -1) {
            parts = notFound.split(o.nsSeparator);
            splitNotFound = parts[1];
        }
        if (splitNotFound === key && o.parseMissingKey) {
            notFound = o.parseMissingKey(notFound);
        }

        if (found === undefined) {
            notFound = applyReplacement(notFound, options);
            notFound = applyReuse(notFound, options);

            if (postProcessor && postProcessors[postProcessor]) {
                const val = options.defaultValue || key;
                found = postProcessors[postProcessor](val, key, options);
            }
        }

        return (found !== undefined) ? found : notFound;
    }

    function _find(key, options){
        options = options || {};

        let optionWithoutCount, translated
            , notFound = options.defaultValue || key
            , lngs = languages;

        if (!resStore) { return notFound; } // no resStore to translate from

        if (options.lng) {
            lngs = f.toLanguages(options.lng);

            if (!resStore[lngs[0]]) {
                const oldAsync = o.getAsync;
                o.getAsync = false;

                i18n.sync.load(lngs, o, function(err, store) {
                    f.extend(resStore, store);
                    o.getAsync = oldAsync;
                });
            }
        }

        let ns = options.ns || o.ns.defaultNs;
        if (key.indexOf(o.nsSeparator) > -1) {
            const parts = key.split(o.nsSeparator);
            ns = parts[0];
            key = parts[1];
        }

        if (hasContext(options)) {
            optionWithoutCount = f.extend({}, options);
            delete optionWithoutCount.context;
            optionWithoutCount.defaultValue = o.contextNotFound;

            const contextKey = ns + o.nsSeparator + key + '_' + options.context;

            translated = translate(contextKey, optionWithoutCount);
            if (translated !== o.contextNotFound) {
                return applyReplacement(translated, { context: options.context }); // apply replacement for context only
            } // else continue translation with original/nonContext key
        }

        if (needsPlural(options)) {
            optionWithoutCount = f.extend({}, options);
            delete optionWithoutCount.count;
            optionWithoutCount.defaultValue = o.pluralNotFound;

            let pluralKey = ns + o.nsSeparator + key + o.pluralSuffix;
            const pluralExtension = pluralExtensions.get(lngs[0], options.count);
            if (pluralExtension >= 0) {
                pluralKey = pluralKey + '_' + pluralExtension;
            } else if (pluralExtension === 1) {
                pluralKey = ns + o.nsSeparator + key; // singular
            }

            translated = translate(pluralKey, optionWithoutCount);
            if (translated !== o.pluralNotFound) {
                return applyReplacement(translated, {
                    count: options.count,
                    interpolationPrefix: options.interpolationPrefix,
                    interpolationSuffix: options.interpolationSuffix
                }); // apply replacement for count only
            } // else continue translation with original/singular key
        }

        let found;
        const keys = key.split(o.keySeparator);
        for (let i = 0, len = lngs.length; i < len; i++ ) {
            if (found !== undefined) break;

            const l = lngs[i];

            let x = 0;
            let value = resStore[l] && resStore[l][ns];
            while (keys[x]) {
                value = value && value[keys[x]];
                x++;
            }
            if (value !== undefined) {
                if (typeof value === 'string') {
                    value = applyReplacement(value, options);
                    value = applyReuse(value, options);
                } else if (Object.prototype.toString.apply(value) === '[object Array]' && !o.returnObjectTrees && !options.returnObjectTrees) {
                    value = value.join('\n');
                    value = applyReplacement(value, options);
                    value = applyReuse(value, options);
                } else if (value === null && o.fallbackOnNull === true) {
                    value = undefined;
                } else if (value !== null) {
                    if (!o.returnObjectTrees && !options.returnObjectTrees) {
                        value = 'key \'' + ns + ':' + key + ' (' + l + ')\' ' +
                            'returned a object instead of string.';
                        f.log(value);
                    } else {
                        const copy = {}; // apply child translation on a copy
                        for (let m in value) {
                            // apply translation on childs
                            if (value.hasOwnProperty(m)) {
                                copy[m] = _translate(ns + o.nsSeparator + key + o.keySeparator + m, options);
                            }
                        }
                        value = copy;
                    }
                }
                found = value;
            }
        }

        if (found === undefined && !options.isFallbackLookup && (o.fallbackToDefaultNS === true || (o.fallbackNS && o.fallbackNS.length > 0))) {
            // set flag for fallback lookup - avoid recursion
            options.isFallbackLookup = true;

            if (o.fallbackNS.length) {

                for (let y = 0, lenY = o.fallbackNS.length; y < lenY; y++) {
                    found = _find(o.fallbackNS[y] + o.nsSeparator + key, options);

                    if (found) {
                        /* compare value without namespace */
                        const foundValue = found.indexOf(o.nsSeparator) > -1 ? found.split(o.nsSeparator)[1] : found
                          , notFoundValue = notFound.indexOf(o.nsSeparator) > -1 ? notFound.split(o.nsSeparator)[1] : notFound;

                        if (foundValue !== notFoundValue) break;
                    }
                }
            } else {
                found = _find(key, options); // fallback to default NS
            }
        }

        return found;
    }
    function detectLanguage() {
        let detectedLng;

        // get from qs
        const qsParm = [];
        if (typeof window !== 'undefined') {
            (function() {
                const query = window.location.search.substring(1);
                const parms = query.split('&');
                for (let i=0; i<parms.length; i++) {
                    const pos = parms[i].indexOf('=');
                    if (pos > 0) {
                        const key = parms[i].substring(0,pos);
                        qsParm[key] = parms[i].substring(pos+1);
                    }
                }
            })();
            if (qsParm[o.detectLngQS]) {
                detectedLng = qsParm[o.detectLngQS];
            }
        }

        // get from cookie
        if (!detectedLng && typeof document !== 'undefined' && o.useCookie ) {
            const c = f.cookie.read(o.cookieName);
            if (c) detectedLng = c;
        }

        // get from navigator
        if (!detectedLng && typeof navigator !== 'undefined') {
            detectedLng =  (navigator.language) ? navigator.language : detectedLng; // navigator.userLanguage is depreciated
        }

        return detectedLng;
    }
    const sync = {

        load: function(lngs, options, cb) {
            if (options.useLocalStorage) {
                sync._loadLocal(lngs, options, function(err, store) {
                    const missingLngs = [];
                    for (let i = 0, len = lngs.length; i < len; i++) {
                        if (!store[lngs[i]]) missingLngs.push(lngs[i]);
                    }

                    if (missingLngs.length > 0) {
                        sync._fetch(missingLngs, options, function(err, fetched) {
                            f.extend(store, fetched);
                            sync._storeLocal(fetched);

                            cb(null, store);
                        });
                    } else {
                        cb(null, store);
                    }
                });
            } else {
                sync._fetch(lngs, options, function(err, store){
                    cb(null, store);
                });
            }
        },

        _loadLocal: function(lngs, options, cb) {
            const store = {}
              , nowMS = new Date().getTime();

            if(window.localStorage) {

                let todo = lngs.length;

                f.each(lngs, function(key, lng) {
                    let local = window.localStorage.getItem('res_' + lng);

                    if (local) {
                        local = JSON.parse(local);

                        if (local.i18nStamp && local.i18nStamp + options.localStorageExpirationTime > nowMS) {
                            store[lng] = local;
                        }
                    }

                    todo--; // wait for all done befor callback
                    if (todo === 0) cb(null, store);
                });
            }
        },

        _storeLocal: function(store) {
            if(window.localStorage) {
                for (let m in store) {
                    if (store.hasOwnProperty(m)) {
                        store[m].i18nStamp = new Date().getTime();
                        window.localStorage.setItem('res_' + m, JSON.stringify(store[m]));
                    }
                }
            }
        },

        _fetch: function(lngs, options, cb) {
            const ns = options.ns
              , store = {};

            if (!options.dynamicLoad) {
                let todo = ns.namespaces.length * lngs.length
                    , errors;

                // load each file individual
                f.each(ns.namespaces, function(nsIndex, nsValue) {
                    f.each(lngs, function(lngIndex, lngValue) {

                        // Call this once our translation has returned.
                        const loadComplete = function(err, data) {
                            if (err) {
                                errors = errors || [];
                                errors.push(err);
                            }
                            store[lngValue] = store[lngValue] || {};
                            store[lngValue][nsValue] = data;

                            todo--; // wait for all done befor callback
                            if (todo === 0) cb(errors, store);
                        };

                        if(typeof options.customLoad === 'function'){
                            // Use the specified custom callback.
                            options.customLoad(lngValue, nsValue, options, loadComplete);
                        } else {
                            //~ // Use our inbuilt sync.
                            sync._fetchOne(lngValue, nsValue, options, loadComplete);
                        }
                    });
                });
            } else {
                // Call this once our translation has returned.
                const loadComplete = function(err, data) {
                    cb(null, data);
                };

                if(typeof options.customLoad === 'function'){
                    // Use the specified custom callback.
                    options.customLoad(lngs, ns.namespaces, options, loadComplete);
                } else {
                    const url = applyReplacement(options.resGetPath, { lng: lngs.join('+'), ns: ns.namespaces.join('+') });
                    // load all needed stuff once
                    f.ajax({
                        url: url,
                        success: function(data) { // args , status, xhr not necessary
                            f.log('loaded: ' + url);
                            loadComplete(null, data);
                        },
                        error : function(xhr, status, error) {
                            f.log('failed loading: ' + url);
                            loadComplete('failed loading resource.json error: ' + error);
                        },
                        dataType: "json",
                        async : options.getAsync
                    });
                }
            }
        },

        _fetchOne: function(lng, ns, options, done) {
            const url = applyReplacement(options.resGetPath, { lng: lng, ns: ns });
            f.ajax({
                url: url,
                success: function(data) { // success has not args: status, xhr
                    f.log('loaded: ' + url);
                    done(null, data);
                },
                error : function(xhr, status, error) {
                    f.log('failed loading: ' + url);
                    done(error, {});
                },
                dataType: "json",
                async : options.getAsync
            });
        },

        postMissing: function(lng, ns, key, defaultValue, lngs) {
            const payload = {};
            payload[key] = defaultValue;

            const urls = [];

            if (o.sendMissingTo === 'fallback' && o.fallbackLng !== false) {
                urls.push({lng: o.fallbackLng, url: applyReplacement(o.resPostPath, { lng: o.fallbackLng, ns: ns })});
            } else if (o.sendMissingTo === 'current' || (o.sendMissingTo === 'fallback' && o.fallbackLng === false) ) {
                urls.push({lng: lng, url: applyReplacement(o.resPostPath, { lng: lng, ns: ns })});
            } else if (o.sendMissingTo === 'all') {
                for (let i = 0, l = lngs.length; i < l; i++) {
                    urls.push({lng: lngs[i], url: applyReplacement(o.resPostPath, { lng: lngs[i], ns: ns })});
                }
            }

            for (let y = 0, len = urls.length; y < len; y++) {
                const item = urls[y];
                f.ajax({
                    url: item.url,
                    type: o.sendType,
                    data: payload,
                    success: function() {
                        f.log('posted missing key \'' + key + '\' to: ' + item.url);

                        // add key to resStore
                        const keys = key.split('.');
                        let x = 0;
                        let value = resStore[item.lng][ns];
                        while (keys[x]) {
                            if (x === keys.length - 1) {
                                value = value[keys[x]] = defaultValue;
                            } else {
                                value = value[keys[x]] = value[keys[x]] || {};
                            }
                            x++;
                        }
                    },
                    error : function() {
                        f.log('failed posting missing key \'' + key + '\' to: ' + item.url);
                    },
                    dataType: "json",
                    async : o.postAsync
                });
            }
        }
    };
    // definition http://translate.sourceforge.net/wiki/l10n/pluralforms
    const pluralExtensions = {

        rules: {
            "ach": {
                "name": "Acholi",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "af": {
                "name": "Afrikaans",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ak": {
                "name": "Akan",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "am": {
                "name": "Amharic",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "an": {
                "name": "Aragonese",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ar": {
                "name": "Arabic",
                "numbers": [
                    0,
                    1,
                    2,
                    3,
                    11,
                    100
                ],
                "plurals": function(n) { return Number(n===0 ? 0 : n===1 ? 1 : n===2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5); }
            },
            "arn": {
                "name": "Mapudungun",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "ast": {
                "name": "Asturian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ay": {
                "name": "Aymar\u00e1",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "az": {
                "name": "Azerbaijani",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "be": {
                "name": "Belarusian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "bg": {
                "name": "Bulgarian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "bn": {
                "name": "Bengali",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "bo": {
                "name": "Tibetan",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "br": {
                "name": "Breton",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "bs": {
                "name": "Bosnian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "ca": {
                "name": "Catalan",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "cgg": {
                "name": "Chiga",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "cs": {
                "name": "Czech",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number((n===1) ? 0 : (n>=2 && n<=4) ? 1 : 2); }
            },
            "csb": {
                "name": "Kashubian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n===1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "cy": {
                "name": "Welsh",
                "numbers": [
                    1,
                    2,
                    3,
                    8
                ],
                "plurals": function(n) { return Number((n===1) ? 0 : (n===2) ? 1 : (n !== 8 && n !== 11) ? 2 : 3); }
            },
            "da": {
                "name": "Danish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "de": {
                "name": "German",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "dz": {
                "name": "Dzongkha",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "el": {
                "name": "Greek",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "en": {
                "name": "English",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "eo": {
                "name": "Esperanto",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "es": {
                "name": "Spanish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "es_ar": {
                "name": "Argentinean Spanish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "et": {
                "name": "Estonian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "eu": {
                "name": "Basque",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "fa": {
                "name": "Persian",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "fi": {
                "name": "Finnish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "fil": {
                "name": "Filipino",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "fo": {
                "name": "Faroese",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "fr": {
                "name": "French",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "fur": {
                "name": "Friulian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "fy": {
                "name": "Frisian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ga": {
                "name": "Irish",
                "numbers": [
                    1,
                    2,
                    3,
                    7,
                    11
                ],
                "plurals": function(n) { return Number(n===1 ? 0 : n===2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4) ;}
            },
            "gd": {
                "name": "Scottish Gaelic",
                "numbers": [
                    1,
                    2,
                    3,
                    20
                ],
                "plurals": function(n) { return Number((n===1 || n===11) ? 0 : (n===2 || n===12) ? 1 : (n > 2 && n < 20) ? 2 : 3); }
            },
            "gl": {
                "name": "Galician",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "gu": {
                "name": "Gujarati",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "gun": {
                "name": "Gun",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "ha": {
                "name": "Hausa",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "he": {
                "name": "Hebrew",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "hi": {
                "name": "Hindi",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "hr": {
                "name": "Croatian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "hu": {
                "name": "Hungarian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "hy": {
                "name": "Armenian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ia": {
                "name": "Interlingua",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "id": {
                "name": "Indonesian",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "is": {
                "name": "Icelandic",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n%10!==1 || n%100===11); }
            },
            "it": {
                "name": "Italian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ja": {
                "name": "Japanese",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "jbo": {
                "name": "Lojban",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "jv": {
                "name": "Javanese",
                "numbers": [
                    0,
                    1
                ],
                "plurals": function(n) { return Number(n !== 0); }
            },
            "ka": {
                "name": "Georgian",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "kk": {
                "name": "Kazakh",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "km": {
                "name": "Khmer",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "kn": {
                "name": "Kannada",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ko": {
                "name": "Korean",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "ku": {
                "name": "Kurdish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "kw": {
                "name": "Cornish",
                "numbers": [
                    1,
                    2,
                    3,
                    4
                ],
                "plurals": function(n) { return Number((n===1) ? 0 : (n===2) ? 1 : (n === 3) ? 2 : 3); }
            },
            "ky": {
                "name": "Kyrgyz",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "lb": {
                "name": "Letzeburgesch",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ln": {
                "name": "Lingala",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "lo": {
                "name": "Lao",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "lt": {
                "name": "Lithuanian",
                "numbers": [
                    1,
                    2,
                    10
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "lv": {
                "name": "Latvian",
                "numbers": [
                    0,
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n !== 0 ? 1 : 2); }
            },
            "mai": {
                "name": "Maithili",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "mfe": {
                "name": "Mauritian Creole",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "mg": {
                "name": "Malagasy",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "mi": {
                "name": "Maori",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "mk": {
                "name": "Macedonian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n===1 || n%10===1 ? 0 : 1); }
            },
            "ml": {
                "name": "Malayalam",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "mn": {
                "name": "Mongolian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "mnk": {
                "name": "Mandinka",
                "numbers": [
                    0,
                    1,
                    2
                ],
                "plurals": function(n) { return Number(0 ? 0 : n===1 ? 1 : 2); }
            },
            "mr": {
                "name": "Marathi",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ms": {
                "name": "Malay",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "mt": {
                "name": "Maltese",
                "numbers": [
                    1,
                    2,
                    11,
                    20
                ],
                "plurals": function(n) { return Number(n===1 ? 0 : n===0 || ( n%100>1 && n%100<11) ? 1 : (n%100>10 && n%100<20 ) ? 2 : 3); }
            },
            "nah": {
                "name": "Nahuatl",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "nap": {
                "name": "Neapolitan",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "nb": {
                "name": "Norwegian Bokmal",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ne": {
                "name": "Nepali",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "nl": {
                "name": "Dutch",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "nn": {
                "name": "Norwegian Nynorsk",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "no": {
                "name": "Norwegian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "nso": {
                "name": "Northern Sotho",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "oc": {
                "name": "Occitan",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "or": {
                "name": "Oriya",
                "numbers": [
                    2,
                    1
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "pa": {
                "name": "Punjabi",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "pap": {
                "name": "Papiamento",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "pl": {
                "name": "Polish",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n===1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "pms": {
                "name": "Piemontese",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ps": {
                "name": "Pashto",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "pt": {
                "name": "Portuguese",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "pt_br": {
                "name": "Brazilian Portuguese",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "rm": {
                "name": "Romansh",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ro": {
                "name": "Romanian",
                "numbers": [
                    1,
                    2,
                    20
                ],
                "plurals": function(n) { return Number(n===1 ? 0 : (n===0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2); }
            },
            "ru": {
                "name": "Russian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "sah": {
                "name": "Yakut",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "sco": {
                "name": "Scots",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "se": {
                "name": "Northern Sami",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "si": {
                "name": "Sinhala",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "sk": {
                "name": "Slovak",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number((n===1) ? 0 : (n>=2 && n<=4) ? 1 : 2); }
            },
            "sl": {
                "name": "Slovenian",
                "numbers": [
                    5,
                    1,
                    2,
                    3
                ],
                "plurals": function(n) { return Number(n%100===1 ? 1 : n%100===2 ? 2 : n%100===3 || n%100===4 ? 3 : 0); }
            },
            "so": {
                "name": "Somali",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "son": {
                "name": "Songhay",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "sq": {
                "name": "Albanian",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "sr": {
                "name": "Serbian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "su": {
                "name": "Sundanese",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "sv": {
                "name": "Swedish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "sw": {
                "name": "Swahili",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "ta": {
                "name": "Tamil",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "te": {
                "name": "Telugu",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "tg": {
                "name": "Tajik",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "th": {
                "name": "Thai",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "ti": {
                "name": "Tigrinya",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "tk": {
                "name": "Turkmen",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "tr": {
                "name": "Turkish",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "tt": {
                "name": "Tatar",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "ug": {
                "name": "Uyghur",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "uk": {
                "name": "Ukrainian",
                "numbers": [
                    1,
                    2,
                    5
                ],
                "plurals": function(n) { return Number(n%10===1 && n%100!==11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); }
            },
            "ur": {
                "name": "Urdu",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "uz": {
                "name": "Uzbek",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "vi": {
                "name": "Vietnamese",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "wa": {
                "name": "Walloon",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n > 1); }
            },
            "wo": {
                "name": "Wolof",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            },
            "yo": {
                "name": "Yoruba",
                "numbers": [
                    1,
                    2
                ],
                "plurals": function(n) { return Number(n !== 1); }
            },
            "zh": {
                "name": "Chinese",
                "numbers": [
                    1
                ],
                "plurals": function() { return 0; }
            }
        },

        // for demonstration only sl and ar is added but you can add your own pluralExtensions
        // addRule: function(lng, obj) {
        //     pluralExtensions.rules[lng] = obj;
        // },

        setCurrentLng: function(lng) {
            if (!pluralExtensions.currentRule || pluralExtensions.currentRule.lng !== lng) {
                const parts = lng.split('-');

                pluralExtensions.currentRule = {
                    lng: lng,
                    rule: pluralExtensions.rules[parts[0]]
                };
            }
        },

        get: function(lng, count) {
            const parts = lng.split('-');

            function getResult(l, c) {
                let ext;
                if (pluralExtensions.currentRule && pluralExtensions.currentRule.lng === lng) {
                    ext = pluralExtensions.currentRule.rule;
                } else {
                    ext = pluralExtensions.rules[l];
                }
                if (ext) {
                    const i = ext.plurals(c);
                    let number = ext.numbers[i];
                    if (ext.numbers.length === 2 && ext.numbers[0] === 1) {
                        if (number === 2) {
                            number = -1; // regular plural
                        } else if (number === 1) {
                            number = 1; // singular
                        }
                    }//console.log(count + '-' + number);
                    return number;
                } else {
                    return c === 1 ? '1' : '-1';
                }
            }

            return getResult(parts[0], count);
        }

    };
    const postProcessors = {};
    const addPostProcessor = function(name, fc) {
        postProcessors[name] = fc;
    };
    // sprintf support
    const sprintf = (function() {
        function get_type(variable) {
            return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
        }
        function str_repeat(input, multiplier) {
            return input.repeat(multiplier); // simplified
        }

        const str_format = function() {
            if (!str_format.cache.hasOwnProperty(arguments[0])) {
                str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
            }
            return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
        };

        str_format.format = function(parse_tree, argv) {
            const tree_length = parse_tree.length, output = [];

            /**
             * @type {number}
             */
            let argNumber;

            /**
             * @type {string}
             */
            let arg;

            let node_type = ''
                , k
                , match
                , pad
                , pad_character
                , pad_length
                , cursor = 1;

            for (let i = 0; i < tree_length; i++) {
                node_type = get_type(parse_tree[i]);
                if (node_type === 'string') {
                    output.push(parse_tree[i]);
                }
                else if (node_type === 'array') {
                    match = parse_tree[i]; // convenience purposes only
                    if (match[2]) { // keyword argument
                        /**
                         * @type {number}
                         */
                        argNumber = argv[cursor];
                        for (k = 0; k < match[2].length; k++) {
                            if (!argNumber.hasOwnProperty(match[2][k])) {
                                throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
                            }
                            /**
                             * @type {number}
                             */
                            argNumber = argNumber[match[2][k]];
                        }
                    }
                    else if (match[1]) { // positional argument (explicit)
                        /**
                         * @type {number}
                         */
                        argNumber = argv[match[1]];
                    }
                    else { // positional argument (implicit)
                        /**
                         * @type {number}
                         */
                        argNumber = argv[cursor++];
                    }

                    if (/[^s]/.test(match[8]) && (get_type(argNumber) !== 'number')) {
                        throw(sprintf('[sprintf] expecting number but found %s', get_type(argNumber)));
                    }
                    // TODO please document this code, toString method has no argument on string, but has for number
                    switch (match[8]) {
                        case 'b': arg = argNumber.toString(2); break;
                        case 'c': arg = String.fromCharCode(argNumber); break;
                        case 'd': arg = String(parseInt(String(argNumber), 10)); break;
                        case 'e': arg = match[7] ? argNumber.toExponential(match[7]) : argNumber.toExponential(); break;
                        case 'f': arg = match[7] ? parseFloat(String(argNumber)).toFixed(match[7]) : parseFloat(String(argNumber)); break;
                        case 'o': arg = argNumber.toString(8); break;
                        case 's': arg = ((arg = String(argNumber)) && match[7] ? arg.substring(0, match[7]) : arg); break;
                        case 'u': arg = String(Math.abs(argNumber)); break;
                        case 'x': arg = argNumber.toString(16); break;
                        case 'X': arg = argNumber.toString(16).toUpperCase(); break;
                    }
                    arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
                    pad_character = match[4] ? match[4] === '0' ? '0' : match[4].charAt(1) : ' ';
                    pad_length = match[6] - String(arg).length;
                    pad = match[6] ? str_repeat(pad_character, pad_length) : '';
                    output.push(match[5] ? arg + pad : pad + arg);
                }
            }
            return output.join('');
        };

        str_format.cache = {};

        str_format.parse = function(fmt) {
            const parse_tree = [];

            let match = []
                , _fmt = fmt
                , arg_names = 0;

            while (_fmt) {
                if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
                    parse_tree.push(match[0]);
                }
                else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
                    parse_tree.push('%');
                }
                else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
                    if (match[2]) {
                        arg_names |= 1;

                        const field_list = [];

                        let field_match = []
                            , replacement_field = match[2];

                        if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                            field_list.push(field_match[1]);
                            while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                                    field_list.push(field_match[1]);
                                }
                                else if ((field_match = /^\[(\d+)]/.exec(replacement_field)) !== null) {
                                    field_list.push(field_match[1]);
                                }
                                else {
                                    throw('[sprintf] huh?');
                                }
                            }
                        }
                        else {
                            throw('[sprintf] huh?');
                        }
                        match[2] = field_list;
                    }
                    else {
                        arg_names |= 2;
                    }
                    if (arg_names === 3) {
                        throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
                    }
                    parse_tree.push(match);
                }
                else {
                    throw('[sprintf] huh?');
                }
                _fmt = _fmt.substring(match[0].length);
            }
            return parse_tree;
        };

        return str_format;
    })();

    const vsprintf = function(fmt, argv) {
        argv.unshift(fmt);
        return sprintf.apply(null, argv);
    };

    addPostProcessor("sprintf", function(val, key, opts) {
        if (!opts.sprintf) return val;

        if (Object.prototype.toString.apply(opts.sprintf) === '[object Array]') {
            return vsprintf(val, opts.sprintf);
        } else if (typeof opts.sprintf === 'object') {
            return sprintf(val, opts.sprintf);
        }

        return val;
    });
    // public api interface
    i18n.init = init;
    i18n.setLng = setLng;
    i18n.preload = preload;
    i18n.addResourceBundle = addResourceBundle;
    i18n.loadNamespace = loadNamespace;
    i18n.loadNamespaces = loadNamespaces;
    i18n.setDefaultNamespace = setDefaultNamespace;
    i18n.t = translate;
    i18n.translate = translate;
    i18n.exists = exists;
    i18n.detectLanguage = f.detectLanguage;
    i18n.pluralExtensions = pluralExtensions;
    i18n.sync = sync;
    i18n.functions = f;
    i18n.lng = lng;
    i18n.addPostProcessor = addPostProcessor;
    i18n.options = o;

})();