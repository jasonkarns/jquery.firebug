/*global jQuery, DEBUG */
if (window.DEBUG === undefined) {
    var DEBUG = true;
}
(function ($) {
    var methods = ["assert",
                "log", "debug", "info", "warn", "error", "dir", "dirxml",
                "count", "trace", "group", "groupEnd", "time", "timeEnd", "profile", "profileEnd"];

    function firebug() {
        var debugIdStack = ["DBG_LOG"];
        var timerStack = [];

        $(document).ready(function () {
            $(document.body).append('<div id="DEBUG"><span id="DBG_BAR"><a id="DBG_CLOSE" title="close the debug log">Close</a><a id="DBG_CLEAR" title="clear the debug log">Clear</a></span><ol id="DBG_LOG"></ol></div>');
            $("#DEBUG").click(function (e) {
                $(e.target).toggleClass("open");
                $("ul, ol, dl", e.target).slideToggle("slow");
            });
            $("#DBG_CLOSE").click(function (e) {
                $("#DBG_LOG").slideToggle("slow");
                $(this).text($(this).text() === "Open" ? "Close" : "Open");
                return false;
            });
            $("#DBG_CLEAR").click(function (e) {
                $("#DBG_LOG").children().remove();
                return false;
            });

        });
        
        function getFunctionName(theFunction) {
            // mozilla makes it easy. I love mozilla.
            if (theFunction.name) {
                return theFunction.name;
            }
            // try to parse the function name from the defintion 
            var definition = theFunction.toString();
            var name = definition.substring(definition.indexOf('function') + 9, definition.indexOf('('));
            if (name) {
                return name;
            }
            // dynamic/anonymous functions 
            return "_anonymous";
        }
        
        function printArguments(args) {
            var msg = "";
            for (var arg = 0; arg < args.length; arg += 1) {
                // print DOM elements
                if (args[arg].nodeType && args[arg].nodeType === 1) {
                    msg += "&lt;" + args[arg].nodeName.toLowerCase();
                    if (args[arg].hasAttributes && args[arg].hasAttributes()) {
                        if (args[arg].getAttribute('id')) {
                            msg += ' id="' + args[arg].getAttribute('id') + '"';
                        }
                        if (args[arg].getAttribute('class')) {
                            msg += ' class="' + args[arg].getAttribute('class') + '"';
                        }
                        if (args[arg].getAttribute('title')) {
                            msg += ' title="' + args[arg].getAttribute('title') + '"';
                        }
                    }
                    msg += "&gt;";
                }
                // print functions
                else if (typeof args[arg] === 'function') {
                    var funcName = getFunctionName(args[arg]) || "function";
                    msg += funcName + "()";
                }
                // print booleans
                else if (typeof args[arg] === 'boolean') {
                    msg += args[arg] + " ";
                }
                // print numbers and strings
                else if (typeof args[arg] === 'number' || typeof args[arg] === 'string' || args[arg].constructor.toString().match(/string/i)) {
                    msg += args[arg] + " ";
                }
                // print source for arrays/objects
                else {
                    // use toSource() if available
                    if (args[arg].toSource) {
                        msg += args[arg].toSource();
                    }
                    // arrays
                    else if (args[arg].constructor.toString().match(/array/i)) {
                        msg += "[ " + args[arg].join() + " ] ";
                    }
                    else {
                        var tmp = [];
                        for (var p in args[arg]) {
                            tmp.push(" '" + p + "' : '" + args[arg][p] + "'");
                        }
                        if (tmp.length) {
                            msg += "{ " + tmp.join() + " } ";
                        }
                        else {
                            msg += "[ " + typeof args[arg] + " ] ";
                        }
                    }
                }
            }
            return "<code>" + msg + "</code> ";
        }
        
        function printDOM(DOM, space) {
            var msg = "";
            if (!DOM.nodeType) {
                return;
            }
            switch (DOM.nodeType) {
            case 1:// element
                msg += space + "&lt;" + DOM.nodeName;
                if (DOM.hasAttributes && DOM.hasAttributes()) {
                    if (DOM.getAttribute('id')) {
                        msg += ' id="' + DOM.getAttribute('id') + '"';
                    }
                    if (DOM.getAttribute('class')) {
                        msg += ' class="' + DOM.getAttribute('class') + '"';
                    }
                    if (DOM.getAttribute('title')) {
                        msg += ' title="' + DOM.getAttribute('title') + '"';
                    }
                }
                msg += "&gt;<br/>";
                for (var n = 0; n < DOM.childNodes.length; n += 1) {
                    msg += printDOM(DOM.childNodes[n], space + "&nbsp;&nbsp;&nbsp;&nbsp;");
                }
                msg += space + "&lt;/" + DOM.nodeName + "&gt;<br/>";
                break;
            case 2:// attribute
                // already taken care of (@id and @class only)
                break;
            case 3:// text
                if (/\S/.test(DOM.nodeValue)) {
                    msg += space + DOM.nodeValue + "<br/>";
                }
                break;
            case 4:// cdata section
                msg += space + "&lt;![CDATA[" + DOM.data + "]]&gt;<br/>";
                break;
            case 7:// processing instruction
                msg += space + "&lt;?" + DOM.target + DOM.data + "?&gt;<br/>";
                break;
            case 8:// comment
                msg += space + "&lt;!--" + DOM.data + "--&gt;<br/>";
                break;
            }
            return "<code>" + msg + "</code>";
        }
        
        function printObject(obj) {
            var msg = "";
            for (var p in obj) {
                msg += "<dt><code>" + p + "</code></dt><dd><code>" + obj[p] + "</code></dd>";
            }
            return "<dl>" + msg + "</dl>";
        }
        
        function stackTrace(nextCaller) {
            var msg = "";
            while (nextCaller) {
                msg += "<li><code>" + getFunctionName(nextCaller) + "(" + nextCaller.arguments.join() + ")" + "</code></li>";
                nextCaller = nextCaller.caller;
            }
            return "Stack Trace:<ol>" + msg + "</ol>";
        }

        // foreach Firebug method, create our own function for printing useful data
        // if debugging is disabled, create an empty function to avoid null function references
        for (var method in methods) {
            if (!window.console[methods[method]]) {
                if (DEBUG) {
                    window.console[methods[method]] = function (method) {
                        return (function () {
                            var msg = "";
                            switch (method) {
                            case "log":
                            case "debug":
                            case "info":
                            case "warn":
                            case "error":
                            case "assert":
                                msg = printArguments(arguments);
                                $('<li class="' + method + '">' + msg + '</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                break;
                            case "dir":
                                msg = printObject(arguments[0]);
                                $('<li class="' + method + '">' + msg + '</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                break;
                            case "dirxml":
                                msg = printDOM(arguments[0]);
                                $('<li class="' + method + '">' + msg + '</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                break;
                            case "trace":
                                msg = stackTrace(arguments.callee);
                                $('<li class="' + method + '">' + msg + '</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                break;
                            case "group":
                                msg = printArguments(arguments);
                                var li = $('<li class="' + method + '">' + msg + '</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                debugIdStack.push("dbg" + (new Date()).getTime());
                                $(li).append('<ol id="' + debugIdStack[debugIdStack.length - 1] + '"></ol>');
                                break;
                            case "groupEnd":
                                debugIdStack.pop();
                                break;
                            case "time":
                                timerStack[arguments[0]] = [];
                                timerStack[arguments[0]].push((new Date()).getTime());
                                break;
                            case "timeEnd":
                                var sec = ((new Date()).getTime() - timerStack[arguments[0]].pop()) / 1000;
                                $('<li class="' + method + '">Timer "' + arguments[0] + '": ' + sec + ' seconds.</li>').appendTo('#' + debugIdStack[debugIdStack.length - 1]);
                                break;
                            case "profile":
                            case "profileEnd":
                            case "count":
                                break;
                            default:
                                break;
                            }
                        });
                    }(methods[method]);
                }
                else {
                    window.console[methods[method]] = function () {};
                }
            }
        }
    }

    // if there's no window console or firebug console, create our own
    if (!window.console || !console.firebug) {
        if (!window.console) {
            window.console = {};
        }
        if (DEBUG) {
            firebug();
            // dynamically include Firebug Lite if possible, will override our custom functions
            $("head").append('<script type="text/javascript" src="firebuglite/firebug.js"></script>');
            $("#DEBUG").remove();
        }
    }

    // foreach Firebug method, create an associated jQuery function
    for (var method in methods) {
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
                        console.group.apply(console, arguments);
                        this.each(function (i) {
                            console[method](this);
                        });
                        console.groupEnd();
                        return this;
                    });
                }(methods[method]);
                break;
            case "count":
            case "trace":
            case "group":
            case "groupEnd":
            case "time":
            case "timeEnd":
            case "profile":
            case "profileEnd":
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        console[method].apply(console, arguments);
                        return this;
                    });
                }(methods[method]);
                break;
            case "assert":
                $.fn[methods[method]] = function (method) {
                    return (function () {
                        var expr = arguments[0];
                        if (!expr) {
                            var args = $.makeArray(arguments);
                            args.shift();
                            args.unshift("Assertion Failed: ");
                            console.group.apply(console, args);
                            this.each(function (i) {
                                console.assert(expr, this);
                            });
                            console.groupEnd();
                        }
                        return this;
                    });
                }(methods[method]);
                break;
            default:
                break;
            }
        }
    }
})(jQuery);
