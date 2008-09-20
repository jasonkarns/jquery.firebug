/*global jQuery, DEBUG */

/*
 * TODO: support count, trace, profile, and profileEnd for Firebug Lite
 * TODO: integrate firebug.watchXHR better
 */
/*** this block must never be used in an embedded script ***/
// determine DEBUG setting from this script tag
eval(document.getElementsByTagName("script")[document.getElementsByTagName("script").length-1].innerHTML);
if (window.DEBUG === undefined) {
    var DEBUG = true;
}
/***********************************************************/

(function ($) {
    var methods = ["assert",
                "log", "debug", "info", "warn", "error", "dir", "dirxml",
                "count", "trace", "group", "groupEnd", "time", "timeEnd", "profile", "profileEnd"];

    // create basic console object if it doesn't exist
    if (!window.console) {
        window.console = {};
    }

    // if there's no window console or firebug console, import Firebug Lite
    if (!console.firebug && DEBUG) {
        $(document).ready(function(){
            var firebug = document.createElement('script');
            firebug.setAttribute('src', 'http://getfirebug.com/releases/lite/1.2/firebug-lite-compressed.js');
            document.body.appendChild(firebug);
            (function(){
                if (window.pi && window.firebug) {
                    // Firebug Lite has been imported
                    window.firebug.init();
	                // add watchXHR support
                    var _ajax = $.ajax;
                    $.ajax = function (_ajax) {
                        return (function (options){
                            var xhr = _ajax(options);
                            if (options && options.watch) {
                                window.firebug.watchXHR(xhr);
                            }
                            return xhr;
                        });
                    }(_ajax);
                    // re-map console commands to Firebug Lite commands
                    var groupStack = [];
                    var timerStack = [];
                    for (var method in methods) {
                        switch (methods[method]) {
                            // map debug,info,warn,error to log()
                            case "debug":
                            case "info":
                            case "warn":
                            case "error":
                                console[methods[method]] = console.log;
                                break;
                            // map dirxml to dir()
                            case "dirxml":
                                console.dirxml = console.dir;
                                break;
                            // use log() to form a sort of group
                            case "group":
                                console.group = function(){
                                    // replace the jQuery object as first argument because its useless when printed in FirebugLite
                                    arguments[0] = "Group Start: ";
                                    groupStack.push(arguments);
                                    console.log.apply(console, arguments);
                                };
                                break;
                            // use log() to form a sort of group
                            case "groupEnd":
                                console.groupEnd = function(){
                                    var args = groupStack.pop()
                                    args[0] = "Group End: ";
                                    console.log.apply(console, args);
                                };
                                break;
                            // start a timer
                            case "time":
                                console.time = function(){
                                    timerStack[arguments[0]] = [];
                                    timerStack[arguments[0]].push((new Date()).getTime());
                                };
                                break;
                            // use log() to display timer results
                            case "timeEnd":
                                console.timeEnd = function(){
                                    if (!timerStack[arguments[0]]) {
                                        return console.error("Timer '" + arguments[0] + "' has not been started.");
                                    }
                                    var sec = ((new Date()).getTime() - timerStack[arguments[0]].pop()) / 1000;
                                    console.log("Timer '" + arguments[0] + "': " + sec + " seconds.");
                                };
                                break;
                            // use log() for assert
                            case "assert":
                                console.assert = function(){
                                    // drop the 'false' argument
                                    var args = $.makeArray(arguments);
                                    args.shift();
                                    console.log.apply(console, args);
                                };
                                break;
                            // count,trace,profile,profileEnd are unsupported
                            case "count":
                            case "trace":
                            case "profile":
                            case "profileEnd":
                                console[methods[method]] = function(method){
                                    return function(){
                                        console.log("Firebug Lite does not support method: " + method);
                                    };
                                }(methods[method]);
                                break;
                            // log,dir built-in with Firebug Lite
                            case "log":
                            case "dir":
                            default:
                                break;
                        }
                    }
                }
                else {
                    setTimeout(arguments.callee);
                }
            })();
            void (firebug);
        });
    }

    // foreach Firebug method, create an associated jQuery function
    for (var method in methods) {
        // set a blank function foreach console method to avoid 'function undefined' errors
        if (!window.console[methods[method]]) {
            window.console[methods[method]] = function(){};
        }
        if (methods.hasOwnProperty(method)) {
            switch (methods[method]) {
            case "log":
            case "debug":
            case "info":
            case "warn":
            case "error":
            case "dir":
            case "dirxml":
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        var self = this;
                        // add jQuery object as arg0
                        var args = [this].concat($.makeArray(arguments));
                        // parse out jQuery '.method' commands to call on jQuery object
                        $.each(args,function(key, value){
                            if (value.match && (found = value.match(/^\.(.)*/))) {
                                var method = found[0].substr(1);
                                if ($(self)[method]) {
                                    args[key] = $(self)[method].apply($(self));
                                }
                            }
                        });
                        // group this jQuery object, calling the method on each item
                        console.group.apply(console, args);
                        this.each(function (i) {
                            console[method](this);
                        });
                        console.groupEnd();
                        return this;
                    });
                }(methods[method]);
                break;
            case "assert":
                // group the jQuery object and call assert on each item
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        if (!arguments[0]) {
                            // add jQuery object as arg0 and replace 'expression' with a description
                            var args = [this].concat($.makeArray(arguments));
                            args[1] = "Assertion Failed: ";
                            console.group.apply(console, args);
                            this.each(function (i) {
                                console.assert(false, this);
                            });
                            console.groupEnd();
                        }
                        return this;
                    });
                }(methods[method]);
                break;
            case "group":
            case "groupEnd":
                // apply these commands directly (add jQuery object as arg0), return the jQuery object
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        console[method].apply(console, [this].concat($.makeArray(arguments)));
                        return this;
                    });
                }(methods[method]);
                break;
            case "count":
            case "trace":
            case "time":
            case "timeEnd":
            case "profile":
            case "profileEnd":
            default:
                // apply these commands directly, returning the jQuery object
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        console[method].apply(console, arguments);
                        return this;
                    });
                }(methods[method]);
                break;
            }
        }
    }
})(jQuery);
