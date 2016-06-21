// @Author: Joshua Tanner
// @Date: 12/8/2014 (created)
// @Description: Easy way to create shapefiles (and geojson, geoservices json)
//               from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName
// @githubURL : https://github.com/tannerjt/AGStoShapefile

// Node Modules
var ogr2ogr = require('ogr2ogr');
var q = require('q');
var request = q.nfbind(require('request'));
var fs = require('fs');
var queryString = require('query-string');

// ./mixin.js
// merge user query params with default
var mixin = require('./mixin');

var serviceFile = process.argv[2] || 'services.txt';
var outDir = process.argv[3] || './output/';
if(outDir[outDir.length - 1] !== '/') {
	outDir += '/';
}

// Make request to each service
fs.readFile(serviceFile, function (err, data) {
	if (err) {
		console.log(err);
		throw err;
	}
	data.toString().split('\n').forEach(function (service) {
		var service = service.split('|');
		//get total number of records | assume 1000 max each request
		if(service[0].split('').length == 0) return;
		var baseUrl = getBaseUrl(service[0].trim()) + '/query';
		request({
			url : baseUrl + "/?where=1=1&returnIdsOnly=true&f=json",
			method : 'GET',
			json : true
		}, function (err, response, body) {
			var err = err || body.error;
			if(err) {
				console.log(err);
				throw err;
			}
			requestService(service[0].trim(), service[1].trim(), body.objectIds);
		});
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName, objectIds) {
	var requests = [];

	for(var i = 0; i < Math.ceil(objectIds.length / 100); i++) {
		var ids = [];
		if ( ((i + 1) * 100) < objectIds.length ) {
			ids = objectIds.slice(i * 100, (i + 1) * 100);
		} else {
			ids = objectIds.slice(i * 100, objectIds.length);
		}
		// we need these query params
		var reqQS = {
			objectIds : ids.join(','),
			geometryType : 'esriGeometryEnvelope',
			returnGeometry : true,
			returnIdsOnly : false,
			outFields : '*',
			outSR : '4326',
			f : 'json'
		};
		// user provided query params
		var userQS = getUrlVars(serviceUrl);
		// mix one obj with another
		var qs = mixin(userQS, reqQS);
		var qs = queryString.stringify(qs);
		var url = decodeURIComponent(getBaseUrl(serviceUrl) + '/query/?' + qs);
		var r = request({
			url : url,
			method : 'GET',
			json : true
		});

		requests.push(r);
	};

	q.allSettled(requests).then(function (results) {
		for(var i = 0; i < results.length; i++) {
			if(i == 0) {
				allFeatures = results[i].value[0].body;
			} else {
				if(!allFeatures.features) return;
				allFeatures.features = allFeatures.features.concat(results[i].value[0].body.features);
			}
		}
		console.log('creating', serviceName, 'json');
		var json = allFeatures;
		fs.writeFile(outDir + serviceName + '.json', JSON.stringify(json), function (err) {
			if(err) throw err;
			// Create Geojson
			console.log('creating', serviceName, 'geojson');
			var ogr = ogr2ogr(outDir + serviceName + '.json')
				.skipfailures();

			ogr.exec(function (er, data) {
				if (er) console.log(er);

				fs.writeFile(outDir + serviceName + '.geojson', JSON.stringify(data), function (err) {
					// Create Shapefile once geojson written
					if (er) console.log(er);
					console.log('creating', serviceName, 'shapefile');
					var shapefile = ogr2ogr(outDir + serviceName + '.geojson')
						.format('ESRI Shapefile')
						.skipfailures();

					shapefile.stream().pipe(fs.createWriteStream(outDir + serviceName + '.zip'));
				});
			});

		});

	}).catch(function (err) {
		console.log(err);
		throw err;
	});
}


//http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url
function getUrlVars(url) {
    var vars = {}, hash;
    var hashes = url.slice(url.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars[hash[0].toString()] = hash[1];
    }
    return vars;
}

// get base url for query
function getBaseUrl(url) {
	// remove any query params
	var url = url.split("?")[0];
	if((/\/$/ig).test(url)) {
		url = url.substring(0, url.length - 1);
	}
	return url;
}
