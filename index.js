#!/usr/bin/env node

// @Author: Joshua Tanner
// @Date: 1/15/2018
// @Description: Easy way to convert ArcGIS Server service to GeoJSON
//               and shapefile format.  Good for backup solution.
// @services.txt format :: serviceLayerURL|layerName|throttle(ms)
// @githubURL : https://github.com/tannerjt/AGStoShapefile

// Node Modules
const fs = require('fs');
const rp = require('request-promise');
const request = require('request');
const _ = require('lodash');
const TerraformerArcGIS = require('terraformer-arcgis-parser');
const geojsonStream = require('geojson-stream');
const JSONStream = require('JSONStream');
const CombinedStream = require('combined-stream');
const queryString = require('query-string');
const merge2 = require('merge2');
const rimraf = require('rimraf');
const ogr2ogr = require('ogr2ogr');
// ./mixin.js
// merge user query params with default
const mixin = require('./mixin');
var program = require('commander');

program
	.version('1.0.2')
	.option('-o, --outdir [directory]', 'Output directory')
	.option('-s, --services [path to txt file]', 'Text file containing service list to extract')
	.option('-S, --shapefile', 'Optional export to shapefile')
	.parse(process.argv);

const serviceFile = program.services || 'services.txt';
var outDir = program.outdir || './output/';
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
		qs = queryString.stringify(qs);
		var url = decodeURIComponent(getBaseUrl(baseUrl) + '/query/?' + qs);

		var throttle = 0;
		if(service.length > 2) {
			throttle = +service[2];
		}

		rp({
			url : url,
			method : 'GET',
			json : true
		}).then((body) => {
			requestService(service[0].trim(), service[1].trim(), body.objectIds, throttle);
		}).catch((err) => {
		  console.log(err);
		});
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName, objectIds, throttle) {
	objectIds.sort();
	const requests = Math.ceil(objectIds.length / 100);
	var completedRequests = 0;
	console.log(`Number of features for service ${serviceName}:`, objectIds.length);
	console.log(`Getting chunks of 100 features, will make ${requests} total requests`);

	for(let i = 0; i < Math.ceil(objectIds.length / 100); i++) {
		var ids = [];
		if ( ((i + 1) * 100) < objectIds.length ) {
			ids = objectIds.slice(i * 100, (i * 100) + 100);
		} else {
			ids = objectIds.slice(i * 100, objectIds[objectIds.length]);
		}

		// we need these query params
		const reqQS = {
			objectIds : ids.join(','),
			geometryType : 'esriGeometryEnvelope',
			returnGeometry : true,
			returnIdsOnly : false,
			outFields : '*',
			outSR : '4326',
			f : 'json'
		};
		// user provided query params
		const userQS = getUrlVars(serviceUrl);
		// mix one obj with another
		var qs = mixin(userQS, reqQS);
		qs = queryString.stringify(qs);
		const url = decodeURIComponent(getBaseUrl(serviceUrl) + '/query/?' + qs);


		const partialsDir = `${outDir}/${serviceName}/partials`;

		if(i == 0) {
			// first pass, setup folders
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

		// timeout for throttle
		setTimeout(() => {
			request(options)
				.pipe(featureStream)
				.pipe(geojsonStream.stringify())
				.pipe(outFile)
				.on('finish', () => {
					completedRequests += 1;
					console.log(`Completed ${completedRequests} of ${requests} requests for ${serviceName}`);
					if(requests == completedRequests) {
						mergeFiles();
					}
				})
				.on('error', (err) => {
					console.log(err);
				});
		}, i * throttle);

		function convert (feature) {
			const gj = {
				type: 'Feature',
				properties: feature.attributes,
				geometry: TerraformerArcGIS.parse(feature.geometry)
			}
			return gj
		}

		function mergeFiles() {
			console.log(`Finished extracting chunks for ${serviceName}, merging files...`)
			fs.readdir(partialsDir, (err, files) => {
				const finalFilePath = `${outDir}/${serviceName}/${serviceName}_${Date.now()}.geojson`
				const finalFile = fs.createWriteStream(finalFilePath);

				let streams = CombinedStream.create();
				_.each(files, (file) => {
					streams.append((next) => {
						next(
							fs.createReadStream(`${partialsDir}/${file}`)
								.pipe(JSONStream.parse('features.*'))
								.on('error', (err) => {
									console.log(err);
								})
						);
					})
				});

				streams
					.pipe(geojsonStream.stringify())
					.pipe(finalFile)
					.on('finish', () => {
						rimraf(partialsDir, () => {
							console.log(`${serviceName} is complete`);
							console.log(`File Location: ${finalFilePath}`);
							if(program.shapefile) {
								makeShape(finalFilePath);
							}
						});
					})
					.on('error', (err) => {
						console.log(err);
					})
			});
		}

		function makeShape(geojsonPath) {
			console.log(`Generating shapefile for ${serviceName}`)
			// todo: make optional with flag
			const shpPath = `${outDir}/${serviceName}/${serviceName}_${Date.now()}.zip`;
			const shpFile = fs.createWriteStream(shpPath);
			var shapefile = ogr2ogr(geojsonPath)
				.format('ESRI Shapefile')
				.options(['-nln', serviceName])
				.timeout(120000)
				.skipfailures()
				.stream();
			shapefile.pipe(shpFile);
		}

	};
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
