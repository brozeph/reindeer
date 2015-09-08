# Reindeer

[![Build Status](https://travis-ci.org/brozeph/reindeer.svg)](https://travis-ci.org/brozeph/reindeer)
[![Coverage Status](https://coveralls.io/repos/brozeph/reindeer/badge.svg?branch=develop&service=github)](https://coveralls.io/github/brozeph/reindeer?branch=develop)

Reindeer strives to make persisting objects to Elasticsearch simple and efficient. This module builds on top of [node-es](https://github.com/ncb000gt/node-es) to provide additional features for interacting with Elasticsearch including the following:

* Validation of data types
* Required fields
* Dynamic [strict and false](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) mapping support

## Current Status

Under construction.

## Installation

```
npm install reindeer
```

## Usage

```javascript
var
  Mapper = require('reindeer').Mapper,
  cats = new Mapper('animals', 'cats', {
    // schema
  }),
  dogs = new Schema('animals', 'dogs', {
    // schema
  });

cats.validate({ name : 'Fluffy' }, function (err, result) {
  console.log(JSON.stringify(result, 0, 2));
});

dogs.validate({ breed : 'poodle' }, function (err, result) {
  console.log(JSON.stringify(result, 0, 2));
});
```
