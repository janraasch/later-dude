// Load the widget once the DOM is ready, using `jQuery.ready`:
$(function(){

  // Item Model
  // ----------

  // The **Item** model has `title` and `uri` attributes,
  // which are set at creation by either `addOne()` or
  // `onReset()` of the widget's instance of **FrontView** View.
  window.Item = Backbone.Model.extend({
    // TODO opening URIs could be handled by an item itself.
    // This would rid us of 'openURI' Events.
  });

  // Item Collection
  // ---------------

  // See backbone-widget-localstorage.js for details on
  // how a Store modulates Backbone.sync behavior. In short:
  // When used on the dashboard we use `widget.setPreferenceForKey()`,
  // otherwise HTML5 *localStorage*.
  window.CollectionOfItems = Backbone.Collection.extend({

    model : Item,

    store : new Store('items')

  });

  // ItemView
  // --------

  // View for the `<li>` DOM element of an item.
  window.ItemView = Backbone.View.extend({

    tagName : 'li',

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    events : {
      'click span.item-destroy' : 'destroy',
      'click .title' : 'open',
      'click .uri' : 'open',
      'dblclick .title' : 'edit',
      'keydown input' : 'onKeydown',
      'dragstart' : 'addDragInfo'
    },

    // The ItemView listens for changes to its model, re-rendering.
    initialize : function () {
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
    },

    // Render DOM element using the template.
    render : function () {
      // Make <li> elements `draggable`.
      $(this.el).attr('draggable','true').html(this.template());
      this.setText();
      return this;
    },

    // Add item's attributes to our DOM element.
    setText : function () {
      this.$('.title').text(decodeURIComponent(this.model.get('title')));
      var uri = this.model.get('uri');
      var isFile = uri.match(/file:\/\/localhost\/(.*)/);
      // Remove 'file://' part of a file's uri for better readability.
      // The last slash of a folder's uri (if present at drop) was already
      // removed before adding the uri by **FrontView**'s `addOne()`.
      if (isFile)
        this.$('.uri').text(decodeURIComponent(isFile[1]));
      else
        this.$('.uri').text(decodeURIComponent(uri));
    },

    // Remove this view from the DOM.
    remove : function () {
      $(this.el).remove();
    },

    // Destroy this view's item.
    destroy : function () {
      this.model.destroy();
    },

    // Open item's uri.
    open : function (e) {
      // Some care has to be taken because we also
      // want to respond to dblclicks on the title.
      if (this._timer) {
        clearTimeout(this._timer);this._timer=null;
      }
      else {
        this._timer = setTimeout(
          _.bind(function(){
            // Opening URIs is handled by the widget's instance of **LaterDude** View.
            this.trigger('openURI',this.model.get('uri'));
          },this),
        200);
      }
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    },

    // Edit item's title.
    edit : function (e) {
      this.$('.title').replaceWith('<input>');
      this.$('input').val(decodeURIComponent(this.model.get('title'))).focus();
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    },

    // Stop editing item's title.
    onKeydown : function (e) {
      if (e.which === 13) {
        // Pressing `return` saves changes, if any there any.
        if (e.target.value === decodeURIComponent(this.model.get('title')))
          this.render();
        else
          this.model.save({title : e.target.value});
      }
      else {
        if (e.which === 27)
          this.render();
      }
      e.originalEvent.stopPropagation();
      // We do not `preventDefault()`, otherwise the widget would not react to
      // a button being pressed for some time like `soooooooooooooo`.
    },

    // On `dragstart add item's attributes to `dataTransfer` object.
    addDragInfo : function(e){
      var uri = this.model.get('uri');
      var rtf = '{\\field{\\*\\fldinst{HYPERLINK '
        + '"'
        + uri
        + '"'
        + '}}'
        + '{\\fldrslt \\f0\\fs24 \\cf0 '
        + this.model.get('title')
      + '}}';

      e.originalEvent.dataTransfer.clearData();
      e.originalEvent.effectAllowed = 'copy';
      e.originalEvent.dataTransfer.setData('text/rtf', rtf);
      e.originalEvent.dataTransfer.setData('text/plain', uri);
      e.originalEvent.dataTransfer.setData('text/uri-list', uri);
    }

  });

  // FrontView
  // ---------

  // View for the DOM element of the widget's *front*.
  window.FrontView = Backbone.View.extend({

    el : $('#front'),

    // The DOM events specific to the *front*.
    events : {
      'click #info-button-rollie' : 'showBack',
      'click #open-all' : 'openAll',
      'dragenter' : 'setDropEffect', // To actually set the `dropEffect`.
      'dragover' : 'setDropEffect', // To constantly `preventDefault()`.
      'drop' : 'onDrop'
    },

    // The widget's collection of items.
    collection : new CollectionOfItems,

    initialize : function() {

    this.growboxInset = {};

    // Setting up the #scroll-area.
    this.scrollbar = new AppleVerticalScrollbar(this.$('#scrollbar')[0]),
    this.scrollArea = new AppleScrollArea(this.$('#scroll-area')[0])
    this.scrollArea.addScrollbar(this.scrollbar);

    // 'reset' Event is triggered by this.collection.fetch() at initialization.
    this.collection.bind('reset', this.onReset, this);
    // Update the scrollbar, if an item has been destroyed.
    this.collection.bind('destroy', this.scrollAreaRefresh, this);

    // Let's get things going by fetching preexisting items from
    // widget's preference file or *localStorage* depending on our environment.
    this.collection.fetch();
    },

    scrollAreaRefresh : function () {
      this.scrollArea.refresh();
    },

    // Transitions between widget's *front* and *back* are
    // coordinated by our instance of **LaterDude** View.
    // See `showBack()` of **LaterDude** View.
    showBack : function () {
      this.trigger('showBack');
    },

    // URI opening is handled by **LaterDude** View.
    // See `openURI()` of **LaterDude** View.
    openAll : function () {
      this.collection.each(_.bind(function(item){
        this.trigger('openURI', item.get('uri'));
      },this));
    },

    // Enable the *front* view to handle the drop
    // and add that nice little green + to the cursor,
    // which for some reason will not show up in the
    // *Dashboard* environment.
    setDropEffect : function(e) {
      e.originalEvent.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      return false;
    },

    // Handle the dropped information.
    onDrop : function (e) {
      // Prevent default drop behavior on some browsers,
      // not needed for the *Dashboard*.
      e.originalEvent.stopPropagation();

      // Add the spinning wheel.
      this.el.append(
        $('<img>').attr(
          {id : 'activity-indicator', src : 'Images/activity-indicator.png', alt : 'Loading...'}
        ).css('-webkit-animation-name', 'activity-indicator')
      );

      // Now let us see what (was dropped by the user/) we have here.
      var uris = e.originalEvent.dataTransfer.getData('text/uri-list') || e.originalEvent.dataTransfer.getData('text/plain');
      if (!uris)
        this.$('#activity-indicator').remove();
      else {
        uris = uris.split('\n');
        var i = 0;
        for (i = 0; i < uris.length; i++) {
          var uri = uris[i].match(/^([a-zA-Z]+):\/\/.*/);
          if (uri) {
            // If a file was dropped, we do not need to `GET` a title for this item,
            // we will just use the file's name.
            if (uri[1] === "file") {
              uri = uri[0];
              var title = /^file:\/\/(?:[^\/]+\/)+(.+$)/.exec(uri);
              var endsOnSlash = uri.match(/(.*)\/$/);
              if (endsOnSlash)
                uri = endsOnSlash[1];
              // We already checked for the 'file' part but, you know, just making sure...
              // TODO In other words this is `if (true)`.
              if (title) {
                title = title[1];
                if (endsOnSlash)
                  this.addOne({title : title.match(/(.*)\/$/)[1], uri : uri});
                else
                  this.addOne({title : title, uri : uri});
              }
              // TODO See comment right above this one.
              else
                this.$('#activity-indicator').remove();
            }
            // Assuming we have a URL, let us `GET` the corresponding webpage's *title*.
            // TODO Check for http/https.
            else {
              uri = uri[0];
              // Using XMLHttpRequest on the *Dashboard* or in *Safari*
              // there are no *cross-domain* restrictions.
              var xhr = new XMLHttpRequest();
              xhr.open('GET', uri, true);
              xhr.frontView = this;
              xhr.onreadystatechange = function(){
                if (xhr.readyState === 4) {
                  if (xhr.status === 200) {
                    var parse_title = /(?:<title[^>]*>)(.*?)(?:<\/title>)/i;
                    title = parse_title.exec(xhr.responseText);
                    if (title)
                      xhr.frontView.addOne({title : title[1], uri : uri});
                    else
                      xhr.frontView.addOne({title : 'Title', uri : uri});
                  }
                  else
                    xhr.frontView.addOne({title : uri, uri : uri});
                }
              }
              xhr.send('');
            }
          }
          // Check for "mailto:" type of link.
          else {
            // TODO Add support for e-mail subject and more.
            var eMail = uris[i].match(/^mailto:([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+[\.]{1}[a-zA-Z]{2,4}$)/);
            if (eMail)
              this.addOne({title: eMail[1], uri: eMail[0]});
            else
              this.$('#activity-indicator').remove();
          }
        }
        // Finally we are all done handling the `drop`, so let's
        // `return false` for good measure.
        return false;
      }
    },

    // (At initialization) add preexisting items to *front* view.
    onReset : function () {
      this.collection.each(_.bind(function(item){
        var view = new ItemView({model : item});
        view.bind('openURI', this.openURI, this);
        this.$("#item-list").prepend(view.render().el);
      },this));
      this.scrollAreaRefresh();
    },

    // Add an item to the view, removing
    // the `activity-indicator` added during `onDrop()`.
    addOne : function (item) {
      var view = new ItemView({model : this.collection.create({title : item.title, uri : item.uri})});
      this.$('#item-list').prepend(view.render().el);
      view.bind('openURI', this.openURI, this);
      this.scrollAreaRefresh();
      this.$('#activity-indicator').remove();
    },

    // Callback for 'openURI' fired by an instance of **ItemView**,
    // when an item was clicked. See `openURI()` of **LaterDude** View.
    openURI : function (uri) {
      this.trigger('openURI', uri);
    }

  });

  // BackView
  // --------

  // View for the DOM element of the widget's *back*.
  window.BackView = Backbone.View.extend({

    el : $("#back"),

    events : {
      'click #version' : 'openHomepage',
      'mouseup #done-button': 'showFront'
    },

    // URI opening is handled by widget's instance of **LaterDude** View.
    // See `openURI()` of **LaterDude** View.
    openHomepage : function() {
      this.trigger('openURI','http://janpunktde.de/later-dude/');
    },

    // Transitions between *front* and *back* are
    // coordinated by widget's instance of **LaterDude** View.
    // See `showFront()` of **LaterDude** View.
    showFront : function() {
      this.trigger('showFront');
    }

  });

  // LaterDude
  // ---------

  // The actual **LaterDude** View. The main view controller.
  // An instance of this coordinates between *front* and *back*, handles
  // opening URIs and initiates the start-up process.
  window.LaterDude = Backbone.View.extend({

    el : $('body'),

    events : {
      'mousedown #resize' : 'startResize'
    },

    back : new BackView,

    front : new FrontView,

    // Assign `x` and `y` to `this.growboxInset`
    // and add event listeners to document for live resizing.
    startResize : function (e) {
      $(document).on('mousemove', _.bind(this.resize,this));
      $(document).on('mouseup', this.stopResize);
      this.growboxInset = {x:(this.el.width() - e.pageX), y:(this.el.height() - e.pageY)};
      e.stopPropagation();
      e.preventDefault();
    },

    // Resize body, *front* elements and window during
    // live resizing.
    resize : function (e) {
      var x = e.pageX + this.growboxInset.x;
      var y = e.pageY + this.growboxInset.y;

      if (y<180) y = 180;
      this.saveBodyHeight(y);
      this.setHeight(y);
      window.widget && window.resizeTo(400, y+20);

      e.stopPropagation();
      e.preventDefault();
    },

    // Remove (resizing) mouse event listeners.
    stopResize : function (e) {
      $(document).off('mousemove');
      $(document).off('mouseup');

      e.stopPropagation();
      e.preventDefault();
    },

    // Save the `body` DOM elements' height.
    saveBodyHeight : function (y) {
      if (window.widget)
        widget.setPreferenceForKey(y, 'bodyHeight_' + widget.identifier);
      else
        localStorage.setItem('bodyHeight', y);
    },

    // Set widget's height. Note that this does not set the
    // height of the `window` object.
    setHeight : function (y) {
      this.el.height(y);
      this.front.el.height(y+10);
      this.back.el.height(y+10);
      this.front.$('#scroll-wrapper').children().css('height', y-35);
      this.front.scrollAreaRefresh();
    },

    showFront : function () {
      window.widget && widget.prepareForTransition('ToFront');
      this.front.el.show();
      this.back.el.hide();
      window.widget && setTimeout('widget.performTransition();', 0);
        // TODO This is messy.
        // In case our *front* view has not removed it,
        // let it spin again!
      this.front.$('#activity-indicator') && this.front.$('#activity-indicator').css('-webkit-animation-name','activity-indicator');
      this.bodyHeight > 180 && setTimeout(_.bind(function(){
        this.animateResize(this.bodyHeight, 500);
      }, this), window.widget && 600);
    },

    showBack : function () {
        // TODO This is messy.
        // The transition animation fails, if the `activityIndicator
        // is spinning.
      this.front.$('#activity-indicator') && this.front.$('#activity-indicator').css('-webkit-animation-name','');

      this.bodyHeight = this.el.height();
      if (this.bodyHeight > 180) {
        this.animateResize(180, 500);
        setTimeout(_.bind(function(){this.performTransitionToBack();}, this), 500);
      }
      else this.performTransitionToBack();
    },

    performTransitionToBack : function () {
      window.widget && widget.prepareForTransition('ToBack');
      this.back.el.show();
      this.front.el.hide();
      setTimeout(_.bind(function(){
        window.widget && widget.performTransition();
        clearInterval(this._scrollRefreshInterval);
      }, this), 0);
    },

    animateResize : function (bodyHeight, milliSeconds) {
      $('body, #front, #scroll-area, #scrollbar').css({'-webkit-transition-property' : 'height', '-webkit-transition-duration' : milliSeconds+'ms'});
      this._scrollRefreshInterval = setInterval(_.bind(function(){this.front.scrollAreaRefresh();}, this), 10);
      this.setHeight(bodyHeight);
      setTimeout(_.bind(function(){
        $('body, #front, #scroll-area, #scrollbar').css({'-webkit-transition-property' : '', '-webkit-transition-duration' : ''});
        clearInterval(this._scrollRefreshInterval);
      }, this), milliSeconds);
    },

    initialize : function() {
      // Obviously we do not want to refence the `widget object, if it is
      // not present. This also enables us to default to running in a
      // browser (see `else case below).
      if (window.widget) {
        // Remove widget's preference file, when removing the widget from the *Dashboard*.
        widget.onremove = function () {
          widget.setPreferenceForKey(null, 'items_' + widget.identifier);
          widget.setPreferenceForKey(null, 'bodyHeight_' + widget.identifier);
        };

        // For `widget.system()` to run in async mode we need a NON-`null` handler.
        this.widgetSystemHandler = function (object) {
          // Use the following for debugging widget behavior which involves `widget.system calls like so
          // widget.setPreferenceForKey(object.outputString + " " + object.errorString + " " + object.status, 'Debug_widget' + '_' + widget.identifier);
        };

        this.isFile = /^file:\/\//;

        // URIs are opened using their default application.
        this.openURI = function (uri) {
          if (uri.match(this.isFile)) {
            widget.system(
            // Exit the *Dashboard*, open file. The order is important.
              "/usr/bin/osascript -e 'tell application \"System Events\" to keystroke (key code 53)' \n" +
              'open ' + '"' + uri + '"',
            this.widgetSystemHandler);
          }
          // With the implementation using `widget.system()` above the following is superficial, but
          // we use it, since Apple provides this functionality out of the box. (Maybe faster... Who knows...)
          else
            widget.openURL(uri);
        };
      }
      // The non-widget/browser case:
      else {
        this.openURI = function (uri) {
          // For debugging:
          // console.log(uri);
          window.open(uri); // Of course POP-UPs would have to be "unblocked"
        };
      }

      // *Dashboard* or browser, in any case:
      // Open URIs, when told to do so.
      this.front.bind('openURI', this.openURI, this);
      this.back.bind('openURI', this.openURI, this);
      // Listen for the need to transition between *front* and *back*
      this.front.bind('showBack', this.showBack, this);
      this.back.bind('showFront', this.showFront, this);

      // Set up the widget's height.
      var predefinedBodyHeight = window.widget ? widget.preferenceForKey('bodyHeight_' + widget.identifier) : parseInt(localStorage.getItem('bodyHeight'));
        if (predefinedBodyHeight) {
          this.setHeight(predefinedBodyHeight);
          window.widget && window.resizeTo(this.el.width()+20, predefinedBodyHeight+20);
        }
    }

  });

  // So here we go.
  window.laterDude = new LaterDude;

}); // Later, dudes!... :D