#AGStoShapefile by [TannerGeo](http://tannergeo.com)

AGStoShapefile is a node.js script that will convert Esri map services (Geoservices REST API) to Shapefile, EsriJSON and GeoJSON formats.  This script will export all features and is not limited to max feature limits.  AGStoShapefile can be used to cache your map services, store data for offline viewing, or used to build applications using a more simple GeJSON format.

#Dependencies
1. You will need to install [node.js](https://nodejs.org/en/) with NPM.

#Instructions
1. Updates services.txt to include the services you wish to query
2. Navigate to the script directory in command line and call with node:

*You will need to first download all the depencies for this app if you havent already done so*

```
    npm install
```

*Run the script*
```
    // will default to [input] : services.txt and [output] : ./output/
    node AGStoSHP.js
```

*Optionally with input and output parameters specified*
```
    // node AGStoSHP.js [input txt file with services] [output directory]
    node AGStoSHP.js services_weather.txt ./weather_output/
```

*for services.txt - use format [service_endpoint]|[title]\n.  Take note of the PIPE (|) symbol and new line.*
```
 //example services.txt file
 http://test.service/arcigs/rest/flooding/MapServer/0|Flooding_Layer
 http://test.service/arcigs/rest/flooding/MapServer/1|Earthquake_Layer
 http://test.service/arcigs/rest/flooding/MapServer/2|Tornado_Layer
```

![screen capture](./screenshot.gif)



