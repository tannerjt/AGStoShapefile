// @Author: Joshua Tanner
// @Date: 12/8/2014
// @Description: Easy way to create shapefiles from ArcGIS Server services
// @services.txt format :: serviceLayerURL|layerName

// Node Modules
var request = require('request');
var esrigeo = require('esri2geo');
var ogr2ogr = require('ogr2ogr');
var fs = require('fs');

// Make request to each service
fs.readFile('services.txt', function (err, data) {
	if (err) throw err;
	data.toString().split('\n').forEach(function (service) {
		var service = service.split('|');
		requestService(service[0].trim(), service[1].trim());
	})
});

// Resquest JSON from AGS
function requestService(serviceUrl, serviceName) {
	request({
		url : serviceUrl + '/query',
		qs : {
			where : 'OBJECTID > -1',
			geometryType : 'esriGeometryEnvelope',
			returnGeometry : true,
			returnIdsOnly : false,
			returnZ : false,
			returnM : false,
			outSR : '4326',
			f : 'json'
		},
		method : 'GET',
		json : true
	}, function (err, response, body) {
		var geojson = esrigeo(body);
		// Create geojson
		fs.writeFile('./output/' + serviceName + '.geojson', JSON.stringify(geojson), function (err) {
			if(err) throw err;

			// Create Shapefile
			console.log('creating', serviceName, 'shapefile');
			var shapefile = ogr2ogr('./output/' + serviceName + '.geojson')
								.format('ESRI Shapefile')
								.skipfailures();

			shapefile.stream().pipe(fs.createWriteStream('./output/' + serviceName + '.zip'));
		});
	})
}