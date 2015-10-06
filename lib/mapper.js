var
	util = require('util'),

	elasticsearch = require('es'),

	errors = require('./errors'),
	validators = require('./validators');


module.exports = (function () {
	'use strict';

	var validTypes = Object.keys(validators);

	function analyze (self) {
		var isValid =
			validators.isPOJO(self._mapping) &&
			validators.isPOJO(self._mapping.properties);

		if (!isValid) {
			throw new errors.InvalidMappingError(
				'mapping is not an object or is missing properties');
		}

		// parse properties from mapping
		identifyDynamicMapping(self, self._mapping.dynamic);
		identifyProperties(self, self._mapping.properties);

		// detect _id.path
		if (self._mapping._id) {
			self._idPath = self._mapping._id.path;
		}

		return;
	}

	function bulkUpdate(self, idList, docList, upsert, callback) {
		// ensure idList is an array
		if (!Array.isArray(idList)) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList is not an array'));
		}

		// ensure docList is an array with values
		if (!Array.isArray(docList) || !docList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'docList',
					'the supplied docList is either not an array or is empty'));
		}

		// ensure idList and docList lengths match if appropriate
		if (idList.length > 0 && idList.length !== docList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList and docList arrays are not of the same length'));
		}

		var
			commands = [],
			isInvalid = false,
			models = [];

		isInvalid = docList.some(function (doc, i) {
			var
				_id = idList.length ? idList[i] : undefined,
				model = validateModel(self, doc);

			// ensure the doc is valid...
			if (Array.isArray(model.errors) && model.errors.length) {
				setImmediate(
					callback,
					new errors.InvalidModelError(model.errors[0]));

				// exit loop due to invalid doc
				return true;
			}

			// ensure we have an _id
			if (!_id && !model._id) {
				setImmediate(
					callback,
					new errors.InvalidParameterError(
						'_id',
						util.format('no _id exists for document at index %d', i)));

				// exit loop due to no _id
				return true;
			}

			// ensure all fields are properly typed
			coerceProperties(self, model.clone);

			// populate the bulk commands array with document details
			commands.push({
					update : {
						_id : _id || model._id,
						_index : self._options._index,
						_type : self._options._type
					}
				}, {
					doc : model.clone,
					'doc_as_upsert' : upsert ? true : undefined
				});

			// store the model for later retrieval
			models.push(model.clone);

			return false;
		});

		// check if callback has already been called
		if (isInvalid) {
			return;
		}

		return ensureInitialize(self, function (err) {
			if (err) {
				return callback(err);
			}

			// perform bulk index operation
			return self._client.bulk(commands, function (err, result) {
				if (err) {
					return callback(err);
				}

				// check for an error in the results
				if (result && result.items) {
					result.items.some(function (item, i) {
						if (item && item.update && item.update.error) {
							err = new errors.InvalidParameterError(
								'docList',
								util.format('unable to perform bulk operation with document %d', i));

							// carry forward any additional details
							err.desc = item.update.error;
							err.statusCode = item.update.status;

							return true;
						}

						return false;
					});
				}

				// return if an error was found
				if (err) {
					return callback(err);
				}

				// return
				return callback(
					null,
					models,
					(result.items || []).map(function (item) {
						if (item && item.update) {
							return item.update._version;
						}

						return null;
					}));
			});
		});
	}

	function coerceProperties (self, model, parentPath) {
		// handle arrays
		if (Array.isArray(model)) {
			model.forEach(function (value) {
				return coerceProperties(self, value, parentPath);
			});

			return;
		}

		Object.keys(model).forEach(function (fieldName) {
			var
				fieldPath = parentPath ?
					[parentPath, fieldName].join('.') :
					fieldName,
				fieldValue = model[fieldName],
				type = self._fields[fieldPath] ?
					self._fields[fieldPath].type :
					undefined;

				// handle sub documents
				if (validators.isPOJO(fieldValue)) {
					if (![
						'object',
						'geo_point',
						'geo_shape'
					].some(function (matchType) {
							return type === matchType;
					})) {
						// a true sub-document within the mapping requiring further coersion
						coerceProperties(self, fieldValue, fieldPath);
					}

					return;
				}

				// if type should be a string, return
				if ([
					'attachment',
					'binary',
					'ip',
					'string'
				].some(function (matchType) {
						return type === matchType;
				})) {
					if (typeof model[fieldName] !== 'string') {
						model[fieldName] = model[fieldName].toString();
					}

					return;
				}

				// if type should be a date, coerce
				if (type === 'date') {
					model[fieldName] = new Date(fieldValue);

					return;
				}

				// if type should be a boolean, coerce
				if (type === 'boolean') {
					model[fieldName] =
						(fieldValue !== 'false' &&
						fieldValue !== 'no' &&
						fieldValue !== 'off' &&
						fieldValue !== '0' &&
						fieldValue !== 0);

					return;
				}

				// if type should be a number, coerce
				if ([
					'byte',
					'integer',
					'long',
					'short'
				].some(function (matchType) {
					return type === matchType;
				})) {
					model[fieldName] = parseInt(fieldValue, 10);

					return;
				}

				// numbers with decimals...
				if ([
					'double',
					'float'
				].some(function (matchType) {
					return type === matchType;
				})) {
					model[fieldName] = parseFloat(fieldValue);

					return;
				}
		});

		return;
	}

	function ensureInitialize (self, callback) {
		// instance is already initialized
		if (self._isInitialized) {
			return setImmediate(callback);
		}

		// initialize _index and _type in Elasticsearch
		return initialize(self, callback);
	}

	function identifyDynamicMapping (self, dynamicMappingType, parentPath) {
		parentPath = parentPath || '.';

		if (typeof self._dynamic[parentPath] === 'undefined') {
			self._dynamic[parentPath] =
				typeof dynamicMappingType !== 'undefined' ? dynamicMappingType : true;
		}

		return;
	}

	function identifyProperties (self, documentProperties) {
		var parseProperties = function (field, path) {
			var fields = Object.keys(field);

			fields.forEach(function (fieldName) {
				var
					fieldPath = path ?
						[path, fieldName].join('.') :
						fieldName,
					fieldValue = field[fieldName],
					isSubDocument =
						validators.isPOJO(fieldValue) &&
						validators.isPOJO(fieldValue.properties);

				// handle sub documents
				if (isSubDocument) {
					identifyDynamicMapping(self, fieldValue.dynamic, fieldPath);
					parseProperties(fieldValue.properties, fieldPath);

					return;
				}

				// ensure we have a type defined
				if (!fieldValue.type) {
					throw new errors.InvalidMappingError(
						util.format('field %s missing type', fieldPath));
				}

				// ensure the type is valid and supported
				if (validTypes.indexOf(fieldValue.type) < 0) {
					throw new errors.InvalidMappingError(
						util.format(
							'field %s type is invalid: %s',
							fieldPath,
							fieldValue.type));
				}

				// keep track of the fully qualified field name and build a validator
				self._fields[fieldPath] = fieldValue;
				self._fieldValidators[fieldPath] = validators[fieldValue.type](fieldValue);

				// track required fields
				if (typeof fieldValue.required === 'boolean' && fieldValue.required) {
					if (typeof self._required[path || '.'] === 'undefined') {
						self._required[path || '.'] = [];
					}

					self._required[path || '.'].push(fieldName);
				}

				return;
			});
		};

		return parseProperties(documentProperties);
	}

	function initialize(self, callback) {
		var
			client,
			cloneConfig = JSON.parse(JSON.stringify(self._options));

		// due to behavior of `es` module, _type must not be specified to determine
		// if _index exists or not
		cloneConfig._type = undefined;
		client = elasticsearch(cloneConfig);

		return client.indices.exists(function (err, info) {
			if (err) {
				return callback(err);
			}

			var data = {};

			// detect when index does not exist
			if (!info.exists) {
				// create the _type with supplied mapping while creating the _index
				data.mappings = {};
				data.mappings[self._options._type] = self._mapping;

				return client.indices.createIndex(data, function (err) {
					if (err) {
						err.desc = '#initialize - unable to create index in Elasticsearch';
						err._index = self._options._index;

						return callback(err);
					}

					// ensure initialize is not called subsequently for each method
					self._isInitialized = true;

					return callback();
				});
			}

			// call to put mapping because the index exists (using mapping client)
			data[self._options._type] = self._mapping;

			return self._client.indices.putMapping(data, function (err) {
				if (err) {
					err.desc = '#initialize - unable to put mapping to Elasticsearch';
					err._index = self._options._index;
					err._type = self._options._type;

					return callback(err);
				}

				// ensure initialize is not called subsequently for each method
				self._isInitialized = true;

				return callback();
			});
		});
	}

	function update (self, _id, doc, upsert, callback) {
		var
			options,
			model = validateModel(self, doc);

		// ensure the input doc is valid...
		if (Array.isArray(model.errors) && model.errors.length) {
			return setImmediate(
				callback,
				new errors.InvalidModelError(model.errors[0]));
		}

		// allow overload of _id as POJO to support additional options like TTL
		if (validators.isPOJO(_id)) {
			options = _id;
		} else {
			// default options when not specified as POJO
			options = {
				_id : _id
			};
		}

		// assign modelId if appropriate as _id value
		options._id = options._id || model._id;

		// require _id in order to go further
		if (options._id === null || typeof options._id === 'undefined') {
			return setImmediate(
				callback,
				new errors.InvalidParameterError('_id', '_id parameter is not supplied'));
		}

		// ensure module is initialized
		return ensureInitialize(self, function (err) {
			if (err) {
				return callback(err);
			}

			// next, perform index operation with _create to error if doc already exists
			return self._client.update(
				options,
				{
					doc : model.clone,
					'doc_as_upsert' : upsert ? true : undefined
				},
				function (err, result) {
					if (err) {
						err.desc = upsert ?
							'#upsert - unable to upsert document in Elasticsearch' :
							'#update - unable to update document in Elasticsearch';
						err._id = options._id;

						return callback(err);
					}

					// ensure type values are as expected
					coerceProperties(self, model.clone);

					// return
					return callback(null, model.clone, result._version);
				});
		});
	}

	function validateModel (self, model, parentPath) {
		var
			missingRequiredFields = self._required[parentPath || '.'],
			result = {
				_id : null,
				clone : null,
				errors : []
			};

		// clone these
		if (missingRequiredFields) {
			missingRequiredFields =
				JSON.parse(JSON.stringify(missingRequiredFields));
		} else {
			missingRequiredFields = [];
		}

		// ensure we have a root model
		if (!validators.isPOJO(model) || !Object.keys(model).length) {
			if (!parentPath) {
				result.errors.push('model is not an object or is empty');
			}

			return result;
		}

		// clone the input model
		result.clone = JSON.parse(JSON.stringify(model));

		Object.keys(model).some(function (field) {
			var
				dynamic,
				fieldPath = parentPath ? [parentPath, field].join('.') : field,
				fieldValue = model[field],
				isSubDocumentArray =
					Array.isArray(fieldValue) &&
					typeof self._dynamic[fieldPath] !== 'undefined';

			// check if field matches _id path
			if (self._idPath && self._idPath === fieldPath) {
				result._id = fieldValue;
			}

			// clear required field when discovered
			if (missingRequiredFields.indexOf(field) >= 0) {
				missingRequiredFields.splice(missingRequiredFields.indexOf(field), 1);
			}

			// check for sub-documents as arrays
			if (isSubDocumentArray) {
				fieldValue.some(function (subModel, i) {
					var fieldResult = validateModel(self, subModel, fieldPath);

					// result._id not assigned for an array of sub-documents
					result.clone[field][i] = fieldResult.clone;
					fieldResult.errors.forEach(function (error) {
						result.errors.push(
							error.replace(
								fieldPath,
								[fieldPath, '[', i, ']'].join('')));
					});

					return fieldResult.errors.length !== 0;
				});

				return result.errors.length !== 0;
			}

			// check for sub-documents
			if (validators.isPOJO(model[field])) {
				var fieldResult = validateModel(self, fieldValue, fieldPath);

				result._id = result._id || fieldResult._id;
				result.clone[field] = fieldResult.clone;
				result.errors = result.errors.concat(fieldResult.errors);

				return result.errors.length !== 0;
			}

			// determine if the field is defined in the mapping
			if (typeof self._fields[fieldPath] === 'undefined') {
				dynamic = self._dynamic[parentPath || '.'];

				// keep the value if the dynamic mapping is true (the default setting)
				if (typeof dynamic === 'undefined' || dynamic === true) {
					return false;
				}

				// track as error if the dynamic mapping is strict
				if (dynamic === 'strict') {
					result.errors.push(util.format(
						'%s is not a valid field in the strict type mapping',
						fieldPath));

					return true;
				}

				// remove the field if the dynamic mapping is false
				result.clone[field] = undefined;

				return false;
			}

			// validate the field value
			if (!self._fieldValidators[fieldPath](fieldValue)) {
				result.errors.push(
					util.format(
						'%s contains an invalid value (%s) for type %s',
						fieldPath,
						model[field],
						self._fields[fieldPath].type));

				return true;
			}

			return false;
		});

		// note all missing required fields as errors
		if (missingRequiredFields.length) {
			missingRequiredFields.forEach(function (missingField) {
				result.errors.push(
					util.format(
						'field %s%s%s is required',
						(parentPath ? parentPath : ''),
						(parentPath ? '.' : ''),
						missingField));
			});
		}

		return result;
	}

	function Mapper (options, mapping) {
		if (!options._index || typeof options._index !== 'string') {
			throw new Error('_index must be provided');
		}

		if (!options._type || typeof options._type !== 'string') {
			throw new Error('_type must be provided');
		}

		// initialize Mapper properties
		this._client = elasticsearch(options);
		this._dynamic = {};
		this._fields = {};
		this._fieldValidators = {};
		this._idPath = null;
		this._isInitialized = false;
		this._options = options;
		this._mapping = mapping;
		this._required = {};

		// analyze the input
		return analyze(this);
	}

	Mapper.prototype.bulkCreate = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		// ensure idList is an array
		if (!Array.isArray(idList)) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList is not an array'));
		}

		// ensure docList is an array with values
		if (!Array.isArray(docList) || !docList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'docList',
					'the supplied docList is either not an array or is empty'));
		}

		// ensure idList and docList lengths match if appropriate
		if (idList.length > 0 && idList.length !== docList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList and docList arrays are not of the same length'));
		}

		var
			_this = this,
			commands = [],
			isInvalid = false,
			modelIds = [],
			models = [];

		isInvalid = docList.some(function (doc, i) {
			var
				_id = idList.length ? idList[i] : undefined,
				model = validateModel(_this, doc);

			// ensure the doc is valid...
			if (Array.isArray(model.errors) && model.errors.length) {
				setImmediate(
					callback,
					new errors.InvalidModelError(model.errors[0]));

				// exit loop due to invalid doc
				return true;
			}

			// coerce the fields to proper types
			coerceProperties(_this, model.clone);

			// populate the bulk commands array with document details
			commands.push({
					create : {
						_id : _id || model._id,
						_index : _this._options._index,
						_type : _this._options._type
					}
				},
				model.clone);

			// save the _id and validated model to return later
			modelIds.push(model._id || null);
			models.push(model.clone);

			return false;
		});

		// check if callback has already been called
		if (isInvalid) {
			return;
		}

		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			// perform bulk index operation
			return _this._client.bulk(commands, function (err, result) {
				if (err) {
					return callback(err);
				}

				// check for an error in the results
				if (result && result.items) {
					result.items.some(function (item, i) {
						if (item && item.create && item.create.error) {
							err = new errors.InvalidParameterError(
								'docList',
								util.format('unable to perform bulk create operation with document %d', i));

							// carry forward any additional details
							err.desc = item.create.error;
							err.statusCode = item.create.status;

							return true;
						}

						return false;
					});
				}

				// return if an error was found
				if (err) {
					return callback(err);
				}

				// return
				return callback(
					null,
					models,
					(result.items || modelIds).map(function (item) {
						if (item && item.create) {
							return item.create._id;
						}

						return item;
					}));
			});
		});
	};

	Mapper.prototype.bulkDelete = function (idList, callback) {
		// ensure docList is an array with values
		if (!Array.isArray(idList) || !idList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList is either not an array or is empty'));
		}

		var
			_this = this,
			commands = [],
			isInvalid = idList.some(function (_id, i) {
				// ensure the _id is valid...
				if (typeof _id === 'undefined' || _id === null) {
					setImmediate(
						callback,
						new errors.InvalidParameterError(
							'idList',
							util.format('_id at index %d is null or undefined', i)));

					// exit loop due to invalid _id
					return true;
				}

				// populate the bulk commands array with document details
				commands.push({
					delete : {
						_id : _id,
						_index : _this._options._index,
						_type : _this._options._type
					}
				});

				return false;
			});

		// check if callback has already been called
		if (isInvalid) {
			return;
		}

		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			// perform bulk delete operation
			return _this._client.bulk(commands, function (err) {
				if (err) {
					return callback(err);
				}

				// return
				return callback();
			});
		});
	};

	Mapper.prototype.bulkGet = function (idList, callback) {
		// ensure docList is an array with values
		if (!Array.isArray(idList) || !idList.length) {
			return setImmediate(
				callback,
				new errors.InvalidParameterError(
					'idList',
					'the supplied idList is either not an array or is empty'));
		}

		var
			_this = this,
			docs = [],
			isInvalid = idList.some(function (_id, i) {
				// ensure the _id is valid...
				if (typeof _id === 'undefined' || _id === null) {
					setImmediate(
						callback,
						new errors.InvalidParameterError(
							'idList',
							util.format('_id at index %d is null or undefined', i)));

					// exit loop due to invalid _id
					return true;
				}

				// populate the bulk commands array with document details
				docs.push({
					_id : _id,
					_index : _this._options._index,
					_type : _this._options._type
				});

				return false;
			});

		// check if callback has already been called
		if (isInvalid) {
			return;
		}

		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			// perform bulk delete operation
			return _this._client.multiGet(docs, function (err, result) {
				if (err) {
					return callback(err);
				}

				docs = [];
				(result.docs || []).forEach(function (doc) {
					if (doc.found) {
						docs.push(doc._source);
					}
				});

				// return
				return callback(null, docs);
			});
		});
	};

	Mapper.prototype.bulkUpdate = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		return bulkUpdate(this, idList, docList, false, callback);
	};

	Mapper.prototype.bulkUpsert = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		return bulkUpdate(this, idList, docList, true, callback);
	};

	Mapper.prototype.create = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		var
			_this = this,
			options,
			model = validateModel(this, doc);

		// ensure the input doc is valid...
		if (Array.isArray(model.errors) && model.errors.length) {
			return setImmediate(
				callback,
				new errors.InvalidModelError(model.errors[0]));
		}

		// allow overload of _id as POJO to support additional options like TTL
		if (validators.isPOJO(_id)) {
			options = _id;
			// jshint sub : true
			options['op_type'] = options['op_type'] || 'create';
		} else {
			// default options when not specified as POJO
			options = {
				_id : _id,
				'op_type' : 'create'
			};
		}

		// assign modelId if appropriate as _id value
		options._id = options._id || model._id;

		// ensure module is initialized
		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			// next, perform index operation with _create to error if doc already exists
			return _this._client.index(
				options,
				model.clone,
				function (err, result) {
					if (err) {
						err.desc = '#create - unable to index new document in Elasticsearch';
						err._id = options._id;

						return callback(err);
					}

					if (!options._id) {
						model._id = result._id;
					}

					// ensure type values are as expected
					coerceProperties(_this, model.clone);

					// return
					return callback(null, model.clone, model._id);
				});
		});
	};

	Mapper.prototype.delete = function (_id, callback) {
		if (_id === null || typeof _id === 'undefined') {
			return setImmediate(
				callback,
				new errors.InvalidParameterError('_id', '_id parameter is not supplied'));
		}

		var
			_this = this,
			options;

		// allow overload of _id as POJO to support additional options
		if (validators.isPOJO(_id)) {
			options = _id;
		} else {
			options = {
				_id : _id
			};
		}

		// ensure module is initialized
		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			return _this._client.delete(options, function (err) {
				if (err) {
					err.desc = '#delete - unable to delete existing document in Elasticsearch';
					err._id = _id;

					return callback(err);
				}

				return callback(null);
			});
		});
	};

	Mapper.prototype.get = function (_id, callback) {
		if (_id === null || typeof _id === 'undefined') {
			return setImmediate(
				callback,
				new errors.InvalidParameterError('_id', '_id parameter is not supplied'));
		}

		var
			_this = this,
			options;

		// allow overload of _id as POJO to support additional options
		if (validators.isPOJO(_id)) {
			options = _id;
			options._source = options._source || true;
		} else {
			options = {
				_id : _id,
				_source : true
			};
		}

		// ensure module is initialized
		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			// perform lookup, specifying _source in order to get doc directly
			return _this._client.get(options, function (err, result) {
				// if there is an error, only return it if it's not expected (i.e. 404)
				if (err && err.statusCode !== 404) {
					err.desc = '#get - unable to get document from Elasticsearch';
					err._id = _id;

					return callback(err);
				}

				// coerce any result to ensure type values are as expected
				if (result) {
					coerceProperties(_this, result);
				}

				// return
				return callback(null, result || null);
			});
		});
	};

	Mapper.prototype.parse = function (json, callback) {
		if (typeof json === 'string') {
			try {
				json = JSON.parse(json);
			} catch (ex) {
				var err = new errors.InvalidModelError(ex, 'unable to parse JSON');

				return setImmediate(callback, err);
			}
		}

		// ensure we have a root model
		if (!Array.isArray(json) && (!validators.isPOJO(json) || !Object.keys(json).length)) {
			var err = new errors.InvalidModelError('supplied model is not an object');

			return setImmediate(callback, err);
		}

		// coerce the field values of a cloned object
		var model = JSON.parse(JSON.stringify(json));
		coerceProperties(this, model);

		return setImmediate(function () {
			return callback(null, model);
		});
	};

	Mapper.prototype.search = function (options, query, callback) {
		if (typeof callback === 'undefined' && typeof query === 'function') {
			callback = query;
			query = options;
			options = {};
		}

		var
			_this = this,
			models = [],
			summary = {
				query : query,
				total : 0
			};

		return ensureInitialize(_this, function (err) {
			if (err) {
				return callback(err);
			}

			return _this._client.search(options, query, function (err, result) {
				if (err) {
					return callback(err);
				}

				// handle results
				if (result && result.hits && result.hits.hits) {
					summary.total = result.hits.total;

					result.hits.hits.forEach(function (hit) {
						// coerce properties and store for return
						coerceProperties(_this, hit._source);
						models.push(hit._source);
					});
				}

				return callback(null, models, summary);
			});
		});
	};

	Mapper.prototype.update = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		return update(this, _id, doc, false, callback);
	};

	Mapper.prototype.upsert = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		return update(this, _id, doc, true, callback);
	};

	Mapper.prototype.validate = function (model, callback) {
		var result = validateModel(this, model);

		if (Array.isArray(result.errors) && result.errors.length) {
			var err = new errors.InvalidModelError(result.errors[0]);

			return setImmediate(callback, err);
		}

		return setImmediate(function () {
			return callback(null, result.clone, result._id);
		});
	};

	Mapper.prototype.verifyConnection = function (callback) {
		return ensureInitialize(this, callback);
	};

	return Mapper;
}());
