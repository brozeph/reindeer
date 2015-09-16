# Reindeer

[![Build Status](https://travis-ci.org/brozeph/reindeer.svg)](https://travis-ci.org/brozeph/reindeer)
[![Coverage Status](https://coveralls.io/repos/brozeph/reindeer/badge.svg?branch=develop&service=github)](https://coveralls.io/github/brozeph/reindeer?branch=develop)

Reindeer strives to make persisting objects to Elasticsearch simple and efficient. This module builds on top of [node-es](https://github.com/ncb000gt/node-es) to provide additional features for interacting with Elasticsearch including the following:

* Validation of mapping types against input
* Proper coercion of data types in accordance with mapping specification
* Support for `_id.path` in the mapping specification
  * NOTE: `path` is deprecated in v1.5.0 of Elasticsearch
* Required fields support in mapping (not a native feature of Elasticsearch)
* Dynamic [strict and false](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) mapping support

## Current Status

Under construction.

## Installation

```
npm install reindeer
```

## Usage

### Constructor

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var cats = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    properties : {
      animalId : {
        type : 'string'
      },
      birthday : {
        type : 'date',
        format : 'dateOptionalTime'
      },
      breed : {
        required : true, // NOTE: not an official Elasticsearch mapping option
        type : 'string'
      },
      name : {
        required : true, // NOTE: not an official Elasticsearch mapping option
        type : 'string'
      },
      attributes : {
        properties : {
          height : {
            type : 'float'
          },
          weight : {
            type : 'float'
          }
        }
      }
    }
  });
```

### #get

### #index

### #parse

### #validate
