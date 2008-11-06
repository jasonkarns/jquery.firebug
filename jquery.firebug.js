/*global jQuery */

(function ($) {
    /****************************************************************************/
    /***  Degrading Script Tags : http://ejohn.org/blog/degrading-script-tags ***/
    /***  This block must never be used in an embedded script                 ***/
    /***  Determine Firebug options from this script tag                      ***/
    var bootstrap = eval("(" + document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1].innerHTML + ")");
    /****************************************************************************/

    $.firebug = {
        defaults: {
            debug: false,
            lite: {
                state: "minimized", // open/maximized, closed, minimized
                watchXHR: true
            },
            methods: ["assert", "log", "debug", "info", "warn", "error", "dir", "dirxml", "count", "trace", "group", "groupEnd", "time", "timeEnd", "profile", "profileEnd"]
        },

        mountFirebugLite: function (options, force) {
            var settings = $.extend({}, $.firebug.defaults, options);

            // if there's no window console or firebug console, import Firebug Lite
            if ((!window.console.firebug && settings.debug) || force) {
                $(document).ready(function () {
                    var firebug = document.createElement('script');
                    firebug.setAttribute('src', 'firebuglite/firebug-lite-compressed.js');
                    document.body.appendChild(firebug);
                    (function () {
                        if (window.pi && window.firebug) {
                            // Firebug Lite has been imported
                            window.firebug.init();
                            
                            // Open to desired state
                            switch (settings.lite.state) {
                            case "closed":
                                window.firebug.win.close();
                                break;
                            case "minimized":
                                window.firebug.win.minimize();
                                break;
                            case "open":
                            case "maximized":
                                window.firebug.win.maximize();
                                break;
                            default:
                                break;
                            }
                            
                            // add watchXHR support
                            var ajax_super = $.ajax;
                            $.ajaxSetup({watch: settings.lite.watchXHR});
                            $.ajax = function (ajax_super) {
                                return function (options) {
                                    var xhr = ajax_super(options);
                                    var opts = $.extend({}, $.ajaxSettings, options);
                                    if (opts && opts.watch) {
                                        window.firebug.watchXHR(xhr);
                                    }
                                    return xhr;
                                };
                            }(ajax_super);
                            
                            // re-map console commands to Firebug Lite commands
                            var groupStack = [];
                            var timerStack = [];
                            for (var method in settings.methods) {
                                if (settings.methods.hasOwnProperty(method)) {
                                    switch (settings.methods[method]) {
                                    // map debug,info,warn,error to log()
                                    case "debug":
                                    case "info":
                                    case "warn":
                                    case "error":
                                        window.console[settings.methods[method]] = window.console.log;
                                        break;
                                    // map dirxml to dir()
                                    case "dirxml":
                                        window.console.dirxml = window.console.dir;
                                        break;
                                    // use log() to form a sort of group
                                    case "group":
                                        window.console.group = function () {
                                            return function () {
                                                // replace the jQuery object as first argument because its useless when printed in FirebugLite
                                                var args = $.makeArray(arguments);
                                                args[0] = "Group Start: ";
                                                groupStack.push(args);
                                                window.console.log.apply(window.console, args);
                                            };
                                        }();
                                        break;
                                    // use log() to form a sort of group
                                    case "groupEnd":
                                        window.console.groupEnd = function () {
                                            return function () {
                                                var args = groupStack.pop();
                                                args[0] = "Group End: ";
                                                window.console.log.apply(window.console, args);
                                            };
                                        }();
                                        break;
                                    // start a timer
                                    case "time":
                                        window.console.time = function () {
                                            return function () {
                                                timerStack[arguments[0]] = [];
                                                timerStack[arguments[0]].push(new Date().getTime());
                                            };
                                        }();
                                        break;
                                    // use log() to display timer results
                                    case "timeEnd":
                                        window.console.timeEnd = function () {
                                            return function () {
                                                if (!timerStack[arguments[0]]) {
                                                    return window.console.error("Timer '" + arguments[0] + "' has not been started.");
                                                }
                                                var sec = (new Date().getTime() - timerStack[arguments[0]].pop()) / 1000;
                                                window.console.log("Timer '" + arguments[0] + "': " + sec + " seconds.");
                                            };
                                        }();
                                        break;
                                    // use log() for assert
                                    case "assert":
                                        window.console.assert = function () {
                                            return function () {
                                                // drop the 'false' argument
                                                var args = $.makeArray(arguments);
                                                args.shift();
                                                window.console.log.apply(window.console, args);
                                            };
                                        }();
                                        break;
                                    // count, trace, profile, profileEnd are unsupported
                                    case "count":
                                    case "trace":
                                    case "profile":
                                    case "profileEnd":
                                        window.console[settings.methods[method]] = function (method) {
                                            return function () {
                                                window.console.log("Firebug Lite does not support method: " + method);
                                            };
                                        }(settings.methods[method]);
                                        break;
                                    // log,dir built-in with Firebug Lite
                                    case "log":
                                    case "dir":
                                        break;
                                    default:
                                        break;
                                    }
                                }
                            }
                        }
                        else {
                            setTimeout(arguments.callee);
                        }
                    })();
//                    void (firebug);
                });
            }
        },

        mountFirebug: function (options) {
            var settings = $.extend({}, $.firebug.defaults, options);

            // foreach Firebug method, create an associated jQuery function
            for (var method in settings.methods) {
                if (settings.methods.hasOwnProperty(method)) {
                    // set a blank function foreach console method to avoid 'function undefined' errors
                    if (!window.console[settings.methods[method]]) {
                        window.console[settings.methods[method]] = function () {
                            return function () {
                            };
                        }();
                    }
                    switch (settings.methods[method]) {
                    case "log":
                    case "debug":
                    case "info":
                    case "warn":
                    case "error":
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                // parse out jQuery '.method' commands to call on jQuery object
                                $.each(arguments, function(self, args){
                                    return function(key, value){
                                        var found = false;
                                        if (value && value.match && (found = value.match(/^\.(([a-zA-Z]+[a-zA-Z0-9_\-]*)\(.*\))$/))) {
                                            if ($(self)[found[2]]) {
                                                with ($(self)) {
                                                    args[key] = eval(found[1]);
                                                }
                                            }
                                        }
                                    };
                                }(this, arguments));
                                if (arguments.length) {
                                    window.console[method].apply(window.console, arguments);
                                }
                                // group this jQuery object, calling the method on each item
                                window.console.group(this);
                                this.each(function (i) {
                                    window.console[method](this);
                                });
                                window.console.groupEnd();
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "dir":
                    case "dirxml":
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                if (arguments.length) {
                                    window.console[method].apply(window.console, arguments);
                                }
                                // group this jQuery object, calling the method on each item
                                window.console.group(this);
                                this.each(function (i) {
                                    window.console.group(this);
                                    window.console[method](this);
                                    window.console.groupEnd();
                                });
                                window.console.groupEnd();
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "assert":
                        // group the jQuery object and call assert on each item
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                if (arguments.length) {
                                    window.console[method].apply(window.console, arguments);
                                }
                                window.console.group(this);
                                this.each(function (i) {
                                    window.console[method](false, this);
                                });
                                window.console.groupEnd();
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "time":
                    case "timeEnd":
                    case "group":
                    case "groupEnd":
                        // apply these commands directly (add jQuery object as arg0), return the jQuery object
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                var args = (arguments.length? arguments : [this]);
                                window.console[method].apply(window.console, args);
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "trace":
                        // apply these commands directly, returning the jQuery object
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                window.console.group("Trace: ", this);
                                window.console[method].apply(window.console, arguments);
                                window.console.groupEnd();
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "profile":
                        // apply these commands directly, returning the jQuery object
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                window.console.debug(this);
                                window.console[method].apply(window.console, arguments);
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    case "count":
                    case "profileEnd":
                        // apply these commands directly, returning the jQuery object
                        $.fn[settings.methods[method]] = function (method) {
                            return function () {
                                window.console[method].apply(window.console, arguments);
                                return this;
                            };
                        }(settings.methods[method]);
                        break;
                    default:
                        break;
                    }
                }
            }
        }
    };

    // create basic console object if it doesn't exist
    if (!window.console) {
        window.console = {};
    }
    
    $.firebug.mountFirebug(bootstrap);
    $.firebug.mountFirebugLite(bootstrap);
})(jQuery);
