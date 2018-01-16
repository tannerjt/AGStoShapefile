# AGStoShapefile by [TannerGeo](http://tannergeo.com)

A command line tool for backing up ArcGIS Server REST Services to file.

AGStoShapefile is a node.js script that will convert Esri map services (Geoservices REST API) to GeoJSON and optionally Shapefile formats.  This script will export all features and is not limited to max feature limits.  AGStoShapefile can be used to cache your map services, store data for offline viewing, or used to build applications using a more simple GeJSON format.

# Dependencies

If you wish to download files as Shapefile, you will need to install the following:

1. You will need to install [node.js](https://nodejs.org/en/) with NPM. This script only runs on node versions 6.x.
2. Install and setup GDAL [Windows](http://sandbox.idre.ucla.edu/sandbox/tutorials/installing-gdal-for-windows) - [Mac/Linux](https://www.mapbox.com/tilemill/docs/guides/gdal/)

# Instructions

1. Create a services.txt to include the services you wish to query
2. Create a directory to store the script output

*You can install via NPM*

```
    npm install agsout -g
```

*Or, optionally, download and install from local*

```
    npm install . -g
```

*Run the script*
```
    agsout --help
    agsout -s ./services.txt -o ./backupdir -S
    #-s location of services text file
    #-o directory to backup services
    #-S optional shapefile output (requires gdal)
```

*Arguments*

This command line script accepts 3 Arguments:

+ `-s` -> Location to services.txt file (**see below for example**)
+ `-o` -> Location to output directory to put files
+ `-S` -> *OPTIONAL* Output shapefile, will output geojson as well by default

*for services.txt - use format [service_endpoint]|[title]|[throttle in ms].  Take note of the PIPE (|) symbol and new line.*
```
 //example services.txt file
 http://test.service/arcigs/rest/flooding/MapServer/0|Flooding_Layer|0
 http://test.service/arcigs/rest/flooding/MapServer/1|Earthquake_Layer|5000
 http://test.service/arcigs/rest/flooding/MapServer/2|Tornado_Layer|
```

The throttle is helpful for very large extracts where servers may reject too many requests.
The throttle number is in milliseconds.


## help

Please contact [TannerGeo](http://tannergeo.com) for questions or assistance.
