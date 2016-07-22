# Reindeer ODM

[![Build Status](https://travis-ci.org/brozeph/reindeer.svg)](https://travis-ci.org/brozeph/reindeer)
[![Coverage Status](https://coveralls.io/repos/brozeph/reindeer/badge.svg?branch=master&service=github)](https://coveralls.io/github/brozeph/reindeer?branch=master)

Reindeer is an Object Data Mapper (ODM) that strives to make persisting objects to Elasticsearch simple and efficient. This module builds on top of [node-es](https://github.com/ncb000gt/node-es) to provide additional features for interacting with Elasticsearch including the following:

* Validation of mapping types against input
* Proper coercion of data types in accordance with mapping specification
* Support for `_id.path` in the mapping specification
  * NOTE: `path` has been deprecated since v1.5.0 of Elasticsearch
* Required fields support in mapping (not a native feature of Elasticsearch)
* Dynamic [strict and false](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) mapping support

```Javascript
const
  Mapper = require('reindeer').Mapper,
  schema = {
    properties : {
      animalId : {
        type : 'string'
      },
      birthday : {
        type : 'date',
        format : 'dateOptionalTime'
      },
      breed : {
        type : 'string'
      },
      name : {
        required : true, // NOTE: not an official Elasticsearch mapping option
        type : 'string'
      }
    }
  };

let catsMapper = new Mapper();

catsMapper
  .bulkUpsert([
    { animalId : 1, name : 'Hamish', birthday : '2011-05-28' },
    { animalId : 2, name : 'Cooper', birthday : '2013-07-02' },
    { animalId : 3, name : 'Blue', birthday : '2014-01-13' },
    { animalId : 4, name : 'Dugald', birthday : '2017-02-21' }
  ])
  .then(() => catsMapper.search({ query : { match_all : {} } }))
  .then((cats) => {
    cats.forEach((cat) => console.log(
      '%s the cat has id %s',
      cat.name,
      cat.animalId));

    return Promise.resolve();
  })
  .then(() => catsMapper.delete(1))
  .then((result) => console.log(
    '_version %s of the cat was removed',
    result._version))
  .catch(console.error);
```

## ES6 Support

For each method documented below, the `callback` argument is fully optional. In the event that callback is not provided, a Javascript native `Promise` is returned to the caller.

## Installation

```
npm install reindeer
```

## Usage

#### Initialization

* [constructor](#constructor)
* [verifyConnection](#verifyconnection)

#### Basic Search

* [search](#search)

#### Basic CRUD Operations

* [create](#create)
* [delete](#delete)
* [get](#get)
* [update](#update)
* [upsert](#upsert)

#### Bulk CRUD Operations

* [bulkCreate](#bulkcreate)
* [bulkDelete](#bulkdelete)
* [bulkGet](#bulkget)
* [bulkUpdate](#bulkupdate)
* [bulkUpsert](#bulkupsert)

#### Model Parsing and Validation

* [analyzedFields](#analyzedfields)
* [fieldExists](#fieldexists)
* [parse](#parse)
* [validate](#validate)

### Initialization

#### Constructor

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

#### #verifyConnection

In order to quickly verify connectivity with Elasticsearch, the `#verifyConnection` method can be used.

**Usage:** `mapper.verifyConnection(callback)`

This method accepts a single optional argument:

* `callback` - _(optional)_ - a function callback that accepts one arguments:
  * `err` - populated with details in the event of an error during the operation

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

catsMapper
  .verifyConnection()
  .then(() => {
    console.log('able to connect to Elasticsearch');
  })
  .catch((err) => {
    console.error('unable to connect to Elasticsearch!');
    console.error(err);
  });
});
```

### Basic Search

For convenience purposes, [request body search](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-body.html) is supported via the `#search` method.

#### #search

This method will search for documents within the `_index` and `_type` that were used to construct the mapper.

**Usage:** `mapper.search(options, query, callback)`

This method accepts the following arguments:

* `options` - _(optional)_ - this can be used to supply additional parameters to Elasticsearch related to the query
* `query` - _(required)_ - this is the query payload that will be sent to Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts three arguments:
  * `err` - populated with details in the event of an error during the operation
  * `models` - an array of models matching the search, properly typed according to the mapping supplied to the mapper constructor
  * `summary` - an object that contains details regarding the search
    * `total` - the total number of matching documents from Elasticsearch

The following example demonstrates the use of the `#search` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

// query for all cats
var query = {
  from : 0,
  query : {
    match_all : {}
  },
  size : 50 // grab a limit of 50 documents
};

// NOTE: utilizing `#search` as a Promise
catsMapper
  .search(query)
  .then((catModels) => {
    console.log(
      'successfully searched cats and retrieved %d documents',
      catModels.length);

    console.log(catModels);
  })
  .catch(console.error);
```

##### events

The search method fires the following events:

* `summary` - each time a search is conducted, a `summary` event is emitted with an object that is structured as follows:

```json
{
  "query": {},
  "total": 0
}
```

The summary object contains the following fields:

* query - the query that was passed to Elasticsearch
* total - the total number of documents that match the query within Elasticsearch... this value is useful when paginating results from Elasticsearch

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

// query for all cats
var query = {
  from : 0,
  query : {
    match_all : {}
  },
  size : 50 // grab a limit of 50 documents
};

catsMapper.on('summary', (summary) => {
  console.log('found %d cats', summary.total);
  console.log(summary.query);
});

catsMapper
  .search(query)
  .then((catModels) => {
    console.log('here are the first %d cats found:', catModels.length);
    console.log(catModels);
  })
  .catch(console.error);
});
```

### Basic CRUD Methods

#### #create

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
* `callback` - _(optional)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `insertedModel` - the validated model that is properly typed according to the mapping specification - if the `_id` parameter is not specified, an event named `identity` is emitted that will contain the value of the `_id` created by Elasticsearch

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

catsMapper
  .create(doc.animalId, doc)
  .then((insertedCat) => {
    console.log('successfully inserted cat %d', insertedCat.animalId);
    console.log(insertedCat);
  })
  .catch(console.error);
```

##### events

The create method fires the following events:

* `identity` - whenever a `#create` operation would result in Elasticsearch creating the `_id` of the document, this event is emitted with the value of the identifier

The identity event returns a string value of the `_id` assigned.

The following example demonstrates how to collect the `_id` in the even that it is created by Elasticsearch:

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
  breed : 'manx',
  name : 'Hamish'
};

catsMapper.on('identity', (_id) => {
  console.log('cat %s created with _id of %s', doc.name, _id);
});

catsMapper
  .create(doc)
  .then((insertedCat) => {
    console.log('successfully inserted cat %d', insertedCat.animalId);
    console.log(insertedCat);
  })
  .catch(console.error);
```

#### #delete

This method can be used to either delete an existing document within Elasticsearch or to delete a number of documents based on a query.

##### delete by `_id`

**Usage:** `mapper.delete(_id, callback)`

This method accepts the following arguments:

* `_id` - _(required)_ - this is the `_id` value with which the document has been indexed in Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts a single argument:
  * `err` - populated with details in the event of an error during the operation
  * `summary` - populated with the response details from Elasticsearch
    * `found` - `true` when document was found, otherwise `false`
    * `_version` - version number of the document that was deleted

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

catsMapper
  .delete(animalId)
  .then((summary) => {
    if (summary.found) {
      console.log('successfully deleted %d', animalId);
    } else {
      console.log('could not find cat %d', animalId);
    }
  })
  .catch(console.error);
```

##### delete by query

**Usage:** `mapper.delete(options, callback)`

This method accepts the following arguments:

* `options` - _(required)_ - this is an object with the the following properties:
  * `query` - the query that defines which documents to remove from Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts a single argument:
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

// delete all cats with breed of "unknown"
var options = {
  query : {
    term : {
      breed : 'unknown'
    }
  }
};

catsMapper
  .delete(options)
  .then(() => {
    console.log('delete by query occurred...');
  })
  .catch(console.error);
```

#### #get

This method can be used to retrieve a single existing document from Elasticsearch.

**Usage:** `mapper.get(_id, _source, callback)`

This method accepts the following arguments:

* `_id` - _(required)_ - this is the `_id` value with which the document has been indexed in Elasticsearch
* `_source` - _(optional)_ - this allows one to specify a parameter of fields to return or filter from being returned according to the [Elasticsearch specification](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html#get-source-filtering)
  * _NOTE:_ when source filtering and required fields are set, validation will fail if the required field is not returned in the query results
* `callback` - _(optional)_ - a function callback that accepts two arguments:
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

catsMapper
  .get(animalId)
  .then((catsModel) => {
    if (catsModel) {
      console.log('successfully retrieved cat %d', animalId);
      console.log(catsModel);
    } else {
      console.log('no cats exist with animalId %d', animalId);
    }
  })
  .catch(console.error);

// query to retrieve the animalId, breed and name only
catsMapper.get(animalId, ['animalId', 'breed', 'name'])
  .then((catsModel) => {
    if (catsModel) {
      console.log('successfully retrieved cat %s', catsModel.name);
      console.log(catsModel);
    } else {
      console.log('no cats exist with animalId %d', animalId);
    }
  })
  .catch(console.error);
```

#### #update

The update method allows one to update an existing document within Elasticsearch. A partial document will be accepted as well, but note that if there are required fields that are missing from the partial document, the method will return an error. This method will return an error in the event that the document does not exist.

**Usage:** `mapper.update(_id, doc, callback)`

This method accepts the following arguments:

* `_id` - _(optional)_ - this is the `_id` value with which the document will be updated in Elasticsearch
  * when this value is not supplied, the value from the field matching the `_id.path` specified in the mapping will be used instead
  * if the `_id` is not supplied and there is no `_id.path` specified in the mapping, an error will be returned
* `doc` - _(required)_ - this is the document representing what should be updated in Elasticsearch
  * the document can be specified as a partial document
  * _NOTE:_ all fields in the document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts two arguments:
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

catsMapper
  .update(
    animalId,
    {
      birthday : new Date('2014-04-20'),
      name : 'Hamish the cat'
    })
  .then((updatedCat) => {
    console.log('successfully updated %s the cat', updatedCat.name);
    console.log(updatedCat);
  })
  .catch(console.error);
```

#### #upsert

The upsert method works similarly to update, except that if the document does not exist already, it is created.

**Usage:** `mapper.upsert(_id, doc, callback)`

This method accepts the following arguments:

* `_id` - _(optional)_ - this is the `_id` value with which the document will be updated in Elasticsearch
  * when this value is not supplied, the value from the field matching the `_id.path` specified in the mapping will be used instead
  * if the `_id` is not supplied and there is no `_id.path` specified in the mapping, an error will be returned
* `doc` - _(required)_ - this is the document representing what should be updated in Elasticsearch
  * the document can be specified as a partial document
  * _NOTE:_ all fields in the document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `upsertedModel` - the validated model that is properly typed according to the mapping specification

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

catsMapper
  .upsert(
    animalId,
    {
      animalId : animalId,
      birthday : new Date('2014-04-20'),
      breed : 'manx',
      name : 'Hamish the cat'
    })
  .then((upsertedCat) => {
    console.log('successfully upserted %s the cat', upsertedCat.name);
    console.log(upsertedCat);
  })
  .catch(console.error);
```

### Bulk CRUD Operations

#### #bulkCreate

This method can be used to index multiple documents within Elasticsearch. By default, this method will result in an error if any of the documents already exist within the Elasticsearch server. Each document supplied will be validated against the mapping that was used to create the instance of the mapper class.

**Usage:** `mapper.bulkCreate(idList, docList, callback)`

This method accepts the following arguments:

* `idList` - _(optional)_ - an array of _ids in the same order that should be applied to the array of documents supplied as the `docList` parameter value
  * when the `idList` property is not supplied, the value from the field matching the `_id.path` for each document in `docList` (if specified in the mapping) will be used instead
  * if the `idList` is not supplied and there is no `_id.path` specified in the mapping, Elasticsearch will auto-assign a value
    * _NOTE:_ it is strongly recommended that you ensure a value for `_id` is supplied for each document as without it, there is no way to later retrieve, delete or update documents easily using the mapping object
* `docList` - _(required)_ - this is an array of documents to index within Elasticsearch
  * _NOTE:_ all fields in each document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `insertedModels` - the validated models that are properly typed according to the mapping specification - if there are no specified primary identifiers for the models and Elasticsearch generates these values internally, the identifiers will be emitted as an array value from the event named `identity`

The following example demonstrates the use of the `#bulkCreate` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var docList = [{
    animalId : 12345,
    breed : 'manx',
    name : 'Hamish'
  }, {
    animalId : 54321,
    breed : 'siamese',
    name : 'Dugald'
  }];

// example of using Array.map to return an array of _id values
var idList = docList.map(function (cat) {
  return cat.animalId;
});

catsMapper
  .bulkCreate(idList, docList)
  .then((insertedCats) => {
    console.log('successfully inserted %d cats', insertedCat.length);
    console.log(insertedCats);
  })
  .catch(console.error);
```

##### events

The bulkCreate method fires the following events:

* `identity` - in the event that Elasticsearch is used to generate an `_id` for the documents indexed in bulk, this event is fired:

The identity event returns an array of strings that contain the `_id` values assigned.

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var docList = [{
    breed : 'manx',
    name : 'Hamish'
  }, {
    breed : 'siamese',
    name : 'Dugald'
  }];

catsMapper.on('identity', (idList) => {
  console.log(
    'Elasticsearch assigned %d identifiers to the indexed documents',
    idList.length);
  console.log(idList);
});

catsMapper
  .bulkCreate(docList)
  .then((insertedCats) => {
    console.log('successfully inserted %d cats', insertedCat.length);
    console.log(insertedCats);
  })
  .catch(console.error);
```

#### #bulkDelete

This method can be used to delete multiple existing documents within Elasticsearch.

**Usage:** `mapper.bulkDelete(idList, callback)`

This method accepts the following arguments:

* `idList` - _(required)_ - this is an array of `_id` values with which the documents that are intended to be removed have been indexed in Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts a single argument:
  * `err` - populated with details in the event of an error during the operation
  * `summary` - populated with response from Elasticsearch
    * `items` - an array of the `delete` operations with the documents deleted

The following example demonstrates the use of the `#bulkDelete` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var idList = [12345, 54321];

catsMapper
  .bulkDelete(idList)
  .then((summary) => {
    console.log('successfully deleted %d cats', summary.items.length);
  })
  .catch(console.error);
```

#### #bulkGet

This method can be used to retrieve an array of existing documents from Elasticsearch.

**Usage:** `mapper.bulkGet(idList, _source, callback)`

This method accepts the following arguments:

* `idList` - _(required)_ - this is an array of `_id` values for which documents should be retrieved from Elasticsearch
* `_source` - _(optional)_ - this allows one to specify a parameter of fields to return or filter from being returned according to the [Elasticsearch specification](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html#get-source-filtering)
  * _NOTE:_ when source filtering and required fields are set, validation will fail if the required field is not returned in the query results
* `callback` - _(optional)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `models` - an array of the validated models that are properly typed according to the mapping specification
    * _NOTE:_ in the event that a document is not found, it is not returned in the models array... if no documents are found at all, the models array will be an empty array

The following example demonstrates the use of the `#bulkGet` method on a mapping for cats:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var idList = [12345, 54321];

catsMapper
  .bulkGet(idList)
  .then((cats) => {
    console.log('successfully retrieved %d cats', cats.length);
    console.log(cats);
  })
  .catch(console.error);
```

#### #bulkUpdate

The bulk update method allows one to update multiple existing documents within Elasticsearch. Partial documents will be accepted as well, but note that if there are required fields that are missing from any of the partial documents, the method will return an error. This method will also return an error in the event that any of the documents do not exist.

**Usage:** `mapper.bulkUpdate(idList, docList, callback)`

This method accepts the following arguments:

* `idList` - _(optional)_ - an array of _ids in the same order that should be applied to the array of documents supplied as the `docList` parameter value
  * when the `idList` property is not supplied, the value from the field matching the `_id.path` for each document in `docList` (if specified in the mapping) will be used instead
  * if the `idList` is not supplied and there is no `_id.path` specified in the mapping, Elasticsearch will auto-assign a value
* `docList` - _(required)_ - * `docList` - _(required)_ - this is an array of documents to update within Elasticsearch
  * any of the documents can be specified as partial documents
  * _NOTE:_ all fields in each document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts two arguments:
  * `err` - populated with details in the event of an error during the operation
  * `updatedModels` - the updated and validated models that are properly typed according to the mapping specification

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

var docList = [{
    animalId : 12345,
    birthday : new Date('2014-04-20')
  }, {
    animalId : 54321,
    birthday : new Date('2014-05-09')
  }];

var idList = docList.map(function (cat) {
  return cat.animalId;
});

catsMapper
  .bulkUpdate(idList, docList)
  .then((updatedCats) => {
    console.log('successfully updated %d cats', updatedCats.length);
    console.log(updatedCats);
  })
  .catch(console.error);
```

#### #bulkUpsert

The bulk upsert method works similarly to bulk update, except that if the document does not exist already, it is created.

**Usage:** `mapper.bulkUpsert(idList, docList, callback)`

This method accepts the following arguments:

* `idList` - _(optional)_ - an array of _ids in the same order that should be applied to the array of documents supplied as the `docList` parameter value
  * when the `idList` property is not supplied, the value from the field matching the `_id.path` for each document in `docList` (if specified in the mapping) will be used instead
  * if the `idList` is not supplied and there is no `_id.path` specified in the mapping, Elasticsearch will auto-assign a value
* `docList` - _(required)_ - this is an array of documents to update or create if not present within Elasticsearch
  * any of the documents can be specified as partial documents
  * _NOTE:_ all fields in each document will be validated against the mapping specification prior to calling Elasticsearch
* `callback` - _(optional)_ - a function callback that accepts two arguments:
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

var docList = [{
    animalId : 12345,
    birthday : new Date('2014-04-20'),
    breed : 'manx',
    name : 'Hamish'
  }, {
    animalId : 54321,
    birthday : new Date('2014-05-09'),
    breed : 'siamese',
    name : 'Dugald'
  }];

var idList = docList.map(function (cat) {
  return cat.animalId;
});

catsMapper
  .bulkUpsert(idList, docList)
  .then((upsertedCats) => {
    console.log('successfully upserted %d cats', upsertedCats.length);
    console.log(upsertedCats);
  })
  .catch(console.error);
```

### Model Parsing and Validation

#### #analyzedFields

For building Elasticsearch queries, it is often helpful to understand when string type fields are analyzed in order to use a `match` vs a `term` query. This method provides a simple way to retrieve this information directly from the mapping.

**Usage:** `mapper.analyzedFields()`

The following example demonstrates how to retrieve an array of analyzed fields:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

console.log(catsMapper.analyzedFields());
```

#### #fieldExists

For building Elasticsearch queries, it is often helpful to understand when a field exists within the type - sorting on a non-existent field, for example, will result in a 400 response from Elasticsearch. This method provides a simply way to quickly determine if a field exists before attempting to use it in a query.

**Usage:** `mapper.fieldExists(fieldPath)`

The following example demonstrates how to determine if a field exists within a mapping:

```javascript
var Mapper = require('reindeer').Mapper;

// create a cats Elasticsearch data mapper
var catsMapper = new Mapper({
    _index : 'animals',
    _type : 'cats'
  }, {
    /* ... mapping details here ... */
  });

console.log('should be true:', catsMapper.fieldExists('name'));
console.log('should be true:', catsMapper.fieldExists('attributes.height'));
console.log('should be false:', catsMapper.fieldExists('attributes.furLength'));
```

#### #parse

The parse method is used for parsing either a JSON string or a Javascript object and coercing fields to a properly typed Javascript object that aligns with the mapping type specification. This method takes into account the [dynamic mapping](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html) specified for the mapping and returns an object as would be stored in Elasticsearch.

_NOTE:_ This method is used internally by CRUD methods within this module in order to ensure properly typed return values (i.e. so that date types are typed as Date objects, etc.).

**Usage:** `mapper.parse(json, callback)`

This method accepts the following arguments:

* `json` - _(required)_ - this can be either a JSON string or a Javascript object containing the document to be parsed
* `callback` - _(optional)_ - a function callback that accepts two arguments:
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

catsMapper
  .parse(json)
  .then((catsModel) => {
    if (catsModel) {
      console.log('successfully parsed cat %d', catsModel.animalId);
      console.log(catsModel);
    }
  })
  .catch(console.error);
```

#### #validate

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
* `callback` - _(optional)_ - a function callback that accepts three arguments:
  * `err` - populated with details in the event of an error during the operation
  * `validatedModel` - the validated model resulting from the operation
  * `modelId` - if `_id.path` is specified in the mapping and the field exists in the `doc` supplied, this is the value of the `_id`, otherwise, `null`

##### events

The validate method fires the following events:

* `identity` - whenever a `#validate` operation results in the discovery of the `_id` for the document that will be inserted to Elasticsearch, the `identity` event is emitted

The identity event returns a string value of the `_id`. The following demonstrates use of the validate method:

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

// note, unless _id.path is specified in the mapping, identity will not emit
catsMapper.on('identity', (_id) => {
  console.log(
    '_id of document will be %s (which is the animalId: %s)',
    _id,
    doc.animalId);
});

catsMapper
  .validate(doc)
  .then((catsModel) => {
    if (catsModel) {
      console.log('successfully validated %s the cat', catsModel.name);
      console.log(catsModel);
    }
  })
  .catch(console.error)
```
