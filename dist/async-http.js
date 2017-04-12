/**
 * async-http.js - Simplify async http request using only dom attributes
 * @version v0.0.19
 * @link https://github.com/raphaelcarlosr/async-http.js
 * @license ISC
 * @author Raphael Carlos Rego <raphaelcarlosr@gmail.com>
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    }
    else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = function (root, jQuery) {
            if (jQuery === undefined) {
                // require('jQuery') returns a factory that requires window to
                // build a jQuery instance, we normalize how we use modules
                // that require this pattern but the window provided is a noop
                // if it's defined (how jquery works)
                if (typeof window !== 'undefined') {
                    jQuery = require('jquery');
                }
                else {
                    jQuery = require('jquery')(root);
                }
            }
            factory(jQuery);
            return jQuery;
        };
    }
    else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
    "use strict";
    /**
     * jQuery get attr by starting name
     * @global
     * @method attrStartWith     
     * @param {string} begins Attr begin name
     * @return {Array} Joined array
     * @see http://stackoverflow.com/questions/36971998/can-i-get-all-attributes-that-begin-with-on-using-jquery
     * @tutorial qunit
     */
    $.fn.attrStartWith = function (begins) {
        return [].slice.call(this.get(0).attributes).filter(function (attr) {
            return attr && attr.name && attr.name.indexOf(begins) === 0;
        });
    };

    /**
     * Return unique itens of array
     * @global
     * @augments Array.prototype
     * @method mergeUnique
     * @param {Array} secondOf
     * @return {Array}
     * @see http://stackoverflow.com/questions/22208966/merging-of-two-arrays-store-unique-elements-and-sorting-in-jquery
     */
    Array.prototype.mergeUnique = function (secondOf) {
        var newArray = this.concat(secondOf).sort(function (a, b) {
            return a > b ? 1 : a < b ? -1 : 0;
        });

        return newArray.filter(function (item, index) {
            return newArray.indexOf(item) === index;
        });
    };

    /**
     * Set first letter to lower case
     * @global
     * @method toLowerFirstLetter
     * @augments {String.prototype}
     * @return {string} Inverted case
     */
    String.prototype.toLowerFirstLetter = function () {
        return this.charAt(0).toLowerCase() + this.slice(1);
    };

    /**
    * The async name space
    * @class asyncHttp
    * @classdesc Abstract class representing async request controler
    */
    var asyncHttp = window.asyncHttp = function () { };
    /**
     * The render method
     * @memberof asyncHttp
     * @static 
     * @enum {number} RENDER_METHOD         
     */
    asyncHttp.RENDER_METHOD = {
        /**
         * Prepend
         */
        prepend: 0,
        /**
         * Replace
         */
        replace: 1,
        /**
         * Append
         */
        append: 2
    };

    /**
    * Detects if has an async request in curse
    * @memberof asyncHttp
    * @method hasAsyncRequest     
    * @return {bool} True if any request is in curse
    */
    asyncHttp.hasAsyncRequest = function () {
        return _private.currentRequest !== null;
    };

    /**
     * Cancel current request
     * @memberof asyncHttp
     * @method cancelCurrentRequest
     * @return {void}
     */
    asyncHttp.cancelCurrentRequest = function () {
        if (this.hasAsyncRequest() === false) return void (0);
        _private.currentRequest.cancel();
    };

    /**
     * Toggle poll state (paused or not)
     * @memberof asyncHttp
     * @method togglePollState
     * @param context {jQuery} The jquery element
     * @return {void}
     */
    asyncHttp.togglePollState = function (context) {
        context = context instanceof jQuery ? context : $(context);
        var paused = context.data('async-poll-paused') || false;
        //invert value
        paused = !paused;
        //save
        context.data('async-poll-paused', paused);
        /**
         * Trigger when poll pause state has changed
         * @memberof asyncHttp.request
         * @event async:poll-pause
         * @param {event}
         * @example
         * <div async-autoload="/url" id="example"></div>
         * <script>
         * $('#example').on('async:poll-pause', function(isPaused){ });
         * </script>
         */
        context.trigger('async:poll-pause', [paused]);
    };

    /**
     * Get the absolute app url and concatenate with path
     * @memberof asyncHttp
     * @method getAbsoluteUrl
     * @param path {string} The path to concatenate
     */
    asyncHttp.getAbsoluteUrl = (function () {
        var a;
        return function (path) {
            if (!a) { a = document.createElement('a'); }
            a.href = path;
            return a.href;
        };
    })();

    /**
     * Default async options
     * @memberof asyncHttp
     * @class defaults {object}
     * @example
     * asyncHttp.defaults.processIndicator = '.default-load-mask:first';
     * asyncHttp.defaults.renderMethod = asyncHttp.RENDER_METHOD.append;
     */
    asyncHttp.defaults = {
        /**
       * Default async text options
       * @memberof defaults
       * @class texts {object}
       * @example
       * asyncHttp.defaults.texts.ConfirmExit = 'Hay una solicitud en curso, realmente quiere dejar?';
       */
        "texts": {
            "ConfirmExit": "A request is in progress, do you really want to exit and cancel the current process?"
        },
        /**
         * Selector for default process indicator
         * @memberof asyncHttp.defaults
         * @property processIndicator {string} The process indicator selector
         * @default [data-]async-process-indicator
         */
        "processIndicator": undefined,
        /**
         * Replace target if true
         * @memberof asyncHttp.defaults
         * @property renderMethod {asyncHttp.RENDER_METHOD}
         * @type asyncHttp.RENDER_METHOD
         * @default asyncHttp.RENDER_METHOD.replace
         */
        "renderMethod": asyncHttp.RENDER_METHOD.replace,
        /**
         * The on target when done
         * @memberof asyncHttp.defaults
         * @property actionDone {string} The action done sentence
         * @default [data-]async-action-done
         */
        "actionDone": undefined,
        /**
         * The on target selector target
         * @memberof asyncHttp.defaults
         * @property actionTarget {string} The action done selector
         * @default [data-]async-action-target
         */
        "actionTarget": undefined,
        /**
         * The poll repets time
         * @memberof asyncHttp.defaults
         * @property pollRepeats {number} The number of max repeats
         * @default [data-]async-poll-repeats
         */
        "pollRepeats": undefined,
        /**
         * Default json request processor 
         * @memberof asyncHttp.defaults
         * @method jsonHandler
         * @return {void}
         * @default $.noop
         */
        "jsonHandler": $.noop,

        /**
         * The confirm handler
         * @memberof asyncHttp.defaults
         * @method confirmHandler The confirm handler
         * @return {Promise}
         * @default confirm('async-[data-confirm="Confirm this action"]')
         * @example <form action="/delete" method="delete" async async-confirm="Confirm this action?"></form>
         */
        "confirmHandler": function (params) {
            var promise = $.Deferred();
            return promise.resolve(confirm(params)).promise();

            // swal(params, function (isConfirmed) {
            //     promise.resolve(isConfirmed);
            // });
            // swal({
            //     title: "Are you sure?",
            //     text: "You will not be able to recover this imaginary file!",
            //     type: "warning",
            //     showCancelButton: true,
            //     confirmButtonColor: "#DD6B55",
            //     confirmButtonText: "Yes, delete it!",
            //     cancelButtonText: "No, cancel plx!",
            //     closeOnConfirm: false,
            //     closeOnCancel: false
            // }, function (isConfirmed) {
            //     debugger;
            //     promise.resolve(isConfirmed);
            // });
            // return promise.promise();
        }
    };

    /**
     * The private helper class
     * @name _private
     * @private
     */
    var _private = {
        /**
         * @property queue {Array} 
         * The queue for requests
         */
        queue: [],
        /**
         * True if queue is running
         * @property queueRunning {bool}
         */
        queueRunning: false,
        /**
         * Run the requests queue
         * @memberof _private
         * @method runQueue
         * @return {void}
         */
        runQueue: function () {
            try {
                if (_private.queueRunning) return void (0);
                _private.queueRunning = true;

                //set current request on scope
                _private.currentRequest = _private.queue.shift();

                if (!_private.currentRequest) {
                    _private.queueRunning = false;
                    _private.currentRequest = null;
                    return void (0);
                }

                _private.currentRequest.request().done(function () {
                    _private.queueRunning = false;
                    _private.currentRequest = null;
                    _private.runQueue();
                });

            } catch (e) {
                console.error('AsyncHttp. runQueue error', e);
            }
        },
        /**
         * The current request
         * @property currentRequest {AsyncHttp}
         */
        currentRequest: null,
        /**
         * Return a merge of node process indicator and default process indicator
         * @memberof _private
         * @method getProcessIndicators
         * @param {string} selector The indicator select
         * @return {jQuery} The process indicators
         */
        getProcessIndicators: function (element, selector) {
            //default indicator
            var indicator = asyncHttp.defaults.processIndicator !== undefined ?
                $(asyncHttp.defaults.processIndicator)
                : null;

            //get from indicator by class in element
            selector = selector || '.async-indicator:first';

            if (indicator !== null) indicator.add($(selector, element)); //merge
            else indicator = $(selector, element);  //from element

            if (indicator.length === 0) indicator = $('.async-indicator:first');

            return indicator.show();
        },
        /**
         * Process all autoload objects in context
         * @memberof _private
         * @method processAutoLoads
         * @param {jQuery} context The jQuery element context
         */
        processAutoLoads: function (context) {
            var autoloads = [];
            $('[data-async-autoload], [async-autoload]', context).each(function (i, autoload) {
                autoloads.push(new AsyncHttp(autoload));
            });
            $.when.apply($, autoloads);/*.then(function () {
                // code here when all ajax calls are done
                // you could also process all the results here if you want
                // rather than processing them individually
                debugger;
            });*/
        },
        /**
         * Parse actions
         * @memberof _private
         * @method parseAction
         * @param {jQuery|HTMLElement} context 
         * @param {string} action The action attr value
         */
        parseAction: function (context, action) {
            var actions = action.split(';');

            for (var a = 0, al = actions.length; a < al; a++) {
                action = actions[a];
                var method = action, arg = [], args = null;
                if (action.indexOf(':') >= 0) {
                    method = action.substr(0, action.indexOf(":"));
                    arg = $.trim(action.substr(action.indexOf(":") + 1, action.length));
                    try {
                        window["eval"].call(window, "args = [" + arg + "]");
                    } catch (e) {
                        args = [arg];
                    }
                }

                try {
                    // $.fn[method].apply(context, params);
                    (context[method] || window[method]).apply(context, args);
                } catch (e) {
                    console.error('AsyncHttp. Invalid action exceuction from method: %s, with params %o', method, params);
                }
            }
        },
        /**
         * Default jquery xhr constructor
         * @property defaultXhr {$.ajaxSettings.xhr}
         */
        defaultXhr: $.ajaxSettings.xhr,
        /**
         * Insert rule on default style sheet
         * @property styleSheet
         * @example asyncHttp.styleSheet.insertRule("header { float: left; opacity: 0.8; }", 1);
        */
        styleSheet: (function () {
            // Create the <style> tag
            var style = document.createElement('style');

            // Add a media (and/or media query) here if you'd like!
            // style.setAttribute('media', 'screen')
            // style.setAttribute('media', 'only screen and (max-width : 1024px)')

            // WebKit hack :(
            style.appendChild(document.createTextNode(''));

            // Add the <style> element to the page
            document.head.appendChild(style);

            //add Async styles rules
            style.sheet.insertRule('.async-indicator{display:none;}', 0);

            return style.sheet;
        })(),
        /**
         * Parse option by name
         * @memberof _private
         * @method parseAction
         * @param {string} name The config name
         * @param {string} value The config value
         * @return {object} Parsed value object
         */
        parseOption: function (name, value, element) {
            element = element||document;
            switch (name) {
                case 'renderMethod':
                    value = asyncHttp.RENDER_METHOD[value];
                    break;
                case 'processIndicator':
                    value = _private.getProcessIndicators(element, value);
                    break;
                case 'target':
                    value = $(value);
                    if (value.length === 0) value = element;
                    break;
                case 'poll':
                    if (isNaN(value) === false) {
                        value = parseInt(value) * 1000;
                    }
                    else if (value.lastIndexOf("ms") == value.length - 2) {
                        value = parseFloat(value.substr(0, value.length - 2));
                    } else if (value.lastIndexOf("s") == value.length - 1) {
                        value = parseFloat(value.substr(0, value.length - 1)) * 1000;
                    } else {
                        value = 1000;
                    }
                    break;
                case 'pollRepeats':
                    value = parseInt(value);
                    break;
            }
            return value;
        }
    };

    // process default values by metatags
    $('meta[name^="async:"]').each(function (index, meta) {
        meta = $(meta);
        var name = meta.attr('name').replace(/async\:/gi, '').replace(/\:/gi, '.'),
            value = meta.attr('content');

        if (name.indexOf('.') >= 0) {
            var names = name.split('.'),
                lastName = null;

            for (var i = 0, l = names.length; i < l; i++) {
                var item = names[i],
                    config = null;

                if (lastName) {
                    asyncHttp.defaults[lastName][item] = value;
                }

                if (item in asyncHttp.defaults && $.isPlainObject(asyncHttp.defaults[item])) {
                    lastName = item;
                } else {
                    lastName = null;
                }
            }
        } else if (name in asyncHttp.defaults) {
            value = _private.parseOption(name, value);
            asyncHttp.defaults[name] = value;
        }
    });

    /**
     * Parse options from element
     * @class Options {object} The options (parsed by attr and defaults) object
     * @constructor
     * @param {jQuery|HTMLElement} element
     * @param {object} options The request options
     * @private
     */
    var Options = function (element, options) {
        var attrOptions = (function () {
            var attrs = element.attrStartWith('async-');
            attrs = attrs.mergeUnique(element.attrStartWith('data-async-'));

            var returnvValue = {};
            for (var i = 0, l = attrs.length; i < l; i++) {
                var attr = attrs[i],
                    name = attr.name.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); }),
                    value = attr.value;

                if (/^async/.test(name)) {
                    name = name.replace(/async/, '').toLowerFirstLetter();
                    // name = name.replace(/\w\S*/g, function (txt) {
                    //     return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    // });
                }

                //converts
                value = _private.parseOption(name, value, element);
                //set                
                returnvValue[name] = value;
            }
            return returnvValue;
        })();

        //check if processIndicator is setted
        if (attrOptions.processIndicator === undefined) {
            //defaults
            attrOptions.processIndicator = _private.getProcessIndicators(element);
        }

        //detect if is autoload
        attrOptions.isAutoLoad = attrOptions.autoload !== undefined;

        //always set target
        if (attrOptions.target === undefined) attrOptions.target = element;

        //if form, set request type by method
        if (element.is('form')) {
            //set request type
            attrOptions.type = element.attr('method');
            //
            var _method = element.find(':hidden[name="_method"]');
            if (_method.length === 0) {
                _method = $('<input type="hidden" name="_method"/>');
                element.prepend(_method);
            }
            _method.val(attrOptions.type.toLowerCase());

            //send form data
            attrOptions.data = element.serialize();
        }

        //extend from defaults
        attrOptions = $.extend({}, asyncHttp.defaults, attrOptions, options);

        //default ajaxSettings overwrite options
        var defaultAjaxSettings = $.extend({}, $.ajaxSettings, {
            'context': element,
            'url': element.attr('href') || element.attr('action') || attrOptions.autoload,
            'xhr': function () {
                var xhr = _private.defaultXhr();
                if (xhr instanceof window.XMLHttpRequest) {
                    xhr.addEventListener('progress', this.progress, false);
                }
                if (xhr.upload) {
                    xhr.upload.addEventListener('progress', this.progress, false);
                }
                return xhr;
            },
            /**
             * Trigger when process request is computed (upload)
             * @memberof asyncHttp.request
             * @event async:onprogress
             * @param {event} e The event args (lengthComputable and total)
             * @example
             * <div async-autoload="/url" id="example"></div>
             * <script>
             * $('#example').on('async:onprogress', function(total){ });
             * </script>
             */
            'progress': function (e) {
                if (e.lengthComputable) {
                    var percent = (e.loaded / e.total) * 100;
                    element.trigger('async:onprogress', [percent.toPrecision(3)]);
                }
            },
            'xhrFields': {
                onprogress: function (e) {
                    var settings = this.settings;
                    if (e.lengthComputable) {
                        var percent = (e.loaded / e.total * 100);
                        element.trigger('async:onprogress', [percent]);
                    }
                }
            },
            /**
             * Trigger before send request
             * @memberof asyncHttp.request
             * @event async:beforeSend
             * @example
             * <div async-autoload="/url" id="example"></div>
             * <script>
             * $('#example').on('async:beforeSend', function(xhr, settings){ });
             * </script>
             */
            'beforeSend': function (xhr, settings) {
                // console.log('async-http beforeSend');
                $(this).trigger('async:beforeSend', [xhr, settings]);
                this.settings = settings;
                //xhr.overrideMimeType( 'text/plain; charset=x-user-defined' );                    
            },
            /**
             * Trigger on request error
             * @memberof asyncHttp.request
             * @event async:error
             * @example
             * <div async-autoload="/url" id="example"></div>
             * <script>
             * $('#example').on('async:error', function(xhr, textStatus, errorThrown){ });
             * </script>
             */
            'error': function (xhr, textStatus, errorThrown) {
                // console.log('async-http error');                    
                //trigger
                $(this).trigger('async:error', [xhr, textStatus, errorThrown]);
            },
            /**
             * Trigger on request sucesss
             * @memberof asyncHttp.request
             * @event async:success
             * @example
             * <div async-autoload="/url" id="example"></div>
             * <script>
             * $('#example').on('async:success', function(data, xhr, textStatus){ });
             * </script>
             */
            'success': function (data, textStatus, xhr) {
                // console.log('async-http success');
                $(this).trigger('async:success', [data, xhr, textStatus]);
            },
            /**
             * Trigger on request complete
             * @memberof asyncHttp.request
             * @event async:complete
             * @example
             * <div async-autoload="/url" id="example"></div>
             * <script>
             * $('#example').on('async:complete', function(xhr, textStatus){ });
             * </script>
             */
            'complete': function (xhr, textStatus) {
                var context = $(this);

                //trigger event
                context.trigger('async:complete', [xhr, textStatus]);

                //send request to google analytics
                if ((typeof ga !== "undefined")) {
                    ga('send', 'pageview', {
                        'location': this.settings.url,
                        'hitCallback': function () {
                            /**
                             * Trigger when google analytics(if exists) send is done
                             * @memberof asyncHttp.request
                             * @event async:ga-done
                             * @example
                             * <div async-autoload="/url" id="example"></div>
                             * <script>
                             * $('#example').on('async:ga-done', function(asyncHttpRequestInstance){ });
                             * </script>
                             */
                            context.trigger('async:ga-done', [context]);
                            //close console group
                            console.groupEnd();

                            //check events
                            if ("gaEventAction" in attrOptions) {
                                ga('send', 'event', {
                                    eventCategory: attrOptions.gaEventCategory || "UnCategorized",
                                    eventAction: attrOptions.gaEventAction || 'click',
                                    eventLabel: attrOptions.gaEventLabel || context.is('a') ? $.trim(context.text()) : 'Not seted'
                                });
                            }
                        }
                    });
                } else {
                    console.groupEnd();
                }

                //continuos queue run;
                _private.runQueue();
            }
        });
        return $.extend({}, defaultAjaxSettings, attrOptions);
    };

    /**
     * Create an async http and return handler, but do not worry, you do not need this
     * @memberof asyncHttp
     * @class request
     * @param {jQuery} context The dom object context
     * @param {asyncHttp.defaults} options The configuration options
     * @example
     * var promise = new AsyncHttp('#selector-of-element', {
     *  //Overwrite here config assumed from attributes 
     * });
     */
    var AsyncHttp = asyncHttp.request = function (context, options) {
        //create an empty context
        if (context === undefined || context === null) { context = $(); }
        else if ($.isPlainObject(context) && $.isEmptyObject(context) && context.url !== undefined) {
            //assume context as options
            options = context;
            //empty context 
            context = $();
        }
        context = context instanceof jQuery ? context : $(context);
        var me = this;

        //parse options
        var config = this.config = new Options(context, options || {});

        //log with group
        console.group('New async request for %o', config);

        //validetions
        if (config.isAutoLoad === false && (context.is('a') || context.is('form')) === false)
            throw new Error('The async request can\'t be created, the context is not valid.');

        //trigger event
        /**
         * Trigger request instance has created
         * @memberof asyncHttp.request
         * @event async:start
         * @example
         * <div async-autoload="/url" id="example"></div>
         * <script>
         * $('#example').on('async:start', function(config){ });
         * </script>
         */
        context.trigger('async:start', [config]);

        //render text lookin for config renderMethod
        var render = function (node) {
            var target = config.target;

            switch (config.renderMethod) {
                case asyncHttp.RENDER_METHOD.append:
                    target.append(node);
                    break;
                case asyncHttp.RENDER_METHOD.replace:
                    target.html(node);
                    break;
                case asyncHttp.RENDER_METHOD.prepend:
                    target.prepend(node);
                    break;
                default:
                    new Error('Undefined render method');
                    break;
            }
        };


        var returnValue = $.Deferred();

        var promise = {
            done: function (responseText, textStatus) {
                //render new content
                render(responseText);
                //set actions
                if (config.actionDone !== undefined) _private.parseAction($(config.actionTarget || config.target), config.actionDone);
                //reprocess new content autoloads
                _private.processAutoLoads(config.target);
                /**
                 * Trigger when request done
                 * @memberof asyncHttp.request
                 * @event async:done
                 * @example
                 * <div async-autoload="/url" id="example"></div>
                 * <script>
                 * $('#example').on('async:done', function(asyncHttpRequestInstance){ });
                 * </script>
                 */
                context.trigger('async:done', [me]);
                //resolve return value
                returnValue.resolve(responseText, textStatus, me);
            },
            fail: function (xhr, textStatus, errorThrown) {
                //render error
                render(xhr.responseText);
                /**
                 * Trigger when request is fail
                 * @memberof asyncHttp.request
                 * @event async:fail
                 * @example
                 * <div async-autoload="/url" id="example"></div>
                 * <script>
                 * $('#example').on('async:fail', function(asyncHttpRequestInstance){ });
                 * </script>
                 */
                context.trigger('async:fail', [me]);
                //resolve return value
                returnValue.fail(xhr, textStatus, errorThrown, me);
            },
            always: function () {
                //remove or hide current indicator
                if (config.processIndicator.parent().length > 0) {
                    //process indicator exists
                    config.processIndicator.fadeOut();
                }
                /**
                 * Trigger when promisse always
                 * @memberof asyncHttp.request
                 * @event async:always
                 * @example
                 * <div async-autoload="/url" id="example"></div>
                 * <script>
                 * $('#example').on('async:always', function(asyncHttpRequestInstance){ });
                 * </script>
                 */
                context.trigger('async:always', [me]);
                //resolve return value
                returnValue.always(me);
            }
        };

        //show confirmation
        if (config.confirm !== undefined) {
            //parse confirm params
            var params = /^(\{|\[)/.test(config.confirm) ?
                JSON.parse(config.confirm) :
                config.confirm;

            var args = $.isArray(params) ? params : [params];

            $.when(asyncHttp.defaults.confirmHandler.apply(this, args))
                .done(function (confirmed) {
                    /**
                     * Trigger confirm or not is selected
                     * @memberof asyncHttp.request
                     * @event async:confirm
                     * @example
                     * <div async-autoload="/url" id="example"></div>
                     * <script>
                     * $('#example').on('async:confirm', function(confirmed){ });
                     * </script>
                     */
                    config.target.trigger('async:confirm', [confirmed]);

                    if (confirmed) {
                        //make a request        
                        me.request = function () {
                            return $.ajax(config)
                                .done(promise.done)
                                .fail(promise.fail)
                                .always(promise.always);
                        };
                    } else {
                        me.request = function () {
                            return $.Deferred()
                                .done(promise.done)
                                .fail(promise.fail)
                                .always(promise.always)
                                .resolve(undefined);
                        };
                    }
                    //run
                    _private.queue.push(me);
                    _private.runQueue();
                });

        } else {
            //make a request        
            this.request = function () {
                return $.ajax(config)
                    .done(promise.done)
                    .fail(promise.fail)
                    .always(promise.always);
            };
            //run
            _private.queue.push(me);
            _private.runQueue();
        }

        /**
         * Cancel the request
         * @memberof asyncHttp.request
         * @method cancel
         * @return {void}
         */
        AsyncHttp.prototype.cancel = function () {
            request.abort();
            this.config.target.trigger('async:aborted');
        };

        //if is poll
        if (config.poll !== undefined) {
            context.data('async-poll-interval', setTimeout(function pollInterval() {
                var interval = context.data('async-interval');
                var executions = context.data('async-poll-executions') || 0;
                var paused = context.data('async-poll-paused') === true;
                try {
                    if (paused) {
                        context.data('async-poll-interval', setTimeout(pollInterval, config.poll));
                    } else if (config.pollRepeats !== undefined && executions == config.pollRepeats) {
                        clearTimeout(interval);
                        context.data('async-poll', undefined);
                    } else {
                        //increment executions
                        context.data('async-poll-executions', executions + 1);
                        //make a new request
                        new AsyncHttp(context);
                    }
                } catch (error) {
                    throw error;
                } finally {
                    /**
                     * Trigger when poll request run
                     * @memberof asyncHttp.request
                     * @event async:poll
                     * @example
                     * <div async-autoload="/url" id="example"></div>
                     * <script>
                     * $('#example').on('async:poll', function(totalExecutions, pausedState){ });
                     * </script>
                     */
                    context.trigger('async:poll', [executions, paused]);
                }

            }, config.poll));
        }

        return returnValue.promise();
    };

    /**
     * Navigator is online events
     * @memberof asyncHttp
     * @property isOnLine {bool} 
     */
    asyncHttp.isOnLine = navigator.onLine || undefined;
    $([window, document]).on('online offline', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'online') {
            // console.log('working online');
            asyncHttp.isOnLine = true;
        } else {
            // console.log('working off line');
            asyncHttp.isOnLine = false;
        }
    });

    /** 
     * Prevent all link disabled click
     * @event
     * @private 
     */
    $(document).on('click', 'a[disabled], a.disabled', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    /**
     * Enable async request to "a" element
     * @event
     * @private
     */
    $(document).on('click', 'a[async]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var me = $(this);
        if (me.is(':disabled') || me.hasClass('disabled') || me.parents('.disabled, [disabled]').length > 0) { return void (0); }
        var request = new AsyncHttp(me);
    });

    /**
     * Enable async request to "form" element
     * @event
     * @private
     */
    $(document).on('submit', 'form[async]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var me = $(this),
            buttons = $(':submit, :reset', me),
            hasBootstapButton = $.fn && $.fn.button;

        if (hasBootstapButton) {
            buttons.button('loading');
        }

        new AsyncHttp(me).done(function () {
            if (hasBootstapButton) {
                buttons.button('reset');
            }

            /**
           * Trigger when submit form done
           * @memberof asyncHttp.request
           * @event async:submit-done
           * @param {event}
           * @example
           * <form action="/url" method="post" async></div>
           * <script>
           * $('#example').on('async:submit-done', function(){ });
           * </script>
           */
            me.trigger('async:submit-done');
        });
    });

    /**
     * Process all autoloads from body
     * @event
     * @private
     */
    $(document).ready(function () {
        _private.processAutoLoads(document.body);
    });

    /**
     * Confirm if has request running when user get out of page
     * @event window.beforeunload
     * @private
     */
    $(window).on('beforeunload', function (e) {
        if (asyncHttp.hasAsyncRequest()) {
            return asyncHttp.defaults.texts.ConfirmExit;
        }
    });

    //  /**
    //  * @event
    //  * Configure default ajax settings
    //  */
    // $(document)
    //     .ajaxStart(function (e) {
    //         // console.log('async-ajaxStart', this, arguments);
    //         //TODO asyncHttp.hasAsyncRequest = true;
    //         //TODO if (processIndicator) processIndicator.show();
    //     })
    //     .ajaxComplete(function (event, xhr, settings) {
    //         // console.log('async-ajaxComplete', this, arguments);
    //         //TODO asyncHttp.hasAsyncRequest = false;
    //         setTimeout(function () {
    //             //TODO if (processIndicator) processIndicator.hide();
    //         }, 500);
    //     });

    /**
     * Overwrite default jquery load method
     * @private
     */
    /**
     * Overwrite default jquery load method
     * @namespace Prototype 
     * @memberof {$.fn}
     * @method load
     * @see http://api.jquery.com/load/     
     * @example
     * $(document).ready(function () {
     *     //jquery load
     *     $('#jqueryLoad').load('/autoload', null, function () {
     *          console.info('jQuery load done', arguments);
     *     });
     * });
     */
    $.fn.__load = $.fn.load;
    $.fn.load = function (url, data, callback) {
        var $this = $(this);
        $this.attr('async-autoload', url);

        new AsyncHttp($this).done(function (response) {
            //callback
            (callback || $.noop)(response);
            /**
             * Trigger when jQuery load done
             * @memberof asyncHttp.request
             * @event async:load-done
             * @param {event}
             * @example
             * $(document).ready(function () {
             *     //jquery load
             *     $('#jqueryLoad').load('/autoload', null, function () {
             *     console.info('jQuery load done', arguments);
             *     });
             * });
             */
            $this.trigger('async:load-done', [response]);
        });
    };

}));