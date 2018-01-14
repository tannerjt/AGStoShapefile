// @Author: Joshua Tanner
// @Date: 12/8/2014 (created)
// @Description: Easy way to create shapefiles (and geojson, geoservices json)
//               from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName
// @githubURL : https://github.com/tannerjt/AGStoShapefile

// Node Modules
const fs = require('fs');
const q = require('q');
const request = q.nfbind(require('request'));
const _ = require('lodash');
const ogr2ogr = require('ogr2ogr');
const TerraformerArcGIS = require('terraformer-arcgis-parser');
const geojsonStream = require('geojson-stream');
const JSONStream = require('JSONStream');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const queryString = require('query-string');

const datename = Date.now();
const adapter = new FileSync(`./output/${datename}.json`);
const db = low(adapter);

// ./mixin.js
// merge user query params with default
var mixin = require('./mixin');

var serviceFile = process.argv[2] || 'services.txt';
var outDir = process.argv[3] || './output/';
if(outDir[outDir.length - 1] !== '/') {
	outDir += '/';
}

fs.readFile(serviceFile, function (err, data) {
	if (err) {
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
				throw err;
			}
			requestService(service[0].trim(), service[1].trim(), body.objectIds);
		});
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName, objectIds) {
	objectIds.sort();
	console.log('Number of features for service: ', objectIds.length);
	console.log('Getting chunks of 100 features...');
	var requests = [];

	for(var i = 0; i < Math.ceil(objectIds.length / 100); i++) {
		var ids = [];
		if ( ((i + 1) * 100) < objectIds.length ) {
			ids = objectIds.slice(i * 100, (i * 100) + 100);
		} else {
			ids = objectIds.slice(i * 100, objectIds[objectIds.length]);
		}

		if(ids[0] !== undefined) {
			console.log('query ->', (i * 100) , 'out of', objectIds.length);
		} else {
			console.log('wait for requests to settle...');
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
		console.log('all requests settled');

		_.each(results, (result, idx) => {
			if(!result || !result.value) {
				console.log('server returned no result')
				return
			} else if (result.value[0].statusCode !== 200) {
				console.warn('server returned no result', result.value[0].statusCode);
				return;
			} else if (!result.value[0].body || !result.value[0].body.features) {
				console.warn('no result set returned');
				return;
			}
			if(idx == 0) {
				db.defaults(result.value[0].body)
					.write();
			} else {
				db.get('features')
					.push(...result.value[0].body.features)
					.write();
			}
		});

		const featureStream = JSONStream.parse('features.*', convert);
		const outfile = fs.createWriteStream(`./output/${datename}.geojson`);
		const infile = fs.createReadStream(`./output/${datename}.json`);

		infile.on('end', () => {
			buildShapefile();
		});

		infile.pipe(featureStream)
			.pipe(geojsonStream.stringify())
			.pipe(outfile);

		function convert (feature) {
			const gj = {
	  		  type: 'Feature',
	  		  properties: feature.attributes,
	  		  geometry: TerraformerArcGIS.parse(feature.geometry)
	  		}
	  		return gj
		}

		function buildShapefile () {
			//shapefile
			var shapefile = ogr2ogr(`./output/${datename}.geojson`)
				.format('ESRI Shapefile')
				.options(['-nln', datename])
				.skipfailures()
				.stream();
			shapefile.pipe(fs.createWriteStream(`./output/${datename}.zip`));
		}

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
