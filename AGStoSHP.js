// @Author: Joshua Tanner
// @Date: 12/8/2014 (created)
// @Description: Easy way to create shapefiles (and geojson, geoservices json)
//               from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName
// @githubURL : https://github.com/tannerjt/AGStoShapefile

// Node Modules
const fs = require('fs');
const rp = require('request-promise');
const request = require('request');
const _ = require('lodash');
const TerraformerArcGIS = require('terraformer-arcgis-parser');
const geojsonStream = require('geojson-stream');
const JSONStream = require('JSONStream');
const queryString = require('query-string');
const merge2 = require('merge2');
const rimraf = require('rimraf');
// ./mixin.js
// merge user query params with default
var mixin = require('./mixin');

var serviceFile = process.argv[2] || 'services.txt';
var outDir = process.argv[3] || './output/';
if(outDir[outDir.length - 1] !== '/') {
	outDir += '/';
}

// Remove trailing '/'
outDir = outDir.replace(/\/$/, '');

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

		rp({
			url : url,
			method : 'GET',
			json : true
		}).then((body) => {
			requestService(service[0].trim(), service[1].trim(), body.objectIds);
		}).catch((err) => {
		  console.log(err);
		});
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName, objectIds) {
	objectIds.sort();
	console.log('Number of features for service: ', objectIds.length);
	console.log('Getting chunks of 100 features...');
	var requests = Math.ceil(objectIds.length / 100);
	var completedRequests = 0;

	for(let i = 0; i < Math.ceil(objectIds.length / 100); i++) {
		var ids = [];
		if ( ((i + 1) * 100) < objectIds.length ) {
			ids = objectIds.slice(i * 100, (i * 100) + 100);
		} else {
			ids = objectIds.slice(i * 100, objectIds[objectIds.length]);
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


		const partialsDir = `${outDir}/${serviceName}/partials`;

		if(i == 0) {
			if(!fs.existsSync(`${outDir}`)) {
				fs.mkdirSync(`${outDir}`)
			}

			if(!fs.existsSync(`${outDir}/${serviceName}`)) {
				fs.mkdirSync(`${outDir}/${serviceName}`);
			}

			if (!fs.existsSync(partialsDir)){
			    fs.mkdirSync(partialsDir);
			} else {
				rimraf.sync(partialsDir);
				fs.mkdirSync(partialsDir);
			}
		}

		const featureStream = JSONStream.parse('features.*', convert);
		const outFile = fs.createWriteStream(`${partialsDir}/${i}.json`);

		const options = {
			url: url,
			method: 'GET',
			json: true,
		};

		request(options)
			.pipe(featureStream)
			.pipe(geojsonStream.stringify())
			.pipe(outFile)
			.on('finish', () => {
				completedRequests += 1;
				console.log(`Completed ${completedRequests} / ${requests} for ${serviceName}`);
				if(requests == completedRequests) {
					mergeFiles();
				}
			});

		function convert (feature) {
			const gj = {
				type: 'Feature',
				properties: feature.attributes,
				geometry: TerraformerArcGIS.parse(feature.geometry)
			}
			return gj
		}

		function mergeFiles() {
			fs.readdir(partialsDir, (err, files) => {
				const finalFilePath = `${outDir}/${serviceName}/${serviceName}_${Date.now()}.geojson`
				const finalFile = fs.createWriteStream(finalFilePath);

				let streams = [];
				_.each(files, (file) => {
					streams.push(
						fs.createReadStream(`${partialsDir}/${file}`)
							.pipe(JSONStream.parse('features.*'))
					)
				});
				merge2(streams)
					.pipe(geojsonStream.stringify())
					.pipe(finalFile)
					.on('finish', () => {
						rimraf(partialsDir, () => {
							console.log(`${serviceName} is complete`);
							console.log(`File Location: ${finalFilePath}`);
						});
					})
			});
		}

	};

	// 	function buildShapefile () {
	// 		//shapefile
	// 		var shapefile = ogr2ogr(`./output/${datename}.geojson`)
	// 			.format('ESRI Shapefile')
	// 			.options(['-nln', datename])
	// 			.skipfailures()
	// 			.stream();
	// 		shapefile.pipe(fs.createWriteStream(`./output/${datename}.zip`));
	// 	}
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
