# v0.2.7 - 10.09.2015

* Fixed issue where string field types failed when validating arrays of strings

# v0.2.6 - 10.09.2015

* Adding additional summary data as callback argument for `delete` and `bulkDelete`

# v0.2.5 - 10.08.2015

* Fixed issue where certain field types that contain the value `null` caused an unhandled exception

# v0.2.4 - 10.08.2015

* Added Mapper#analyzedFields

# v0.2.3 - 10.06.2015

* Added Mapper#verifyConnection

# v0.2.2 - 09.28.2015

* Added Mapper#bulkCreate
* Added Mapper#bulkDelete
* Added Mapper#bulkGet
* Added Mapper#bulkUpdate
* Added Mapper#bulkUpsert
* Added Mapper#search

# v0.2.1 - 09.22.2015

* Added coveralls.io support

# v0.2.0 - 09.22.2015

* Renamed Schema to Mapper to better reflect data access pattern used
* Added additional documentation for usage of module
* Added Mapper#create
* Added Mapper#delete
* Added Mapper#get
* Added Mapper#parse
* Added Mapper#update
* Added Mapper#upsert

# v0.1.0 - 08.31.2015

* Initial version of module that supports Mapping validation
