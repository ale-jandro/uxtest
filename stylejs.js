(function (window, ch) {
    'use strict';

    /**
     * A large list of elements. Some elements will be shown in a preset area, and others will be hidden waiting for the user interaction to show it.
     * @memberof ch
     * @constructor
     * @param {HTMLElement} el A HTMLElement to create an instance of ch.Carousel.
     * @param {Object} [options] Options to customize an instance.
     * @param {Number} [options.async] Defines the number of future asynchronous items to add to the component. Default: 0.
     * @param {Boolean} [options.arrows] Defines if the arrow-buttons must be created or not at initialization. Default: true.
     * @param {Boolean} [options.pagination] Defines if a pagination must be created or not at initialization. Default: false.
     * @param {Boolean} [options.fx] Enable or disable the slide effect. Default: true.
     * @param {Boolean} [options.autoHeight] Enable or disable the recalculation of item height on a proportional basis maintaining the proportions of an item. Default: true.
     * @param {Boolean} [options.autoMargin] Enable or disable the addition of a proportional margin to each item. Default: true.
     * @param {Number} [options.limitPerPage] Set the maximum amount of items to show in each page.
     * @returns {carousel} Returns a new instance of Carousel.
     * @example
     * // Create a new carousel.
     * var carousel = new ch.Carousel(el, [options]);
     * @example
     * // Create a new Carousel with disabled effects.
     * var carousel = new ch.Carousel(el, {
     *     'fx': false
     * });
     * @example
     * // Create a new Carousel with items asynchronously loaded.
     * var carousel = new ch.Carousel(el, {
     *     'async': 10
     * }).on('itemsadd', function (collection) {
     *     // Inject content into the added <li> elements
     *     $.each(collection, function (i, e) {
     *         e.innerHTML = 'Content into one of newly inserted <li> elements.';
     *     });
     * });
     */
    function Carousel(el, options) {
        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this;

        this._init(el, options);

        if (this.initialize !== undefined) {
            /**
             * If you define an initialize method, it will be executed when a new Carousel is created.
             * @memberof! ch.Carousel.prototype
             * @function
             */
            this.initialize();
        }

        /**
         * Event emitted when the component is ready to use.
         * @event ch.Carousel#ready
         * @example
         * // Subscribe to "ready" event.
         * carousel.on('ready', function () {
         *     // Some code here!
         * });
         */
        window.setTimeout(function () { that.emit('ready'); }, 50);
    }

    // Inheritance
    tiny.inherits(Carousel, ch.Component);

    var pointertap = ch.onpointertap,
        Math = window.Math,
        setTimeout = window.setTimeout,
        parent = Carousel.super_.prototype;

    /**
     * Reference to the vendor prefix of the current browser.
     *
     * @private
     * @constant
     * @type {String}
     * @link http://lea.verou.me/2009/02/find-the-vendor-prefix-of-the-current-browser
     * @example
     * VENDOR_PREFIX === 'webkit';
     */
    var VENDOR_PREFIX = (function () {

        var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/,
            styleDeclaration = document.getElementsByTagName('script')[0].style,
            prop;

        for (prop in styleDeclaration) {
            if (regex.test(prop)) {
                return prop.match(regex)[0].toLowerCase();
            }
        }

        // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
        // However (prop in style) returns the correct value, so we'll have to test for
        // the precence of a specific property
        if ('WebkitOpacity' in styleDeclaration) { return 'webkit'; }
        if ('KhtmlOpacity' in styleDeclaration) { return 'khtml'; }

        return '';
    }());

    /**
     * The name of the component.
     * @memberof! ch.Carousel.prototype
     * @type {String}
     */
    Carousel.prototype.name = 'carousel';

    /**
     * Returns a reference to the constructor function.
     * @memberof! ch.Carousel.prototype
     * @function
     */
    Carousel.prototype.constructor = Carousel;

    /**
     * Configuration by default.
     * @memberof! ch.Carousel.prototype
     * @type {Object}
     * @private
     */
    Carousel.prototype._defaults = {
        'async': 0,
        'arrows': true,
        'pagination': false,
        'fx': true,
        'autoHeight': true,
        'autoMargin': true
    };

    /**
     * Initialize a new instance of Carousel and merge custom options with defaults options.
     * @memberof! ch.Carousel.prototype
     * @function
     * @private
     * @returns {carousel}
     */
    Carousel.prototype._init = function (el, options) {
        // Call to its parents init method
        parent._init.call(this, el, options);

        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this;

        /**
         * The original and entire element and its state, before initialization.
         * @type {HTMLDivElement}
         * @private
         */
        // cloneNode(true) > parameters is required. Opera & IE throws and internal error. Opera mobile breaks.
        this._snippet = this._el.cloneNode(true);

        /**
         * Element that moves (slides) across the component (inside the mask).
         * @private
         * @type {HTMLElement}
         */
        this._list = this._el.children[0];

        tiny.addClass(this._el, 'ch-carousel');
        tiny.addClass(this._list, 'ch-carousel-list');

        /**
         * Collection of each child of the slider list.
         * @private
         * @type {HTMLCollection}
         */
        this._items = (function () {
            var collection = that._list.querySelectorAll('li');

            Array.prototype.forEach.call(collection, function (item) {
                tiny.addClass(item, 'ch-carousel-item');
            });

            return collection;
        }());

        /**
         * Element that wraps the list and denies its overflow.
         * @private
         * @type {HTMLDivElement}
         */
        this._mask = document.createElement('div');
        this._mask.setAttribute('role', 'tabpanel');
        this._mask.setAttribute('class','ch-carousel-mask');
        this._mask.appendChild(this._list);

        this._el.appendChild(this._mask);

        /**
         * Size of the mask (width). Updated in each refresh.
         * @private
         * @type {Number}
         */
        this._maskWidth = this._getOuterDimensions(this._mask).width;

        /**
         * The width of each item, including paddings, margins and borders. Ideal for make calculations.
         * @private
         * @type {Number}
         */
        this._itemWidth = this._getOuterDimensions(this._items[0]).width;

        /**
         * The width of each item, without paddings, margins or borders. Ideal for manipulate CSS width property.
         * @private
         * @type {Number}
         */
        this._itemOuterWidth = parseInt(tiny.css(this._items[0], 'width'));

        /**
         * The size added to each item to make it elastic/responsive.
         * @private
         * @type {Number}
         */
        this._itemExtraWidth = 0;

        /**
         * The height of each item, including paddings, margins and borders. Ideal for make calculations.
         * @private
         * @type {Number}
         */
        this._itemHeight = this._getOuterDimensions(this._items[0]).height;

        /**
         * The margin of all items. Updated in each refresh only if it's necessary.
         * @private
         * @type {Number}
         */
        this._itemMargin = 0;

        /**
         * Flag to control when arrows were created.
         * @private
         * @type {Boolean}
         */
        this._arrowsCreated = false;

        /**
         * Flag to control when pagination was created.
         * @private
         * @type {Boolean}
         */
        this._paginationCreated = false;

        /**
         * Amount of items in each page. Updated in each refresh.
         * @private
         * @type {Number}
         */
        this._limitPerPage = 0;

        /**
         * Page currently showed.
         * @private
         * @type {Number}
         */
        this._currentPage = 1;

        /**
         * Total amount of pages. Data updated in each refresh.
         * @private
         * @type {Number}
         */
        this._pages = 0;

        /**
         * Distance needed to move ONLY ONE PAGE. Data updated in each refresh.
         * @private
         * @type {Number}
         */
        this._pageWidth = 0;

        /**
         * List of items that should be loaded asynchronously on page movement.
         * @private
         * @type {Number}
         */
        this._async = this._options.async;

        /**
         * UI element of arrow that moves the Carousel to the previous page.
         * @private
         * @type {HTMLDivElement}
         */
        this._prevArrow = document.createElement('div');
        this._prevArrow.setAttribute('role', 'button');
        this._prevArrow.setAttribute('aria-hidden', 'true');
        this._prevArrow.setAttribute('aria-label', 'Previous elements');
        this._prevArrow.setAttribute('class', 'ch-carousel-prev ch-carousel-disabled');
        tiny.on(this._prevArrow, pointertap, function () { that.prev(); }, false);

        /**
         * UI element of arrow that moves the Carousel to the next page.
         * @private
         * @type {HTMLDivElement}
         */
        this._nextArrow = document.createElement('div');
        this._nextArrow.setAttribute('role', 'button');
        this._nextArrow.setAttribute('aria-label', 'Next elements');
        this._nextArrow.setAttribute('aria-hidden', 'true');
        this._nextArrow.setAttribute('class', 'ch-carousel-next');
        tiny.on(this._nextArrow, pointertap, function () { that.next(); }, false);

        /**
         * UI element that contains all the thumbnails for pagination.
         * @private
         * @type {HTMLDivElement}
         */
        this._pagination = document.createElement('div');
        this._pagination.setAttribute('role', 'navigation');
        this._pagination.setAttribute('class', 'ch-carousel-pages');

        tiny.on(this._pagination, pointertap, function (event) {
            // Get the page from the element
            var page = event.target.getAttribute('data-page');
            // Allow interactions from a valid page of pagination
            if (page !== null) { that.select(window.parseInt(page, 10)); }
        }, false);

        // Refresh calculation when the viewport resizes
        ch.viewport.on('resize', function () { that.refresh(); });

        // If efects aren't needed, avoid transition on list
        if (!this._options.fx) { tiny.addClass(this._list, 'ch-carousel-nofx'); }

        // Position absolutelly the list when CSS transitions aren't supported
        if (!tiny.support.transition) {
            this._list.style.cssText += 'position:absolute;left:0;';
        }

        // If there is a parameter specifying a pagination, add it
        if (this._options.pagination) { this._addPagination(); }

        // Allow to render the arrows
        if (this._options.arrows !== undefined && this._options.arrows !== false) { this._addArrows(); }

        // Set WAI-ARIA properties to each item depending on the page in which these are
        this._updateARIA();

        // Calculate items per page and calculate pages, only when the amount of items was changed
        this._updateLimitPerPage();

        // Update the margin between items and its size
        this._updateDistribution();

        return this;
    };

    /**
     * Set accesibility properties to each item depending on the page in which these are.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._updateARIA = function () {
        /**
         * Reference to an internal component instance, saves all the information and configuration properties.
         * @type {Object}
         * @private
         */
        var that = this,
            // Amount of items when ARIA is updated
            total = this._items.length + this._async,
            // Page where each item is in
            page;

        // Update WAI-ARIA properties on all items
        Array.prototype.forEach.call(this._items, function (item, i) {
            // Update page where this item is in
            page = Math.floor(i / that._limitPerPage) + 1;
            // Update ARIA attributes
            item.setAttribute('aria-hidden', (page !== that._currentPage));
            item.setAttribute('aria-setsize', total);
            item.setAttribute('aria-posinset', (i + 1));
            item.setAttribute('aria-label', 'page' + page);
        });

    };

    /**
     * Adds items when page/pages needs to load it asynchronously.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._loadAsyncItems = function () {

        // Load only when there are items to load
        if (this._async === 0) { return; }

        // Amount of items from the beginning to current page
        var total = this._currentPage * this._limitPerPage,
            // How many items needs to add to items rendered to complete to this page
            amount = total - this._items.length,
            // The new width calculated from current width plus extraWidth
            width = (this._itemWidth + this._itemExtraWidth),
            // Get the height using new width and relation between width and height of item (ratio)
            height = ((width * this._itemHeight) / this._itemWidth).toFixed(3),
            // Generic <LI> HTML Element to be added to the Carousel
            item = [
                '<li',
                ' class="ch-carousel-item"',
                ' style="width:' + (width % 1 === 0 ? width : width.toFixed(4)) + 'px;',
                (this._options.autoHeight ? 'height:' + height + 'px;' : ''),
                (this._options.autoMargin ? 'margin-right:' + (this._itemMargin % 1 === 0 ? this._itemMargin : this._itemMargin.toFixed(4)) + 'px"' : '"'),
                '></li>'
            ].join(''),
            // It stores <LI> that will be added to the DOM collection
            items = '',
            // It stores the items that must be added, it helps to slice the items in the list
            counter = 0;

        // Load only when there are items to add
        if (amount < 1) { return; }

        // If next page needs less items than it support, then add that amount
        amount = (this._async < amount) ? this._async : amount;

        // Add the necessary amount of items
        while (amount) {
            items += item;
            amount -= 1;
            counter += 1;
        }

        // Add sample items to the list
        this._list.insertAdjacentHTML('beforeend', items);

        // Update items collection
        // uses querySelectorAll because it need a static collection
        this._items = this._list.querySelectorAll('li');

        // Set WAI-ARIA properties to each item
        this._updateARIA();

        // Update amount of items to add asynchronously
        this._async -= amount;

        /**
         * Event emitted when the component creates new asynchronous empty items.
         * @event ch.Carousel#itemsadd
         * @example
         * // Create a new Carousel with items asynchronously loaded.
         * var carousel = new ch.Carousel({
         *     'async': 10
         * }).on('itemsadd', function (collection) {
         *     // Inject content into the added <li> elements
         *     $.each(collection, function (i, e) {
         *         e.innerHTML = 'Content into one of newly inserted <li> elements.';
         *     });
         * });
         */
        this.emit('itemsadd', Array.prototype.slice.call(this._items, -counter));
    };

    /**
     * Creates the pagination of the component.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._addPagination = function () {
        // Remove the current pagination if it's necessary to create again
        if (this._paginationCreated) {
            this._removePagination();
        }

        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this,
            thumbs = [],
            page = that._pages,
            isSelected;

        // Generate a thumbnail for each page on Carousel
        while (page) {
            // Determine if this thumbnail is selected or not
            isSelected = (page === that._currentPage);
            // Add string to collection
            thumbs.unshift(
                '<span',
                ' role="button"',
                ' aria-selected="' + isSelected + '"',
                ' aria-controls="page' + page + '"',
                ' data-page="' + page + '"',
                ' class="' + (isSelected ? 'ch-carousel-selected' : '') + '"',
                '>' + page + '</span>'
            );

            page -= 1;
        }

        // Append thumbnails to pagination and append this to Carousel
        that._pagination.innerHTML = thumbs.join('');
        that._el.appendChild(that._pagination);

        // Avoid selection on the pagination
        that._pagination.setAttribute('unselectable', 'on');
        tiny.addClass(that._pagination, 'ch-user-no-select');

        // Check pagination as created
        that._paginationCreated = true;
    };

    /**
     * Deletes the pagination from the component.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._removePagination = function () {
        // Avoid to change something that not exists
        if (!this._paginationCreated) { return; }
        // Delete thumbnails
        this._pagination.innerHTML = '';
        // Check pagination as deleted
        this._paginationCreated = false;
    };

    /**
     * It stops the slide effect while the list moves.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     * @param {Function} callback A function to execute after disable the effects.
     */
    Carousel.prototype._standbyFX = function (callback) {
        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this;

        // Do it if is required
        if (this._options.fx && tiny.support.transition) {
            // Delete efects on list to make changes instantly
            tiny.addClass(this._list, 'ch-carousel-nofx');
            // Execute the custom method
            callback.call(this);
            // Restore efects to list
            // Use a setTimeout to be sure to do this AFTER changes
            setTimeout(function () { tiny.removeClass(that._list, 'ch-carousel-nofx'); }, 0);
        // Avoid to add/remove classes if it hasn't effects
        } else {
            callback.call(this);
        }
    };

    /**
     * Calculates the total amount of pages and executes internal methods to load asynchronous items, update WAI-ARIA, update the arrows and update pagination.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._updatePages = function () {
        // Update the amount of total pages
        // The ratio between total amount of items and items in each page
        this._pages = Math.ceil((this._items.length + this._async) / this._limitPerPage);
        // Add items to the list, if it's necessary
        this._loadAsyncItems();
        // Set WAI-ARIA properties to each item
        this._updateARIA();
        // Update arrows (when pages === 1, there is no arrows)
        this._updateArrows();
        // Update pagination
        if (this._options.pagination) {
            this._addPagination();
        }
    };

    /**
     * Calculates the correct items per page and calculate pages, only when the amount of items was changed.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._updateLimitPerPage = function () {

        var max = this._options.limitPerPage,
            // Go to the current first item on the current page to restore if pages amount changes
            firstItemOnPage,
            // The width of each item into the width of the mask
            // Avoid zero items in a page
            limitPerPage = Math.floor(this._maskWidth / this._itemOuterWidth) || 1;

        // Limit amount of items when user set a limitPerPage amount
        if (max !== undefined && limitPerPage > max) { limitPerPage = max; }

        // Set data and calculate pages, only when the amount of items was changed
        if (limitPerPage === this._limitPerPage) { return; }

        // Restore if limitPerPage is NOT the same after calculations (go to the current first item page)
        firstItemOnPage = ((this._currentPage - 1) * this._limitPerPage) + 1;
        // Update amount of items into a single page (from conf or auto calculations)
        this._limitPerPage = limitPerPage;
        // Calculates the total amount of pages and executes internal methods
        this._updatePages();
        // Go to the current first item page
        this.select(Math.ceil(firstItemOnPage / limitPerPage));
    };

    /**
     * Calculates and set the size of the items and its margin to get an adaptive Carousel.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._updateDistribution = function () {
        var moreThanOne = this._limitPerPage > 1,
            // Total space to use as margin into mask
            // It's the difference between mask width and total width of all items
            freeSpace = this._maskWidth - (this._itemOuterWidth * this._limitPerPage),
            // Defines how to distribute the freeSpace.
            freeSpaceDistribution = this._options.autoMargin ? (freeSpace / this._limitPerPage / 2) : (freeSpace / this._limitPerPage),
            // Width to add to each item to get responsivity
            // When there are more than one item, get extra width for each one
            // When there are only one item, extraWidth must be just the freeSpace
            extraWidth = moreThanOne ? freeSpaceDistribution : freeSpace,
            // Amount of spaces to distribute the free space
            spaces,
            // The new width calculated from current width plus extraWidth
            width,
            // Styles to update the item element width, height & margin-right
            cssItemText;

        // Update ONLY IF margin changed from last refresh
        // If *new* and *old* extra width are 0, continue too
        if (extraWidth === this._itemExtraWidth && extraWidth > 0) { return; }

        // Update global value of width
        this._itemExtraWidth = extraWidth;

        // When there are 6 items on a page, there are 5 spaces between them
        // Except when there are only one page that NO exist spaces
        spaces = moreThanOne ? this._limitPerPage - 1 : 0;
        // The new width calculated from current width plus extraWidth
        width = this._itemWidth + extraWidth;

        // Free space for each space between items
        // Ceil to delete float numbers (not Floor, because next page is seen)
        // There is no margin when there are only one item in a page
        // Update global values
        this._itemMargin = this._options.autoMargin && moreThanOne ? (freeSpace / spaces / 2) : 0;

        // Update distance needed to move ONLY ONE page
        // The width of all items on a page, plus the width of all margins of items
        this._pageWidth = (this._itemOuterWidth + extraWidth + this._itemMargin) * this._limitPerPage;

        // Update the list width
        // Do it before item resizing to make space to all items
        // Delete efects on list to change width instantly
        this._standbyFX(function () {
            this._list.style.cssText = this._list.style.cssText + '; ' + 'width:' + (this._pageWidth * this._pages) + 'px;';
        });

        // Get the height using new width and relation between width and height of item (ratio)
        cssItemText = [
            'width:' + (width % 1 === 0 ? width : width.toFixed(4)) + 'px;',
            this._options.autoHeight ? 'height:' + ((width * this._itemHeight) / this._itemWidth).toFixed(4) + 'px;' : '',
            this._options.autoMargin ? 'margin-right:' + (this._itemMargin % 1 === 0 ? this._itemMargin : this._itemMargin.toFixed(4)) + 'px;' : ''
        ].join('');

        // Update element styles
        Array.prototype.forEach.call(this._items, function (item){
            item.setAttribute('style', cssItemText);
        });

        // Update the mask height with the list height
        this._mask.style.height = this._getOuterDimensions(this._list).height + 'px';

        // Suit the page in place
        this._standbyFX(function () {
            this._translate(-this._pageWidth * (this._currentPage - 1));
        });
    };

    /**
     * Adds arrows to the component.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._addArrows = function () {
        // Avoid selection on the arrows
        [this._prevArrow, this._nextArrow].forEach(function(el){
            el.setAttribute('unselectable', 'on');
            tiny.addClass(el, 'ch-user-no-select');
        });

        // Add arrows to DOM
        this._el.insertBefore(this._prevArrow, this._el.children[0]);
        this._el.appendChild(this._nextArrow);
        // Check arrows as created
        this._arrowsCreated = true;
    };

    /**
     * Set as disabled the arrows by adding a classname and a WAI-ARIA property.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     * @param {Boolean} prev Defines if the "previous" arrow must be disabled or not.
     * @param {Boolean} next Defines if the "next" arrow must be disabled or not.
     */
    Carousel.prototype._disableArrows = function (prev, next) {
        this._prevArrow.setAttribute('aria-disabled', prev);
        this._prevArrow.setAttribute('aria-hidden', prev);
        tiny[prev ? 'addClass' : 'removeClass'](this._prevArrow, 'ch-carousel-disabled');

        this._nextArrow.setAttribute('aria-disabled', next);
        this._nextArrow.setAttribute('aria-hidden', next);
        tiny[next ? 'addClass' : 'removeClass'](this._nextArrow, 'ch-carousel-disabled');
    };

    /**
     * Check for arrows behavior on first, last and middle pages, and update class name and WAI-ARIA values.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     */
    Carousel.prototype._updateArrows = function () {
        // Check arrows existency
        if (!this._arrowsCreated) {
            return;
        }
        // Case 1: Disable both arrows if there are ony one page
        if (this._pages === 1) {
            this._disableArrows(true, true);
        // Case 2: "Previous" arrow hidden on first page
        } else if (this._currentPage === 1) {
            this._disableArrows(true, false);
        // Case 3: "Next" arrow hidden on last page
        } else if (this._currentPage === this._pages) {
            this._disableArrows(false, true);
        // Case 4: Enable both arrows on Carousel's middle
        } else {
            this._disableArrows(false, false);
        }
    };

    /**
     * Moves the list corresponding to specified displacement.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     * @param {Number} displacement Distance to move the list.
     */
    Carousel.prototype._translate = (function () {
        // CSS property written as string to use on CSS movement
        var vendorTransformKey = VENDOR_PREFIX ? VENDOR_PREFIX + 'Transform' : null;

        // Use CSS transform to move
        if (tiny.support.transition) {
            return function (displacement) {
                // Firefox has only "transform", Safari only "webkitTransform",
                // Chrome has support for both. Applied required minimum
                if (vendorTransformKey) {
                    this._list.style[vendorTransformKey] = 'translateX(' + displacement + 'px)';
                }
                this._list.style.transform = 'translateX(' + displacement + 'px)';
            };
        }

        // Use left position to move
        return function (displacement) {
            this._list.style.left = displacement + 'px';
        };
    }());

    /**
     * Updates the selected page on pagination.
     * @memberof! ch.Carousel.prototype
     * @private
     * @function
     * @param {Number} from Page previously selected. It will be unselected.
     * @param {Number} to Page to be selected.
     */
    Carousel.prototype._switchPagination = function (from, to) {
        // Avoid to change something that not exists
        if (!this._paginationCreated) { return; }
        // Get all thumbnails of pagination element
        var children = this._pagination.children,
            fromItem = children[from - 1],
            toItem = children[to - 1];

        // Unselect the thumbnail previously selected
        fromItem.setAttribute('aria-selected', false);
        tiny.removeClass(fromItem, 'ch-carousel-selected');

        // Select the new thumbnail
        toItem.setAttribute('aria-selected', true);
        tiny.addClass(toItem, 'ch-carousel-selected');
    };

    /**
     * Get the current outer dimensions of an element.
     *
     * @memberof ch.Carousel.prototype
     * @param {HTMLElement} el A given HTMLElement.
     * @returns {Object}
     */
    Carousel.prototype._getOuterDimensions = function (el) {
        var obj = el.getBoundingClientRect();

        return {
            'width': (obj.right - obj.left),
            'height': (obj.bottom - obj.top)
        };
    };

    /**
     * Triggers all the necessary recalculations to be up-to-date.
     * @memberof! ch.Carousel.prototype
     * @function
     * @returns {carousel}
     */
    Carousel.prototype.refresh = function () {

        var that = this,
            maskWidth = this._getOuterDimensions(this._mask).width;

        // Check for changes on the width of mask, for the elastic carousel
        // Update the width of the mask
        if (maskWidth !== this._maskWidth) {
            // Update the global reference to the with of the mask
            this._maskWidth = maskWidth;
            // Calculate items per page and calculate pages, only when the amount of items was changed
            this._updateLimitPerPage();
            // Update the margin between items and its size
            this._updateDistribution();

            /**
             * Event emitted when the component makes all the necessary recalculations to be up-to-date.
             * @event ch.Carousel#refresh
             * @example
             * // Subscribe to "refresh" event.
             * carousel.on('refresh', function () {
             *     alert('Carousel was refreshed.');
             * });
             */
            this.emit('refresh');
        }

        // Check for a change in the total amount of items
        // Update items collection
        if (this._list.children.length !== this._items.length) {
            // Update the entire reference to items
            // uses querySelectorAll because it need a static collection
            this._items = this._list.querySelectorAll('li');
            // Calculates the total amount of pages and executes internal methods
            this._updatePages();
            // Go to the last page in case that the current page no longer exists
            if (this._currentPage > this._pages) {
                this._standbyFX(function () {
                    that.select(that._pages);
                });
            }

            /**
             * Event emitted when the component makes all the necessary recalculations to be up-to-date.
             * @event ch.Carousel#refresh
             * @ignore
             */
            this.emit('refresh');
        }

        return this;
    };

    /**
     * Moves the list to the specified page.
     * @memberof! ch.Carousel.prototype
     * @function
     * @param {Number} page Reference of page where the list has to move.
     * @returns {carousel}
     */
    Carousel.prototype.select = function (page) {
        // Getter
        if (page === undefined) {
            return this._currentPage;
        }

        // Avoid to move if it's disabled
        // Avoid to select the same page that is selected yet
        // Avoid to move beyond first and last pages
        if (!this._enabled || page === this._currentPage || page < 1 || page > this._pages) {
            return this;
        }

        // Perform these tasks in the following order:
        // Task 1: Move the list from 0 (zero), to page to move (page number beginning in zero)
        this._translate(-this._pageWidth * (page - 1));
        // Task 2: Update selected thumbnail on pagination
        this._switchPagination(this._currentPage, page);
        // Task 3: Update value of current page
        this._currentPage = page;
        // Task 4: Check for arrows behavior on first, last and middle pages
        this._updateArrows();
        // Task 5: Add items to the list, if it's necessary
        this._loadAsyncItems();

        /**
         * Event emitted when the component moves to another page.
         * @event ch.Carousel#select
         * @example
         * // Subscribe to "select" event.
         * carousel.on('select', function () {
         *     alert('Carousel was moved.');
         * });
         */
        this.emit('select');

        return this;
    };

    /**
     * Moves the list to the previous page.
     * @memberof! ch.Carousel.prototype
     * @function
     * @returns {carousel}
     */
    Carousel.prototype.prev = function () {

        this.select(this._currentPage - 1);

        /**
         * Event emitted when the component moves to the previous page.
         * @event ch.Carousel#prev
         * @example
         * carousel.on('prev', function () {
         *     alert('Carousel has moved to the previous page.');
         * });
         */
        this.emit('prev');

        return this;
    };

    /**
     * Moves the list to the next page.
     * @memberof! ch.Carousel.prototype
     * @function
     * @returns {carousel}
     */
    Carousel.prototype.next = function () {

        this.select(this._currentPage + 1);

        /**
         * Event emitted when the component moves to the next page.
         * @event ch.Carousel#next
         * @example
         * carousel.on('next', function () {
         *     alert('Carousel has moved to the next page.');
         * });
         */
        this.emit('next');

        return this;
    };

    /**
     * Enables a Carousel instance.
     * @memberof! ch.Carousel.prototype
     * @function
     * @returns {carousel}
     */
    Carousel.prototype.enable = function () {

        this._el.setAttribute('aria-disabled', false);

        this._disableArrows(false, false);

        parent.enable.call(this);

        return this;
    };

    /**
     * Disables a Carousel instance.
     * @memberof! ch.Carousel.prototype
     * @function
     * @returns {carousel}
     */
    Carousel.prototype.disable = function () {

        this._el.setAttribute('aria-disabled', true);

        this._disableArrows(true, true);

        parent.disable.call(this);

        return this;
    };

    /**
     * Destroys a Carousel instance.
     * @memberof! ch.Carousel.prototype
     * @function
     */
    Carousel.prototype.destroy = function () {

        this._el.parentNode.replaceChild(this._snippet, this._el);

        tiny.trigger(window.document, ch.onlayoutchange);

        parent.destroy.call(this);

        return;
    };

    ch.factory(Carousel);

}(this, this.ch));

(function (window, ch) {
    'use strict';

    function normalizeOptions(options) {
        var num = window.parseInt(options, 10);

        if (!window.isNaN(num)) {
            options = {
                'max': num
            };
        }

        return options;
    }

    /**
     * Countdown counts the maximum of characters that user can enter in a form control. Countdown could limit the possibility to continue inserting charset.
     * @memberof ch
     * @constructor
     * @augments ch.Component
     * @param {HTMLElement} el A HTMLElement to create an instance of ch.Countdown.
     * @param {Object} [options] Options to customize an instance.
     * @param {Number} [options.max] Number of the maximum amount of characters user can input in form control. Default: 500.
     * @param {String} [options.plural] Message of remaining amount of characters, when it's different to 1. The variable that represents the number to be replaced, should be a hash. Default: "# characters left.".
     * @param {String} [options.singular] Message of remaining amount of characters, when it's only 1. The variable that represents the number to be replaced, should be a hash. Default: "# character left.".
     * @returns {countdown} Returns a new instance of Countdown.
     * @example
     * // Create a new Countdown.
     * var countdown = new ch.Countdown([el], [options]);
     * @example
     * // Create a new Countdown with custom options.
     * var countdown = new ch.Countdown({
     *     'max': 250,
     *     'plural': 'Left: # characters.',
     *     'singular': 'Left: # character.'
     * });
     * @example
     * // Create a new Countdown using the shorthand way (max as parameter).
     * var countdown = new ch.Countdown({'max': 500});
     */
    function Countdown(el, options) {

        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this;

        this._init(el, options);

        if (this.initialize !== undefined) {
            /**
             * If you define an initialize method, it will be executed when a new Countdown is created.
             * @memberof! ch.Countdown.prototype
             * @function
             */
            this.initialize();
        }

        /**
         * Event emitted when the component is ready to use.
         * @event ch.Countdown#ready
         * @example
         * // Subscribe to "ready" event.
         * countdown.on('ready', function () {
         *     // Some code here!
         * });
         */
        window.setTimeout(function () { that.emit('ready'); }, 50);
    }

    // Inheritance
    tiny.inherits(Countdown, ch.Component);

    var parent = Countdown.super_.prototype;

    /**
     * The name of the component.
     * @memberof! ch.Countdown.prototype
     * @type {String}
     */
    Countdown.prototype.name = 'countdown';

    /**
     * Returns a reference to the constructor function.
     * @memberof! ch.Countdown.prototype
     * @function
     */
    Countdown.prototype.constructor = Countdown;

    /**
     * Configuration by default.
     * @type {Object}
     * @private
     */
    Countdown.prototype._defaults = {
        'plural': '# characters left.',
        'singular': '# character left.',
        'max': 500
    };

    /**
     * Initialize a new instance of Countdown and merge custom options with defaults options.
     * @memberof! ch.Countdown.prototype
     * @function
     * @private
     * @returns {countdown}
     */
    Countdown.prototype._init = function (el, options) {
        // Call to its parent init method
        parent._init.call(this, el, options);

        /**
         * Reference to context of an instance.
         * @type {Object}
         * @private
         */
        var that = this,

            /**
             * Create the "id" attribute.
             * @type {String}
             * @private
             */
            messageID = 'ch-countdown-message-' + that.uid,

           /**
             * Singular or Plural message depending on amount of remaining characters.
             * @type {String}
             * @private
             */
            message;

        /**
         * The countdown trigger.
         * @type {HTMLTextAreaElement}
         * @example
         * // Gets the countdown trigger.
         * countdown.trigger;
         */
        this.trigger = this._el;
        'keyup keypress keydown input paste cut'.split(' ')
            .forEach(function(name) {
                tiny.on(that.trigger, name, function () { that._count(); });
            });

        /**
         * Amount of free characters until full the field.
         * @type {Number}
         * @private
         */
        that._remaining = that._options.max - that._contentLength();

        // Update the message
        message = ((that._remaining === 1) ? that._options.singular : that._options.plural);

        /**
         * The countdown container.
         * @type {HTMLParagraphElement}
         */
        that.container = (function () {
            var parent = tiny.parent(that._el);
            parent.insertAdjacentHTML('beforeend', '<span class="ch-countdown ch-form-hint" id="' + messageID + '">' + message.replace('#', that._remaining) + '</span>');

            return parent.querySelector('#' + messageID);
        }());

        this.on('disable', this._removeError);

        return this;
    };

    /**
     * Returns the length of value.
     * @function
     * @private
     * @returns {Number}
     */
    Countdown.prototype._contentLength = function () {
        return this._el.value.length;
    };

    /**
     * Process input of data on form control and updates remaining amount of characters or limits the content length. Also, change the visible message of remaining characters.
     * @function
     * @private
     * @returns {countdown}
     */
    Countdown.prototype._count = function () {

        if (!this._enabled) {
            return this;
        }

        var length = this._contentLength(),
            message;

        this._remaining = this._options.max - length;

        // Limit Count alert the user
        if (length <= this._options.max) {

            if (this._exceeded) {
                // Update exceeded flag
                this._exceeded = false;
                this._removeError();
            }

        } else if (length > this._options.max) {

            /**
             * Event emitted when the lenght of characters is exceeded.
             * @event ch.Countdown#exceed
             * @example
             * // Subscribe to "exceed" event.
             * countdown.on('exceed', function () {
             *     // Some code here!
             * });
             */
            this.emit('exceed');

            // Update exceeded flag
            this._exceeded = true;

            this.trigger.setAttribute('aria-invalid', 'true');
            tiny.addClass(this.trigger, 'ch-validation-error');

            tiny.addClass(this.container, 'ch-countdown-exceeded');
        }

        // Change visible message of remaining characters
        // Singular or Plural message depending on amount of remaining characters
        message = (this._remaining !== 1 ? this._options.plural : this._options.singular).replace(/\#/g, this._remaining);

        // Update DOM text
        this.container.innerText  = message;

        return this;

    };

     /**
     * Process input of data on form control and updates remaining amount of characters or limits the content length. Also, change the visible message of remaining characters.
     * @function
     * @private
     * @returns {countdown}
     */
    Countdown.prototype._removeError = function () {
        tiny.removeClass(this.trigger, 'ch-validation-error');
        this.trigger.setAttribute('aria-invalid', 'false');

        tiny.removeClass(this.container, 'ch-countdown-exceeded');

        return this;
    };

    /**
     * Destroys a Countdown instance.
     * @memberof! ch.Countdown.prototype
     * @function
     * @example
     * // Destroy a countdown
     * countdown.destroy();
     * // Empty the countdown reference
     * countdown = undefined;
     */
    Countdown.prototype.destroy = function () {
        var parentElement = tiny.parent(this.container);
        parentElement.removeChild(this.container);

        tiny.trigger(window.document, ch.onlayoutchange);

        parent.destroy.call(this);

        return;
    };

    // Factorize
    ch.factory(Countdown, normalizeOptions);

}(this, this.ch));




var carousel = new ch.Carousel(ch('.demo-carousel')[0], {
    pagination: true
});


        function qS(selector) { return document.querySelector(selector); };

        var extraSuggestions = ['<ul>',
            '<li class="ch-autocomplete-item" data-suggested="Static option">Static option</li>',
            '<li class="ch-autocomplete-item" data-suggested="Other Static option">Other static option</li>',
            '</ul>'].join('');

        function parseResults(results) {
            var data = [];
            if (results[2].suggested_queries !== undefined) {
                results[2].suggested_queries.forEach(function (e, i) {
                    data.push(e.q);
                });

                // Show suggestions
                autocomplete.suggest(data);
            }
        }

        var autocomplete = new ch.Autocomplete(qS('.autocomplete'), {wrapper: 'ch-autocomplete-wrapper'})
                .on('type', function (userInput) {
                    tiny.jsonp('http://suggestgz.mlapps.com/sites/MLA/autosuggest?q=' + userInput + '&v=1', {
                        name: 'autocompleteSuggestion',
                        success: parseResults,
                        error: function(err) {
                            autocomplete.suggest([]);
                        }
                    });
                });

        autocomplete.container.insertAdjacentHTML('beforeend', extraSuggestions);

        var calendar = new ch.Calendar(qS('.YOUR_SELECTOR_calendar'), {'selected': ['2012/01/22','2012/01/21']});

        // Expandable
        var expandable1 = new ch.Expandable(qS('.YOUR_SELECTOR_expandable'));

        expandable1.on('contentdone', function () {
            tiny.on('.test', 'click', function () {
                console.log('contentdone' + that.uid);
            });
        });

        var expandable2 = new ch.Expandable(qS('.YOUR_SELECTOR_expandable2'), {
            'content': './static/ajax.html',
            'container': qS('.container_expandable2')
        });
        expandable2.on('contentdone', function () {
            var that = this;
            tiny.on('h2', 'click', function () {
                console.log('contentdone' + that.uid);
            });
        });

        var expandable3 = new ch.Expandable(qS('.YOUR_SELECTOR_expandable3'), {'container': qS('#container')});

        var expandable4 = new ch.Expandable(qS('.YOUR_SELECTOR_expandable4'), {
            'container': qS('#container-ajax'),
            'content': './static/ajax.html'
        });

        // Menu
        var menu = new ch.Menu(qS('.YOUR_SELECTOR_Menu'));

        // Dropdown
        var dropdown1 = new ch.Dropdown(qS('.myDropdown'));

        var dropdown2 = new ch.Dropdown(qS('.myDropdownNav'), {'shortcuts': false, 'skin': true});

        var dropdown3 = new ch.Dropdown(qS('.myDropdownSkin'), {'skin': true});

        // Tooltip
        // Bottom
        var tooltip1 = new ch.Tooltip(qS('#default')); // lt lb

        var tooltip2 = new ch.Tooltip(qS('#ctcb'), {
         'side': 'bottom',
         'align': 'center'
        });

        var tooltip3 = new ch.Tooltip(qS('#rtrb'), {
         'side': 'bottom',
         'align': 'right'
        });

        // Top
        var tooltip4 = new ch.Tooltip(qS('#lblt'), {
         'side': 'top',
         'align': 'left',
         'offsetY': -10
        });
        var tooltip5 = new ch.Tooltip(qS('#cbct'), {
         'side': 'top',
         'align': 'center',
         'offsetY': -10
        });
        var tooltip6 = new ch.Tooltip(qS('#rbrt'), {
         'side': 'top',
         'align': 'right',
         'offsetY': -10
        });

        // Right
        var tooltip7 = new ch.Tooltip(qS('#ltrt'), {
         'side': 'right',
         'align': 'top',
         'offsetX': 10
        });
        var tooltip8 = new ch.Tooltip(qS('#lmrm'), {
         'side': 'right',
         'align': 'center',
         'offsetX': 10
        });
        var tooltip9 = new ch.Tooltip(qS('#lbrb'), {
         'side': 'right',
         'align': 'bottom',
         'offsetX': 10
        });

        // Left
        var tooltip10 = new ch.Tooltip(qS('#rtlt'), {
         'side': 'left',
         'align': 'top',
         'offsetX': -10
        });
        var tooltip11 = new ch.Tooltip(qS('#rmlm'), {
         'side': 'left',
         'align': 'center',
         'offsetX': -10
        });
        var tooltip12 = new ch.Tooltip(qS('#rblb'), {
         'side': 'left',
         'align': 'bottom',
         'offsetX': -10
        });

        var tooltipX = new ch.Tooltip({
            'content': 'Tooltip without trigger!',
            'reference': qS('#default')
        });

        // Layer
        var layer1 = new ch.Layer(qS('#layer1'), {'content': 'foo'});

        var layerContent = document.createElement('p');
            layerContent.innerHTML = 'This is an HTML P Element as content.';

        var layer2 = new ch.Layer(qS('#layer2'), {
            'content': layerContent,
            'shownby': 'pointertap',
            'hiddenby': 'all'
        });

        var invisibleContent = qS('#invisible-content-for-layer');

        var layer3 = new ch.Layer(qS('#layer3'), {
            'content': invisibleContent,
            'shownby': 'pointertap',
            'hiddenby': 'none'
        });

        var layer4 = new ch.Layer(qS('#layer4'), {
            'content': 'Plain text.',
            'shownby': 'pointertap',
            'hiddenby': 'button'
        });

        var layer5 = new ch.Layer(qS('#layer5'), {
            'content': './static/ajax.html',
            'shownby': 'pointertap',
            'hiddenby': 'pointers'
        });

        var layerX = new ch.Layer({
            'content': 'Layer without trigger!',
            'reference': qS('#layer5')
        });

        var layerFixed = new ch.Layer(qS('#components'), {
            'content': qS('#components-list'),
            'shownby': 'pointertap',
            'hiddenby': 'all',
            'width': '700px',
            'position': 'fixed',
            'align': 'center',
            'offsetY': '5px'
        });

        var bubble = new ch.Bubble({
            'reference': qS('#bubble1')
        });

        bubble.on('click', function () {
            bubble.show();
        });

        // Modal
        var modal1 = new ch.Modal(qS('#modal1'), {
            'width': '500px',
            'height': '300px'
        });

        // Modal with invisible DOM Content
        var modal2 = new ch.Modal(qS('#modal2'), {'content': document.querySelector('#invisible-content')});

        // Modal lite
        var modal3 = new ch.Modal(qS('#modal3'), {
         'content': '<h2>Heading or content</h2>',
         'addClass': 'ch-modal-lite'
        });

        var modalX = new ch.Modal({
            'hiddenby': 'button'
        });

        tiny.on('#modal-form', 'submit', function (e) {
            e.preventDefault();
            modalX.show('<h2>Heading or content</h2><p>Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus bibendum consectetur dignissim.</p>');
        });

        // var modalValidation = new ch.Modal($('#modal-validation'), {
        //         'content': $('#bigForm')
        //     })
        //     .once('show', function () {
        //         this.validation = new ch.Required($('#input_modal'), {
        //             'position': 'fixed'
        //         });
        //     })
        //     .on('hide', function () {
        //         this.validation.clear();
        //     });

        // Trasition
        var transition = new ch.Transition(qS('#transition'));

        var transitionX = new ch.Transition({
            'waiting': 'Transition without trigger!'
        });

        // Zoom
        var zoom1 = new ch.Zoom(qS('#zoom-default'));

        var zoom2 = new ch.Zoom(qS('#zoom-preload'));
        // Preload image
        zoom2.loadImage();

        // Carousel
        var carousel = new ch.Carousel(qS('.myCarousel'), {"pagination": true});

        // // Tabs
        var tabs = new ch.Tabs(qS(".YOUR_SELECTOR_Tabs"));

        // Date Picker
        var datepicker = new ch.Datepicker(qS('#val_date'), {
            'selected': '2011/11/15',
            'to': 'today'
        });

        var  datepicker2 = new ch.Datepicker(qS('#val_date2'), {
            'selected': '2011/11/15',
            'to': 'today'
        });

        // Countdown
        var countdown = new ch.Countdown(qS('#text_cd'), {'max': 140, 'plural': '# left', 'singular': '# left'});

        // Messages
        var message = (function (message, value) {
        var messages = {
             'option': 'Choose an option.',
             'requiredCheck': 'Accept the Terms of Use.',
             'link': 'Fill in this information. <a href="#double">Chico UI</a>.'
         };

         return function (message, value) {
             var message = messages[message] || message;
             if(value){
                 return message.replace('{#num#}',value)
             }
             return message;
         }
        }());

        // Form
        var m = new ch.Modal();

        var form = new ch.Form(qS('.myForm'))
                 .on('success', function (event) {
                     event.preventDefault();
                     m.show('success');
                 })
                 .on('error', function (errors) {
                     console.log(errors);
                 });

        tiny.on(form._el, 'submit', function (event) {
            if (!form.hasError()) {
                event.preventDefault();
                console.log('Ademas hago otra cosa en el submit');
            }
        });

        // // Validators
        // // var validation1 = $('#input_ico').validation({
        // //     'conditions': [
        // //         {
        // //             'name': 'required',
        // //             'message': 'Mensaje de requerido.'
        // //         },
        // //         {
        // //             'name': 'custom-validation',
        // //             'fn': function (value) { return value === 'custom-validation';},
        // //             'message': 'This is a custom-validation!'
        // //         }
        // //     ],
        // //     'offsetX': 0,
        // //     'offsetY': 10,
        // //     'side': 'bottom',
        // //     'align': 'left',

        // // });

        // // var validation1 = $('#input_ico')
        // //       .required({
        // //         'offsetX': 0,
        // //         'offsetY': 10,
        // //         'side': 'bottom',
        // //         'align': 'left',
        // //         'message': 'Mensaje de requerido.'
        // //       }).and()
        // //       .custom('custom-validation', function (value) { return value === "custom-validation";}, 'This is a custom-validation!')
        // //       .and().custom('another-custom-validation', function (value) { return value === "another-custom-validation";}, 'This is an another-custom-validation!');



        var  validation1 = new ch.Validation(qS('#input_ico'), {
            'conditions': [
                {
                    'name': 'required'
                },
                {
                    'name': 'string'
                }
            ],
            'reference': qS('#input_ico + .ch-form-icon.ch-icon-help-sign')
        });


        var  validation2 = new ch.Validation(qS('#input_ico_inside'), {
            'conditions':[{'name': 'required'}, {'name': 'number'}]
        });

        var  validation4 = new ch.Validation(qS('#email'), {
            'conditions':[{'name': 'required'}, {'name': 'email'}]
        });

        var  validation5 = new ch.Validation(qS('#custom'), {'conditions':[
            {
                'name': 'myCustom1',
                'fn': function (v) {
                     if (v.toString().indexOf("1") > -1) {
                         return true;
                     }
                     return false;
                },
                'message': 'The number must contain a 1.'
            },
            {
                'name': 'myCustom2',
                'fn': function (v) {
                     if (v.toString().indexOf("2") > -1) {
                         return true;
                     }
                     return false;
                },
                'message': 'The number must contain a 2.'
            }
        ]});

        var validation6 = new ch.Validation(qS('#url'), {'conditions':[{'name': 'url'}]});

        var validation7 = new ch.Validation(qS('#number'), {
            'conditions':[{'name': 'number'}, {'name': 'min', 'num': 5}]
        });

        var validation8 = new ch.Validation(qS('#range'), {
            'conditions':[{'name': 'min', 'num': 8}, {'name': 'max', 'num': 10}]
        });

        var validation9 = new ch.Validation(qS('#characters'), {
            'conditions':[{'name': 'maxLength', 'num': 20}, {'name': 'minLength', 'num': 6}]
        });

        var validation10 = new ch.Validation(qS('#select2'), {
            'conditions':[{'name': 'required', 'message': message('option')}]
        });

        var validation11 = new ch.Validation(qS('.required-check'), {
            'conditions':[{'name': 'required', 'message': message('requiredCheck')}]
        });

        var validation12 = new ch.Validation(qS('.required-option'), {
            'conditions':[{'name': 'required', 'message': message('option')}]
        });
        var validation13 = new ch.Validation(qS('#double'), {
            'conditions':[{'name': 'required', 'message': message('link')}, {'name': 'number'}]
        });

        var validation14 = new ch.Validation(qS('#textarea2'), {
            'conditions':[{'name': 'required'}]
        });

        tiny.on('a[href="#"]', 'click', function(e) {
            e.preventDefault();
        });

 

