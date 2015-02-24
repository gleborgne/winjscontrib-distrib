/* 
 * WinJS Contrib v2.0.1.0
 * licensed under MIT license (see http://opensource.org/licenses/MIT)
 * sources available at https://github.com/gleborgne/winjscontrib
 */

var WinJSContrib;
(function (WinJSContrib) {
    var UI;
    (function (UI) {
        var Pages;
        (function (Pages) {
            /**
             * List of mixins to apply to each fragment managed by WinJS Contrib (through navigator or by calling explicitely {@link WinJSContrib.UI.Pages.fragmentMixin}).
             * @field WinJSContrib.UI.Pages.defaultFragmentMixins
             * @type {Array}
             */
            Pages.defaultFragmentMixins = [{
                $: function (selector) {
                    return $(selector, this.element || this._element);
                },
                q: function (selector) {
                    return this.element.querySelector(selector);
                },
                qAll: function (selector) {
                    var res = this.element.querySelectorAll(selector);
                    if (res && !res.forEach) {
                        res.forEach = function (callback) {
                            for (var i = 0; i < res.length; i++) {
                                callback(res[i], i);
                            }
                        };
                    }
                },
                eventTracker: {
                    get: function () {
                        if (!this._eventTracker)
                            this._eventTracker = new WinJSContrib.UI.EventTracker();
                        return this._eventTracker;
                    }
                },
                promises: {
                    get: function () {
                        if (!this._promises)
                            this._promises = [];
                        return this._promises;
                    }
                },
                addPromise: function (prom) {
                    this.promises.push(prom);
                    return prom;
                },
                cancelPromises: function () {
                    var page = this;
                    if (page.promises) {
                        for (var i = 0; i < page.promises.length; i++) {
                            if (page.promises[i]) {
                                page.promises[i].cancel();
                            }
                        }
                    }
                }
            }];
            /**
             * substitute for WinJS.UI.Pages.define that injects custom WinJS Contrib behaviors
             * @function WinJSContrib.UI.Pages.define
             */
            function define(location, members) {
                var ctor = WinJS.UI.Pages.define(location, members);
                WinJSContrib.UI.Pages.fragmentMixin(ctor);
                return ctor;
            }
            Pages.define = define;
            /**
             * Inject WinJSContrib fragment enhancements, such as "$","q", "qAll" functions for scoped selectors, eventTracker and promises properties
             * This enhancement also allows you to add behavior on each WinJS fragment by adding them to {@link WinJSContrib.UI.Pages.defaultFragmentMixins}
             * WinJS Contrib navigator is calling this method before processing the page, so you don't need to explicitely wrap all your pages if you use it
             * @function WinJSContrib.UI.Pages.fragmentMixin
             * @param {function} constructor constructor for the fragment
             * @returns {function} constructor for the fragment
             * @example
             * WinJSContrib.UI.Pages.fragmentMixin(WinJS.UI.Pages.define("./demos/home.html", {
             *     ready : function(){
             *         //your page ready stuff
             *     }
             * }));
             */
            function fragmentMixin(constructor) {
                var proto = constructor.prototype;
                if (constructor.winJSContrib)
                    return;
                constructor.winJSContrib = true;
                WinJSContrib.UI.Pages.defaultFragmentMixins.forEach(function (mixin) {
                    WinJS.Class.mix(constructor, mixin);
                });
                if (!proto.__wLoad) {
                    //wrap WinJS page events with custom functions
                    proto.__wLoad = proto.load;
                    proto.load = function (uri) {
                        return WinJS.Promise.as(this.__wLoad.apply(this, arguments)).then(function (arg) {
                            if (!proto.__wInit) {
                                //this register should happen after first page load, otherwise page methods will override framework method
                                register(proto);
                            }
                            return arg;
                        });
                    };
                    var register = function (proto) {
                        proto.__wDispose = proto.dispose;
                        proto.__wInit = proto.init;
                        proto.__wProcess = proto.process;
                        proto.__wProcessed = proto.processed;
                        proto.__wRender = proto.render;
                        proto.__wReady = proto.ready;
                        proto.__wError = proto.error;
                        proto.__wUpdateLayout = proto.updateLayout;
                        proto.init = function (element, options) {
                            var page = this;
                            var initArgs = arguments;
                            element.classList.add('mcn-fragment');
                            element.classList.add('mcn-layout-ctrl');
                            //if (element.style.display)
                            //    this._initialDisplay = element.style.display;
                            //element.style.display = 'hidden';
                            return WinJS.Promise.as(page.__wInit.apply(this, initArgs)).then(function (initres) {
                                return WinJS.Promise.timeout().then(function () {
                                    return initres;
                                });
                            });
                        };
                        proto.process = function (element, options) {
                            var page = this;
                            var processargs = arguments;
                            return WinJS.Promise.as(page.__wProcess.apply(page, processargs));
                        };
                        proto.processed = function (element, options) {
                            var page = this;
                            var processedargs = arguments;
                            WinJSContrib.UI.bindMembers(element, page);
                            //return WinJS.Promise.as(page.__wProcessed.apply(page, processedargs));
                            return page.prepareDataPromise.then(function () {
                                return broadcast(page, element, 'prepare', [element, options], null, page.prepare);
                            }).then(function () {
                                //element.style.display = page._initialDisplay || '';
                                //return WinJS.Promise.timeout();
                            }).then(function () {
                                //if (page.onbeforelayout)
                                //    return page.onbeforelayout(element, options);
                            }).then(function () {
                                return broadcast(page, element, 'pageLayout', [element, options], null, page.pageLayout);
                            }).then(function () {
                                //if (page.onafterlayout)
                                //    return page.onafterlayout(element, options);
                            }).then(function () {
                                return WinJS.Promise.as(page.__wProcessed.apply(page, processedargs));
                            });
                        };
                        proto.render = function (element, options, loadResult) {
                            var page = this;
                            var renderargs = arguments;
                            if (page.prepareData)
                                page.prepareDataPromise = WinJS.Promise.as(page.prepareData(element, options));
                            else
                                page.prepareDataPromise = WinJS.Promise.wrap();
                            return WinJS.Promise.as(page.__wRender.apply(page, renderargs));
                        };
                        proto.ready = function (element, options) {
                            var page = this;
                            WinJSContrib.UI.bindActions(element, this);
                            return WinJS.Promise.as(page.__wReady.apply(page, arguments)).then(function () {
                                return broadcast(page, element, 'pageReady', [element, options]);
                            }).then(function () {
                                if (page.enterPageAnimation) {
                                    return WinJS.Promise.as(page.enterPageAnimation(element, options));
                                }
                            }).then(function () {
                                return broadcast(page, element, 'contentReady', [element, options], null, page.contentReady);
                            });
                        };
                        proto.dispose = function () {
                            $('.tap', this.element).untap();
                            if (this.eventTracker) {
                                this.eventTracker.dispose();
                                this._eventTracker = null;
                            }
                            if (this.promises && this.cancelPromises) {
                                this.cancelPromises();
                                this._promises = [];
                            }
                            if (this.__wDispose)
                                this.__wDispose(this);
                        };
                        proto.updateLayout = function () {
                            var page = this;
                            var updateLayoutArgs = arguments;
                            var p = WinJS.Promise.wrap();
                            if (page.__wUpdateLayout) {
                                p = WinJS.Promise.as(page.__wUpdateLayout.apply(page, updateLayoutArgs));
                            }
                            return p.then(function () {
                                //return broadcast(page, page.element, 'updateLayout', updateLayoutArgs);
                            });
                        };
                    };
                }
                return constructor;
            }
            Pages.fragmentMixin = fragmentMixin;
            function broadcast(ctrl, element, eventName, args, before, after) {
                var pagelayoutCtrls = element.querySelectorAll('.mcn-layout-ctrl');
                var promises = [];
                if (before)
                    promises.push(WinJS.Promise.as(before.apply(ctrl, args)));
                var query = element.querySelectorAll(".mcn-layout-ctrl");
                var index = 0;
                var length = query.length;
                while (index < length) {
                    var childctrl = query[index];
                    if (childctrl) {
                        var event = childctrl.winControl[eventName];
                        if (event) {
                            promises.push(WinJS.Promise.as(event.apply(childctrl.winControl, args)));
                        }
                    }
                    // Skip descendants
                    //index += childctrl.querySelectorAll(".mcn-fragment, .mcn-layout-ctrl").length + 1;
                    index += 1;
                }
                if (after)
                    promises.push(WinJS.Promise.as(after.apply(ctrl, args)));
                return WinJS.Promise.join(promises);
            }
            /**
             * render a html fragment with winjs contrib pipeline and properties, and add WinJS Contrib page events.
             * @function WinJSContrib.UI.Pages.renderFragment
             * @param {HTMLElement} container element that will contain the fragment
             * @param {string} location url for the fragment
             * @param {Object} args arguments to the fragment
             * @param {Object} options rendering options
             */
            function renderFragment(container, location, args, options) {
                var fragmentCompleted;
                var fragmentError;
                options = options || {};
                var element = document.createElement("div");
                element.setAttribute("dir", window.getComputedStyle(element, null).direction);
                element.style.opacity = '0';
                container.appendChild(element);
                var fragmentPromise = new WinJS.Promise(function (c, e) {
                    fragmentCompleted = c;
                    fragmentError = e;
                });
                var parented = options.parented; // || WinJS.Promise.timeout();
                var layoutCtrls = [];
                var pageConstructor = WinJS.UI.Pages.get(location);
                WinJSContrib.UI.Pages.fragmentMixin(pageConstructor);
                function preparePageControl(elementCtrl) {
                    //if (args && args.injectToPage) {
                    //    WinJSContrib.Utils.inject(elementCtrl, args.injectToPage);
                    //}
                    elementCtrl.navigationState = { location: location, state: args };
                    if (options.oncreate) {
                        options.oncreate(elementCtrl.element, args);
                    }
                    if (options.oninit) {
                        elementCtrl.elementReady.then(function () {
                            options.oninit(elementCtrl.element, args);
                        });
                    }
                    if (options.onrender) {
                        elementCtrl.renderComplete.then(function () {
                            options.onrender(elementCtrl.element, args);
                        });
                    }
                    if (options.onready) {
                        elementCtrl.renderComplete.then(function () {
                            return elementCtrl.readyComplete;
                        }).then(function () {
                            options.onready(elementCtrl.element, args);
                        });
                    }
                    if (elementCtrl.enterPageAnimation || options.enterPage) {
                        if (elementCtrl.enterPageAnimation)
                            elementCtrl._enterAnimation = elementCtrl.enterPageAnimation;
                        else
                            elementCtrl._enterAnimation = options.enterPage;
                        elementCtrl.enterPageAnimation = function () {
                            var page = this;
                            var elts = null;
                            element.style.opacity = '';
                            if (page && page.getAnimationElements) {
                                elts = page.getAnimationElements(false);
                            }
                            else {
                                elts = page.element;
                            }
                            //this.dispatchEvent("pageContentReady", navargs);
                            if (elts)
                                return page._enterAnimation(elts);
                        };
                    }
                    if (options.closeOldPagePromise) {
                        elementCtrl._beforelayoutPromise = options.closeOldPagePromise;
                        elementCtrl.onbeforelayout = function () {
                            return this._beforelayoutPromise;
                        };
                    }
                    if (!elementCtrl.beforeShow)
                        elementCtrl.beforeShow = [];
                    elementCtrl.contentReadyComplete = elementCtrl.renderComplete.then(function () {
                        if (!WinJSContrib.UI.disableAutoResources)
                            return WinJS.Resources.processAll(element);
                    }).then(function (control) {
                        return elementCtrl.elementReady;
                    }).then(function (control) {
                        if (elementCtrl.beforeShow.length) {
                            return WinJSContrib.Promise.parallel(elementCtrl.beforeShow, function (cb) {
                                return WinJS.Promise.as(cb());
                            });
                        }
                    }).then(function () {
                        if (elementCtrl.enterPageAnimation) {
                            return WinJS.Promise.as(elementCtrl.enterPageAnimation(element, options));
                        }
                        else {
                            elementCtrl.element.style.opacity = '';
                        }
                    }).then(fragmentCompleted, fragmentError);
                }
                var elementCtrl = new pageConstructor(element, args, preparePageControl, parented);
                elementCtrl.parentedComplete = parented;
                return fragmentPromise;
            }
            Pages.renderFragment = renderFragment;
        })(Pages = UI.Pages || (UI.Pages = {}));
    })(UI = WinJSContrib.UI || (WinJSContrib.UI = {}));
})(WinJSContrib || (WinJSContrib = {}));
///<reference path="../typings/jquery.d.ts"/>
///<reference path="../typings/winjs.d.ts"/>
///<reference path="../typings/winrt.d.ts"/>
var WinJSContrib;
(function (WinJSContrib) {
    var UI;
    (function (UI) {
        UI.Application = {};
        /**
         * indicate if fragment should not look for resources when building control
         * @field WinJSContrib.UI.disableAutoResources
         * @type {boolean}
         */
        UI.disableAutoResources = false;
        /**
         * Calculate offset of element relative to parent element. If parent parameter is null, offset is relative to document
         * @function WinJSContrib.UI.offsetFrom
         * @param {HTMLElement} element element to evaluate
         * @param {HTMLElement} parent reference of offset
         */
        function offsetFrom(element, parent) {
            var xPosition = 0;
            var yPosition = 0;
            var w = element.clientWidth;
            var h = element.clientHeight;
            while (element && element != parent) {
                xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
                yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
                element = element.offsetParent;
            }
            return { x: xPosition, y: yPosition, width: w, height: h };
        }
        UI.offsetFrom = offsetFrom;
        var EventTracker = (function () {
            /**
             * @class WinJSContrib.UI.EventTracker
             * @classdesc object to register and release events from addEventListener or bind
             */
            function EventTracker() {
                this.events = [];
            }
            /**
             * register an event from an object
             * @function WinJSContrib.UI.EventTracker.prototype.addEvent
             * @param {Object} e object containing addEventListener
             * @param {string} eventName name of the event
             * @param {function} handler
             * @param {boolean} capture
             * @returns {function} function to call for unregistering the event
             */
            EventTracker.prototype.addEvent = function (e, eventName, handler, capture) {
                var tracker = this;
                e.addEventListener(eventName, handler, capture);
                var unregister = function () {
                    try {
                        e.removeEventListener(eventName, handler);
                        var idx = tracker.events.indexOf(unregister);
                        if (idx >= 0) {
                            tracker.events.splice(idx, 1);
                        }
                    }
                    catch (exception) {
                        console.error('unexpected error while releasing callback ' + exception.message);
                    }
                };
                this.events.push(unregister);
                return unregister;
            };
            /**
             * register binding event
             * @function WinJSContrib.UI.EventTracker.prototype.addBinding
             * @param {Object} e object containing bind method
             * @param {string} eventName name of the binding event
             * @param {function} handler
             */
            EventTracker.prototype.addBinding = function (e, eventName, handler) {
                e.bind(eventName, handler);
                var unregister = function () {
                    e.unbind(eventName, handler);
                };
                this.events.push(unregister);
                return unregister;
            };
            /**
             * release all registered events
             * @function WinJSContrib.UI.EventTracker.prototype.dispose
             */
            EventTracker.prototype.dispose = function () {
                for (var i = 0; i < this.events.length; i++) {
                    this.events[i]();
                }
                this.events = [];
            };
            return EventTracker;
        })();
        UI.EventTracker = EventTracker;
        /**
         * open all appbars
         * @function WinJSContrib.UI.appbarsOpen
         */
        function appbarsOpen() {
            var res = document.querySelectorAll('div[data-win-control="WinJS.UI.AppBar"],div[data-win-control="WinJS.UI.NavBar"]');
            if (res && res.length) {
                for (var i = 0; i < res.length; i++) {
                    var e = res[i];
                    if (e.winControl) {
                        e.winControl.show();
                    }
                }
            }
        }
        UI.appbarsOpen = appbarsOpen;
        /**
         * close all appbars
         * @function WinJSContrib.UI.appbarsClose
         */
        function appbarsClose() {
            var res = document.querySelectorAll('div[data-win-control="WinJS.UI.AppBar"],div[data-win-control="WinJS.UI.NavBar"]');
            if (res && res.length) {
                for (var i = 0; i < res.length; i++) {
                    var e = res[i];
                    if (e.winControl) {
                        e.winControl.hide();
                    }
                }
            }
        }
        UI.appbarsClose = appbarsClose;
        /**
         * disable all appbars
         * @function WinJSContrib.UI.appbarsDisable
         */
        function appbarsDisable() {
            var res = document.querySelectorAll('div[data-win-control="WinJS.UI.AppBar"],div[data-win-control="WinJS.UI.NavBar"]');
            if (res && res.length) {
                for (var i = 0; i < res.length; i++) {
                    var e = res[i];
                    if (e.winControl) {
                        e.winControl.disabled = true;
                    }
                }
            }
        }
        UI.appbarsDisable = appbarsDisable;
        /**
         * enable all appbars
         * @function WinJSContrib.UI.appbarsEnable
         */
        function appbarsEnable() {
            $('div[data-win-control="WinJS.UI.AppBar"],div[data-win-control="WinJS.UI.NavBar"]').each(function () {
                if (this.winControl) {
                    this.winControl.disabled = false;
                }
            });
        }
        UI.appbarsEnable = appbarsEnable;
        /**
         * build a promise around element "load" event (work for all element with src property like images, iframes, ...)
         * @function WinJSContrib.UI.elementLoaded
         * @param {HTMLElement} element
         * @param {string} url url used to feed "src" on element
         * @returns {WinJS.Promise}
         */
        function elementLoaded(elt, url) {
            return new WinJS.Promise(function (complete, error) {
                function onerror(e) {
                    elt.onload = undefined;
                    elt.onerror = undefined;
                    elt.onreadystatechange = undefined;
                    error('element not loaded');
                }
                function onload(e) {
                    elt.onload = undefined;
                    elt.onerror = undefined;
                    elt.onreadystatechange = undefined;
                    complete({
                        element: elt,
                        url: url
                    });
                }
                elt.onerror = onerror;
                elt.onload = onload;
                elt.onreadystatechange = onload;
                if (elt.naturalWidth > 0) {
                    onload(undefined);
                }
                elt.src = url;
            });
        }
        UI.elementLoaded = elementLoaded;
        /**
         * Create a promise for getting an image object from url
         * @function WinJSContrib.UI.loadImage
         * @param {string} imgUrl url for the picture
         * @returns {WinJS.Promise}
         */
        function loadImage(imgUrl) {
            return new WinJS.Promise(function (complete, error) {
                var image = new Image();
                function onerror(e) {
                    image.onload = undefined;
                    image.onerror = undefined;
                    error('image not loaded');
                }
                function onload(e) {
                    image.onload = undefined;
                    image.onerror = undefined;
                    complete({
                        element: image,
                        url: imgUrl
                    });
                }
                image.onerror = onerror;
                image.onload = onload;
                if (image.naturalWidth > 0) {
                    onload(undefined);
                }
                image.src = imgUrl;
            });
        }
        UI.loadImage = loadImage;
        /**
         * List all elements found after provided element
         * @function WinJSContrib.UI.listElementsAfterMe
         * @param {HTMLElement} elt target element
         * @returns {Array} list of sibling elements
         */
        function listElementsAfterMe(elt) {
            var res = [];
            var passed = false;
            if (elt.parentElement) {
                var parent = elt.parentElement;
                for (var i = 0; i < parent.children.length; i++) {
                    if (parent.children[i] === elt) {
                        passed = true;
                    }
                    else if (passed) {
                        res.push(parent.children[i]);
                    }
                }
            }
            return res;
        }
        UI.listElementsAfterMe = listElementsAfterMe;
        /**
         * create an animation for removing an element from a list
         * @function WinJSContrib.UI.removeElementAnimation
         * @param {HTMLElement} element that will be removed
         * @returns {WinJS.Promise}
         */
        function removeElementAnimation(elt) {
            return new WinJS.Promise(function (complete, error) {
                var remainings = WinJSContrib.UI.listElementsAfterMe(elt);
                var anim = WinJS.UI.Animation.createDeleteFromListAnimation([
                    elt
                ], remainings);
                elt.style.position = "fixed";
                elt.style.opacity = '0';
                anim.execute().done(function () {
                    complete(elt);
                });
            });
        }
        UI.removeElementAnimation = removeElementAnimation;
        /**
         * setup declarative binding to parent control function. It looks for "data-page-action" attributes,
         * and try to find a matching method on the supplyed control.
         * You could add arguments with a "page-action-args" attribute. The argument can be an object or a function
         * @function WinJSContrib.UI.bindPageActions
         * @param {HTMLElement} element root node crawled for page actions
         * @param {Object} control control owning functions to call
         */
        function bindPageActions(element, control) {
            $('*[data-page-action]', element).each(function () {
                var actionName = $(this).addClass('page-action').data('page-action');
                var action = control[actionName];
                if (action && typeof action === 'function') {
                    $(this).tap(function (eltarg) {
                        var actionArgs = $(eltarg).data('page-action-args');
                        if (actionArgs && typeof actionArgs == 'string') {
                            try {
                                var tmp = WinJSContrib.Utils.readValue(eltarg, actionArgs);
                                if (tmp) {
                                    actionArgs = tmp;
                                }
                                else {
                                    actionArgs = JSON.parse(actionArgs);
                                }
                            }
                            catch (exception) {
                                return;
                            }
                        }
                        control[actionName].bind(control)({ elt: eltarg, args: actionArgs });
                    });
                }
            });
        }
        UI.bindPageActions = bindPageActions;
        /**
         * setup declarative binding to page link. It looks for "data-page-link" attributes.
         * If any the content of the attribute point toward a page. clicking that element will navigate to that page.
         * You could add arguments with a "page-action-args" attribute. The argument can be an object or a function
         * @function WinJSContrib.UI.bindPageLinks
         * @param {HTMLElement} element root node crawled for page actions
         */
        function bindPageLinks(element) {
            $('*[data-page-link]', element).each(function () {
                var target = $(this).addClass('page-link').data('page-link');
                if (target && target.indexOf('/') < 0) {
                    var tmp = WinJSContrib.Utils.readProperty(window, target);
                    if (tmp) {
                        target = tmp;
                    }
                }
                if (target) {
                    $(this).tap(function (eltarg) {
                        var actionArgs = $(eltarg).data('page-action-args');
                        if (actionArgs && typeof actionArgs == 'string') {
                            try {
                                var tmp = WinJSContrib.Utils.readValue(eltarg, actionArgs);
                                if (tmp) {
                                    actionArgs = tmp;
                                }
                                else {
                                    actionArgs = JSON.parse(actionArgs);
                                }
                            }
                            catch (exception) {
                                return;
                            }
                        }
                        if (WinJSContrib.UI.parentNavigator && WinJSContrib.UI.parentNavigator(eltarg)) {
                            var nav = WinJSContrib.UI.parentNavigator(eltarg);
                            nav.navigate(target, actionArgs);
                        }
                        else {
                            WinJS.Navigation.navigate(target, actionArgs);
                        }
                    });
                }
            });
        }
        UI.bindPageLinks = bindPageLinks;
        function parentNavigator(element) {
            var current = element.parentNode;
            while (current) {
                if (current.mcnNavigator) {
                    return current.winControl;
                }
                current = current.parentNode;
            }
        }
        UI.parentNavigator = parentNavigator;
        /**
         * Add this element or control as member to the control. It looks for "data-page-member" attributes. If attribute is empty, it tooks the element id as member name.
         * @function WinJSContrib.UI.bindMembers
         * @param {HTMLElement} element root node crawled for page actions
         * @param {Object} control control owning functions to call
         */
        function bindMembers(element, control) {
            $('*[data-page-member]', element).each(function () {
                var memberName = $(this).addClass('page-member').data('page-member');
                if (!memberName)
                    memberName = this.id;
                if (memberName && !control[memberName]) {
                    control[memberName] = this;
                    if (this.winControl) {
                        control[memberName] = this.winControl;
                    }
                }
            });
        }
        UI.bindMembers = bindMembers;
        /**
         * setup declarative binding to parent control function and to navigation links. It internally invoke both {@link WinJSContrib.UI.bindPageActions} and {@link WinJSContrib.UI.bindPageLinks}
         * @function WinJSContrib.UI.bindActions
         * @param {HTMLElement} element root node crawled for page actions
         * @param {Object} control control owning functions to call
         */
        function bindActions(element, control) {
            WinJSContrib.UI.bindPageActions(element, control);
            WinJSContrib.UI.bindPageLinks(element);
        }
        UI.bindActions = bindActions;
        /**
         * Trigger events on media queries. This class is usefull as a component for other controls to change some properties based on media queries
         * @class WinJSContrib.UI.MediaTrigger
         * @param {Object} items object containing one property for each query
         * @param {Object} linkedControl control linked to media trigger
         */
        var MediaTrigger = (function () {
            function MediaTrigger(items, linkedControl) {
                var ctrl = this;
                ctrl.queries = [];
                ctrl.linkedControl = linkedControl;
                for (var name in items) {
                    var e = items[name];
                    if (e.query) {
                        ctrl.registerMediaEvent(name, e.query, e);
                    }
                }
            }
            /**
             * @function WinJSContrib.UI.MediaTrigger.prototype.dispose
             * release media trigger
             */
            MediaTrigger.prototype.dispose = function () {
                var ctrl = this;
                ctrl.linkedControl = null;
                this.queries.forEach(function (q) {
                    q.dispose();
                });
            };
            /**
             * register an event from a media query
             * @function WinJSContrib.UI.MediaTrigger.prototype.registerMediaEvent
             * @param {string} name event name
             * @param {string} query media query
             * @param {Object} data data associated with this query
             */
            MediaTrigger.prototype.registerMediaEvent = function (name, query, data) {
                var ctrl = this;
                var mq = window.matchMedia(query);
                var internalQuery = {
                    name: name,
                    query: query,
                    data: data,
                    mq: mq,
                    dispose: null
                };
                var f = function (arg) {
                    if (arg.matches) {
                        ctrl._mediaEvent(arg, internalQuery);
                    }
                };
                mq.addListener(f);
                internalQuery.dispose = function () {
                    mq.removeListener(f);
                };
                ctrl.queries.push(internalQuery);
            };
            MediaTrigger.prototype._mediaEvent = function (arg, query) {
                var ctrl = this;
                if (ctrl.linkedControl) {
                    WinJS.UI.setOptions(ctrl.linkedControl, query.data);
                }
                ctrl.dispatchEvent('media', query);
            };
            /**
             * @function WinJSContrib.UI.MediaTrigger.prototype.check
             * Check all registered queries
             */
            MediaTrigger.prototype.check = function () {
                var ctrl = this;
                ctrl.queries.forEach(function (q) {
                    var mq = window.matchMedia(q.query);
                    if (mq.matches) {
                        ctrl._mediaEvent({ matches: true }, q);
                    }
                });
            };
            /**
             * Adds an event listener to the control.
             * @function WinJSContrib.UI.MediaTrigger.prototype.addEventListener
             * @param type The type (name) of the event.
             * @param listener The listener to invoke when the event gets raised.
             * @param useCapture If true, initiates capture, otherwise false.
            **/
            MediaTrigger.prototype.addEventListener = function (type, listener, useCapture) {
            };
            /**
             * Raises an event of the specified type and with the specified additional properties.
             * @function WinJSContrib.UI.MediaTrigger.prototype.dispatchEvent
             * @param type The type (name) of the event.
             * @param eventProperties The set of additional properties to be attached to the event object when the event is raised.
             * @returns true if preventDefault was called on the event.
            **/
            MediaTrigger.prototype.dispatchEvent = function (type, eventProperties) {
                return false;
            };
            /**
             * Removes an event listener from the control.
             * @function WinJSContrib.UI.MediaTrigger.prototype.removeEventListener
             * @param type The type (name) of the event.
             * @param listener The listener to remove.
             * @param useCapture true if capture is to be initiated, otherwise false.
            **/
            MediaTrigger.prototype.removeEventListener = function (type, listener, useCapture) {
            };
            return MediaTrigger;
        })();
        UI.MediaTrigger = MediaTrigger;
        WinJS.Class.mix(WinJSContrib.UI.MediaTrigger, WinJS.Utilities.eventMixin);
        /**
         * register navigation related events like hardware backbuttons. This method keeps track of previously registered navigation handlers
         *  and disable them until the latests is closed, enablinh multi-level navigation.
         * @function WinJSContrib.UI.registerNavigationEvents
         * @param {Object} control control taking ownership of navigation handlers
         * @param {function} callback callback to invoke when "back" is requested
         * @returns {function} function to call for releasing navigation handlers
         */
        function registerNavigationEvents(control, callback) {
            var locked = [];
            control.navLocks = control.navLocks || [];
            control.navLocks.isActive = true;
            var backhandler = function (arg) {
                if (!control.navLocks || control.navLocks.length === 0) {
                    callback.bind(control)(arg);
                }
            };
            var navcontrols = document.querySelectorAll('.mcn-navigation-ctrl');
            for (var i = 0; i < navcontrols.length; i++) {
                var navigationCtrl = navcontrols[i].winControl;
                if (navigationCtrl && navigationCtrl != control) {
                    navigationCtrl.navLocks = navigationCtrl.navLocks || [];
                    if (navigationCtrl.navLocks.isActive && (!navigationCtrl.navLocks.length || navigationCtrl.navLocks.indexOf(control) < 0)) {
                        navigationCtrl.navLocks.push(control);
                        locked.push(navigationCtrl);
                    }
                }
            }
            function cancelNavigation(args) {
                //this.eventTracker.addEvent(nav, 'beforenavigate', this._beforeNavigate.bind(this));
                var p = new WinJS.Promise(function (c) {
                });
                args.detail.setPromise(p);
                //setImmediate(function () {
                p.cancel();
                //});
            }
            WinJS.Navigation.addEventListener('beforenavigate', cancelNavigation);
            if (window.Windows && window.Windows.Phone)
                window.Windows.Phone.UI.Input.HardwareButtons.addEventListener("backpressed", backhandler);
            else
                document.addEventListener("backbutton", backhandler);
            if (WinJSContrib.UI.Application && WinJSContrib.UI.Application.navigator)
                WinJSContrib.UI.Application.navigator.addLock();
            return function () {
                if (WinJSContrib.UI.Application && WinJSContrib.UI.Application.navigator)
                    WinJSContrib.UI.Application.navigator.removeLock();
                control.navLocks.isActive = false;
                locked.forEach(function (navigationCtrl) {
                    var idx = navigationCtrl.navLocks.indexOf(control);
                    if (idx >= 0)
                        navigationCtrl.navLocks.splice(idx, 1);
                });
                WinJS.Navigation.removeEventListener('beforenavigate', cancelNavigation);
                if (window.Windows && window.Windows.Phone)
                    window.Windows.Phone.UI.Input.HardwareButtons.removeEventListener("backpressed", backhandler);
                else
                    document.removeEventListener("backbutton", backhandler);
            };
        }
        UI.registerNavigationEvents = registerNavigationEvents;
    })(UI = WinJSContrib.UI || (WinJSContrib.UI = {}));
})(WinJSContrib || (WinJSContrib = {}));
///<reference path="../typings/jquery.d.ts"/>
///<reference path="../typings/winjs.d.ts"/>
///<reference path="../typings/winrt.d.ts"/>
if (!Object.map) {
    Object.map = function (obj, mapping) {
        var mapped = {};
        if (typeof obj !== 'object') {
            return mapped;
        }
        if (typeof mapping !== 'function') {
            // We could just return obj but that wouldn't be
            // consistent with the rest of the interface which always returns
            // a new object.
            mapping = function (key, val) {
                return [key, val];
            };
        }
        Object.keys(obj).forEach(function (key) {
            var transmuted = mapping.apply(obj, [key, obj[key]]);
            if (transmuted && transmuted.length) {
                mapped[transmuted[0] || key] = transmuted[1];
            }
        });
        return mapped;
    };
}
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };
}
if (!String.prototype.padLeft) {
    String.prototype.padLeft = function padLeft(length, leadingChar) {
        if (leadingChar === undefined) {
            leadingChar = "0";
        }
        return this.length < length ? (leadingChar + this).padLeft(length, leadingChar) : this;
    };
}
var WinJSContrib;
(function (WinJSContrib) {
    var Promise;
    (function (Promise) {
        /**
         * apply callback for each item in the array in waterfall
         * @function WinJSContrib.Promise.waterfall
         * @param {Array} dataArray items to process with async tasks
         * @param {function} promiseCallback function applyed to each item (could return a promise for item callback completion)
         * @returns {WinJS.Promise}
         */
        function waterfall(dataArray, promiseCallback) {
            var resultPromise = WinJS.Promise.wrap();
            var results = [];
            if (!dataArray) {
                return WinJS.Promise.wrap([]);
            }
            var dataPromise = WinJS.Promise.as(dataArray);
            return dataPromise.then(function (items) {
                var queueP = function (p, item) {
                    return p.then(function (r) {
                        return WinJS.Promise.as(promiseCallback(item)).then(function (r) {
                            results.push(r);
                        });
                    });
                };
                for (var i = 0, l = items.length; i < l; i++) {
                    resultPromise = queueP(resultPromise, items[i]);
                }
                return resultPromise.then(function (r) {
                    return results;
                });
            });
        }
        Promise.waterfall = waterfall;
        function promises(dataArray, promiseCallback) {
            if (!dataArray) {
                return WinJS.Promise.wrap([]);
            }
            var dataPromise = WinJS.Promise.as(dataArray);
            return dataPromise.then(function (items) {
                var promises = [];
                for (var i = 0, l = items.length; i < l; i++) {
                    promises.push(WinJS.Promise.as(promiseCallback(items[i])));
                }
                return promises;
            });
        }
        /**
         * apply callback for each item in the array in parallel (equivalent to WinJS.Promise.join)
         * @function WinJSContrib.Promise.parallel
         * @param {Array} dataArray items to process with async tasks
         * @param {function} promiseCallback function applyed to each item (could return a promise for item callback completion)
         * @returns {WinJS.Promise}
         */
        function parallel(dataArray, promiseCallback) {
            if (!dataArray) {
                return WinJS.Promise.wrap([]);
            }
            var dataPromise = WinJS.Promise.as(dataArray);
            return dataPromise.then(function (items) {
                var promises = [];
                for (var i = 0, l = items.length; i < l; i++) {
                    promises.push(WinJS.Promise.as(promiseCallback(items[i])));
                }
                return WinJS.Promise.join(promises);
            });
        }
        Promise.parallel = parallel;
        /**
         * apply callback for each item in the array in batch of X parallel items
         * @function WinJSContrib.Promise.batch
         * @param {Array} dataArray items to process with async tasks
         * @param {number} batchSize number of items to batch
         * @param {function} promiseCallback function applyed to each item (could return a promise for item callback completion)
         * @returns {WinJS.Promise}
         */
        function batch(dataArray, batchSize, promiseCallback) {
            if (!dataArray) {
                return WinJS.Promise.wrap([]);
            }
            var dataPromise = WinJS.Promise.as(dataArray);
            return dataPromise.then(function (items) {
                var resultPromise = WinJS.Promise.wrap();
                var batcheditems = [];
                var results = [];
                var hasErrors = false;
                var queueBatch = function (p, items) {
                    //var batchresults = [];
                    return p.then(function (r) {
                        return WinJS.Promise.join(items.map(function (item) {
                            return WinJS.Promise.as(promiseCallback(item));
                        })).then(function (results) {
                            results = results.concat(results);
                        }, function (errors) {
                            results = results.concat(errors);
                            hasErrors = true;
                        });
                    });
                };
                for (var i = 0, l = items.length; i < l; i++) {
                    batcheditems.push(items[i]);
                    if (i > 0 && i % batchSize === 0) {
                        resultPromise = queueBatch(resultPromise, batcheditems);
                        batcheditems = [];
                    }
                }
                if (batcheditems.length) {
                    resultPromise = queueBatch(resultPromise, batcheditems);
                }
                return resultPromise.then(function () {
                    if (hasErrors)
                        return WinJS.Promise.wrapError(results);
                    return results;
                });
            });
        }
        Promise.batch = batch;
    })(Promise = WinJSContrib.Promise || (WinJSContrib.Promise = {}));
})(WinJSContrib || (WinJSContrib = {}));
var WinJSContrib;
(function (WinJSContrib) {
    var Utils;
    (function (Utils) {
        /** indicate if string starts with featured characters
         * @function WinJSContrib.Utils.startsWith
         * @param {string} str string to search within
         * @param {string} strToMatch match string
         * @returns {boolean} true if string starts with strToMatch
         */
        function startsWith(str, strToMatch) {
            if (!strToMatch) {
                return false;
            }
            var match = (str.match("^" + strToMatch) == strToMatch);
            return match;
        }
        Utils.startsWith = startsWith;
        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function (str) {
                return WinJSContrib.Utils.startsWith(this, str);
            };
        }
        /** indicate if string ends with featured characters
         * @function WinJSContrib.Utils.endsWith
         * @param {string} str string to search within
         * @param {string} strToMatch match string
         * @returns {boolean} true if string starts with strToMatch
         */
        function endsWith(str, strToMatch) {
            if (!strToMatch) {
                return false;
            }
            return (str.match(strToMatch + "$") == strToMatch);
        }
        Utils.endsWith = endsWith;
        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function (str) {
                return WinJSContrib.Utils.endsWith(this, str);
            };
        }
        /**
         * generate a string formatted as a query string from object properties
         * @function WinJSContrib.Utils.queryStringFrom
         * @param {Object} obj object to format
         * @returns {string}
         */
        function queryStringFrom(obj) {
            var str = [];
            for (var p in obj)
                if (obj.hasOwnProperty(p)) {
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                }
            return str.join("&");
        }
        Utils.queryStringFrom = queryStringFrom;
        /**
         * trigger an event on a DOM node
         * @function WinJSContrib.Utils.triggerEvent
         * @param {HTMLElement} element receiving the event
         * @param {string} eventName name of the event
         * @param {boolean} bubbles indicate if event should bubble
         * @param {boolean} cancellable indicate if event can be cancelled
         */
        function triggerEvent(element, eventName, bubbles, cancellable) {
            var eventToTrigger = document.createEvent("Event");
            eventToTrigger.initEvent(eventName, bubbles, cancellable);
            element.dispatchEvent(eventToTrigger);
        }
        Utils.triggerEvent = triggerEvent;
        /**
         * @function WinJSContrib.Utils.triggerCustomEvent
         * @param {HTMLElement} element receiving the event
         * @param {string} eventName name of the event
         * @param {boolean} bubbles indicate if event should bubble
         * @param {boolean} cancellable indicate if event can be cancelled
         */
        function triggerCustomEvent(element, eventName, bubbles, cancellable, data) {
            var eventToTrigger = document.createEvent("CustomEvent");
            eventToTrigger.initCustomEvent(eventName, bubbles, cancellable, data);
            element.dispatchEvent(eventToTrigger);
        }
        Utils.triggerCustomEvent = triggerCustomEvent;
        /*
        Core object properties features
        */
        //return object value based on property name. Property name is a string containing the name of the property, 
        //or the name of the property with an indexer, ex: myproperty[2] (to get item in a array)
        function getobject(obj, prop) {
            if (!obj)
                return;
            if (prop === 'this')
                return obj;
            var baseValue = obj[prop];
            if (typeof baseValue !== "undefined")
                return baseValue;
            var idx = prop.indexOf('[');
            if (idx < 0)
                return;
            var end = prop.indexOf(']', idx);
            if (end < 0)
                return;
            var val = prop.substr(idx + 1, end - idx);
            val = parseInt(val);
            return obj[val];
        }
        //set object property value based on property name. Property name is a string containing the name of the property, 
        //or the name of the property with an indexer, ex: myproperty[2] (to get item in a array)
        function setobject(obj, prop, data) {
            if (WinJSContrib.Utils.hasValue(prop)) {
                if (obj.setProperty) {
                    obj.setProperty(prop, data);
                    return;
                }
                obj[prop] = data;
                return;
            }
            if (typeof prop === "string") {
                var idx = prop.indexOf('[');
                if (idx < 0)
                    return;
                var end = prop.indexOf(']', idx);
                if (end < 0)
                    return;
                var val = prop.substr(idx + 1, end - idx);
                val = parseInt(val);
                obj[val] = data;
            }
        }
        /** Read property value on an object based on expression
        * @function WinJSContrib.Utils.readProperty
        * @param {Object} source the object containing data
        * @param {Object} properties property descriptor. could be a string in js notation ex: 'myProp.myChildProp,
        * or an array of strings ['myProp', 'myChildProp']. String notation can contain indexers
        * @returns {Object} property value
        */
        function readProperty(source, properties) {
            if (typeof properties == 'string' && source[properties])
                return source[properties];
            if (!properties || !properties.length)
                return source;
            var prop = WinJSContrib.Utils.getProperty(source, properties);
            if (prop) {
                return prop.propValue;
            }
        }
        Utils.readProperty = readProperty;
        var PropertyDescriptor = (function () {
            function PropertyDescriptor(parent, parentDescriptor, keyProp) {
                this.parent = parent;
                this.parentDescriptor = parentDescriptor;
                this.keyProp = keyProp;
            }
            PropertyDescriptor.prototype.ensureParent = function () {
                if (parent) {
                    return parent;
                }
                else {
                    if (this.parentDescriptor) {
                        this.parentDescriptor.ensureParent();
                        if (!this.parentDescriptor.parent[this.parentDescriptor.keyProp]) {
                            this.parentDescriptor.parent[this.parentDescriptor.keyProp] = {};
                            this.parent = this.parentDescriptor.parent[this.parentDescriptor.keyProp];
                        }
                    }
                }
            };
            Object.defineProperty(PropertyDescriptor.prototype, "propValue", {
                get: function () {
                    return getobject(this.parent, this.keyProp);
                },
                set: function (val) {
                    this.ensureParent();
                    setobject(this.parent, this.keyProp, val);
                },
                enumerable: true,
                configurable: true
            });
            return PropertyDescriptor;
        })();
        Utils.PropertyDescriptor = PropertyDescriptor;
        /**
         * return a propery descriptor for an object based on expression
         * @function WinJSContrib.Utils.getProperty
         * @param {Object} source the object containing data
         * @param {string[]} properties property descriptor. could be a string in js notation ex: 'myProp.myChildProp,
         * or an array of strings ['myProp', 'myChildProp']. String notation can contain indexers
         * @returns {Object} property descriptor
         */
        function getProperty(source, properties) {
            if (typeof properties == 'string') {
                properties = properties.split('.');
            }
            if (!properties || !properties.length) {
                properties = ['this'];
            }
            var parent = source;
            var previousDescriptor = null;
            for (var i = 0; i < properties.length; i++) {
                var descriptor = new PropertyDescriptor(parent, previousDescriptor, properties[i]);
                previousDescriptor = descriptor;
                if (i == properties.length - 1) {
                    return descriptor;
                }
                parent = getobject(parent, properties[i]);
            }
            return;
        }
        Utils.getProperty = getProperty;
        /**
         * Write property value on an object based on expression
         * @function WinJSContrib.Utils.writeProperty
         * @param {Object} source the object containing data
         * @param {string[]} properties property descriptor. could be a string in js notation ex: 'myProp.myChildProp,
         * or an array of strings ['myProp', 'myChildProp']. String notation can contain indexers
         * @param {Object} data data to feed to the property
         */
        function writeProperty(source, properties, data) {
            var prop = WinJSContrib.Utils.getProperty(source, properties);
            if (prop) {
                prop.propValue = data;
            }
        }
        Utils.writeProperty = writeProperty;
        /** generate a random value between two numbers
         * @function WinJSContrib.Utils.randomFromInterval
         * @param {number} from lower limit
         * @param {number} to upper limit
         * @returns {number}
         */
        function randomFromInterval(from, to) {
            return (Math.random() * (to - from + 1) + from) << 0;
        }
        Utils.randomFromInterval = randomFromInterval;
        /**
         * function to use as a callback for Array.sort when you want the array to be sorted alphabetically
         * @function WinJSContrib.Utils.alphabeticSort
         * @param {string} a
         * @param {string} b
         * @returns {number}
         */
        function alphabeticSort(a, b) {
            if (a > b)
                return 1;
            if (a < b)
                return -1;
            return 0;
        }
        Utils.alphabeticSort = alphabeticSort;
        /**
         * generate an array with only distinct elements
         * @function WinJSContrib.Utils.distinctArray
         * @param {Array} array
         * @param {string} path to array's item property used for checking items
         * @param {boolean} ignorecase indicate if comparison should ignore case when using string
         * @returns {Array}
         */
        function distinctArray(array, property, ignorecase) {
            if (array === null || array.length === 0)
                return array;
            if (typeof ignorecase == "undefined")
                ignorecase = false;
            var sMatchedItems = "";
            var foundCounter = 0;
            var newArray = [];
            var sFind;
            var i;
            if (ignorecase) {
                for (i = 0; i < array.length; i++) {
                    if (property) {
                        var data = WinJSContrib.Utils.readProperty(array[i], property.split('.'));
                        sFind = data;
                        if (!data)
                            sFind = data;
                        if (data && data.toLowerCase)
                            sFind = data.toLowerCase();
                    }
                    else {
                        sFind = array[i];
                    }
                    if (sMatchedItems.indexOf("|" + sFind + "|") < 0) {
                        sMatchedItems += "|" + sFind + "|";
                        newArray[foundCounter++] = array[i];
                    }
                }
            }
            else {
                for (i = 0; i < array.length; i++) {
                    if (property) {
                        sFind = WinJSContrib.Utils.readProperty(array[i], property.split('.'));
                    }
                    else {
                        sFind = array[i];
                    }
                    if (sMatchedItems.indexOf("|" + sFind + "|") < 0) {
                        sMatchedItems += "|" + sFind + "|";
                        newArray[foundCounter++] = array[i];
                    }
                }
            }
            return newArray;
        }
        Utils.distinctArray = distinctArray;
        /**
         * get distinct values from an array of items
         * @function WinJSContrib.Utils.getDistinctPropertyValues
         * @param {Array} array items array
         * @param {string} property property path for values
         * @param {boolean} ignorecase ignore case for comparisons
         */
        function getDistinctPropertyValues(array, property, ignorecase) {
            return Utils.distinctArray(array, property, ignorecase).map(function (item) {
                return WinJSContrib.Utils.readProperty(item, property.split('.'));
            });
        }
        Utils.getDistinctPropertyValues = getDistinctPropertyValues;
        /**
         * Remove all accented characters from a string and replace them with their non-accented counterpart for ex: replace "é" with "e"
         * @function WinJSContrib.Utils.removeAccents
         * @param {string} s
         * @returns {string}
         */
        function removeAccents(s) {
            var r = s.toLowerCase();
            r = r.replace(new RegExp("[àáâãäå]", 'g'), "a");
            r = r.replace(new RegExp("æ", 'g'), "ae");
            r = r.replace(new RegExp("ç", 'g'), "c");
            r = r.replace(new RegExp("[èéêë]", 'g'), "e");
            r = r.replace(new RegExp("[ìíîï]", 'g'), "i");
            r = r.replace(new RegExp("ñ", 'g'), "n");
            r = r.replace(new RegExp("[òóôõö]", 'g'), "o");
            r = r.replace(new RegExp("œ", 'g'), "oe");
            r = r.replace(new RegExp("[ùúûü]", 'g'), "u");
            r = r.replace(new RegExp("[ýÿ]", 'g'), "y");
            return r;
        }
        Utils.removeAccents = removeAccents;
        /**
         * remove a page from navigation history
         * @function WinJSContrib.Utils.removePageFromHistory
         * @param {string} pageLocation page url
         */
        function removePageFromHistory(pageLoc) {
            var history = [];
            if (WinJS.Navigation.history && WinJS.Navigation.history.backStack && WinJS.Navigation.history.backStack.length) {
                WinJS.Navigation.history.backStack.forEach(function (page) {
                    if (page.location !== pageLoc) {
                        history.push(page);
                    }
                });
            }
            WinJS.Navigation.history.backStack = history;
        }
        Utils.removePageFromHistory = removePageFromHistory;
        /**
         * format a number on 2 digits
         * @function WinJSContrib.Utils.pad2
         * @param {number} number
         */
        function pad2(number) {
            return (number < 10 ? '0' : '') + number;
        }
        Utils.pad2 = pad2;
        /**
         * truncate a string and add ellipse if text if greater than certain size
         * @function WinJSContrib.Utils.ellipsisizeString
         * @param {string} text text to truncate
         * @param {number} maxSize maximum size for text
         * @param {boolean} useWordBoundary indicate if truncate should happen on the closest word boundary (like space)
         */
        function ellipsisizeString(text, maxSize, useWordBoundary) {
            if (!text) {
                return '';
            }
            var toLong = text.length > maxSize, text_ = toLong ? text.substr(0, maxSize - 1) : text;
            text_ = useWordBoundary && toLong ? text_.substr(0, text_.lastIndexOf(' ')) : text_;
            return toLong ? text_ + '...' : text_;
        }
        Utils.ellipsisizeString = ellipsisizeString;
        /**
         * generate a new Guid
         * @function WinJSContrib.Utils.guid
         * @returns {string}
         */
        function guid() {
            var d = new Date().getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
            });
            return uuid;
        }
        Utils.guid = guid;
        /**
         * inherit property from parent WinJS controls
         * @function WinJSContrib.Utils.inherit
         * @param {HTMLElement} element
         * @param {string} property property name
         */
        function inherit(element, property) {
            if (element && element.parentElement) {
                var current = element.parentElement;
                while (current) {
                    if (current.winControl) {
                        if (current.winControl[property] !== undefined) {
                            return current.winControl[property];
                        }
                    }
                    current = current.parentElement;
                }
            }
        }
        Utils.inherit = inherit;
        /**
         * move DOM childrens form one node to the other
         * @function WinJSContrib.Utils.moveChilds
         * @param {HTMLElement} source source node containing elements to move
         * @param {HTMLElement} target target node for moved elements
         */
        function moveChilds(source, target) {
            var childs = [];
            for (var i = 0; i < source.children.length; i++) {
                childs.push(source.children[i]);
            }
            childs.forEach(function (elt) {
                target.appendChild(elt);
            });
        }
        Utils.moveChilds = moveChilds;
        /**
         * get parent control identifyed by a property attached on DOM element
         * @function WinJSContrib.Utils.getParent
         * @param {string} property property attached to control's DOM element, for ex: msParentSelectorScope
         * @param {HTMLElement} element DOM element to scan
         * @returns {Object} WinJS control
         */
        function getParent(property, element) {
            var current = element.parentNode;
            while (current) {
                if (current[property] && current.winControl) {
                    return current.winControl;
                }
                current = current.parentNode;
            }
        }
        Utils.getParent = getParent;
        /**
         * get parent control identifyed by a css class
         * @function WinJSContrib.Utils.getParentControlByClass
         * @param {string} className css class name
         * @param {HTMLElement} element DOM element to scan
         * @returns {Object} WinJS control
         */
        function getParentControlByClass(className, element) {
            var current = element.parentNode;
            while (current) {
                if (current.classList && current.classList.contains(className) && current.winControl) {
                    return current.winControl;
                }
                current = current.parentNode;
            }
        }
        Utils.getParentControlByClass = getParentControlByClass;
        /**
         * get parent page control (work only with WinJSContrib.UI.PageControlNavigator
         * @function WinJSContrib.Utils.getParentPage
         * @param {HTMLElement} element DOM element to scan
         * @returns {Object} WinJS control
         */
        function getParentPage(element) {
            return WinJSContrib.Utils.getParent('mcnPage', element);
        }
        Utils.getParentPage = getParentPage;
        /**
         * get parent scope control (based on msParentSelectorScope)
         * @function WinJSContrib.Utils.getScopeControl
         * @param {HTMLElement} element DOM element to scan
         * @returns {Object} WinJS control
         */
        function getScopeControl(element) {
            var current = element.parentNode;
            while (current) {
                if (current.msParentSelectorScope) {
                    var scope = current.parentNode;
                    if (scope) {
                        var scopeControl = scope.winControl;
                        if (scopeControl) {
                            return scopeControl;
                        }
                    }
                }
                current = current.parentNode;
            }
        }
        Utils.getScopeControl = getScopeControl;
        /**
         * get WinJS.Binding.Template like control from a path, a control, a function or a DOM element
         * @function WinJSContrib.Utils.getTemplate
         * @param {Object} template template input
         * @returns {Object} WinJS.Binding.Template or template-like object (object with a render function)
         */
        function getTemplate(template) {
            if (template) {
                var templatetype = typeof template;
                if (templatetype == 'string') {
                    return new WinJS.Binding.Template(null, { href: template });
                }
                if (templatetype == 'function') {
                    return {
                        render: function (data, elt) {
                            var res = template(data, elt);
                            return WinJS.Promise.as(res);
                        }
                    };
                }
                else if (template.winControl) {
                    return template.winControl;
                }
                else if (template.render) {
                    return template;
                }
            }
        }
        Utils.getTemplate = getTemplate;
        /**
         * get a function from an expression, for example 'page:myAction' will return the myAction function from the parent page.
         * The returned function will be bound to it's owner. This function relies on {link WinJSContrib.Utils.resolveValue}, see this for details about how data are crawled
         * @function WinJSContrib.Utils.resolveMethod
         * @param {HTMLElement} element DOM element to look
         * @param {string} text expression like 'page:something' or 'ctrl:something' or 'something'
         * @returns {function}
         */
        function resolveMethod(element, text) {
            var res = WinJSContrib.Utils.resolveValue(element, text);
            if (res && typeof res == 'function')
                return res;
            return undefined;
        }
        Utils.resolveMethod = resolveMethod;
        function readValue(element, text) {
            var res = WinJSContrib.Utils.resolveValue(element, text);
            if (res) {
                if (typeof res == 'function')
                    return res(element);
                else
                    return res;
            }
            return undefined;
        }
        Utils.readValue = readValue;
        /**
         * resolve value from an expression. This helper will crawl the DOM up, and provide the property or function from parent page or control.
         * @function WinJSContrib.Utils.resolveValue
         * @param {HTMLElement} element DOM element to look
         * @param {string} text expression like 'page:something' or 'ctrl:something' or 'something'
         * @returns {Object}
         */
        function resolveValue(element, text) {
            var methodName, control, method;
            if (text.indexOf('page:') === 0) {
                methodName = text.substr(5);
                if (WinJSContrib.Utils.getParentPage) {
                    control = WinJSContrib.Utils.getParentPage(element);
                }
                if (!control && WinJSContrib.UI.Application.navigator) {
                    control = WinJSContrib.UI.Application.navigator.pageControl;
                }
                if (!control)
                    return;
                method = WinJSContrib.Utils.readProperty(control, methodName);
                if (method && typeof method === 'function')
                    method = method.bind(control);
            }
            else if (text.indexOf('ctrl:') === 0) {
                methodName = text.substr(5);
                control = WinJSContrib.Utils.getScopeControl(element);
                method = WinJSContrib.Utils.readProperty(control, methodName);
                if (method && typeof method === 'function')
                    method = method.bind(control);
            }
            else {
                methodName = text;
                control = WinJSContrib.Utils.getScopeControl(element);
                method = WinJSContrib.Utils.readProperty(window, methodName);
            }
            return method;
        }
        Utils.resolveValue = resolveValue;
        /**
         * Checks in a safe way if an object has a value, which could be 'false', '0' or '""'
         * @function WinJSContrib.Utils.hasValue
         * @param {Object} item The object to check.
         * @returns {Boolean} Whether the object has a value or not.
         */
        function hasValue(item) {
            return typeof item !== "undefined" && item !== null;
        }
        Utils.hasValue = hasValue;
        /**
         * format error from an xhr call
         * @function WinJSContrib.Utils.formatXHRError
         */
        function formatXHRError(xhr) {
            return "{0} - {1}: {2}".format(xhr.status, xhr.statusText, xhr.responseText);
        }
        Utils.formatXHRError = formatXHRError;
        /**
         * Unwraps the real error from a WinJS.Promise.join operation, which by design returns an array with 'undefined' for all cells,
         * excepts the one corresponding to the promise that really faulted.
         * @function WinJSContrib.Utils.unwrapJoinError
         * @param {function} errorCallback The callback to use to handle the error.
         * @returns {Function} The result of the callback being fired with the real error.
         */
        function unwrapJoinError(errorCallback) {
            return function (errorArray) {
                var unwrappedError = null;
                for (var i = 0; i < errorArray.length; i++) {
                    var tentativeError = errorArray[i];
                    if (typeof tentativeError !== "undefined") {
                        unwrappedError = tentativeError;
                        break;
                    }
                }
                return errorCallback(unwrappedError);
            };
        }
        Utils.unwrapJoinError = unwrapJoinError;
        /**
         * inject properties from source object to target object
         * @function WinJSContrib.Utils.inject
         */
        function inject(target, source) {
            if (source) {
                for (var k in source) {
                    target[k] = source[k];
                }
            }
        }
        Utils.inject = inject;
    })(Utils = WinJSContrib.Utils || (WinJSContrib.Utils = {}));
})(WinJSContrib || (WinJSContrib = {}));

//# sourceMappingURL=../../Sources/Core/winjscontrib.core.js.map