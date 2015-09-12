// @Author: Joshua Tanner
// @Date: 12/8/2014
// @Description: Easy way to create shapefiles from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName

// Node Modules
var esrigeo = require('esri2geo');
var ogr2ogr = require('ogr2ogr');
var q = require('q');
var request = q.nfbind(require('request'));
var fs = require('fs');

var serviceFile = process.argv[2] || 'services.txt';
var outDir = process.argv[3] || './output/';
if(outDir[outDir.length - 1] !== '/') {
	outDir += '/';
}

// Make request to each service
fs.readFile(serviceFile, function (err, data) {
	if (err) throw err;
	data.toString().split('\n').forEach(function (service) {
		var service = service.split('|');
		//get total number of records | assume 1000 max each request
		request({
			url : service[0].trim() + '/query',
			qs : {
				where : '1=1',
				returnCountOnly : true,
				f : 'json'
			},
			method : 'GET',
			json : true
		}, function (err, response, body) {
			if(err) throw err;
			requestService(service[0].trim(), service[1].trim(), body.count);
		});
	})
});

// Resquest JSON from AGS
// assumption 1 = 1000 max requests on service
// assumption 2 = objectid always auto incremented
function requestService(serviceUrl, serviceName, totalRecords) {
	var requests = [];
	for(var i = 0 ; i < Math.ceil(totalRecords / 1000); i++) {
		var r = request({
			url : serviceUrl + '/query',
			qs : {
				where : 'OBJECTID > ' +  (i * 1000) + ' and OBJECTID <= ' + ((i+1) * 1000),
				geometryType : 'esriGeometryEnvelope',
				returnGeometry : true,
				returnIdsOnly : false,
				returnZ : false,
				returnM : false,
				outFields : '*',
				outSR : '4326',
				f : 'json'
			},
			method : 'GET',
			json : true
		});

		requests.push(r);
	};

	q.allSettled(requests).then(function (results) {
		var allFeatures = null;
		for(var i = 0; i < results.length; i++) {
			if(i == 0) {
				allFeatures = results[i].value[0].body;
			} else {
				allFeatures.features = allFeatures.features.concat(results[i].value[0].body.features);
			}
		}

		console.log('creating', serviceName, 'geojson');
		var geojson = esrigeo(allFeatures);
		fs.writeFile(outDir + serviceName + '.geojson', JSON.stringify(geojson), function (err) {
			if(err) throw err;

			// Create Shapefile
			console.log('creating', serviceName, 'shapefile');
			var shapefile = ogr2ogr(outDir + serviceName + '.geojson')
								.format('ESRI Shapefile')
								.skipfailures();

			shapefile.stream().pipe(fs.createWriteStream(outDir + serviceName + '.zip'));
		});

	}).catch(function (err) {
		throw err;
	});
}