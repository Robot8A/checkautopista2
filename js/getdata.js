fw = [];
function Freeway(relID) {
	this.type = 'relation'
	this.relID = relID;
	this.tags = undefined;
	this.bounds = undefined;
	this.country = undefined;
	this.exits = [];
	this.tollBooths = [];
	this.tollGantrys = [];
	this.areasNode = [];
	this.areasWay = [];
	this.unmarked = [];
	this.otherNodesIDs = [];
	this.waysIDs = [];
	this.loaded = 0;
	this.analysis = new Analysis();
	this.timestamp = undefined;
};

node = [];
function Node(element) {
	this.type = 'node';
	if(element!==undefined) {
		this.nodeID = element.id;
		this.lat = element.lat;
		this.lon = element.lon;
		this.tags = element.tags;
	} else {
		this.nodeID = undefined;
		this.lat = undefined;
		this.lon = undefined;
		this.tags = undefined;
	};
}

way = [];
function Way(element) {
	this.type = 'way';
	this.wayID = element.id;
	this.nodes = element.nodes;		// nodeIDs of nodes that make this way
	this.exitNodes = [];	// array of exit nodes connected to this way
	this.tags = element.tags;
	this.prev = [];		// array of ways that are before this way
	this.next = [];		// array of ways that are after this way
	this.hasDestination = function () {
		// Returns true if this way has any destination tag

		if (this.tags['destination']) { return true; };
		if (this.tags['destination:street']) { return true; };
		if (this.tags['destination:ref']) { return true; };
		if (this.tags['destination:int_ref']) { return true; };
		if (this.tags['destination:symbol']) { return true; };
		return false;
	};
	this.getDestination = function () {
		// Returns the destination tags of this way

		if (!this.hasDestination()) {
			return undefined;
		};

		var dest = '';
		if (this.tags['destination:street']) { 
			dest += this.tags['destination:street'] + ';';
		};
		if (this.tags.destination) {
			dest += this.tags['destination'];
		};
		return dest;
	};
}

function Exit() {
	this.subtype = 'exit';
	this.linkWays = [];			// motorway_link ways connected to this exit
	this.parentWays = [];		// motorway ways connected to this exit
	this.prev = [];		// previous exit
	this.next = [];		// next exit
	this.hasDestination = function () {
		// Returns true if the motorway_link way of this exit has destination

		for (var i in this.linkWays) {
			if (this.linkWays[i].hasDestination()) {
				return true;
			};
		}
		return false;
	};
}

Exit.prototype = new Node();

rq1 = [];
Freeway.prototype.loadFreewayData = function(opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 8; };
	console.log('Loading freeway data');
	console.time('loadFreewayData');
	var query = '[out:json][timeout:'+opt.timeout+'];(relation('+this.relID+');way(r);node(w););out bb body qt;';
	var fwy = this;
	rq1[this.relID] = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if(response.remark!=undefined) {
				console.timeEnd('loadFreewayData');
				console.log('ERROR: Timeout when loading freeway data'); opt.timeout+=5; fwy.loadFreewayData(opt); return;
			};
			if(response.elements.length==0) {
				console.log('ERROR: Incorrect relation ID'); 
				$('li#road').toggleClass('disabled', true);
				$('li#road i').attr('class', 'fa fa-road');
				$('li#stats').toggleClass('disabled', true);
				$('li#stats i').attr('class', 'fa fa-bar-chart');
				$('li#info').toggleClass('disabled', true);
				return;
			}
			fwy.timestamp = new Date(response.osm3s.timestamp_osm_base);
			for (var i = 0; i < response.elements.length; i++) {
				// Get info from relation
				if (response.elements[i].type=='relation'){
					fwy.tags = response.elements[i].tags;
					fwy.bounds = response.elements[i].bounds;
					for (var j = 0; j < response.elements[i].members.length; j++) {
						if (response.elements[i].members[j].type=='way') {
							fwy.waysIDs.push(response.elements[i].members[j].ref);
						};
					};
				// Get info from nodes
				} else if (response.elements[i].type=='node') {
					if (response.elements[i].tags!=undefined) {
						// Get info from exits
						if (response.elements[i].tags.highway=='motorway_junction') {
							var ex = new Exit();
							ex.nodeID = response.elements[i].id;
							ex.lat = response.elements[i].lat;
							ex.lon = response.elements[i].lon;
							ex.tags = response.elements[i].tags;
							node[ex.nodeID] = ex;
							fwy.exits.push(ex);
						// Get info from toll_booths
						} else if (response.elements[i].tags.barrier=='toll_booth') {
							node[response.elements[i].id] = new Node(response.elements[i]);
							fwy.tollBooths.push(node[response.elements[i].id]);
						// Get info from toll_gantrys
						} else if (response.elements[i].tags.highway=='toll_gantry') {
							node[response.elements[i].id] = new Node(response.elements[i]);
							fwy.tollGantrys.push(node[response.elements[i].id]);
						} else {
							fwy.otherNodesIDs.push(response.elements[i].id);
							node[response.elements[i].id] = new Node(response.elements[i]);
						};
					} else {
						fwy.otherNodesIDs.push(response.elements[i].id);
						node[response.elements[i].id] = new Node(response.elements[i]);
					};
				// Get info from ways
				} else if (response.elements[i].type=='way') {
					way[response.elements[i].id] = new Way(response.elements[i]);
				};
			};
			// Get previous/next ways of each way
			for (var i = 0; i < fwy.waysIDs.length; i++) {
				var wayi = way[fwy.waysIDs[i]];
				var lasti = wayi.nodes.length-1;
				for (var j = 0; j < fwy.waysIDs.length; j++) {
					var wayj = way[fwy.waysIDs[j]];
					var lastj = wayj.nodes.length-1;
					// Skip if it's the same way
					if (wayi==wayj) { continue; };
					// Checking first node
					if (wayi.nodes[0]==wayj.nodes[0] ||
						wayi.nodes[0]==wayj.nodes[lastj]) {
						if (!wayi.tags || wayi.tags.oneway!='-1') {
							wayi.prev.push(wayj);
						} else {
							wayi.next.push(wayj);
						};
					};
					//Checking last node
					if (wayi.nodes[lasti]==wayj.nodes[0] ||
						wayi.nodes[lasti]==wayj.nodes[lastj]) {
						if (!wayi.tags || wayi.tags.oneway!='-1') {
							wayi.next.push(wayj);
						} else {
							wayi.prev.push(wayj);
						};
					};
				};
			};
			// Get parentWays of each exit & exitNodes of each way
			for (var i = 0; i < fwy.waysIDs.length; i++) {
				var wayi = way[fwy.waysIDs[i]];
				for (var j = 0; j < wayi.nodes.length; j++) {
					var nodej = wayi.nodes[j];
					if (node[nodej] && node[nodej].subtype=='exit') {
						node[nodej].parentWays.push(wayi);
						if (wayi.tags.oneway!='-1') {
							wayi.exitNodes.push(node[nodej]);
						} else {
							wayi.exitNodes.unshift(node[nodej]);
						};
						
					};
				};
			};
			// Get prev/next exit of each exit
			for (var i = 0; i < fwy.exits.length; i++) {
				var exiti = fwy.exits[i];
				var timeout;
				// look for the next exit node
				var wayj = exiti.parentWays[0];
				timeout = 0;
				while (exiti.next.length==0 && wayj) {
					if (wayj.exitNodes.length>0) { 
						var k = wayj.exitNodes.indexOf(exiti);
						if (k<0) {
							exiti.next.push(wayj.exitNodes[0]);
						} else if (k<wayj.exitNodes.length-1) {
							exiti.next.push(wayj.exitNodes[k+1]);
						};
					};
					wayj=wayj.next[0];
					if (wayj==exiti.parentWays[0]) { break; };
					timeout++;
					if (timeout>1000) { break; }
				};
				// look for the previous exit node
				var wayj = exiti.parentWays[0];
				timeout = 0;
				while (exiti.prev.length==0 && wayj) {
					if (wayj.exitNodes.length>0) { 
						var k = wayj.exitNodes.indexOf(exiti);
						if (k<0) {
							exiti.prev.push(wayj.exitNodes[wayj.exitNodes.length-1]);
						} else if (k>0) {
							exiti.prev.push(wayj.exitNodes[k-1]);
						};
					};
					wayj=wayj.prev[0];
					if (wayj==exiti.parentWays[0]) { break; };
					timeout++;
					if (timeout>1000) { break; };
				};
			};

			if (opt && opt.zoom) { fwy.zoom() };
			fwy.loaded++;
			console.timeEnd('loadFreewayData');
			fwy.getAnalysis();
			fwy.loadCountry();
		}
	)
	.fail( function (response) {
		console.timeEnd('loadFreewayData');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when loading freeway data'); fwy.loadFreewayData();
		} else { console.log('ERROR: Abort when loading freeway data'); };
	});
}

rq2 = [];
Freeway.prototype.loadCountry = function(opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 5; };
	console.log('Loading country');
	console.time('loadCountry');
	var query = '[out:json][timeout:'+opt.timeout+'];is_in(' + this.exits[0].lat + ',' + this.exits[0].lon + ');area._[admin_level="2"];out tags;';
	var fwy = this;
	rq2[this.relID] = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if (response.remark!=undefined) { 
				console.timeEnd('loadCountry');
				console.log('ERROR: Timeout when loading country'); opt.timeout+=5; fwy.loadCountry(opt); return; 
			};
			if (response.elements[0]) {
				fwy.country = response.elements[0].tags['ISO3166-1'];
			}
			fwy.loaded++;
			console.timeEnd('loadCountry');
			fwy.getAnalysis();
			fwy.loadDestinationUnmarked();
		}
	)
	.fail( function (response) {
		console.timeEnd('loadCountry');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when loading country'); fwy.loadCountry();
		} else { console.log('ERROR: Abort when loading country'); };
	});
}

rq3 = [];
Freeway.prototype.loadDestinationUnmarked = function(opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 8; };
	console.log('Loading destination & unmarked');
	console.time('loadDestinationUnmarked');
	var query = '[out:json][timeout:'+opt.timeout+'];relation('+this.relID+');way(r);node(w);way(bn);out body qt;';
	var fwy = this;
	rq3[this.relID] = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if (response.remark!=undefined) {
				console.timeEnd('loadDestinationUnmarked');
				console.log('ERROR: Timeout when loading destination & unmarked'); opt.timeout+=5; fwy.loadDestinationUnmarked(opt); return; 
			};
			// Get corresponding motorway_link
			for (var i = 0; i < response.elements.length; i++) {
				if(!response.elements[i].tags) { continue; }; // Remove untagged ways
				if(!(response.elements[i].tags.highway=='motorway_link') &&
					!(response.elements[i].tags.highway=='construction' && response.elements[i].tags.construction=='motorway_link') &&
					!(response.elements[i].tags.highway=='proposed' && response.elements[i].tags.proposed=='motorway_link')) {
					continue // Remove ways which are not motorway_link
				};
				for (var j = 0; j < fwy.exits.length; j++) {
					// Searching for the motorway_junction corresponding to this motorway_link
					if(fwy.exits[j].nodeID==response.elements[i].nodes[0] && response.elements[i].tags.oneway=='yes' || 
						fwy.exits[j].nodeID==response.elements[i].nodes[response.elements[i].nodes.length-1] && response.elements[i].tags.oneway=='-1'){
						way[response.elements[i].id] = new Way(response.elements[i]);
						fwy.exits[j].linkWays.push(way[response.elements[i].id]);
					};
				};
			};
			// Get Unmarked Exits
			for (var i = 0; i < response.elements.length; i++) {
				if (!response.elements[i].tags || !response.elements[i].tags.highway) { continue; };
				if (['motorway_link','trunk_link','service'].indexOf(response.elements[i].tags.highway)==-1) { continue; };
				if (response.elements[i].tags.access=='no') { continue; };
				if (response.elements[i].tags.access=='private') { continue; };
				if (fwy.waysIDs.indexOf(response.elements[i].id)==-1) {
					if (response.elements[i].tags.oneway=="-1") {
						var firstNode = response.elements[i].nodes[response.elements[i].nodes.length-1];
					} else {
						var firstNode = response.elements[i].nodes[0];
					};
					if (fwy.otherNodesIDs.indexOf(firstNode)!=-1) {
						if (node[firstNode].tags!=undefined && (node[firstNode].tags.highway=='services' || node[firstNode].tags.highway=='rest_area')) { continue; };
						fwy.unmarked.push(node[firstNode]);
					};
				};
			};
			fwy.loaded++;
			console.timeEnd('loadDestinationUnmarked');
			fwy.getAnalysis();
			fwy.loadAreas();
		}
	)
	.fail( function (response) {
		console.timeEnd('loadDestinationUnmarked');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when loading destination & unmarked'); fwy.loadDestinationUnmarked();
		} else { console.log('ERROR: Abort when loading destination & unmarked'); };
	});
}

rq4 = [];
Freeway.prototype.loadAreas = function(opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 25; };
	console.log('Loading areas');
	console.time('loadAreas');
	var query = '[out:json][timeout:'+opt.timeout+'];relation(' + this.relID + ');way(r);node(w);(node(around:500)["highway"~"services|rest_' +
		'area"]->.x;way(around:500)["highway"~"services|rest_area"];);(._;>;);out center qt;';
	var fwy = this;
	rq4[this.relID] = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if (response.remark!=undefined) { 
				console.timeEnd('loadAreas');
				console.log('ERROR: Timeout when loading areas'); opt.timeout+=10; fwy.loadAreas(opt); return; 
			};
			for (var i = 0; i < response.elements.length; i++) {
				if(!response.elements[i].tags || !response.elements[i].tags.highway) { continue; };
				if(response.elements[i].tags.highway!=='services'&&response.elements[i].tags.highway!=='rest_area') { continue; };
				if(response.elements[i].type=='node') {
					node[response.elements[i].id] = new Node(response.elements[i]);
					fwy.areasNode.push(node[response.elements[i].id]);
				} else if (response.elements[i].type=='way') {
					way[response.elements[i].id] = new Way(response.elements[i]);
					way[response.elements[i].id].center = response.elements[i].center;
					fwy.areasWay.push(way[response.elements[i].id]);
				};
			};
			for (var i = 0; i < response.elements.length; i++) {
				if (node[response.elements[i].id]==undefined) { node[response.elements[i].id] = new Node(response.elements[i]); };
			};
			fwy.loaded++;
			console.timeEnd('loadAreas');
			fwy.getAnalysis();
		}
	)
	.fail( function (response) {
		console.timeEnd('loadAreas');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when loading areas'); fwy.loadAreas();
		} else { console.log('ERROR: Abort when loading areas'); };
	});
}

function loadFreeway (relID, opt) {
	killRequests();
	console.log('\nLoading freeway [relID='+relID+']');
	$('li#road i').attr('class', 'fa fa-spinner fa-spin'); $('li#road').toggleClass('disabled', false);
	$('li#stats i').attr('class', 'fa fa-spinner fa-spin');
	fw[relID] = new Freeway();
	fw[relID].relID = relID;
	fw[relID].loadFreewayData(opt);
	updatePermalink(relID);
	return fw[relID];
}

function searchInMap (opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 60; };
	killRequests();
	$('li#search i').attr('class', 'fa fa-spin fa-spinner');
	console.log('\nSearching in map');
	console.time('searchInMap');
	var query = '[out:json][timeout:'+opt.timeout+'];relation[route=road]('+
		map.getBounds().getSouth()+','+map.getBounds().getWest()+','+map.getBounds().getNorth()+','+map.getBounds().getEast()+
		');foreach(out tags; way(r); out tags 1 qt;);';
	rq0 = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if (response.remark!=undefined) { 
				console.timeEnd('searchInMap');
				console.log('ERROR: Timeout when searching in map'); opt.timeout+=60; searchInMap(opt); return; 
			};
			$('li#search i').attr('class', 'fa fa-search');
			var fwVisible = [];
			for (var i = 0; i < response.elements.length; i++) {
				if (response.elements[i].type!=='relation') {continue; };
				if (response.elements[i+1].type!=='way') {continue; };
				if (response.elements[i+1].tags.highway=='motorway'||response.elements[i+1].tags.highway=='motorway_link'||
					response.elements[i+1].tags.construction=='motorway'||response.elements[i+1].tags.construction=='motorway_link') {
					fwVisible.push({relID:response.elements[i].id, tags:response.elements[i].tags});
				};
			};
			fwVisible.sort(sortAlgorithm);
			$('div#searchInMap button.download,div#searchInMap select').prop('disabled', fwVisible.length == 0);
			$("div#searchInMap select").html('');
			for (var i = 0; i < fwVisible.length; i++) {
				$("div#searchInMap select").append('<option value="'+fwVisible[i].relID+'">'+fwVisible[i].tags.ref+' — '+fwVisible[i].tags.name+'</option>');
			};
			console.timeEnd('searchInMap');
			console.log('Done');
		}
	)
	.fail( function (response) {
		console.timeEnd('searchInMap');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when searching in map'); searchInMap();
		} else { console.log('ERROR: Abort when searching in map'); };
	});
}

function searchByProp (opt) {
	if (!opt) { opt = {}; };
	if (!opt.timeout) { opt.timeout = 20; };
	killRequests();
	$('li#search i').attr('class', 'fa fa-spin fa-spinner');
	console.log('\nSearching by properties');
	console.time('searchByProp');
	var name = $('div#searchByProp input#name').val();
	var ref = $('div#searchByProp input#ref').val();
	var network = $('div#searchByProp input#network').val();
	var operator = $('div#searchByProp input#operator').val();
	var query = '[out:json][timeout:'+opt.timeout+'];relation[route=road]'+
		(name!=''?'[name~"'+name+'",i]':'')+
		(ref!=''?'[ref~"'+ref+'",i]':'')+
		(network!=''?'[network~"'+network+'",i]':'')+
		(operator!=''?'[operator~"'+operator+'",i]':'')+
		';foreach(out tags; way(r); out tags 1 qt;);';
	rq0 = $.getJSON('https://overpass-api.de/api/interpreter?data=' + query,
		function (response) {
			if (response.remark!=undefined) { 
				console.timeEnd('searchByProp');
				console.log('ERROR: Timeout when searching by properties'); opt.timeout+=20; searchByProp(opt); return; 
			};
			$('li#search i').attr('class', 'fa fa-search');
			var fwVisible = [];
			for (var i = 0; i < response.elements.length; i++) {
				if (response.elements[i].type!=='relation') {continue; };
				if (response.elements[i+1].type!=='way') {continue; };
				if (response.elements[i+1].tags.highway=='motorway'||response.elements[i+1].tags.highway=='motorway_link'||
					response.elements[i+1].tags.construction=='motorway'||response.elements[i+1].tags.construction=='motorway_link') {
					fwVisible.push({relID:response.elements[i].id, tags:response.elements[i].tags});
				};
			};
			fwVisible.sort(sortAlgorithm);
			$('div#searchByProp button.download,div#searchByProp select').prop('disabled', fwVisible.length == 0);
			$("select#visible").html('');
			for (var i = 0; i < fwVisible.length; i++) {
				$("div#searchByProp select").append('<option value="'+fwVisible[i].relID+'">'+fwVisible[i].tags.ref+' — '+fwVisible[i].tags.name+'</option>');
			};
			console.timeEnd('searchByProp');
			console.log('Done');
		}
	)
	.fail( function (response) {
		console.timeEnd('searchByProp');
		if (response.statusText!=='abort') { console.log('ERROR: Unknown error when searching by properties'); searchByProp();
		} else { console.log('ERROR: Abort when searching by properties'); };
	});
}

function sortAlgorithm (a,b) {
	if (a.tags.ref==undefined && b.tags.ref==undefined) {
		return +1;
	} else if (a.tags.ref==undefined && b.tags.ref!==undefined) {
		return +1;
	} else if (a.tags.ref!==undefined && b.tags.ref==undefined) {
		return -1;
	} else if (a.tags.ref.replace(/[0-9]/g, '') == b.tags.ref.replace(/[0-9]/g, '')) {
		return Number(a.tags.ref.replace(/\D/g,'')) > Number(b.tags.ref.replace(/\D/g,'')) ? +1 : -1;
	} else {
		return a.tags.ref.replace(/[0-9]/g,'') > b.tags.ref.replace(/[0-9]/g,'') ? +1 : -1;
	}
}

function killRequests() {
	if (typeof rq0 !== 'undefined') {rq0.abort(); };
	if (typeof rq1[options.relID] !== 'undefined') {rq1[options.relID].abort(); };
	if (typeof rq2[options.relID] !== 'undefined') {rq2[options.relID].abort(); };
	if (typeof rq3[options.relID] !== 'undefined') {rq3[options.relID].abort(); };
	if (typeof rq4[options.relID] !== 'undefined') {rq4[options.relID].abort(); };
	$('li#search i').attr('class', 'fa fa-search');
	$('li#road i').attr('class', 'fa fa-road');
	$('li#stats i').attr('class', 'fa fa-bar-chart');
}