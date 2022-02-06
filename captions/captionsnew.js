/*
THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF
ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
PARTICULAR PURPOSE.

Copyright (c) Microsoft Corporation. All rights reserved
*/

(function () {
    'use strict';

    function convertTicksToMilliseconds(value) {
        /// <summary>Converts the specified value (in ticks) to milliseconds.</summary>
        /// <param name="value" type="Number">The number of ticks to convert.</param>
        /// <returns type="Number">The number of milliseconds.</returns>

        return value / 10000;
    }

    function convertTicksToSeconds(value) {
        /// <summary>Converts the specified value (in ticks) to seconds.</summary>
        /// <param name="value" type="Number">The number of ticks to convert.</param>
        /// <returns type="Number">The number of seconds.</returns>

        return value / 10000000;
    }

    function binaryInsert(array, value, comparer) {
        /// <summary>Inserts a value into a sorted array if it does not already exist.</summary>
        /// <param name="array" type="Array">The target array.</param>
        /// <param name="value" type="Object">The value to insert.</param>
        /// <param name="comparer" type="Function">The comparison function by which the array is sorted.</param>
        /// <returns type="Boolean">True if the value was inserted.</returns>

        var index = binarySearch(array, value, comparer);

        if (index < 0) {
            array.splice(-(index + 1), 0, value);
            return true;
        }
        //else {
        //    array.splice(index, 0, value);
        //    return true;
        //}

        return false;
    }

    function binarySearch(array, value, comparer) {
        /// <summary>Searches a sorted array for the specified value using the binary search algorithm.</summary>
        /// <param name="array" type="Array">The array to search.</param>
        /// <param name="value" type="Object">The value to search for.</param>
        /// <param name="comparer" type="Function">The comparison function by which the array is sorted.</param>
        /// <returns type="Number">The lowest index of the value if found, otherwise the insertion point.</returns>

        var left = 0;
        var right = array.length;
        var middle, compareResult, found;

        while (left < right) {
            middle = (left + right) >> 1;
            compareResult = comparer(value, array[middle]);
            if (compareResult > 0) {
                left = middle + 1;
            } else {
                right = middle;
                found = !compareResult;
            }
        }

        return found ? left : ~left;
    }

    function first(array, callback, thisObj) {
        /// <summary>Returns the first item in the array that passes the test implemented by the specified callback function.</summary>
        /// <param name="array" type="Array">The array to search.</param>
        /// <param name="callback" type="Function">A function that should return true if an item passes the test.</param>
        /// <param name="thisObj" type="Object" optional="true">The optional object to use as "this" when executing the callback.</param>
        /// <returns type="Object">The first item that passes the test.</returns>

        if (array === null || array === undefined) {
            throw invalidArgument;
        }

        if (typeof callback !== "function") {
            throw invalidArgument;
        }

        var obj = Object(array);
        var len = obj.length >>> 0;

        for (var i = 0; i < len; i++) {
            if (i in obj && callback.call(thisObj, obj[i], i, obj)) {
                return obj[i];
            }
        }

        return null;
    }

    function getArray(obj) {
        /// <summary>Gets an array from an "enumerable" object.</summary>
        /// <param name="obj" type="Object">The target object.</param>
        /// <returns type="Array">The array.</returns>

        if (obj) {
            if (Array.isArray(obj)) {
                return obj;
            } else if (typeof obj.length !== "undefined") {
                return Array.prototype.slice.call(obj);
            } else if (typeof obj.first === "function") {
                var array = [];

                for (var i = obj.first() ; i.hasCurrent; i.moveNext()) {
                    array.push(i.current);
                }

                return array;
            }
        }

        throw invalidArgument;
    }

    WinJS.Namespace.define('PlayerFramework.Utilities', {
        convertTicksToMilliseconds: convertTicksToMilliseconds,
        convertTicksToSeconds: convertTicksToSeconds,
        binaryInsert: binaryInsert,
        binarySearch: binarySearch,
        first: first,
        getArray: getArray
    });
})();


(function TTMLParserInit(PlayerFramework, undefined) {
    "use strict";

    // TtmlParser Errors
    var invalidConstruction = "Invalid construction: TtmlParser constructor must be called using the \"new\" operator.";

    // TtmlParser Enums
    var nodeType = {
        elementNode: 1,
        attributeNode: 2,
        textNode: 3,
        cdataSectionNode: 4,
        entityReferenceNode: 5,
        entityNode: 6,
        processingInstructionNode: 7,
        commentNode: 8,
        documentNode: 9,
        documentTypeNode: 10,
        documentFragmentNode: 11,
        notationNode: 12
    };

    // TtmlParser Class
    var TtmlParser = WinJS.Class.define(function () {
        /// <summary>
        ///     Parses a TTML file per the W3C specification: http://www.w3.org/TR/ttaf1-dfxp/
        ///     Based on a library written by Sean Hayes.
        /// </summary>

        if (!(this instanceof PlayerFramework.TimedText.TtmlParser)) {
            throw invalidConstruction;
        }

        this.options = {
            xmlNamespace: "http://www.w3.org/XML/1998/namespace",
            xhtmlNamespace: "http://www.w3.org/1999/xhtml",
            ttmlNamespace: "http://www.w3.org/ns/ttml",
            ttmlStyleNamespace: "http://www.w3.org/ns/ttml#styling",
            ttmlMetaNamespace: "http://www.w3.org/ns/ttml#metadata",
            ttmlNamespaceOld: "http://www.w3.org/2006/10/ttaf1",
            ttmlStyleNamespaceOld: "http://www.w3.org/2006/10/ttaf1#styling",
            ttmlMetaNamespaceOld: "http://www.w3.org/2006/10/ttaf1#metadata",
            smpteNamespace: "http://www.smpte-ra.org/schemas/2052-1/2010/smpte-tt",
            audioNamespace: "http://www.microsoft.com/enable#media",
            trackIdPrefix: "",
            mediaFrameRate: 30,
            mediaFrameRateMultiplier: 1,
            mediaSubFrameRate: 1,
            mediaTickRate: 1000,
            mediaStart: 0,
            mediaDuration: Math.pow(2, 53), // maximum JavaScript integer
            clockTime: /^(\d{2,}):(\d{2}):(\d{2})((?:\.\d{1,})|:(\d{2,}(?:\.\d{1,})?))?$/, // hours ":" minutes ":" seconds ( fraction | ":" frames ( "." sub-frames )? )?
            offsetTime: /^(\d+(\.\d+)?)(ms|[hmsft])$/ // time-count fraction? metric
        };

        this.root = null;
        this.layout = null;
        this.head = null;
        this.body = null;
        this.regions = null;

        // True unless we see a region definition in the TTML.
        this.usingDefaultRegion = true;

        // Ordered list of events containing times (in ms) and corresponding element.
        this.ttmlEvents = [];

        // List of audio descriptions.
        this.descriptions = [];

        // List of cues.
        this.cues = [];

        // Tree of navigation points.
        this.navigation = null;

        // Store styles here because IE doesn't support expandos on XML elements.
        this.styleSetCache = {};
        this.styleSetId = 0;

        // SMPTE-TT image support.
        this.imageCache = {};

        // Keep track of the rightmost element at each level, so that we can include left and right links.
        this.rightMostInLevel = [];
    }, {
        parseTtml: function (document, startTime, endTime) {
            // Parse an XML document and returns its TTML captions, audio descriptions, and navigation points.
            if (startTime === undefined) startTime = this.options.mediaStart;
            if (endTime === undefined) endTime = this.options.mediaDuration;

            // Find the tt root node.
            this.root = this.getElementByTagNameNS(document, "tt", this.options.ttmlNamespace);
            if (!this.root) {
                this.options.ttmlNamespace = this.options.ttmlNamespaceOld;
                this.options.ttmlStyleNamespace = this.options.ttmlStyleNamespaceOld;
                this.options.ttmlMetaNamespace = this.options.ttmlMetaNamespaceOld;
                this.root = this.getElementByTagNameNS(document, "tt", this.options.ttmlNamespace);
            }

            if (this.root) {
                // Find the head, body, and layout nodes.
                this.head = this.getElementByTagNameNS(this.root, "head", this.options.ttmlNamespace);
                this.body = this.getElementByTagNameNS(this.root, "body", this.options.ttmlNamespace);
                this.layout = this.head ? this.getElementByTagNameNS(this.head, "layout", this.options.ttmlNamespace) : null;

                // TTML that doesn't declare any layout regions uses a default region.
                if (this.layout) {
                    this.regions = this.getElementsByTagNameNS(this.layout, "region", this.options.ttmlNamespace);
                    this.usingDefaultRegion = (this.regions.length === 0);
                } else {
                    this.regions = [];
                    this.usingDefaultRegion = true;
                }

                // Load SMPTE images.
                this.imageCache = {};

                this.getElementsByTagNameNS(this.root, "image", this.options.smpteNamespace).forEach(function (image) {
                    var id = this.getAttributeNS(image, "id", this.options.xmlNamespace);
                    if (id !== null) this.imageCache["#" + id] = image.textContent;
                }, this);

                // Apply the style inheritance over the tree.
                this.applyStyling();

                // Apply the time intervals over the tree.
                this.applyTiming(this.root, { first: startTime, second: endTime }, true);

                // Use the time containment as a structured navigation map.
                this.navigation = this.getNavigation(this.body);

                // Get the cues.
                this.cues = this.getCues();
            }
        },

        //[N] - (hopefuly) temporary fix for having multiple captions at the same time
        // this causes multiple identical cues to be created with different times
        // it works - but there has to be a beter way
        timeList: [],

        compareTicks: function (a, b) {
            var result = a - b;
            return result;
        },

        getCorrectTime: function (tick) {
            while (!PlayerFramework.Utilities.binaryInsert(this.timeList, tick, this.compareTicks)) {
                tick += 0.01;
            };
            return tick;
        },

        applyTiming: function (element, bound, isParallelContext) {
            // Walk the tree to determine the absolute start and end times of all the
            // elements using the TTML subset of the SMIL timing model.
            // The reference times passed in "bound" are absolute times, the result of
            // calling this is to set the local start time and end time to absolute times
            // between these two reference times, based on the begin, end and dur attributes
            // and to recursively set all of the children.

            var startTime, endTime;
            var beginAttr = this.getAttributeNS(element, "begin", this.options.ttmlNamespace);
            var durAttr = this.getAttributeNS(element, "dur", this.options.ttmlNamespace);
            var endAttr = this.getAttributeNS(element, "end", this.options.ttmlNamespace);

            if (beginAttr !== null) {
                // Begin attested.
                startTime = bound.first + this.getTime(beginAttr); // extra time added to fix cues that begin exactly when the previous cue ends
                startTime = this.getCorrectTime(startTime);
                // this.startTimeList.push(startTime);
            } else {
                startTime = bound.first;
            }

            if (durAttr !== null && endAttr !== null) {
                // Both dur and end attested, the minimum interval applies.
                endTime = Math.min(Math.min(startTime + this.getTime(durAttr), bound.first + this.getTime(endAttr)), bound.second);
                endTime = this.getCorrectTime(endTime);
            } else if (endAttr !== null) {
                // Only end attested.
                endTime = Math.min(bound.first + this.getTime(endAttr), bound.second);
                endTime = this.getCorrectTime(endTime);
            } else if (durAttr !== null) {
                // Only dur attested.
                endTime = Math.min(startTime + this.getTime(durAttr), bound.second);
                endTime = this.getCorrectTime(endTime);
            } else {
                // No direct timing attested, so use default based on context.
                // "par" children have indefinite default duration, truncated by bounds.
                // "seq" children have zero default duration.
                if (isParallelContext) {
                    if (startTime <= bound.second) {
                        endTime = bound.second;
                    } else {
                        endTime = 0;
                    }
                }
            }

            if (endTime < startTime) {
                endTime = startTime;
            }

            element.setAttribute("data-time-start", startTime);
            element.setAttribute("data-time-end", endTime);

            PlayerFramework.Utilities.binaryInsert(this.ttmlEvents, { tick: startTime, elementScope: element }, this.compareTtmlEvents);
            PlayerFramework.Utilities.binaryInsert(this.ttmlEvents, { tick: endTime, elementScope: element }, this.compareTtmlEvents);

            if (this.getAttributeNS(element, "role", this.options.ttmlMetaNamespace)) {
                var uri = this.getAttributeNS(element, "audio", this.options.audioNamespace);
                if (uri) {
                    this.descriptions.push({
                        uri: uri,
                        startTime: startTime,
                        endTime: endTime
                    });
                    this.descriptions.sort(this.compareDescriptions);
                }
            }

            var seqStartTime = startTime;
            var timeContext = this.getAttributeNS(element, "timeContainer", this.options.ttmlNamespace);

            this.getChildElements(element).forEach(function (childElement) {
                if (timeContext !== "seq") {
                    this.applyTiming(childElement, { first: startTime, second: endTime }, true);
                } else {
                    this.applyTiming(childElement, { first: seqStartTime, second: endTime }, false);
                    seqStartTime = new Number(this.getAttribute(childElement, "data-time-end"));
                }
            }, this);
        },

        getTime: function (timeExpression) {
            // Utility object to handle TTML time expressions. Could be improved, but seems to do the job.
            // In particular, we are not currently handling TTML parameters for tick rate and so on.

            // NOTE: IE cannot parse time formats containing frames (e.g. "00:00:04.18" works, but not "00:00:04:18")
            // To overlay custom and native captions for testing purposes, use the CaptionsPlugin.displayMode option.

            var v1 = this.options.clockTime.exec(timeExpression);
            var v2 = this.options.offsetTime.exec(timeExpression);

            if (v1 != null) {
                var hours = new Number(v1[1]);
                var minutes = new Number(v1[2]);
                var seconds = new Number(v1[3]);
                var frames = 0;

                if (!isNaN(v1[4])) {
                    seconds += new Number(v1[4]);
                }

                if (!isNaN(v1[5])) {
                    frames = new Number(v1[5]);
                }

                return hours * this.getMetricMultiplier("h") + minutes * this.getMetricMultiplier("m") + seconds * this.getMetricMultiplier("s") + frames * this.getMetricMultiplier("f");
            } else if (v2 != null) {
                return new Number(v2[1]) * this.getMetricMultiplier(v2[3]);
            } else {
                return 0;
            }
        },

        getMetricMultiplier: function (timeExpression) {
            switch (timeExpression) {
                case "h":
                    return 1000 * 60 * 60;
                case "m":
                    return 1000 * 60;
                case "s":
                    return 1000;
                case "ms":
                    return 1;
                case "f":
                    return 1000 / this.options.mediaFrameRate;
                case "t":
                    return 1000 / this.options.mediaTickRate;
                default:
                    return 0;
            }
        },

        compareTtmlEvents: function (a, b) {
            // Compare TTML events for sorting purposes.
            var result = a.tick - b.tick;
            //if (result === 0 && a.elementScope !== b.elementScope) {
            //    return 1;
            //}
            return result;
        },

        compareDescriptions: function (a, b) {
            // Compare descriptions for sorting purposes.

            return a.startTime - b.startTime;
        },

        getNavigation: function (element) {
            // Navigation elements are marked with the extensions role="x-nav-..."
            // We want to find the lists of nav-labels, where each label goes in the right level of list.
            // The structure of this is loosely based on daisy NCK files.

            return this.getNavigationPoint(element, null, 0);
        },

        getNavigationList: function (element, parent, level) {
            // A nav list is supposed to be a list of nav points, but a nav point can be a degenerate nav label.

            var list = [];
            var role = this.getAttributeNS(element, "role", this.options.ttmlMetaNamespace);

            if (role !== null && !PlayerFramework.Utilities.first(role, function (r) { return r === "x-nav-list"; })) {
                var childElements = this.getChildElements(element);
                for (var i = 0; i < childElements.length; i++) {
                    var point = this.getNavigationPoint(childElements[i], parent, level);
                    if (point != null) {
                        list.push(point);
                    }
                }
            }

                return list;
        },

        getNavigationPoint: function (element, parent, level) {
            // A nav point is an element tagged with the x-nav-point role, containing one label, and one list.
            // If the list is empty, then the label can stand on its own for the whole point.

            var label = null;
            var subtree = [];
            var node = {};

            // Keep the high tide mark for how deep in the tree we are.
            if (this.rightMostInLevel.length <= level) {
                this.rightMostInLevel.push(null);
            }

            var role = this.getAttributeNS(element, "role", this.options.ttmlMetaNamespace);

            switch (role) {
                case "x-nav-label": // Degenerate form.
                    label = this.getNavigationLabel(element);
                    break;
                case "x-nav-point": // Full form contains a label and a list.
                    this.getChildElements(element).forEach(function (childElement) {
                        var childRole = this.getAttributeNS(childElement, "role", this.options.ttmlMetaNamespace);
                        switch (childRole) {
                            // Should only be one of each. but allow last to win.
                            case "x-nav-label":  // Contains text, and use its timing.
                                label = this.getNavigationLabel(childElement);
                                break;
                            case "x-nav-list":   // Contains either a list of navPoints.
                                subtree = this.getNavigationList(childElement, node, level + 1);
                                break;
                            default:
                                break;
                        }
                    }, this);
                    break;
                default:
                    break;  // Ignore anything else.
            }

            if (label !== null) {
                node.text = label.text;
                node.startTime = new Number(label.startTime) / 1000 + 0.01;
                node.endTime = new Number(label.endTime) / 1000;
                node.parent = parent;
                node.left = this.rightMostInLevel[level];
                node.right = null;
                node.children = subtree;

                if (this.rightMostInLevel[level] !== null) {
                    this.rightMostInLevel[level].right = node;
                }

                this.rightMostInLevel[level] = node;

                return node;
            } else {
                return null;
            }
        },

        getNavigationLabel: function (element) {
            // A nav label is just text, but we use its timing to create an interval into the media for navigation.

            var role = this.getAttributeNS(element, "role", this.options.ttmlMetaNamespace);

            if (role !== null && !PlayerFramework.Utilities.first(role, function (r) { return r === "x-nav-label"; })) {
                return {
                    text: element.innerHTML,
                    startTime: this.getAttribute(element, "data-time-start"),
                    endTime: this.getAttribute(element, "data-time-end")
                };
            }
        },

        getCues: function () {
            // Get all cues for the set of TTML events.
            // Unroll using ttmlEvents and getCuesAtTime.
            // This then makes it easier to use the <track> APIs and also use the same interface for WebVTT, SRT etc.

            var cues = [];

            for (var i = 0; i < this.ttmlEvents.length; i++) {
                var ttmlEvent = this.ttmlEvents[i];

                if (ttmlEvent.elementScope === this.root) {
                    continue;
                }

                var ttmlEventCues = this.getCuesAtTime(ttmlEvent.elementScope, ttmlEvent.tick);

                if (i > 0) {
                    for (var j = i - 1; j >= 0; j--) {
                        var previousTtmlEvent = this.ttmlEvents[j];

                        if (previousTtmlEvent.elementScope === this.root || previousTtmlEvent.elementScope === ttmlEvent.elementScope) {
                            continue;
                        }

                        var overlappingCues = this.getCuesAtTime(previousTtmlEvent.elementScope, ttmlEvent.tick);

                        if (overlappingCues.length > 0) {
                            ttmlEventCues.push(overlappingCues[0]);
                        }
                        else {
                            break;
                        }
                    }
                }

                for (var k = 0; k < ttmlEventCues.length; k++) {
                    var ttmlEventCue = ttmlEventCues[k];
                    var nextTtmlEvent = this.ttmlEvents[i + 1];

                    cues.push({
                        cue: ttmlEventCue,
                        startTime: ttmlEvent.tick / 1000,
                        endTime: (nextTtmlEvent) ? nextTtmlEvent.tick / 1000 : this.options.mediaDuration
                    });
                }
            }

            return cues;
        },

        getCuesAtTime: function (element, tick) {
            // Get cues for a given time instant.

            var cues = [];

            if (element && this.isTemporallyActive(element, tick)) {
                if (!this.usingDefaultRegion) {
                    this.regions.forEach(function (region) {
                        var cueElement = this.translateMarkup(region, tick);

                        if (cueElement) {
                            // Create a new subtree for the body element, prune elements not associated
                            // with the region, and if it's not empty then select it into this region by
                            // adding it to cue element container.

                            var regionId = this.getAttributeNS(region, "id", this.options.xmlNamespace);
                            var prunedElement = this.prune(element, regionId, tick);

                            if (prunedElement) {
                                cueElement.appendChild(prunedElement);
                            }

                            if (cueElement.getAttribute("data-showBackground") !== "whenActive" && cueElement.innerHTML.trim() !== "") {
                                cues.push(cueElement);
                            }
                        }
                    }, this);
                } else {
                    var cueElement = document.createElement("div");
                    cueElement.className = "pf-cue";

                    var prunedElement = this.prune(element, "", tick);

                    if (prunedElement) {
                        cueElement.appendChild(prunedElement);
                    }

                    if (this.getChildElements(cueElement).length > 0) {
                        cues.push(cueElement);
                    }
                }
            }

            return cues;
        },

        isTemporallyActive: function (element, tick) {
            var startTime = Math.round(1000 * parseFloat(this.getAttribute(element, "data-time-start"))) / 1000;
            var endTime = Math.round(1000 * parseFloat(this.getAttribute(element, "data-time-end"))) / 1000;
            var time = Math.round(1000 * tick) / 1000;

            return (startTime <= time) && (endTime > time);
        },

        translateMarkup: function (element, tick) {
            // Convert elements in TTML to their equivalent in HTML.

            var translation;
            var name = this.getTagNameEquivalent(element);
            var htmlName = "";
            var htmlClass = "";
            var htmlAttrs = {};

            if (element && this.isTemporallyActive(element, tick)) {
                switch (name) {
                    case "tt:region":
                    case "tt:tt": // We get this if there is no region.
                        htmlClass = "pf-cue "; // To simulate the ::cue selector.
                        htmlName = "div";
                        break;
                    case "tt:body":
                    case "tt:div":
                        htmlName = "div";
                        break;
                    case "tt:p":
                        htmlName = "p";
                        break;
                    case "tt:span":
                        htmlName = "span";
                        break;
                    case "tt:br":
                        htmlName = "br";
                        break;
                    case "":
                        break;
                    default:
                        htmlName = name;
                        Array.prototype.forEach.call(element.attributes, function (attribute) { htmlAttrs[attribute.name] = attribute.value; });
                        break;
                }

                var roleAttr = this.getAttributeNS(element, "role", this.options.ttmlMetaNamespace);
                if (roleAttr) htmlClass += roleAttr + " ";

                var classAttr = this.getAttributeNS(element, "class", this.options.xhtmlNamespace);
                if (classAttr) htmlClass += classAttr + " ";

                // Hack until display:ruby on other elements works.
                if (roleAttr === "x-ruby") htmlName = "ruby";
                if (roleAttr === "x-rubybase") htmlName = "rb";
                if (roleAttr === "x-rubytext") htmlName = "rt";

                // Convert image based captions here; and move the text into its alt.
                // If I could get inline CSS to work div's then this would be set as style.
                var imageAttr = this.getAttribute(element, "image");
                if (imageAttr !== null) htmlName = "img";

                if (htmlName !== "") {
                    translation = document.createElement(htmlName);
                    translation.className = htmlClass.trim();

                    // Move ID's over. Use trackIdPrefix to ensure there are no name clases on id's already in target doc.
                    var idAttr = this.getAttributeNS(element, "id", this.options.xmlNamespace);
                    if (idAttr) translation.setAttribute("id", this.options.trackIdPrefix + idAttr);

                    // [N] added max width
                    translation.style.maxWidth = '100%';

                    // [N] remove margin
                    translation.style.margin = '0px';

                    // Copy style from element over to html, translating into CSS as we go
                    this.translateStyle(element, translation, tick);

                    // If we are copying over html elements, then copy any attributes too.
                    for (var attr in htmlAttrs) {
                        translation.setAttribute(attr, htmlAttrs[attr]);
                    }

                    if (imageAttr !== null) {
                        translation.setAttribute("src", imageAttr);
                        translation.setAttribute("alt", element.innerHTML);
                    }
                }
            }

            return translation;
        },

        translateStyle: function (element, htmlElement, tick) {
            // Convert from TTML style names to CSS.

            // Clone of the base style set.
            var computedStyleSet = {};
            var styles = this.styleSetCache[this.getAttribute(element, "__styleSet__")];

            for (var name in styles) {
                computedStyleSet[name] = styles[name];
            }

            // Apply inline styles.
            this.getElementsByTagNameNS(element, "set", this.options.ttmlNamespace).forEach(function (childElement) {
                if (this.isTemporallyActive(childElement, tick)) {
                    this.applyInlineStyles(childElement, computedStyleSet);
                }
            }, this);

            // Apply CSS styles.
            for (var name in computedStyleSet) {
                var value = computedStyleSet[name];
                switch (name) {
                    case "displayAlign":
                        // [N] moved textAlign and added display Align
                        htmlElement.style.display = "-ms-flexbox";
                        htmlElement.style.msFlexDirection = "column";
                        switch (value) {
                            case "before":
                                htmlElement.style.msFlexPack = "start";
                                break;
                            case "center":
                                htmlElement.style.msFlexPack = "center";
                                break;
                            case "after":
                                htmlElement.style.msFlexPack = "end";
                                break;
                            default:
                                htmlElement.style.msFlexPack = "start";
                                break;
                        }
                        break;
                    case "wrapOption":
                        htmlElement.style.whiteSpace = (value === "nowrap") ? "nowrap" : "normal";
                        break;
                    case "textAlign":
                        htmlElement.style.textAlign = value;
                        switch (value) {
                            case "left":
                                htmlElement.style.msFlexAlign = "start";
                                break;
                            case "center":
                                htmlElement.style.msFlexAlign = "center";
                                break;
                            case "right":
                                htmlElement.style.msFlexAlign = "end";
                                break;
                            default:
                                htmlElement.style.msFlexAlign = "start";
                                break;
                        }
                        break;
                    case "fontFamily":
                        // [N] - added font family
                        var font = value.toLowerCase();
                        var defaultFontSize = computedStyleSet.fontSize;
                        switch (font) {


                            case "default":
                                htmlElement.style.fontFamily = '"Segoe UI", "Ebrima", "Nirmala UI", "Gadugi", "Segoe Xbox Symbol", "Segoe UI Symbol", "Meiryo UI", "Khmer UI", "Tunga", "Lao UI", "Raavi", "Iskoola Pota", "Latha", "Leelawadee", "Microsoft YaHei UI", "Microsoft JhengHei UI", "Malgun Gothic", "Estrangelo Edessa", "Microsoft Himalaya", "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Tai Le", "Microsoft Yi Baiti", "Mongolian Baiti", "MV Boli", "Myanmar Text", "Cambria Math"';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "monospace":
                                htmlElement.style.fontFamily = 'Courier New';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "sansserif":
                                htmlElement.style.fontFamily = 'Tahoma';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "serif":
                                htmlElement.style.fontFamily = 'Times New Roman';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "monospacesansserif":
                                htmlElement.style.fontFamily = 'Lucida Console';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "monospaceserif":
                                htmlElement.style.fontFamily = 'Courier New';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "proportionalsansserif":
                                htmlElement.style.fontFamily = 'Tahoma';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "proportionalserif":
                                htmlElement.style.fontFamily = 'Times New Roman';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "casual":
                                htmlElement.style.fontFamily = 'Comic Sans MS';
                                htmlElement.style.fontVariant = 'normal';
                                break;

                            case "cursive":
                                htmlElement.style.fontFamily = 'Segoe Script';
                                htmlElement.style.fontVariant = 'normal';
                                htmlElement.style.lineHeight = '1.38';
                                if (!computedStyleSet.fontSize) { htmlElement.style.fontSize = '84%'; }
                                break;

                            case "smallcaps":
                                htmlElement.style.fontFamily = 'Trebuchet MS';
                                htmlElement.style.fontVariant = 'small-caps';
                                break;
                            case "webdings":
                                htmlElement.style.fontFamily = 'Webdings';
                                htmlElement.style.fontVariant = 'normal';
                                break;
                            default:
                                htmlElement.style.fontFamily = '"Segoe UI", "Ebrima", "Nirmala UI", "Gadugi", "Segoe Xbox Symbol", "Segoe UI Symbol", "Meiryo UI", "Khmer UI", "Tunga", "Lao UI", "Raavi", "Iskoola Pota", "Latha", "Leelawadee", "Microsoft YaHei UI", "Microsoft JhengHei UI", "Malgun Gothic", "Estrangelo Edessa", "Microsoft Himalaya", "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Tai Le", "Microsoft Yi Baiti", "Mongolian Baiti", "MV Boli", "Myanmar Text", "Cambria Math"';
                                htmlElement.style.fontVariant = 'normal';
                                break;
                        }
                        break;

                    case "fontSize":
                        if (value.charAt(value.length - 1) === '%') {
                            var percentValue = parseInt(value.substr(0, value.length - 1), 10);

                            if (computedStyleSet.fontFamily && computedStyleSet.fontFamily === "cursive") {
                                percentValue = percentValue * 0.84;
                                htmlElement.style.lineHeight = '1.38';
                            }

                            htmlElement.style.fontSize = percentValue + "%";
                        }
                        break;

                    default:
                        htmlElement.style[name] = value;
                        break;
                }
            }
        },

        // [N] - fix for body styles not applied
        _bodyElem: null,

        applyBodyStyles: function (body) {
            if (!this._bodyElem || !body) return;
            this.translateStyle(this._bodyElem, body, null);
        },

        applyStyling: function () {
            // Apply styling to every element in the body.
            var nodes = this.root.getElementsByTagName("*");

            for (var i = 0; i < nodes.length; i++) {
                this.applyStyle(nodes[i]);
                if (nodes[i].localName === 'body') {
                    this._bodyElem = nodes[i];
                }
            }
        },

        applyStyle: function (element) {
            // Apply styles in the correct order to element.

            var styleSet = {};

            // Find all the applicable styles and set them as properties on styleSet.
            this.applyStylesheet(element, styleSet);
            this.applyInlineStyles(element, styleSet);

            // Record the applied set to the element
            this.styleSetCache[this.styleSetId] = styleSet;
            element.setAttribute("__styleSet__", this.styleSetId++);
        },

        applyStylesheet: function (element, styleSet) {
            // For each style id on element, find the corresponding style element
            // and then apply the stylesheet into styleset; this recurses over the tree of referenced styles.

            var styleAttr = this.getAttributeNS(element, "style", this.options.ttmlNamespace);

            if (styleAttr !== null) {
                var styleIds = styleAttr.split(/\s/); // Find all the style ID references.
                var isStyleElement = this.hasTagNameNS(element, "style", this.options.ttmlNamespace); // Detect if we are referencing style from a style.

                styleIds.forEach(function (styleId) {
                    // Find all the style elements in the TTML namespace.
                    this.getElementsByTagNameNS(this.head, "style", this.options.ttmlNamespace).forEach(function (styleElement) {
                        if (this.getAttributeNS(styleElement, "id", this.options.xmlNamespace) === styleId) {
                            this.applyStylesheet(styleElement, styleSet);

                            // If the element is region, do nested styles (note regions can only be referenced from elements in the body).
                            if (!isStyleElement && this.hasTagNameNS(styleElement, "region", this.options.ttmlNamespace)) {
                                this.getElementsByTagNameNS(styleElement, "style", this.options.ttmlNamespace).forEach(function (childElement) {
                                    this.applyStylesheet(childElement, styleSet);
                                }, this);
                            }

                            // Do inline styles.
                            this.applyInlineStyles(styleElement, styleSet);
                        }
                    }, this);
                }, this);
            }
        },

        applyInlineStyles: function (element, styleSet) {
            // Apply style attributes into styleset.

            Array.prototype.forEach.call(element.attributes, function (attribute) {
                var ns = this.getNamespace(attribute);
                if (ns === this.options.ttmlStyleNamespace) {
                    styleSet[this.getLocalTagName(attribute)] = attribute.nodeValue;
                }
                else if (ns === this.options.smpteNamespace && this.getLocalTagName(attribute) === "backgroundImage") {
                    var imageId = attribute.nodeValue;
                    if (imageId.indexOf("#") === 0) {
                        element.setAttribute("image", "data:image/png;base64," + this.imageCache[imageId]);
                    } else {
                        element.setAttribute("image", imageId);
                    }
                }
            }, this);
        },

        isInRegion: function (element, regionId) {
            // A content element is associated with a region according to the following ordered rules,
            // where the first rule satisfied is used and remaining rules are skipped:

            // Quick test: Out of normal order, but makes following rules simpler.
            if (regionId === "" || regionId === undefined) {
                return this.usingDefaultRegion;
            }

            // 1. If the element specifies a region attribute, then the element is associated with the
            // region referenced by that attribute;
            if (this.getAttributeNS(element, "region", this.options.ttmlNamespace) === regionId) {
                return true;
            }

            // 2. If some ancestor of that element specifies a region attribute, then the element is
            // associated with the region referenced by the most immediate ancestor that specifies
            // this attribute;
            var ancestor = element.parentNode;
            while (ancestor !== null && ancestor.nodeType === nodeType.elementNode) {
                var id = this.getAttributeNS(ancestor, "region", this.options.ttmlNamespace);
                if (id) return id === regionId;
                ancestor = ancestor.parentNode;
            }

            // 3. If the element contains a descendant element that specifies a region attribute,
            // then the element is associated with the region referenced by that attribute;
            var nodes = element.getElementsByTagName("*");
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (this.getAttributeNS(node, "region", this.options.ttmlNamespace) === regionId && this.getNamespace(node) === this.options.ttmlNamespace) {
                    return true;
                }
            }

            // 4. If a default region was implied (due to the absence of any region element), then
            // the element is associated with the default region;
            if (this.usingDefaultRegion) {
                return regionId === "";
            }

            // 5. The element is not associated with any region.
            return false;
        },

        prune: function (element, regionId, tick) {
            /// Convert the element if it is in the region, then recurse into its contents.
            /// If it ends up with no children, then we dont add it to the region.

            var clone = undefined;

            if (this.isInRegion(element, regionId)) {
                clone = this.translateMarkup(element, tick);

                if (!clone) {
                    return clone;
                }

                for (var i = 0; i < element.childNodes.length; i++) {
                    var childElement = element.childNodes[i];
                    if (childElement.nodeType !== nodeType.commentNode) {
                        if (childElement.nodeType === nodeType.textNode) {
                            clone.appendChild(document.createTextNode(childElement.data));
                        } else {
                            var prunedChildElement = this.prune(childElement, regionId, tick);
                            if (prunedChildElement) {
                                clone.appendChild(prunedChildElement);
                            }
                        }
                    }
                }
            }

            return clone;
        },

        getTagNameEquivalent: function (element) {
            var name = this.getLocalTagName(element);

            switch (this.getNamespace(element)) {
                case this.options.xhtmlNamespace:
                    return name;
                case this.options.ttmlNamespace:
                    return "tt:" + name;
                case this.options.smpteNamespace:
                    return "smpte:" + name;
                default:
                    return "";
            }
        },

        getLocalTagName: function (element) {
            if (element.localName) {
                return element.localName;
            } else {
                return element.baseName;
            }
        },

        hasTagNameNS: function (element, name, namespace) {
            if (element.localName) {
                return (name === element.localName && this.getNamespace(element) === namespace);
            } else {
                return (name === element.baseName && this.getNamespace(element) === namespace);
            }
        },

        getElementByTagNameNS: function (element, name, namespace) {
            return this.getElementsByTagNameNS(element, name, namespace)[0] || null;
        },

        getElementsByTagNameNS: function (element, name, namespace) {
            if (element.getElementsByTagNameNS) {
                return PlayerFramework.Utilities.getArray(element.getElementsByTagNameNS(namespace, name));
            }
            else {
                return PlayerFramework.Utilities.getArray(element.getElementsByTagName(name)).filter(function (element) { return element.namespaceUri === namespace; });
            }
        },

        getAttributeNS: function (element, name, namespace) {
            var result = element.getAttributeNS(namespace, name);
            if (result === "") {
                result = this.getAttribute(element, name);
            }
            return result;
        },

        getAttribute: function (element, name) {
            if (element.nodeType === nodeType.elementNode) {
                var value = element.getAttribute(name);

                if (value) {
                    return value;
                } else if (element.prefix) {
                    // Bug in Encoder moves unprefixed attributes
                    return element.getAttribute(element.prefix + ":" + name);
                }
            }

            return null;
        },

        getNamespace: function (element) {
            return (element.namespaceUri) ? element.namespaceUri : element.namespaceURI;
        },

        getChildElements: function (element) {
            var childElements = [];

            for (var childElement = element.firstChild; childElement; childElement = childElement.nextSibling) {
                if (childElement.nodeType === nodeType.elementNode) {
                    childElements.push(childElement);
                }
            }

            return childElements;
        }
    });

    // TtmlParser Exports
    WinJS.Namespace.define("PlayerFramework.TimedText", {
        TtmlParser: TtmlParser
    });

})(PlayerFramework);


(function captionsManagerInit() {
    'use strict';
    var failedCounter = 0;
    var captionsArray = WinJS.Class.define(function () {
        this._table = {};
    }, {
        insert: function (startTime, endTime, value) {
            if (endTime < startTime) return;
            var start = Math.floor(startTime);
            var end = Math.ceil(endTime);
            var length = end - start;
            for (var i = 0; i < length; i++) {
                this._insertTable(start + i, value);
            }
        },

        get: function (time) {
            console.log(Object.keys(this._table).length);
            var key = Math.floor(time).toString(), val;
            if (this._table[key]) {
                failedCounter = 0;
                console.log("GOTGOT Chunk [" + key + "]");
                if (this.prev && key != this.prev) {
                    if (this._table.hasOwnProperty(this.prev)) {
                        delete this._table[this.prev];
                    }
                }
                this.prev = key;
                return this._table[key];
            } else {
                failedCounter++;
                if (failedCounter > 50) {
                    console.log("More than fifty failed chunks");
                }
                console.log("FAILED Chunk [" + key + "]");
                return null;
            }
        },

        _insertTable: function (key, value) {
            var _key = key.toString();
            if (!this._table[_key]) {
                this._table[_key] = new Array();
            } else {
                for (var i = 0; i < this._table[_key].length; i++) {
                    if (this._table[_key][i].cue === value.cue) return;
                }
            }
            this._table[_key].push(value);
            console.log("Adding Chunk [" + _key + "]");
        },

        dispose: function () {
            for (var property in this._table) {
                if (this._table.hasOwnProperty(property)) {
                    delete this._table[property];
                }
            }
        }
    }, {

    });

    var captionsManager = WinJS.Class.define(function (streamManager) {
        this._streamManager = streamManager;

        this._onVideoTimeUpdateBind = this._onVideoTimeUpdate.bind(this);
        this._manifestReadyHandlerBind = this._manifestReadyHandler.bind(this);
        this._streamDataReceivedHandlerBind = this._streamDataReceivedHandler.bind(this);
        //this._managerTimeChangedBind = this._managerTimeChanged.bind(this);
        this._managerClosedBind = this._managerClosed.bind(this);
        this._managerEndOfLiveBind = this._managerEndOfLive.bind(this);
        this._managerStateChangedBind = this._managerStateChanged.bind(this);
        this._handleWindowResizeBind = this._handleWindowResize.bind(this);

        this._streamManagerPort = new Steve.StreamManagerPort(streamManager, this); //A
    }, {
        _streamManager: null,
        _mediaPlayer: null,
        _videoElement: null,

        _captionsDiv: null,
        _viewBoxDiv: null,

        _currentTrackIndex: -1,

        _isLive: false,
        _liveTime: null,
        _startTime: 0,
        _endTime: 0,

        isLive: {
            get: function () {
                return _isLive;
            }
        },

        currentTrackIndex: {
            get: function () {
                return this._currentTrackIndex;
            },
            set: function (value) {
                this._updateTrackAsync(value);
            }
        },

        _updateTrackAsync: function (value) {
            var that = this;
            return new WinJS.Promise(function (complete, error) {

                var oldIndex = that._currentTrackIndex; //A BELOW
                if (value >= 0 && value < that._streamManagerPort.availableCaptionStreams.length) {
                    that._streamManagerPort.setSelectedCaptionStream(that._streamManagerPort.availableCaptionStreams[value]);
                    that._currentTrackIndex = value;
                    that._updateTrackCaptionsAsync(oldIndex);
                    complete();
                } else if (value === null || value < 0) {
                    that._streamManagerPort.setSelectedCaptionStream(null); //A END
                    that._currentTrackIndex = -1;
                    that._updateTrackCaptionsAsync(oldIndex);
                    complete();
                } else {
                    error();
                }
            });
        },

        _tracks: null,

        tracks: {
            get: function () {
                return this._tracks;
            }
        },

        _onVideoTimeUpdateBind: null,

        _onVideoTimeUpdate: function (e) {
            this._updateTrackCaptionsAsync(this._currentTrackIndex);
        },

        _activeCaptions: new Array(),

        _addCaption: function addCaption(caption) {
            if (this._activeCaptions.indexOf(caption) === -1) {
                this._captionsDiv.appendChild(caption.cue);
                this._activeCaptions.push(caption);
            }
        },

        _updateActiveCaptions: function updateActiveCaptions(currentTime) {
            // set style if not default captioning
            var captionOptions = Windows.Xbox.System.ClosedCaptions.ClosedCaptionProperties;

            this._setCaptionStyle();

            for (var i = this._activeCaptions.length - 1; i >= 0; i--) {
                if (currentTime < this._activeCaptions[i].startTime || //!captionOptions.isEnabled || 
                    currentTime > this._activeCaptions[i].endTime) {
                    try {
                        this._captionsDiv.removeChild(this._activeCaptions[i].cue);
                        this._activeCaptions.splice(i, 1);
                    } catch (e) { }
                }
            }
        },

        _updateTrackCaptionsAsync: function (trackIndex) {
            var that = this;
            return new WinJS.Promise(
                function (completed, error) {
                    var captionOptions = Windows.Xbox.System.ClosedCaptions.ClosedCaptionProperties;
                    if (//captionOptions.isEnabled &&
                        that.isActive &&
                        that.tracks &&
                        trackIndex >= 0 &&
                        trackIndex === that.currentTrackIndex) {

                        var time = that._videoElement.currentTime;
                        var captions = that._tracks[trackIndex].cues.get(Math.floor(time));

                        if (captions) {
                            var filteredCaptions = captions.filter(function (elem) {
                                return elem.startTime < time && elem.endTime > time;
                            });
                            for (var i = 0; i < filteredCaptions.length; i++) {
                                that._addCaption(filteredCaptions[i]);
                            }
                        }

                    }
                    that._updateActiveCaptions(time);
                    completed();
                });
        },

        clearCaptions: function (trackIndex) {
            this._tracks.forEach(function (track) {
                track.cues.dispose();
            });
        },

        setVodClamps: function (start, end) {
            this._vodStart = start;
            this._vodEnd = end;
        },

        _manifestReadyHandlerBind: null,

        _manifestReadyHandler: function (e) {
            if (!this.tracks) {
                this._tracks = new Array();
            }
            //clear the array
            this._tracks.length = 0;

            this._streamManagerPort.gotManifest(e.target.manifest, this._vodStart, this._vodEnd);

            this._isLive = this._streamManagerPort.isLive; //A

            var noneTrack = {
                name: "Turn captions off",
                cues: new captionsArray(),
                track: this._streamManagerPort.availableCaptionStreams[0],
            };

            this._tracks.push(noneTrack);

            if (Array.isArray(this._streamManagerPort.availableCaptionStreams)) { //A
                for (var i = 0; i < this._streamManagerPort.availableCaptionStreams.length; i++) {
                    var track = {
                        name: this._streamManagerPort.availableCaptionStreams[i].name,
                        cues: new captionsArray(),
                        track: this._streamManagerPort.availableCaptionStreams[i],
                    };
                    this._tracks.push(track);
                }
            } //A

            //this._tracks.push({ //A
            //    name: "english",
            //    cues: new captionsArray(),
            //    track: e.target.manifest.availableStreams[3],
            //}); //A

            this.dispatchEvent("ready", {
                isLive: this._isLive,
                tracks: this._tracks
            });
        },

        _uintToString: function (uintArray) {
            var encodedString = String.fromCharCode.apply(null, uintArray),
                decodedString = decodeURIComponent(escape(encodedString));
            return decodedString;
        },

        _streamDataReceivedHandlerBind: null,

        _streamDataReceivedHandler: function (e) {
            var captionStream = this._streamManagerPort.selectedCaptionStream;
            if (this._currentTrackIndex != -1) { //A
                var ttmlDocument = new Windows.Data.Xml.Dom.XmlDocument();
                var ttml = this._uintToString(e.data);
                ttmlDocument.loadXml(ttml);

                var startTime = PlayerFramework.Utilities.convertTicksToMilliseconds(e.startTime);
                var endTime = PlayerFramework.Utilities.convertTicksToMilliseconds(e.endTime);

                var ttmlParser = new PlayerFramework.TimedText.TtmlParser();
                ttmlParser.parseTtml(ttmlDocument, startTime, endTime);
                console.log("**PARSED [" + startTime + "," + endTime + "] with " + ttmlParser.cues.length);

                for (var i = 0; i < ttmlParser.cues.length; i++) {
                    var cue = ttmlParser.cues[i];
                    this._tracks[this._currentTrackIndex].cues.insert(cue.startTime, cue.endTime, cue);
                }
            }
        },

        // used for setting style and checking if options have changed
        _currentCaptionClass: 'pf-captions-container',

        _setCaptionStyle: function () {
            var captionsOptions = Windows.Xbox.System.ClosedCaptions.ClosedCaptionProperties;
            var newClass = 'pf-captions-container';;

            //if (captionsOptions.useDefaultOptions) {
            //    newClass = 'pf-captions-container';
            //} else {
            //    var className = 'pf-captions-container';
            //    var fontClass = this._getFontClass(captionsOptions.fontStyle);
            //    var fontColorClass = this._getFontColorClass(captionsOptions.fontColor);
            //    var fontSizeClass = this._getFontSizeClass(captionsOptions.fontSize);
            //    var fontEffectClass = this._getFontEffectClass(captionsOptions.fontEdgeAttribute);
            //    var backgroundColorClass = this._getBackgroundColorClass(captionsOptions.backgroundColor);
            //    var windowColorClass = this._getWindowColorClass(captionsOptions.windowColor);

            //    newClass = className + ' ' +
            //                                  fontClass + ' ' +
            //                                  fontColorClass + ' ' +
            //                                  fontSizeClass + ' ' +
            //                                  fontEffectClass + ' ' +
            //                                  backgroundColorClass + ' ' +
            //                                  windowColorClass;
            //}

            if (newClass !== this._currentCaptionClass) {
                this._currentCaptionClass = newClass;
                this._captionsDiv.className = this._currentCaptionClass;
            }

        },

        _getFontEffectClass: function (enumValue) {
            switch (enumValue) {
                // Default
                // None
                case 0:
                case 1:
                    return 'pf-none-font-effect';

                    // Raised
                case 2:
                    return 'pf-raised-font-effect';

                    // Depressed
                case 3:
                    return 'pf-depressed-font-effect';

                    // Uniform
                case 4:
                    return 'pf-uniform-font-effect';

                    // Drop shadow
                case 5:
                    return 'pf-drop-shadow-font-effect';
            }
        },

        _getFontClass: function (enumValue) {
            switch (enumValue) {
                // Default
                case 0:
                    return 'pf-default-font';

                    // Monospace Serif
                case 1:
                    return 'pf-monospaceserif-font';

                    // Proportional Serif
                case 2:
                    return 'pf-proportionalserif-font';

                    // Monospace Sans Serif
                case 3:
                    return 'pf-monospacesandserif-font';

                    // Proportional Sans Serif
                case 4:
                    return 'pf-proportionalsansserif-font';

                    // Casual
                case 5:
                    return 'pf-casual-font';

                    // Cursive
                case 6:
                    return 'pf-cursive-font';

                    // SmallCaps
                case 7:
                    return 'pf-smallcaps-font';

                default:
                    return 'pf-default-font';
            }
        },

        _getFontColorClass: function (fontColor) {
            return 'pf-' + fontColor.r +
                     '-' + fontColor.g +
                     '-' + fontColor.b +
                     '-' + fontColor.a +
                     '-font-color';
        },

        _getBackgroundColorClass: function (fontColor) {
            return 'pf-' + fontColor.r +
                     '-' + fontColor.g +
                     '-' + fontColor.b +
                     '-' + fontColor.a +
                     '-background-color';
        },

        _getWindowColorClass: function (fontColor) {
            return 'pf-' + fontColor.r +
                     '-' + fontColor.g +
                     '-' + fontColor.b +
                     '-' + fontColor.a +
                     '-window-color';
        },

        _getFontSizeClass: function (enumValue) {
            switch (enumValue) {
                case 0:
                    return 'pf-100-font-size';
                case 1:
                    return 'pf-50-font-size';
                case 2:
                    return 'pf-75-font-size';
                case 3:
                    return 'pf-150-font-size';
                case 4:
                    return 'pf-200-font-size';
                default:
                    return 'pf-100-font-size';
            }
        },

        _managerClosedBind: null,

        _managerClosed: function (e) {
            this.deactivate();
            this.dispatchEvent("streamclosed", {});
        },

        _managerEndOfLiveBind: null,

        _managerEndOfLive: function (e) {
            this._liveTime = null;
            this._isLive = false;
        },

        _managerStateChangedBind: null,

        _managerStateChanged: function (e) {

        },

        _handleWindowResizeBind: null,

        _handleWindowResize: function () {
            var wuiv = Windows.UI.ViewManagement;

            if (wuiv &&
                    wuiv.ApplicationView.value === wuiv.ApplicationViewState.snapped) {
                WinJS.Utilities.addClass(this._viewBoxDiv, 'pf-snapped-player');
                WinJS.Utilities.removeClass(this._viewBoxDiv, 'pf-full-player');
            } else {
                WinJS.Utilities.removeClass(this._viewBoxDiv, 'pf-snapped-player');
                WinJS.Utilities.addClass(this._viewBoxDiv, 'pf-full-player');
            }
        },

        isActive: false,

        activate: function (mediaPlayer) {
            this.deactivate();

            this._mediaPlayer = mediaPlayer;
            this._streamManagerPort._mediaPlayer = this._mediaPlayer;
            this._captionsDiv = document.createElement('div');
            this._viewBoxDiv = document.createElement('div');

            WinJS.Utilities.addClass(this._captionsDiv, 'pf-captions-container');
            WinJS.Utilities.addClass(this._viewBoxDiv, 'pf-viewbox');

            this._mediaPlayer.element.appendChild(this._viewBoxDiv);
            this._viewBoxDiv.appendChild(this._captionsDiv);

            var captionsViewBox = new WinJS.UI.ViewBox(this._viewBoxDiv);

            var controls = this._mediaPlayer.element.querySelector('.win-mediaplayer');
            controls.style.zIndex = 99;

            this._handleWindowResize();

            this._videoElement = this._mediaPlayer.element.querySelector('video');

            this._tracks = new Array();

            window.addEventListener('resize', this._handleWindowResizeBind);
            this._videoElement.addEventListener('timeupdate', this._onVideoTimeUpdateBind);
            this._streamManager.addEventListener('manifestreadyevent', this._manifestReadyHandlerBind);
            this._streamManager.addEventListener('datareceived', this._streamDataReceivedHandlerBind);
            this._streamManager.addEventListener('managerclosed', this._managerClosedBind);
            this._streamManager.addEventListener('endoflive', this._managerEndOfLiveBind);
            this._streamManager.addEventListener('statechanged', this._managerStateChangedBind);
            this.isActive = true;

            // temp - REMOVE BEFORE SHIP

            //WinJS.xhr({ url: "ms-appx:///temp/FontSelections.ttm" }).then(function (result) {
            //    var ttmlDocument = new Windows.Data.Xml.Dom.XmlDocument();
            //    ttmlDocument.loadXml(result.responseText);

        },

        deactivate: function () {
            if (this._videoElement) {
                this._videoElement.removeEventListener('timeupdate', this._onVideoTimeUpdateBind);
            }
            if (this._streamManager) {
                this._streamManager.removeEventListener('datareceived', this._streamDataReceivedHandlerBind);
                this._streamManager.removeEventListener('manifestready', this._manifestReadyHandlerBind);
                this._streamManager.removeEventListener('managerclosed', this._managerClosedBind);
                this._streamManager.removeEventListener('endoflive', this._managerEndOfLiveBind);
                this._streamManager.removeEventListener('statechanged', this._managerStateChangedBind);
                window.removeEventListener('resize', this._handleWindowResizeBind);
            }

            this._mediaPlayer = null;
            this._videoElement = null;
            this._manifest = null;
            this._tracks = null;

            this.isActive = false;
        },


    }, {


        // static properties
    });

    WinJS.Class.mix(captionsManager, WinJS.Utilities.eventMixin);

    WinJS.Namespace.define("PlayerFramework.Captions", {
        CaptionsManager: captionsManager
    });
})();
