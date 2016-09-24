/*eslint no-undefined:0*/
var
	events = require('events'),
	util = require('util'),

	elasticsearch = require('es'),

	errors = require('./errors'),
	validators = require('./validators');

const
	EVENT_IDENTITY = 'identity',
	EVENT_SUMMARY = 'summary',
	EVENT_VERSION = 'version';

module.exports = (function () {
	'use strict';

	let validTypes = Object.keys(validators);

	function analyze (self) {
		let isValid =
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

	function bulkUpdate (self, idList, docList, upsert, callback) {
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

		let
			commands = [],
			isInvalid = false,
			models = [];

		isInvalid = docList.some((doc, i) => {
			let
				_id = idList.length ? idList[i] : undefined,
				model = validateModel(self, doc, undefined, !upsert);

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

		return ensureInitialize(self, (err) => {
			if (err) {
				return callback(err);
			}

			// perform bulk index operation
			return self._client.bulk(commands, (err, result) => {
				if (err) {
					return callback(err);
				}

				// check for an error in the results
				if (result && result.items) {
					result.items.some((item, i) => {
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
					(result.items || []).map((item) => {
						if (item && item.update) {
							return item.update._version;
						}

						return null;
					}));
			});
		});
	}

	function coerceValue (fieldValue, type) {
		// if type should be a string, return
		if ([
			'attachment',
			'binary',
			'ip',
			'string'
		].some((matchType) => type === matchType)) {
			if (fieldValue && typeof fieldValue !== 'string') {
				return fieldValue.toString();
			}

			return fieldValue;
		}

		// if type should be a date, coerce
		if (type === 'date') {
			return new Date(fieldValue);
		}

		// if type should be a boolean, coerce
		if (type === 'boolean') {
			return (
				fieldValue !== false &&
				fieldValue !== 'false' &&
				fieldValue !== 'no' &&
				fieldValue !== 'off' &&
				fieldValue !== 0 &&
				fieldValue !== '0');
		}

		// if type should be a number, coerce
		if ([
			'byte',
			'integer',
			'long',
			'short'
		].some((matchType) => type === matchType)) {
			return parseInt(fieldValue, 10);
		}

		// numbers with decimals...
		if ([
			'double',
			'float'
		].some((matchType) => type === matchType)) {
			return parseFloat(fieldValue);
		}

		return fieldValue;
	}

	function coerceProperties (self, model, parentPath) {
		// handle arrays
		if (Array.isArray(model)) {
			model.forEach((value) => coerceProperties(self, value, parentPath));

			return;
		}

		Object.keys(model).forEach((fieldName) => {
			let
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
					].some((matchType) => type === matchType)) {
						// a true sub-document within the mapping requiring further coersion
						coerceProperties(self, fieldValue, fieldPath);
					}

					return;
				}

				// handle arrays of types properly
				if (Array.isArray(fieldValue)) {
					fieldValue.forEach((subValue, i) => (
						model[fieldName][i] = coerceValue(subValue, type)));

					return;
				}

				// individual type values (not arrays)
				model[fieldName] = coerceValue(fieldValue, type);

				return;
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

	function execOrCallback (exec, callback) {
		if (callback) {
			return exec
				.then((result) => callback(null, result))
				.catch(callback);
		}

		return exec;
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
		let parseProperties = (field, path) => {
			let fields = Object.keys(field);

			fields.forEach((fieldName) => {
				let
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

				// ensure dynamic object field types are properly tracked
				if (fieldValue.type === 'object') {
					self._dynamic[fieldPath] = fieldValue.dynamic || false;
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
		let
			client,
			cloneConfig = JSON.parse(JSON.stringify(self._options));

		// due to behavior of `es` module, _type must not be specified to determine
		// if _index exists or not
		cloneConfig._type = undefined;
		client = elasticsearch(cloneConfig);

		return client.indices.exists((err, info) => {
			if (err) {
				return callback(err);
			}

			let data = {};

			// detect when index does not exist
			if (!info.exists) {
				// create the _type with supplied mapping while creating the _index
				data.mappings = {};
				data.mappings[self._options._type] = self._mapping;

				return client.indices.createIndex(data, (err) => {
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

			return self._client.indices.putMapping(data, (err) => {
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
		let
			options,
			model = validateModel(self, doc, undefined, !upsert);

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
		return ensureInitialize(self, (err) => {
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
				(err, result) => {
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

	function validateModel (self, model, parentPath, skipRequiredFieldCheck) {
		let
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

		Object.keys(model).some((field) => {
			let
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
				fieldValue.some((subModel, i) => {
					let fieldResult = validateModel(
						self,
						subModel,
						fieldPath,
						skipRequiredFieldCheck);

					// result._id not assigned for an array of sub-documents
					result.clone[field][i] = fieldResult.clone;
					fieldResult.errors.forEach((error) => {
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
				let fieldResult = validateModel(
					self,
					fieldValue,
					fieldPath,
					skipRequiredFieldCheck);

				result._id = result._id || fieldResult._id;
				result.clone[field] = fieldResult.clone;
				result.errors = result.errors.concat(fieldResult.errors);

				return result.errors.length !== 0;
			}

			// determine if the field is defined in the mapping
			if (typeof self._fields[fieldPath] === 'undefined') {
				dynamic = self._dynamic[parentPath || '.'];

				// keep the value if the dynamic mapping is true (the default setting)
				if (dynamic === true) {
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

			// skip when required field check is disabled and the value is empty
			if (skipRequiredFieldCheck && validators.isUndefined(fieldValue)) {
				return false;
			}

			// is field an array of values?
			if (Array.isArray(fieldValue)) {
				return fieldValue.some((subValue, i) => {
					// validate the field value
					if (!self._fieldValidators[fieldPath](subValue)) {
						result.errors.push(
							util.format(
								'%s contains an invalid value (%s) at index %d for type %s',
								fieldPath,
								model[field],
								i,
								self._fields[fieldPath].type));

						return true;
					}

					return false;
				});
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
		if (!skipRequiredFieldCheck && missingRequiredFields.length) {
			missingRequiredFields.forEach((missingField) => {
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

		// ensure Mapper is an EventEmitter
		events.EventEmitter.call(this);

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

	util.inherits(Mapper, events.EventEmitter);

	Mapper.prototype.analyzedFields = function () {
		let
			_this = this,
			analyzedFields = [];

		Object.keys(_this._fields).forEach((fieldPath) => {
			// strings are the only types that are analyzed
			if (_this._fields[fieldPath].type !== 'string') {
				return;
			}

			if ((_this._fields[fieldPath].index || 'analyzed') === 'analyzed') {
				analyzedFields.push(fieldPath);
			}
		});

		return analyzedFields;
	};

	Mapper.prototype.bulkCreate = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		if (typeof docList === 'undefined' && typeof idList !== 'function') {
			docList = idList;
			idList = [];
		}

		if (typeof idList === 'function') {
			callback = idList;
			docList = [];
			idList = [];
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let
					commands = [],
					modelIds = [],
					models = [];

				// ensure idList is an array
				if (!Array.isArray(idList)) {
					return reject(new errors.InvalidParameterError(
						'idList',
						'the supplied idList is not an array'));
				}

				// ensure docList is an array with values
				if (!Array.isArray(docList) || !docList.length) {
					return reject(new errors.InvalidParameterError(
						'docList',
						'the supplied docList is either not an array or is empty'));
				}

				// ensure idList and docList lengths match if appropriate
				if (idList.length > 0 && idList.length !== docList.length) {
					return reject(new errors.InvalidParameterError(
						'idList',
						'the supplied idList and docList arrays are not of the same length'));
				}

				// validate supplied documents
				docList.some((doc, i) => {
					let
						_id = idList.length ? idList[i] : undefined,
						model = validateModel(_this, doc);

					// ensure the doc is valid...
					if (Array.isArray(model.errors) && model.errors.length) {
						return reject(new errors.InvalidModelError(model.errors[0]));
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
					if (_id || model._id) {
						modelIds.push(_id || model._id);
					}

					models.push(model.clone);

					return false;
				});

				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					// perform bulk index operation
					return _this._client.bulk(commands, (err, result) => {
						if (err) {
							return reject(err);
						}

						// check for an error in the results
						if (result && result.items) {
							result.items.some((item, i) => {
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
							return reject(err);
						}

						// set the idList if it was an empty array
						if (!modelIds.length) {
							_this.emit(
								EVENT_IDENTITY,
								result.items.map((item) => item.create._id));
						}

						// return
						return resolve(models);
					});
				});
			});

		// execute and return to caller
		return execOrCallback(exec, callback);
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

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let commands = [];

				idList.some((_id, i) => {
					// ensure the _id is valid...
					if (typeof _id === 'undefined' || _id === null) {
						return reject(new errors.InvalidParameterError(
							'idList',
							util.format('_id at index %d is null or undefined', i)));
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

				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					// perform bulk delete operation
					return _this._client.bulk(commands, (err, summary) => {
						if (err) {
							return reject(err);
						}

						// return
						return resolve(summary);
					});
				});
			});

		// execute and return to caller
		return execOrCallback(exec, callback);
	};

	Mapper.prototype.bulkGet = function (idList, _source, callback) {
		// handle optional _source parameter
		if (!callback && typeof _source === 'function') {
			callback = _source;
			_source = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				// ensure idList is an array with values
				if (!Array.isArray(idList) || !idList.length) {
					return reject(
						new errors.InvalidParameterError(
							'idList',
							'the supplied idList is either not an array or is empty'));
				}

				let docs = [];

				idList.some((_id, i) => {
					// ensure the _id is valid...
					if (typeof _id === 'undefined' || _id === null) {
						return reject(new errors.InvalidParameterError(
							'idList',
							util.format('_id at index %d is null or undefined', i)));
					}

					// populate the bulk commands array with document details
					docs.push({
						_id : _id,
						_index : _this._options._index,
						_source : _source,
						_type : _this._options._type
					});

					return false;
				});

				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					// perform bulk delete operation
					return _this._client.multiGet(docs, (err, result) => {
						if (err) {
							return reject(err);
						}

						docs = [];
						(result.docs || []).forEach((doc) => {
							if (doc.found) {
								docs.push(doc._source);
							}
						});

						// return
						return resolve(docs);
					});
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.bulkUpdate = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				return bulkUpdate(
					_this,
					idList,
					docList,
					false,
					(err, result, versions) => {
						if (err) {
							return reject(err);
						}

						// emit the version information
						_this.emit(EVENT_VERSION, versions);

						return resolve(result);
					});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.bulkUpsert = function (idList, docList, callback) {
		if (typeof callback === 'undefined' && typeof docList === 'function') {
			callback = docList;
			docList = idList;
			idList = [];
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				return bulkUpdate(
					_this,
					idList,
					docList,
					true,
					(err, result, versions) => {
						if (err) {
							return reject(err);
						}

						// emit the version information
						_this.emit(EVENT_VERSION, versions);

						return resolve(result);
					});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.create = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		if (typeof doc === 'undefined' && typeof _id !== 'function') {
			doc = _id;
			_id = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let
					options,
					model = validateModel(this, doc);

					// ensure the input doc is valid...
					if (Array.isArray(model.errors) && model.errors.length) {
						return reject(new errors.InvalidModelError(model.errors[0]));
					}

					// allow overload of _id as POJO to support additional options like TTL
					if (validators.isPOJO(_id)) {
						options = _id;
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
					return ensureInitialize(_this, (err) => {
						if (err) {
							return reject(err);
						}

						// next, perform index operation with _create to error if doc already exists
						return _this._client.index(
							options,
							model.clone,
							(err, result) => {
								if (err) {
									err.desc = '#create - unable to index new document in Elasticsearch';
									err._id = options._id;

									return reject(err);
								}

								// ensure type values are as expected
								coerceProperties(_this, model.clone);

								// apply the _id if it isn't specified
								if (!options._id) {
									_this.emit(
										EVENT_IDENTITY,
										result._id);
								}

								// return
								return resolve(model.clone);
							});
					});
			});

		// execute and return to caller
		return execOrCallback(exec, callback);
	};

	Mapper.prototype.delete = function (_id, callback) {
		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let options;

				if (_id === null || typeof _id === 'undefined') {
					return reject(
						new errors.InvalidParameterError(
							'_id',
							'_id parameter is not supplied'));
				}

				// allow overload of _id as POJO to support additional options
				if (validators.isPOJO(_id)) {
					options = _id;
				} else {
					options = {
						_id : _id
					};
				}

				// ensure either an _id or a query is provided
				if (!options._id && !options.query) {
					return reject(
						new errors.InvalidParameterError('_id', '_id or query must be supplied'));
				}

				// ensure module is initialized
				return ensureInitialize(_this, (err) => {
					if (err) {
						return callback(err);
					}

					// delete by _id
					if (options._id) {
						return _this._client.delete(options, (err, summary) => {
							if (err) {
								err.desc = '#delete - unable to delete specified document in Elasticsearch';
								err.options = options;

								return reject(err);
							}

							return resolve(summary);
						});
					}

					// delete by query
					return _this._client.deleteByQuery(options, (err, summary) => {
						if (err) {
							err.desc = '#delete - unable to delete document(s) in Elasticsearch by query';
							err.options = options;

							return reject(err);
						}

						return resolve(summary);
					});
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.fieldExists = function (fieldPath) {
		return typeof this._fields[fieldPath] !== 'undefined';
	};

	Mapper.prototype.get = function (_id, _source, callback) {
		// handle optional _source parameter when missing
		if (!callback && typeof _source === 'function') {
			callback = _source;
			_source = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				if (_id === null || typeof _id === 'undefined') {
					return reject(
						new errors.InvalidParameterError('_id', '_id parameter is not supplied'));
				}

				let options;

				// allow overload of _id as POJO to support additional options
				if (validators.isPOJO(_id)) {
					options = _id;
					options._source = _source || options._source || true;
				} else {
					options = {
						_id : _id,
						_source : _source || true
					};
				}

				// ensure module is initialized
				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					// perform lookup, specifying _source in order to get doc directly
					return _this._client.get(options, (err, result) => {
						// if there is an error, only return it if it's not expected (i.e. 404)
						if (err && err.statusCode !== 404) {
							err.desc = '#get - unable to get document from Elasticsearch';
							err._id = _id;

							return reject(err);
						}

						// coerce any result to ensure type values are as expected
						if (result) {
							coerceProperties(_this, result);
						}

						// return
						return resolve(result || null);
					});
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.parse = function (json, callback) {
		if (typeof callback === 'undefined' && typeof json === 'function') {
			callback = json;
			json = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				if (typeof json === 'string') {
					try {
						json = JSON.parse(json);
					} catch (ex) {
						let err = new errors.InvalidModelError(ex, 'unable to parse JSON');

						return reject(err);
					}
				}

				// ensure we have a root model
				if (!Array.isArray(json) && (!validators.isPOJO(json) || !Object.keys(json).length)) {
					let err = new errors.InvalidModelError('supplied model is not an object');

					return reject(err);
				}

				// coerce the field values of a cloned object
				let model = JSON.parse(JSON.stringify(json));
				coerceProperties(_this, model);

				// return to sender
				return resolve(model);
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.search = function (options, query, callback) {
		if (typeof callback === 'undefined' && typeof query === 'function') {
			callback = query;
			query = options;
			options = {};
		}

		if (typeof query === 'undefined' && typeof options !== 'function') {
			query = options;
			options = {};
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let
					models = [],
					summary = {
						query : query,
						total : 0
					};

				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					return _this._client.search(options, query, (err, result) => {
						if (err) {
							return reject(err);
						}

						// handle results
						if (result && result.hits && result.hits.hits) {
							summary.total = result.hits.total;

							result.hits.hits.forEach((hit) => {
								// when fields are specified on a search, there is no _source
								if (hit.fields) {
									models.push(hit.fields);

									return;
								}

								// coerce properties and store for return
								coerceProperties(_this, hit._source);
								models.push(hit._source);

								return;
							});
						}

						// emit the summary
						_this.emit(EVENT_SUMMARY, summary);

						return resolve(models);
					});
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.update = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				return update(_this, _id, doc, false, (err, result, version) => {
					if (err) {
						return reject(err);
					}

					// emit the version
					_this.emit(EVENT_VERSION, version);

					return resolve(result);
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.upsert = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				return update(_this, _id, doc, true, (err, result, version) => {
					if (err) {
						return reject(err);
					}

					// emit the version
					_this.emit(EVENT_VERSION, version);

					return resolve(result);
				});
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.validate = function (model, callback) {
		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				let result = validateModel(this, model);

				if (Array.isArray(result.errors) && result.errors.length) {
					let err = new errors.InvalidModelError(result.errors[0]);
					return reject(err);
				}

				if (result._id) {
					_this.emit(EVENT_IDENTITY, result._id);
				}

				return resolve(result.clone);
			});

		return execOrCallback(exec, callback);
	};

	Mapper.prototype.verifyConnection = function (callback) {
		let
			_this = this,
			exec = new Promise((resolve, reject) => {
				return ensureInitialize(_this, (err) => {
					if (err) {
						return reject(err);
					}

					return resolve();
				});
			});

		return execOrCallback(exec, callback);
	};

	return Mapper;
}());
