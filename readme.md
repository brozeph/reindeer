# Reindeer

[![Build Status](https://travis-ci.org/brozeph/reindeer.svg)](https://travis-ci.org/brozeph/reindeer)
[![Coverage Status](https://coveralls.io/repos/brozeph/reindeer/badge.svg?branch=master&service=github)](https://coveralls.io/github/brozeph/reindeer?branch=master)

Reindeer strives to make persisting objects to Elasticsearch simple and efficient. This module builds on top of [node-es](https://github.com/ncb000gt/node-es) to provide additional features for interacting with Elasticsearch including the following:

* Validation of mapping types against input
* Proper coercion of data types in accordance with mapping specification
* Support for `_id.path` in the mapping specification
  * NOTE: `path` has been deprecated since v1.5.0 of Elasticsearch
* Required fields support in mapping (not a native feature of Elasticsearch)
* Dynamic [strict and false](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) mapping support

## Current Status

Under construction.

## Installation

```
npm install reindeer
```

## Usage

#### Construction

* [constructor](#constructor)

#### Basic CRUD Operations

* [create](#create)
* [delete](#delete)
* [get](#get)
* [update](#update)
* [upsert](#upsert)

#### Bulk CRUD Operations

* bulkCreate _(coming soon)_
* bulkDelete _(coming soon)_
* bulkGet _(coming soon)_
* bulkUpdate _(coming soon)_
* bulkUpsert _(coming soon)_

#### Object Parsing and Validation

* [parse](#parse)
* [validate](#validate)

### Constructor

To create a new mapper, use the constructor and supply the following parameters:

* `config` - _(required)_ - this is an object that defines the `_index`, `_type` and optionally additional `server` information for the Elasticsearch instance
* `mapping` - _(required)_ - this is an object that defines the [Elasticsearch mapping](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html)

_NOTE:_ In the event that there exists a mapping error (meaning that the mapping contains an invalid type or is not parseable), an `InvalidMappingError` is thrown during construction.

_NOTE:_ Prior to the execution of any CRUD messages, internally the mapper will initialize itself (a one time operation) in order to ensure that the index and mapping supplied properly exist within the target Elasticsearch cluster.

**Example usage:**

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
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

#### config parameter

The Reindeer module makes use of the `es` NPM package (<https://www.npmjs.com/package/es>) in order to execute commands against an Elasticsearch cluster or instance. As such, the options defined for Reindeer mirror the config options that the `es` module accepts to `#createClient`. For more details regarding the `config` parameter, please see <https://www.npmjs.com/package/es#createclient>.

The config parameter supports the following fields:

* `_index` - _(required)_ - denotes the specific index within Elasticsearch that the mapping applies to
* `_type` - _(required)_ - denotes the specific type that the mapping object applies to
* `server` - _(optional)_ - defines how to connect to the Elasticsearch cluster
* `timeout` - _(optional)_ - globally controls the timeout for all operations against Elasticsearch

##### server

When the `server` property is not supplied it defaults to the following:

```javascript
{
  host : 'localhost',
  port : 9200
}
```

The following is an example config with several additional parameters supplied. This config supports a secure connection to an Elasticsearch cluster containing three hosts, using BASIC auth and self-signed certificates:

```javascript
var config = {
  _index : 'animals',
  _type : 'cats',
  server : {
    agent : false,
    auth : 'user:pass',
    hostnames : ['es0.myhost.com', 'es1.myhost.com', 'es2.myhost.com'],
    port : 9243,
    rejectUnauthorized : false, // for self-signed certs
    secure : true // toggles HTTPS
  }
};
```

##### timeout

The `timeout` parameter is optional - when not supplied, it is set to 30 seconds. This value allows for the override of operation timeout on all requests to Elasticsearch.

```javascript
var config = {
  _index : 'animals',
  _type : 'cats',
  timeout : 60000 // 60 seconds
};
```

### #create

This method can be used to create a new document within Elasticsearch. By default, this method will result in an error if the document already exists within the Elasticsearch server. The document supplied as an argument to the create method will be validated against the mapping that was used to create the instance of the mapper class.

**Usage:** `mapper.create(_id, doc, callback)`

This method accepts the following arguments:

* `_id` - _(optional)_ - this is the `_id` value with which the document will be indexed in Elasticsearch
  * when this value is not supplied, the value from the field matching the `_id.path` specified in the mapping will be used instead
  * if the `_id` is not supplied and there is no `_id.path` specified in the mapping, Elasticsearch will auto-assign a UUID value
    * _NOTE:_ it is strongly recommended that you supply a value for `_id` as without it, there is no way to later retrieve, delete or update documents easily using the mapping object
* `doc` - _(required)_ - this is the document representing what should be created in Elasticsearch
  * the document can be specified as a partial document
  * _NOTE:_ all fields in the document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(required)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `insertedModel` - the validated model that is properly typed according to the mapping specification

The following example demonstrates the use of the `#create` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var doc = {
  animalId : 12345,
  breed : 'manx',
  name : 'Hamish'
};

catsMapper.create(doc.animalId, doc, function (err, insertedCat) {
  if (err) {
    console.error(err);
    return;
  }

  console.log('successfully inserted cat %d', insertedCat.animalId);
  console.log(insertedCat);
});
```

### #delete

This method can be used to delete an existing document within Elasticsearch.

**Usage:** `mapper.delete(_id, callback)`

This method accepts the following arguments:

* `_id` - _(required)_ - this is the `_id` value with which the document has been indexed in Elasticsearch
* `callback` - _(required)_ - a function callback that accepts a single argument:
  * `err` - populated with details in the event of an error during the operation

The following example demonstrates the use of the `#delete` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var animalId = 12345;

catsMapper.delete(animalId, function (err) {
  if (err) {
    console.error(err);
    return;
  }

  console.log('successfully deleted %d', animalId);
});
```

### #get

This method can be used to retrieve a single existing document from Elasticsearch.

**Usage:** `mapper.get(_id, callback)`

This method accepts the following arguments:

* `_id` - _(required)_ - this is the `_id` value with which the document has been indexed in Elasticsearch
* `callback` - _(required)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `model` - the validated model that is properly typed according to the mapping specification... in the event that the get method is unable to find a matching document, this will be set to `null`

The following example demonstrates the use of the `#get` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var animalId = 12345;

catsMapper.get(animalId, function (err, catsModel) {
  if (err) {
    console.error(err);
    return;
  }

  if (catsModel) {
    console.log('successfully retrieved cat %d', animalId);
    console.log(catsModel);
  } else {
    console.log('no cats exist with animalId %d', animalId);
  }
});
```

### #parse

The parse method is used for parsing either a JSON string or a Javascript object and coercing fields to a properly typed Javascript object that aligns with the mapping type specification. This method takes into account the [dynamic mapping](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) specified for the mapping and returns an object as would be stored in Elasticsearch.

_NOTE:_ This method is used internally by CRUD methods within this module in order to ensure properly typed return values (i.e. so that date types are typed as Date objects, etc.).

**Usage:** `mapper.parse(json, callback)`

This method accepts the following arguments:

* `json` - _(required)_ - this can be either a JSON string or a Javascript object containing the document to be parsed
* `callback` - _(required)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `model` - the parsed model that is properly typed according to the mapping specification

The following example demonstrates the parsing of a JSON string:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var json = requestJSONStringFromSomewhere();

catsMapper.parse(json, function (err, catsModel) {
  if (err) {
    console.error(err);
    return;
  }

  if (catsModel) {
    console.log('successfully parsed cat %d', catsModel.animalId);
    console.log(catsModel);
  }
});
```

### #update

The update method allows one to update an existing document within Elasticsearch. A partial document will be accepted as well, but note that if there are required fields that are missing from the partial document, the method will return an error. This method will return an error in the event that the document does not exist.

**Usage:** `mapper.update(_id, doc, callback)`

This method accepts the following arguments:

* `_id` - _(optional)_ - this is the `_id` value with which the document will be updated in Elasticsearch
  * when this value is not supplied, the value from the field matching the `_id.path` specified in the mapping will be used instead
  * if the `_id` is not supplied and there is no `_id.path` specified in the mapping, an error will be returned
* `doc` - _(required)_ - this is the document representing what should be updated in Elasticsearch
  * the document can be specified as a partial document
  * _NOTE:_ all fields in the document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(required)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `updatedModel` - the validated model that is properly typed according to the mapping specification

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });


var animalId = 12345;

catsMapper.update(
  animalId,
  {
    birthday : new Date('2014-04-20'),
    name : 'Hamish the cat'
  },
  function (err, updatedCat) {
    if (err) {
      console.error(err);
      return;
    }

    console.log('successfully updated cat %d', animalId);
    console.log(updatedCat);
  });
```

### #upsert

The upsert method works similarly to update, except that if the document does not exist already, it is created.

**Usage:** `mapper.upsert(_id, doc, callback)`

This method accepts the following arguments:

* `_id` - _(optional)_ - this is the `_id` value with which the document will be updated in Elasticsearch
  * when this value is not supplied, the value from the field matching the `_id.path` specified in the mapping will be used instead
  * if the `_id` is not supplied and there is no `_id.path` specified in the mapping, an error will be returned
* `doc` - _(required)_ - this is the document representing what should be updated in Elasticsearch
  * the document can be specified as a partial document
  * _NOTE:_ all fields in the document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(required)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `updatedModel` - the validated model that is properly typed according to the mapping specification

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });


var animalId = 12345;

catsMapper.upsert(
  animalId,
  {
    animalId : animalId,
    birthday : new Date('2014-04-20'),
    breed : 'manx',
    name : 'Hamish the cat'
  },
  function (err, upsertedCat) {
    if (err) {
      console.error(err);
      return;
    }

    console.log('successfully upserted cat %d', animalId);
    console.log(upsertedCat);
  });
```

### #validate

The validate method validates a document according to a mapping specification. This method handles the following error scenarios:

* determines if model is empty
* determines if model field values do not match and are not able to be casted to the specified mapping type
* detects any missing required fields and returns an `InvalidModelError` error
* detects an extraneous fields from `dynamic=strict` mapping types and returns an `InvalidModelError` error

Additionally, the validate method performs the following:

* captures value for field specified in `_id.path` of mapping (if applicable)
* removes any extraneous fields from `dynamic=false` mapping types

_NOTE:_ This method is used internally by CRUD methods within this module in order to ensure the document that is being operated on is valid prior to transmission to Elasticsearch.

**Usage:** `mapper.validate(doc, callback)`

This method accepts the following arguments:

* `doc` - _(required)_ - this is the document to be validated
  * the document can be specified as a partial model
  * _NOTE:_ if required fields are missing, an `InvalidModelError` will be returned
  * _NOTE:_ if an `_id.path` is specified in the mapping, and a value is found matching that field in the supplied document, it will be returned in the modelId parameter
* `callback` - _(required)_ - a function callback that accepts three arguments:
  * `err` - populated with details in the event of an error during the operation
  * `validatedModel` - the validated model resulting from the operation
  * `modelId` - if `_id.path` is specified in the mapping and the field exists in the `doc` supplied, this is the value of the `_id`, otherwise, `null`

The following demonstrates use of the validate method:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var doc = {
  animalId : 12345,
  birthday : new Date('2014-04-20'),
  name : 'Hamish'
};

catsMapper.validate(doc, function (err, catsModel, animalId) {
  if (err) {
    console.error(err);
    return;
  }

  if (catsModel) {
    // note, unless _id.path is specified in the mapping, animalId is null
    console.log('successfully validated cat %d', catsModel.animalId);
    console.log(catsModel);
  }
});
```
