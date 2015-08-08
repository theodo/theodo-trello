// Thanks @unscriptable - http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
var debounce = function (func, threshold, execAsap) {
    var timeout;
    return function debounced () {
    	var obj = this, args = arguments;
		function delayed () {
			if (!execAsap)
				func.apply(obj, args);
			timeout = null;
		};

		if (timeout)
			clearTimeout(timeout);
		else if (execAsap)
			func.apply(obj, args);

		timeout = setTimeout(delayed, threshold || 100);
	};
}

// For MutationObserver
var obsConfig = { childList: true, characterData: true, attributes: false, subtree: true };
var _pointSeq = ['?', 0, .5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '∞'];
var _pointsAttr = ['cpoints', 'points'];

//internals
var reg = /((?:^|\s))\((\?|\∞|\d*\.?\d+)(\))\s?/m, //parse regexp- accepts digits, decimals and '?' and '∞', surrounded by ()
    regC = /((?:^|\s))\[(\?|\∞|\d*\.?\d+)(\])\s?/m, //parse regexp- accepts digits, decimals and '?' and '∞', surrounded by []
    iconUrl, pointsDoneUrl,
	flameUrl, flame18Url,
	scrumLogoUrl, scrumLogo18Url;
if(typeof chrome !== 'undefined'){
  // Works in Chrome
	iconUrl = chrome.extension.getURL('images/storypoints-icon.png');
	pointsDoneUrl = chrome.extension.getURL('images/points-done.png');
	scrumLogoUrl = chrome.extension.getURL('images/trellodo-12x12.png');
	scrumLogo18Url = chrome.extension.getURL('images/trellodo-18x18.png');
}
function round(_val) {return (Math.round(_val * 100) / 100)};

// Comment out before release - makes cross-browser debugging easier.
//function log(msg){
//	if(typeof chrome !== 'undefined'){
//		console.log(msg);
//	} else {
//		$($('.header-btn-text').get(0)).text(msg);
//	}
//}

// Some browsers have serious errors with MutationObserver (eg: Safari doesn't have it called MutationObserver).
var CrossBrowser = {
	init: function(){
		this.MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver || null;
	}
};
CrossBrowser.init();

//what to do when DOM loads
$(function(){
	//watch filtering
	function updateFilters() {
		setTimeout(calcListPoints);
	};
	$('.js-toggle-label-filter, .js-select-member, .js-due-filter, .js-clear-all').live('mouseup', calcListPoints);
	$('.js-input').live('keyup', calcListPoints);
	$('.js-share').live('mouseup',function(){
		setTimeout(checkExport,500)
	});

	calcListPoints();
});

// Recalculates every card and its totals (used for significant DOM modifications).
var recalcListAndTotal = debounce(function($el){
    ($el||$('.list')).each(function(){
		if(!this.list) new List(this);
		else if(this.list.refreshList){
			this.list.refreshList(); // make sure each card's points are still accurate (also calls list.calc()).
		}
	})
}, 500, false);

var recalcTotalsObserver = new CrossBrowser.MutationObserver(function(mutations)
{
	// Determine if the mutation event included an ACTUAL change to the list rather than
	// a modification caused by this extension making an update to points, etc. (prevents
	// infinite recursion).
	var doFullRefresh = false;
	var refreshJustTotals = false;
	$.each(mutations, function(index, mutation){
		var $target = $(mutation.target);

		// Ignore a bunch of known cases that send mutation events which don't require us to recalcListAndTotal.
		if(! ($target.hasClass('list-total')
			  || $target.hasClass('list-title')
			  || $target.hasClass('list-header')
			  || $target.hasClass('date') // the 'time-ago' functionality changes date spans every minute
			  || $target.hasClass('js-phrase') // this is constantly updated by Trello, but doesn't affect estimates.
              || $target.hasClass('member')
              || $target.hasClass('clearfix')
              || $target.hasClass('badges')
			  || $target.hasClass('header-btn-text')
              || (typeof mutation.target.className == "undefined")
			  ))
		{
			if($target.hasClass('badge')){
                if(!$target.hasClass("consumed")){
    				refreshJustTotals = true;
                }
			} else {
				// It appears this was an actual modification and not a recursive notification.
				doFullRefresh = true;
			}
		}
	});

	if(doFullRefresh){
		recalcListAndTotal();
	} else if(refreshJustTotals){
		calcListPoints();
	}

    $editControls = $(".card-detail-title .edit-controls");
    if($editControls.length > 0)
    {
        showPointPicker($editControls.get(0));
    }
});
recalcTotalsObserver.observe(document.body, obsConfig);

var ignoreClicks = function(){ return false; };
//calculate board totals
var ctto;
function computeTotal(){
	clearTimeout(ctto);
	ctto = setTimeout(function(){
		var $title = $('.board-header-btns.mod-right,#board-header a');
		var $total = $title.children('.list-total').empty();
		if ($total.length == 0)
			$total = $('<span/>', {class: "list-total"}).appendTo($title);

		for (var i in _pointsAttr){
			var score = 0,
				attr = _pointsAttr[i];
			$('#board .list-total .'+attr).each(function(){
				score+=parseFloat(this.textContent)||0;
			});
			var scoreSpan = $('<span/>', {class: attr}).text(round(score)||'');
			$total.append(scoreSpan);
		}
	});
};

//calculate list totals
var lto;
function calcListPoints(){
	clearTimeout(lto);
	lto = setTimeout(function(){
		$('.list').each(function(){
			if(!this.list) new List(this);
			else if(this.list.calc) this.list.calc();
		});
	});
};

//.list pseudo
function List(el){
	if(el.list)return;
	el.list=this;

	var $list=$(el),
		$total=$('<span class="list-total">'),
		busy = false,
		to,
		to2;

	function readCard($c){
		if($c.target) {
			if(!/list-card/.test($c.target.className)) return;
			$c = $($c.target).filter('.list-card:not(.placeholder)');
		}
		$c.each(function(){
			if(!this.listCard) for (var i in _pointsAttr)
				new ListCard(this,_pointsAttr[i]);
			else for (var i in _pointsAttr)
				setTimeout(this.listCard[_pointsAttr[i]].refresh);
		});
	};

	// All calls to calc are throttled to happen no more than once every 500ms (makes page-load and recalculations much faster).
	var self = this;
	this.calc = debounce(function(){
		self._calcInner();
    }, 500, true); // executes right away unless over its 500ms threshold since the last execution
	this._calcInner	= function(e){ // don't call this directly. Call calc() instead.
		//if(e&&e.target&&!$(e.target).hasClass('list-card')) return; // TODO: REMOVE - What was this? We never pass a param into this function.
		clearTimeout(to);
		to = setTimeout(function(){
			$total.empty().appendTo($list.find('.list-title,.list-header'));
			for (var i in _pointsAttr){
				var score=0,
					attr = _pointsAttr[i];
				$list.find('.list-card:not(.placeholder)').each(function(){
					if(!this.listCard) return;
					if(!isNaN(Number(this.listCard[attr].points))){
						// Performance note: calling :visible in the selector above leads to noticible CPU usage.
						if(jQuery.expr.filters.visible(this)){
							score+=Number(this.listCard[attr].points);
						}
					}
				});
				var scoreTruncated = round(score);
				var scoreSpan = $('<span/>', {class: attr}).text( (scoreTruncated>0) ? scoreTruncated : '' );
				$total.append(scoreSpan);
				computeTotal();
			}
		});
	};

    this.refreshList = debounce(function(){
    		readCard($list.find('.list-card:not(.placeholder)'));
            this.calc(); // readCard will call this.calc() if any of the cards get refreshed.
    }, 500, false);

	var cardAddedRemovedObserver = new CrossBrowser.MutationObserver(function(mutations)
	{
		// Determine if the mutation event included an ACTUAL change to the list rather than
		// a modification caused by this extension making an update to points, etc. (prevents
		// infinite recursion).
		$.each(mutations, function(index, mutation){
			var $target = $(mutation.target);

			// Ignore a bunch of known elements that send mutation events.
			if(! ($target.hasClass('list-total')
					|| $target.hasClass('list-title')
					|| $target.hasClass('list-header')
					|| $target.hasClass('badge-points')
					|| $target.hasClass('badges')
					|| (typeof mutation.target.className == "undefined")
					))
			{
				var list;
				// It appears this was an actual mutation and not a recursive notification.
				$list = $target.closest(".list");
				if($list.length > 0){
					list = $list.get(0).list;
					if(!list){
						list = new List(mutation.target);
					}
					if(list){
						list.refreshList(); // debounced, so its safe to call this multiple times for the same list in this loop.
					}
				}
			}
		});
	});

    cardAddedRemovedObserver.observe($list.get(0), obsConfig);

	setTimeout(function(){
		readCard($list.find('.list-card'));
		setTimeout(el.list.calc);
	});
};

//.list-card pseudo
function ListCard(el, identifier){
	if(el.listCard && el.listCard[identifier]) return;

	//lazily create object
	if (!el.listCard){
		el.listCard={};
	}
	el.listCard[identifier]=this;

	var points=-1,
		consumed=identifier!=='points',
		regexp=consumed?regC:reg,
		parsed,
		that=this,
		busy=false,
		$card=$(el),
		$badge=$('<div class="badge badge-points point-count" style="background-image: url('+iconUrl+')"/>'),
		to,
		to2;

	// MutationObservers may send a bunch of similar events for the same card (also depends on browser) so
	// refreshes are debounced now.
	var self = this;
	this.refresh = debounce(function(){
		self._refreshInner();
    }, 250, true); // executes right away unless over its 250ms threshold
	this._refreshInner=function(){
		if(busy) return;
		busy = true;
		clearTimeout(to);
		to = setTimeout(function(){
			var $title=$card.find('a.list-card-title');
			if(!$title[0])return;
			var titleTextContent = $title[0].childNodes[1].textContent;
			if(titleTextContent) el._title = titleTextContent;

			// Get the stripped-down (parsed) version without the estimates, that was stored after the last change.
			var parsedTitle = $title.data('parsed-title');
			if(titleTextContent != parsedTitle){
				// New card title, so we have to parse this new info to find the new amount of points.
				parsed=titleTextContent.match(regexp);
				points=parsed?parsed[2]:-1;
			} else {
				// Title text has already been parsed... process the pre-parsed title to get the correct points.
				var origTitle = $title.data('orig-title');
				parsed=origTitle.match(regexp);
				points=parsed?parsed[2]:-1;
			}

			clearTimeout(to2);
			to2 = setTimeout(function(){
				// Add the badge (for this point-type: regular or consumed) to the badges div.
				$badge
					.text(that.points)
					[(consumed?'add':'remove')+'Class']('consumed')
					.attr({title: 'This card has '+that.points+ (consumed?' consumed':'')+' storypoint' + (that.points == 1 ? '.' : 's.')})
					.prependTo($card.find('.badges'));

				// Update the DOM element's textContent and data if there were changes.
				if(titleTextContent != parsedTitle){
					$title.data('orig-title', titleTextContent); // store the non-mutilated title (with all of the estimates/time-spent in it).
				}
				parsedTitle = $.trim(el._title.replace(reg,'$1').replace(regC,'$1'));
				el._title = parsedTitle;
				$title.data('parsed-title', parsedTitle); // save it to the DOM element so that both badge-types can refer back to it.
				$title[0].childNodes[1].textContent = parsedTitle;
				var list = $card.closest('.list');
				if(list[0]){
					list[0].list.calc();
				}
				busy = false;
			});
		});
	};

	this.__defineGetter__('points',function(){
		return parsed?points:''
	});

	var cardShortIdObserver = new CrossBrowser.MutationObserver(function(mutations){
		$.each(mutations, function(index, mutation){
			var $target = $(mutation.target);
			if(mutation.addedNodes.length > 0){
				$.each(mutation.addedNodes, function(index, node){
					if($(node).hasClass('card-short-id')){
						// Found a card-short-id added to the DOM. Need to refresh this card.
						var listElement = $target.closest('.list').get(0);
						if(!listElement.list) new List(listElement); // makes sure the .list in the DOM has a List object

						var $card = $target.closest('.list-card');
						if($card.length > 0){
							var listCardHash = $card.get(0).listCard;
							if(listCardHash){
								// The hash contains a ListCard object for each type of points (cpoints, points, possibly more in the future).
								$.each(_pointsAttr, function(index, pointsAttr){
									listCardHash[pointsAttr].refresh();
								});
							}
						}
					}
				});
			}
		});
	});

	// The MutationObserver is only attached once per card (for the non-consumed-points ListCard) and that Observer will make the call
	// to update BOTH types of points-badges.
	if(!consumed){
		var observerConfig = { childList: true, characterData: false, attributes: false, subtree: true };
		cardShortIdObserver.observe(el, observerConfig);
	}

	setTimeout(that.refresh);
};

//the story point picker
function showPointPicker(location) {
	if($(location).find('.picker').length) return;
	var $picker = $('<div/>', {class: "picker"}).appendTo('.card-detail-title .edit-controls');
	$picker.append($('<span>', {class: "picker-title"}).text("Estimated Points"));

	var estimateSequence = _pointSeq;
	for (var i in estimateSequence) $picker.append($('<span>', {class: "point-value"}).text(estimateSequence[i]).click(function(){
		var value = $(this).text();
		var $text = $('.card-detail-title .edit textarea');
		var text = $text.val();

		// replace our new
		$text[0].value=text.match(reg)?text.replace(reg, '('+value+') '):'('+value+') ' + text;

		// then click our button so it all gets saved away
		$(".card-detail-title .edit .js-save-edit").click();

		return false
	}))

	if($(location).find('.picker-consumed').length) return;
	var $pickerConsumed = $('<div/>', {class: "picker-consumed"}).appendTo('.card-detail-title .edit-controls');
	$pickerConsumed.append($('<span>', {class: "picker-title"}).text("Consumed Points"));

	var consumedSequence = _pointSeq;
	for (var i in consumedSequence) $pickerConsumed.append($('<span>', {class: "point-value"}).text(consumedSequence[i]).click(function(){
		var value = $(this).text();
		var $text = $('.card-detail-title .edit textarea');
		var text = $text.val();

		// replace our new
		$text[0].value=text.match(regC)?text.replace(regC, ' ['+value+']'):text + ' ['+value+']';

		// then click our button so it all gets saved away
		$(".card-detail-title .edit .js-save-edit").click();

		return false
	}))
};
