#AGStoShapefile

This node based script will convert ArcGIS Server dynamic map services (Geoservices REST) to Shapefile and GeoJSON formats.  This script will only export the first 1000 features.  You can view more about the query interface [here](http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#//02r3000000r1000000).

#Instructions
1. Updates services.txt to include the services you wish to query
2. Navigate to the script directory in command line and call it:

    node AGStoSHP.js

3. Services will be saved in the output folder as a shapefile (.zip) and geojson (.geojson)

