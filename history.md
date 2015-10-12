# v0.2.13 - 10.12.2015

* Fixed an issue where on search, if fields were used, property coerceion of property types worked incorrectly

# v0.2.12 - 10.09.2015

* Fixed an issue where the required check for date type fields failed

# v0.2.11 - 10.09.2015

* Fixed issue where `new Date().toString()` failed date validation

# v0.2.10 - 10.09.2015

* Fixed issue with boolean type recognition

# v0.2.9 - 10.09.2015

* Fixed issue where fields that were array values were improperly converted to a string type during coercion

# v0.2.8 - 10.09.2015

* Now allowing Mapper#update to skip `required` field validation when supplying a partial document

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
