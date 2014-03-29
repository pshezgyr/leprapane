// ==UserScript==
// @name           leprapane
// @namespace      leprapane
// @description    mimimi
// @include        http://*leprosorium.ru/comments/*
// @grant          GM_getValue
// @grant          GM_setValue
// ==/UserScript==
/* @TODO
  add modal video view
  add inline video view
  ? add modal images gallery
  add usernames filter
  add better comment collapse
  fix closed threads imagepane. Show all?
  add minimal comments rating to show
  add modal window for settings
  add human-readable post time
  add sort by rating with .js-commentsHolder copy and without indent
  add sort criterias builder
  replace addListener by cross-browser wrap
//*/
var SETTINGS = {
  filters: {
    all    : { symbol: 'все',       color: '',       title: 'все' },
    new    : { symbol: ''   ,       color: '',       title: 'новые' },
    mine   : { symbol: 'm',         color: 'tomato', title: 'мои' },
    friend : { symbol: '&#x1f60f;', color: '#3c0',   title: 'друзяки' },
    starter: { symbol: '&#x2606;',  color: '#f90',   title: 'автор' },
    image  : { symbol: '&#x20de;',  color: '#360',   title: 'картинки' },
    video  : { symbol: '&#x25b6;',  color: '#600',   title: 'видосики' },
    link   : { symbol: 'links'   ,  color: '#936',   title: 'со ссылками' },
    male   : { symbol: '&#x2642;',  color: '#333',   title: 'благородные юноши' },
    female : { symbol: '&#x2640;',  color: '#f39',   title: 'восхитительные девы' },
    idiot  : { symbol: 'i',         color: '#3c0',   title: 'идиоты' }
  },
  friends: [], // ['jovan']
  idiots : [],
  imagesFix: {
    enabled       : true,
    fitWidth      : true,
    fitWidthMargin: 64
  },
  imagesPane: {
    enabled     : true,
    size        : 32,
    scrollAmount: 3,
    showScroll  : false,
    loadingText : 'Понатыкали, блядь...'
  },
  username: {
    enabled  : false,
    replaceBy: '%ME%', // %ME% for actual username
    color    : 'tomato'
  },
  ranks: {
    enabled      : true,
    hide         : false,
    showRegNumber: true,
    keepGender   : true,
    numbers      : true,
    customRanks  : {
      enabled : true,
      list: {
        boxesofmatches: ''
      }
    }
  },
  collapse: {
    enabled      : true,
    collapsedText: '<<< CLICK TO VIEW >>>',
    spoilers     : false,
    showSpoilers : true,
    idiots       : true,
    fublyaImages : true,
    fublyaRating : -11,
    allImages    : false
  },
  threads: {
    enabled     : false,
    collapseFrom: 5
  },
  video: {
    enabled: true,
    width  : 320,
    height : 240
  },
  ratingFont: {
    enabled  : true,
    criterias: [ // [rating, [font size, font color]]
      [0   , [9 , 'red'    ]],
      [30  , [9 , '#333'   ]],
      [50  , [10, '#9c9c9c']],
      [100 , [11, '#36f'   ]],
      [500 , [11, '#369'   ]],
      [1000, [11, '#363'   ]],
      [2000, [11, '#fc0'   ]]
    ]
  }
};

// @TODO well-comment this
(function (W, D, B, NAMESPACE, undefined) {
  "use strict";

  // Globals
  var RE = {
    userName    : /<a href="(http:\/\/.*?)\/users\/(.*)">(.*)<\/a>(.*)/i,
    userId      : /\d+/,
    isNew       : /new/,
    isMine      : /mine/,
    isFemale    : "написала",
    isVideo     : /href=\"(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube|vimeo)/ig,
    removeIndent: /\bindent_\d{0,2}\b/,
    getIndent   : /indent_(\d*)/
  },
  CSS = "", // @TODO move from stylish
  scrollInterval;

  // Utilities
  function GM_log()        {return console.log.apply(console, arguments);};
  function removeIndent(n) {n.className=n.className.replace(RE.removeIndent,"indent_0");return n;};
  function showEl(n)       {n.style.display="block";return n;};
  function hideEl(n)       {n.style.display="none";return n;};
  function getIndent(n)    {var i=n.className.match(RE.getIndent);return i&&i[1]?parseInt(i[1], 10):0;};
  function getId(n)        {return isNaN(parseInt(n.id, 10))?parseInt(n.id.replace("p",""),10):parseInt(n.id,10);};
  function plural(n,f)     {n%=100;if(n>10&&n<20)return f[2];n%=10;return f[n>1&&n<5?1:n==1?0:2]};
  function debounce(fn,ms) {var t;return function(){window.clearTimeout(t);t=window.setTimeout(function(){fn();},ms);};};
  function makeEl(type)    {
    if( ! type ){ return false; };
    var $el, mthds;

    $el   = D.createElement(type);
    mthds = {
      $el: $el,
      setId: function(id) {
        $el.id = NAMESPACE + "-" + id;
        return mthds;
      },
      setClass: function(string) {
        $el.className = string;
        return mthds;
      },
      setCss: function(list) {
        list = list || {};
        for( var prop in list ){ if( list.hasOwnProperty(prop) ) { $el.style[prop] = list[prop]; }; };
        return mthds;
      },
      setAttr: function(attr, value) {
        $el.setAttribute(attr, value);
        return mthds;
      },
      setHtml: function(html) {
        $el.innerHTML = html;
        return mthds;
      },
      appendTo: function($node) {
        $node.appendChild($el);
        return mthds;
      },
      insertBefore: function($node) {
        $node.parentNode.insertBefore($el, $node);
        return mthds;
      },
      insertAfter: function($node) {
        $node.parentNode.insertBefore($el, $node.nextSibling);
        return mthds;
      },
      makeChild: function(type) {
        if( ! type ) return false;
        return makeEl(type).appendTo($el);
      },
      bindEvent: function(e, cb) {
        GM_log(NAMESPACE + ' :: bindEvent >', arguments, $el)
        $el.addEventListener(e, cb, 0);
        return mthds;
      },
      destroy: function() {
        (function(ref){ref.parentNode.removeChild(ref);})($el);
        return mthds;
      }
    };
    return mthds;
  };
  /**
   * Simplest modal window
   *
   * @TODO
   */
  var modal = (function () {
    var $wrapper, $content;

    $wrapper = makeEl('div')
      .setId('modal')
      .setCss({
        position  : 'fixed',
        top       : 0,
        right     : 0,
        bottom    : 0,
        left      : 0,
        background: 'rgba(0,0,0,.9)',
        zIndex    : 65536,
        display   : 'none'
      })
      .appendTo(B)
      .$el;

    /**
    *
    * @private
    */
    function _show() {
      B.style.overflow = 'hidden';
      $wrapper.style.display = 'block';
      GM_log('show')
    };

    return {
      $wrapper: $wrapper,
      show    : _show
    }
  })();
  /**
   * Video parser and renderer
   *
   *
   */
  var embedMediaBuilder = (function() {
    var RE = {
      yt  : '(http|https)://(www.)?youtube|youtu\.be',
      ytId: '^.*(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*',
      vm  : 'http://(player.)?vimeo\.com',
      vmId: '\/(.*\/)?([^#\?]*)'
    };

    /**
     *
     * @TODO
     * @public
     */
    function _render (type, id) {
      return false;
    };

    /**
     * Lookup media hosting and video id by links in given node
     *
     * @param {Object} $node Comment text div
     * @returns {Boolean} true|false Is comment have some media?
     * @public
     */
    function _guess ($node) {
      var $links = $node.getElementsByTagName('a');
      if( ! $links.length ){ return false; };

      var media = [];
      for( var i = 0; i < $links.length; i++ ) {
        var href = $links[i].href;

        // Youtube
        if( href.match(RE.yt) ) {
          var id = href.match(RE.ytId);

          if( id ) {
            id = id[1];
            media.push(['youtube', id]);

            var $trigger = makeEl('span')
              .setHtml(' [>] ')
              .setAttr('title', id)
              .setCss({
                cursor: 'pointer'
              })
              .bindEvent('click', function() {
                // @TODO Place renderer
                GM_log('clicked', ['youtube', id]);
              });

            $node.insertBefore($trigger.$el, $links[i].nextSibling);
          };
        };

        // Vimeo
        if( href.match(RE.vm) ) {
          var id = href.match(RE.vmId);
          media.push(['vimeo', id && (id[2] || id[1]), $links[i]]);
        };
      };

      return media.length && media;
    };

    return {
      guess : _guess,
      render: _render
    };
  })();

  /**
   * Comments class
   *
   * @constructor
   * @param {Object} $el
   * @param {String} USERNAME
   */
  function Comment($el, USERNAME) {
    var self     = this,
        $dt      = $el.childNodes[1],
        $dd      = $el.childNodes[3],
        $p       = $dd.childNodes[1],
        $pLinks  = $p.getElementsByTagName('a'),
        $uIdLink = $pLinks[$pLinks.length-1].className ? $pLinks[$pLinks.length-1] : $pLinks[4],
        rating   = $dd.childNodes[3].childNodes[1].childNodes[1].childNodes[0],
        text     = $dt.innerHTML.toLowerCase();

    this.$el             = $el;
    this.id              = getId($el);
    this.images          = $dt.getElementsByTagName('img');
    this.username        = $pLinks[1].innerHTML;
    this.lowerUsername   = this.username.toLowerCase();
    this.userid          = (($uIdLink.onclick.toString().match(RE.userId) || '?') + '');
    this.rating          = parseInt(rating.innerHTML, 10);
    this.isFemale        = $p.childNodes[2].textContent.toLowerCase().contains(RE.isFemale);
    this.isNew           = $el.className.match(RE.isNew);
    this.isMine          = $el.className.match(RE.isMine);
    this.isFriend        = SETTINGS.friends.length && SETTINGS.friends.indexOf(this.username) != -1;
    this.isIdiot         = SETTINGS.idiots.length  && SETTINGS.idiots.indexOf(this.username)  != -1;
    this.hasIrony        = text.contains('<span class="irony"');
    this.hasSpoiler      = text.contains('<span class="spoiler"');
    this.hasLink         = text.contains('<a href');
    this.hasImage        = this.images.length > 0;
    this.indent          = getIndent($el);
    this.parentCommentId = null;
    this.childComments   = [];
    this.videos          = embedMediaBuilder.guess($dt);

    // Comment parent. Thx, Viten`ka ^_^
    if( $pLinks[4] && $pLinks[4].getAttribute('replyto') ) {
      this.parentCommentId = parseInt($pLinks[4].getAttribute('replyto'), 10);
    };

    // Ranks
    if( SETTINGS.ranks.enabled ) {
      var userRank;
      // Hide this shit
      if( SETTINGS.ranks.hide ) {
        userRank = SETTINGS.ranks.keepGender ? this.isFemale ? 'Написала ' : 'Написал ' : '';
      } else {
        // Or replace by custom
        if( SETTINGS.ranks.customRanks.enabled &&
           (SETTINGS.ranks.customRanks.list[this.lowerUsername] ||
            SETTINGS.ranks.customRanks.list[this.username])
        ){
          userRank = SETTINGS.ranks.keepGender ? this.isFemale ? 'Написала ' : 'Написал ' : '';
          userRank += ( (SETTINGS.ranks.customRanks.list[this.lowerUsername] || SETTINGS.ranks.customRanks.list[this.username]) + ' ');
        };
      };

      if( userRank )               { $pLinks[1].previousSibling.textContent = userRank; };
      if( SETTINGS.ranks.numbers ) { $pLinks[1].nextSibling.textContent += ' #' + this.userid + ' '; };
    };

    // Username
    if( SETTINGS.username.enabled ) {
      var name = SETTINGS.username.replaceBy != '%ME%' ? SETTINGS.username.replaceBy : USERNAME;
      $dt.innerHTML = $dt.innerHTML.replace(/%username%/gi, "<span style='color:" + SETTINGS.username.color + ";'>" + name + "</span>");
    };

    // Rating text font
    if( SETTINGS.ratingFont.enabled ) {
      var l      = SETTINGS.ratingFont.criterias.length - 1,
          preset = SETTINGS.ratingFont.criterias[l];

      for( ; l>=0; l-- ) {
        if( this.rating < SETTINGS.ratingFont.criterias[l][0] ) {
          preset = SETTINGS.ratingFont.criterias[l];
        };
      };

      rating.style.fontSize = preset[1][0] + 'px';
      rating.style.color    = preset[1][1];

      // Keep color for thumbs
      this.ratingColor = preset[1][1];
    };

    // Image size fix
    if( SETTINGS.imagesFix.enabled && SETTINGS.imagesFix.fitWidth && this.hasImage ) {

      var _resizeCommentImages = function() {
        var oversize;

        for( var i = 0, l = self.images.length; i < l; i++ ) {
          oversize = B.clientWidth - (self.images[i].width + $el.getBoundingClientRect().left + SETTINGS.imagesFix.fitWidthMargin);

          if( oversize < 0 ) {
            self.images[i].style.width = self.images[i].width + oversize + 'px';
          }
        };
        return true;
      };

      // When all loaded
      W.addEventListener('load', _resizeCommentImages, false);
      W.addEventListener('resize', debounce(_resizeCommentImages, 3500), false);
    };


    /**
     *
     * @public
     */
    this.showSpoiler = function() {
      if( ! this.hasSpoiler ) return false;
      var $spoilers = $dt.getElementsByClassName('inner_spoiler'), i = $spoilers.length - 1;
      for( ;i>=0;i-- ){ $spoilers[i].style.opacity = 1; };
      return true;
    };

    /**
     * Scroll to post
     *
     * @public
     */
    this.scrollToPost = function ()
    {
      // Try to do it with some style
      try {
        var INTERVAL      = 16,   // refresh rate
            DURATION      = 1500, // speed
            timePassed    = 0,
            startLocation = W.pageYOffset,
            endLocation   = (function(anchor) {
              // @private
              var location = 0;
              // Assume each parent
              if (anchor.offsetParent) {
                do {
                  location += anchor.offsetTop;
                  anchor    = anchor.offsetParent;
                } while (anchor);
              };

              return location >= 0 ? location : 0;
            })($el),
            percentage, position;

        // vCenter would be nice
        endLocation += Math.min(0, ($el.clientHeight - W.innerHeight) * 0.5);

        var distance = endLocation - startLocation;

        var stopAnimation = function() {
          var currentLocation = W.pageYOffset;
          if ( position == endLocation        ||
               currentLocation == endLocation ||
               ( (W.innerHeight + currentLocation) >= B.scrollHeight )
          ){
            W.clearInterval(scrollInterval);
          }
        };

        // easeInOutBounce
        var easingPattern = function(time) {
          return time < 0.5 ? 8 * time * time * time * time : 1 - 8 * (--time) * time * time * time;
        };

        var animateScroll = function() {
          timePassed += INTERVAL;
          percentage = ( timePassed / DURATION );
          percentage = ( percentage > 1 ) ? 1 : percentage;
          position   = startLocation + ( distance * easingPattern(percentage) );
          W.scrollTo( 0, position );
          stopAnimation();
        };

        if( scrollInterval ){ W.clearInterval(scrollInterval); };
        scrollInterval = W.setInterval(function() { animateScroll(); }, INTERVAL);

      } catch (e) {
        // Ok, just scroll to it
        return $el.scrollIntoView();
      };
    };

    // @TODO
    // Toggle post
    var $collapsedToggle;

    this.expand = function(e) {
      if( ! SETTINGS.collapse.enabled ){ return false; };
      e && e.preventDefault();
      $dt.style.display = 'block';
      $collapsedToggle.style.display = 'none';
      collapsedToggle.removeEventListener && collapsedToggle.removeEventListener('click', self.expand);
      return false;
    };
    this.collapse = function() {
      if( ! SETTINGS.collapse.enabled ){ return false; };
      $dt.style.display = 'none';

      if( ! $collapsedToggle ) {
        $collapsedToggle = D.createElement('div');
        $collapsedToggle.className     = 'dt';
        $collapsedToggle.innerHTML     = SETTINGS.collapse.collapsedText;
        $collapsedToggle.style.display = 'none';
        $collapsedToggle.style.cursor  = 'pointer';
      };

      $collapsedToggle.style.display = 'block';
      $collapsedToggle.addEventListener('click', self.expand, true);
      $dt.parentNode.insertBefore($collapsedToggle, $dt);

      return true;
    };

    // Simple show/hide for nested comments
    this.collapseFast = function() {
      $el.style.display = 'none';
      return true;
    };
    this.expandFast = function() {
      $el.style.display = 'block';
      return true;
    };

    // Colorize author
    this.highlightAuthor = function(color) {
      if( ! color ){ return false; };
      $pLinks[1].style.color = color;
      return true;
    };

    // Colorize post
    this.highlightPost = function (color) {
      if( ! color ){ return false; };
      $dt.style.outline = 'dotted 1px ' + color;
      return true;
    };

    return this;
  };

  /**
   * Comments routine
   *
   * @returns {Boolean} true
   */
  function collectComments()
  {
    var topic, comments, username, starter, $comments, i, l;

    // Current user name
    username = (function() {
      if( D.getElementById('greetings') ) {
        return D.getElementById('greetings').innerHTML.match(RE.userName)[3];
      };
      return '%username%';
    })();

    // Topic
    topic    = new Comment(D.querySelector('.post'), username);
    starter  = topic.username;
    topic.highlightAuthor(SETTINGS.filters.starter.color);

    // Comments hash
    comments = {
      user   : {},
      id     : {},
      indents: {},
      all    : [],
      mine   : [],
      new    : [],
      female : [],
      male   : [],
      spoiler: [],
      image  : [],
      link   : [],
      starter: [],
      friend : [],
      idiot  : [],
      video  : []
    };

    $comments = D.getElementById('js-commentsHolder').getElementsByClassName('post');
            i = 0;
            l = $comments.length;

    // For each comment
    for(; i<l; i++ ) {
      var c = new Comment($comments[i], username);

      comments['all'].push(c);
      comments['id'][c.id] = c;

      c.isNew   && comments['new'  ].push(c);
      c.hasLink && comments['link' ].push(c);
      c.videos  && comments['video'].push(c);

      if( c.parentCommentId ) { comments.id[c.parentCommentId].childComments.push(c); };

      if( ! comments['indents'][c.indent] ) { comments['indents'][c.indent] = []; }; comments['indents'][c.indent].push(c);
      if( ! comments['user'][c.username] )  { comments['user'][c.username]  = []; }; comments['user'][c.username].push(c);

      if( c.isFemale )            { comments['female' ].push(c); c.highlightAuthor(SETTINGS.filters.female.color);  }
      else                        { comments['male'   ].push(c); c.highlightAuthor(SETTINGS.filters.male.color);    };

      if( c.isFriend )            { comments['friend' ].push(c); c.highlightAuthor(SETTINGS.filters.friend.color);  };
      if( c.isMine   )            { comments['mine'   ].push(c); c.highlightAuthor(SETTINGS.filters.mine.color);    };
      if( c.username == starter ) { comments['starter'].push(c); c.highlightAuthor(SETTINGS.filters.starter.color); };

      if( c.hasSpoiler ) {
        comments['spoiler'].push(c);
        if( SETTINGS.collapse.showSpoilers  ) { c.showSpoiler(); }
        else if( SETTINGS.collapse.spoilers ) { c.collapse();    };
      };

      if( c.hasImage ) {
        comments['image'].push(c);
        if( SETTINGS.collapse.allImages || SETTINGS.collapse.fublyaImages && c.rating <= SETTINGS.collapse.fublyaRating){ c.collapse(); };
      };

      if( c.isIdiot ) {
        comments['idiot'].push(c);
        c.highlightAuthor(SETTINGS.filters.idiot.color);
        if( SETTINGS.collapse.idiots ){ c.collapse(); };
      };
    };

    return {
      topic   : topic,
      comments: comments,
      username: username
    }
  };

  /**
   * Pane class
   *
   * @constructor
   * @requires collectComments
   * @param {Object} DATA Comments routine result
   */
  function Pane (DATA) {
    var self = this;

    this.CN = {
      group   : NAMESPACE + '-group',
      item    : NAMESPACE + '-item',
      filter  : NAMESPACE + '-filter',
      button  : NAMESPACE + '-button',
      title   : NAMESPACE + '-title',
      count   : NAMESPACE + '-count',
      showMore: NAMESPACE + '-show-more'
    };
    this.DATA = DATA;
    // Has any filter applied?
    this.isFiltered = false;

    // Elements
    this.$pane = makeEl('div')
      .setId('pane')
      .appendTo(B)
      .$el;

    this.$controls = makeEl('div')
      .setId('controls')
      .appendTo(this.$pane)
      .$el;

    this.$buttons = makeEl('div')
      .setId('buttons')
      .setClass(this.CN.group)
      .appendTo(this.$controls)
      .$el;

    // Buttons
    this.addButton('&uarr;', function(e) {
      return W.scrollTo(0, 0);
    });

    // Render stuff
    this.renderFilters();
    // this.renderSearch();
    if( SETTINGS.threads.enabled )    this.renderThreads();
    if( SETTINGS.imagesPane.enabled ) this.renderThumbs();

    return this;
  };
  /**
   *
   *
   */
  Pane.prototype.addButton = function(text, cbOnClick) {
    if( ! (text && cbOnClick) ){ return false; };

    makeEl('div')
      .setHtml(text)
      .setClass(this.CN.item + ' ' + this.CN.button)
      .appendTo(this.$buttons)
      .bindEvent('click', cbOnClick);

    return true;
  };
  /**
   *
   *
   */
  Pane.prototype.renderSearch = function() {
    var self = this,
        $search, $input, $btnClear;

    $search = makeEl('div')
      .setId('search')
      .setClass(this.CN.item)
      .setHtml('<span><input type="text" placeholder="find" /></span><input type="button" value="x" />')
      .appendTo(this.$controls)
      .$el;

    $input    = $search.querySelector('[type="text"]');
    $btnClear = $search.querySelector('[type="button"]');

    return true;
  };
  /**
   *
   *
   */
  Pane.prototype.renderFilters = function() {
    var self        = this,
        filtersHtml = '',
        $filters, type, typeProps;

    for( type in SETTINGS.filters ) {
      if( this.DATA.comments[type] && this.DATA.comments[type].length ) {
        typeProps = SETTINGS.filters[type];

        filtersHtml += '<div class="' + this.CN.item + ' ' + this.CN.filter + '" style="border-bottom: 3px solid ' + typeProps.color + '" title="' + typeProps.title + '" data-type="' + type + '">';
          filtersHtml += '<div class="' + this.CN.count + '">' + this.DATA.comments[type].length + '</div> '
          filtersHtml += '<div class="' + this.CN.title + '">' + typeProps.title + '</div>'
        filtersHtml += '</div>';
      };
    };

    $filters = makeEl('div')
      .setId('filters')
      .setClass(this.CN.group)
      .setHtml(filtersHtml)
      .appendTo(this.$controls)
      .$el;

    var $items = $filters.querySelectorAll('.' + this.CN.filter);
    for( var i = 0; i < $items.length; i++ ) {
      $items[i].addEventListener('click', _cbOnClick, false);
    };
    /**
     *
     * @private
     */
    function _cbOnClick(e) {
      e && e.preventDefault();
      self.doFilter({
        type : 'comment',
        value: this.getAttribute('data-type')
      });
      return false;
    };

    return true;
  };
  /**
   *
   *
   */
  Pane.prototype.renderThumbs = function() {
    if( ! this.DATA.comments.image.length ) return this;

    var self = this,
        $thumbs, thumbsVisible = true;

    this.addButton('&#9679;', function(e) {
      e && e.preventDefault();
      thumbsVisible = ! thumbsVisible;
      $thumbs.style.display = thumbsVisible ? 'block' : 'none';
      return false;
    });

    $thumbs = makeEl('div')
      .setId('thumbs')
      .setClass(this.CN.group)
      .setHtml(SETTINGS.imagesPane.loadingText)
      .setCss({
        height    : (SETTINGS.imagesPane.size + 2) + 'px', // 2 - border size
        lineHeight: SETTINGS.imagesPane.size + 'px',
        whiteSpace: 'nowrap',
        overflowY : 'hidden',
        overflowX : SETTINGS.imagesPane.showScroll ? "auto" : "hidden"
      })
      .appendTo(this.$pane)
      .bindEvent('DOMMouseScroll', _cbOnWheel)
      .$el;

    /**
     *
     * @private
     */
    function _cbOnWheel(e) {
      e.preventDefault && e.preventDefault();
      e.stopPropagation && e.stopPropagation();
      e = window.event || e;
      var delta = Math.max( -1, Math.min( 1, (e.wheelDelta || - e.detail) ) );
      $thumbs.scrollLeft -= Math.floor( SETTINGS.imagesPane.scrollAmount * SETTINGS.imagesPane.size * delta );
      return false;
    };
    /**
     *
     * @private
     */
    function _cbOnClick(e) {
      e && e.preventDefault();
      // Show all comments
      if( self.isFiltered ){ self.showAllComments(); };

      self.DATA.comments.image[this.getAttribute('data-index')] &&
      self.DATA.comments.image[this.getAttribute('data-index')].scrollToPost();
      return false;
    };

    W.addEventListener('load', function() {
      $thumbs.innerHTML  = '';
      $thumbs.scrollLeft = 0;

      var i, l, k, j, thumbsHtml = '';

      for( i=0,l=self.DATA.comments.image.length; i<l; i++ ) {
        for( k=0,j=self.DATA.comments.image[i].images.length; k<j; k++ ) { // wow
          var image   = self.DATA.comments.image[i].images[k];
          var comment = self.DATA.comments.image[i];
          var imageWH = Math.min(image.height || 16, SETTINGS.imagesPane.size);

          thumbsHtml += '<span class="leprapane-thumbs-item" data-index="' + i + '">'
            thumbsHtml += '<img style="width:' + imageWH + 'px;height:' + imageWH + 'px" src="' + image.src + '" />'
            thumbsHtml += '<i style="background-color:' + (comment.ratingColor || 'transparent') + '"></i>'
          thumbsHtml += '</span>'
        };
      };

      $thumbs.innerHTML = thumbsHtml;

      var $items = $thumbs.getElementsByTagName('span');
      for( var i = 0; i < $items.length; i++ ) {
        $items[i].addEventListener('click', _cbOnClick, false);
      };
    });
    return true;
  };
  /**
   * Render comment threads based on indent
   *
   * @public
   * @returns {Boolean} true
   */
  Pane.prototype.renderThreads = function() {
    var scope = this.DATA.comments.indents[Math.max(1, SETTINGS.threads.collapseFrom - 1)];
    if( ! scope.length ) { return false; };

    // Ok, has some comments with indent
    for( var i = 0, l = scope.length; i < l; i++ ) {
      var root     = this.DATA.comments.id[scope[i].parentCommentId],
          _nested  = _getNestedComments(scope[i]),
          total    = _nested.length,
          k        = _nested.length - 1,
          namesMap = {},
          nodes    = [],
          names    = [],
          togglerHtml = '',
          toggler;

      for( ; k >= 0; k-- ) {
        // Keep node
        nodes.push(_nested[k]['node']);

        // Unique names
        if( ! namesMap[_nested[k]['name']] ) {
          namesMap[_nested[k]['name']] = 1;
          names.push(_nested[k]['name']);
        };
      };

      // Prepare toggler text
      togglerHtml += 'Еще ' + total + ' ' + plural(total, ['коммент', 'коммента', 'комментов']);
      if( root && root.username ) { togglerHtml += ' к ' + root.username; };
      togglerHtml += ' от ' + names.reverse().join(', ');

      // Append toggler
      toggler = makeEl('div')
        .setHtml(togglerHtml)
        .setClass(this.CN.showMore + ' indent_' + total)
        .insertBefore(scope[i].$el);

      // Make closure
      (function(nodes, toggler) {
        toggler.bindEvent('click', function(e) {
          // prevent lepra new.js 2924
          e && e.stopPropagation();

          // Show nodes
          for( var i = nodes.length - 1; i >= 0; i-- ) {
            nodes[i].expandFast();
          };
          // Remove toggler
          toggler.destroy();
        });
      })(nodes, toggler);
    };

    /**
     * Get nested comments related to node.childComments
     *
     * @private
     * @see Comment class
     * @param {Object} node Comment node
     * @returns {Array} Array of { node: ... user: ... }
     */
    function _getNestedComments(node) {
      var k, i,
          r = [{
            node: node,
            name: node.username
          }];

      // Hide current node. It is nested
      node.collapseFast();

      if( node.childComments.length ) {
        for( i = 0; k = node.childComments[i]; i++ ) {
          r.push(_getNestedComments(k));
        };
      };
      return [].concat.apply([], r);
    };

    return true;
  };
  /**
   * Hide all comments
   *
   * @public
   */
  Pane.prototype.hideAllComments = function() {
    for( var i = this.DATA.comments.all.length - 1; i >= 0; i-- ) {
      this.DATA.comments.all[i].$el.style.display = 'none';
    };
    this.isFiltered = true;
    return true;
  };
  /**
   * Hide all comments
   *
   * @public
   * @fires thumbs#click
   */
  Pane.prototype.showAllComments = function() {
    for( var i = this.DATA.comments['all'].length - 1; i >= 0; i-- ) {
      this.DATA.comments['all'][i].$el.style.display = 'block';
    };
    this.isFiltered = false;
    return true;
  };
  /**
   * Comments filter
   *
   * @param {Object} params Filter params object
   * @param {String} params.type Filter type
   * @param {String} params.value Filter value
   * @public
   */
  Pane.prototype.doFilter = function(params) {
    // GM_log('doFilter', params);

    switch(params.type.toLowerCase()) {
      case 'comment':
        // Show all
        if( params.value == 'all' ) {
          return this.showAllComments();
        };

        // Show only given type
        this.hideAllComments();
        for( var i = this.DATA.comments[params.value].length - 1; i >= 0; i-- ) {
          this.DATA.comments[params.value][i].$el.style.display = 'block';
        };

        // Scroll to first one
        this.DATA.comments[params.value][0].scrollToPost();
        break;
      case 'user':

        break;
      default:break;
    };
  };

  /**
   * -_-_-_-_-_-_-_,------,
   * _-_-_-_-_-_-_-|   /\_/\
   * -_-_-_-_-_-_-~|__( ^ .^)
   * _-_-_-_-_-_-_-""  ""
   */
  try     { new Pane(collectComments()); }
  catch(e){ GM_log(NAMESPACE + ' :: error >', e); };
})(window, document, document.body, 'leprapane');
