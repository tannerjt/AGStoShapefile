// @Author: Joshua Tanner
// @Date: 12/8/2014 (created)
// @Description: Easy way to create shapefiles (and geojson, geoservices json)
//               from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName
// @githubURL : https://github.com/tannerjt/AGStoShapefile

// Node Modules
var ogr2ogr = require('ogr2ogr');
var esri2geo = require('esri2geo');
var q = require('q');
var request = q.nfbind(require('request'));
var objectstream = require('objectstream');
var fs = require('fs');
var queryString = require('query-string');
var winston = require('winston');

// Setup logging with winston
winston.level = 'debug';
// winston.add(winston.transports.File, {filename: './logfile.log'});

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
		winston.info(err);
		throw err;
	}
	data.toString().split('\n').forEach(function (service) {
		var service = service.split('|');
		if(service[0].split('').length == 0) return;
		var baseUrl = getBaseUrl(service[0].trim());

		var reqQS = {
			where: '1=1',
			returnIdsOnly: true,
			f: 'json'
		};
		var userQS = getUrlVars(service[0].trim());
		// mix one obj with another
		var qs = mixin(userQS, reqQS);
		var qs = queryString.stringify(qs);
		var url = decodeURIComponent(getBaseUrl(baseUrl) + '/query/?' + qs);

		request({
			url : url,
			method : 'GET',
			json : true
		}, function (err, response, body) {
			var err = err || body.error;
			if(err) {
				winston.info(err);
				throw err;
			}
			requestService(service[0].trim(), service[1].trim(), body.objectIds);
		});
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName, objectIds) {
	objectIds.sort();
	winston.info('Number of features for service: ', objectIds.length);
	winston.info('Getting chunks of 100 features...');
	var requests = [];

	for(var i = 0; i < Math.ceil(objectIds.length / 100); i++) {
		var ids = [];
		if ( ((i + 1) * 100) < objectIds.length ) {
			ids = objectIds.slice(i * 100, (i * 100) + 100);
		} else {
			ids = objectIds.slice(i * 100, objectIds[objectIds.length]);
		}

		if(ids[0] !== undefined) {
			winston.info('query ->', (i * 100) , 'out of', objectIds.length);
		} else {
			winston.info('wait for requests to settle...');
			continue;
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
		winston.info('all requests settled');
		var allFeatures;
		for(var i = 0; i < results.length; i++) {
			if(i == 0) {
				allFeatures = results[i].value[0].body;
			} else {
				allFeatures.features = allFeatures.features.concat(results[i].value[0].body.features);
			}
		}
		winston.info('creating', serviceName, 'json');
		var json = allFeatures;

		//esri json
		winston.info('Creating Esri JSON');
		var stream = fs.createWriteStream(outDir + serviceName + '.json');
		var objstream = objectstream.createSerializeStream(stream);
		objstream.write(json);
		objstream.end();

		//geojson
		winston.info('Creating GeoJSON');
		var stream = fs.createWriteStream(outDir + serviceName + '.geojson');
		var objstream = objectstream.createSerializeStream(stream);
		esri2geo(json, function (err, data) {
			if(err) {
				throw(err);
				winston.info('Error converting esri json to geojson');
				return;
			}
			objstream.write(data);
			objstream.end();
			winston.info('Creating Shapefile');
			//shapefile
			var shapefile = ogr2ogr(data)
				.format('ESRI Shapefile')
				.options(['-nln', serviceName])
				.skipfailures();
			shapefile.stream().pipe(fs.createWriteStream(outDir + serviceName + '.zip'));
		});

	}).catch(function (err) {
		winston.info(err);
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
