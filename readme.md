# Elastic Schema

Elastic Schema strives to make persisting objects to Elasticsearch simple and efficient. This module builds on top of (node-es)[https://github.com/ncb000gt/node-es] to provide additional features for interacting with Elasticsearch including the following:

* Validation of data types
* Required fields
* Dynamic (strict and false)[https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html] mapping support

## Installation

```
npm install elastic-schema
```

## Usage

```
var
  Mapper = require('elastic-schema').Mapper,
  cats = new Mapper('animals', 'cats', {
    // schema
  }),
  dogs = new Schema('animals', 'dogs', {
    // schema
  });

cats.index({ name : 'Fluffy' }, function (err, savedCat) {

});

dogs.update({ breed : 'Chihuahua' }, function (err, updatedDog) {

});
```
