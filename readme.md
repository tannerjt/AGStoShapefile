#AGStoShapefile by [TannerGeo](http://tannergeo.com)

This node script will convert ArcGIS Server dynamic map services (Geoservices REST API) to both a Shapefile and GeoJSON format.  This script will only export all features and is not limited to any max feature limit.  Use this tool to cache your map services as shapefiles, take the data offline, or use the geojson in your development process.  You will need [node.js](https://nodejs.org/en/) with NPM.

#Instructions
1. Updates services.txt to include the services you wish to query
* Navigate to the script directory in command line and call with node:

```
    // call npm install to get app dependencies
    // this only needs to be called once
    npm install
```
    // will default to [input] : services.txt and [output] : ./output/
    node AGStoSHP.js
    // optionally you can provide input and output parameters
    // node AGStoSHP.js [input txt file with services] [output directory]
    node AGStoSHP.js services_weather.txt ./weather_output/
```

+ Services will be saved in the output folder as a shapefile (.zip) and geojson (.geojson)

```
 for services.txt - use format [service_endpoint]|[title]
 example: http://test.service/arcigs/rest/flooding/MapServer/0|Flooding_Layer
```

![screen capture](./screenshot.gif)



