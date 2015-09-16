var
	util = require('util'),

	elasticsearch = require('es'),

	errors = require('./errors'),
	validators = require('./validators');


module.exports = (function () {
	'use strict';

	var validTypes = Object.keys(validators);

	function analyze (self, mapping) {
		var isValid =
			validators.isPOJO(mapping) &&
			validators.isPOJO(mapping.properties);

		if (!isValid) {
			throw new errors.InvalidMappingError(
				'mapping is not an object or is missing properties');
		}

		// parse properties from mapping
		identifyDynamicMapping(self, mapping.dynamic);
		identifyProperties(self, mapping.properties);

		// assign _id.path (if applicable)
		if (mapping._id) {
			self._idPath = mapping._id.path;
		}

		return;
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
		this._idPath;
		this._index = options._index;
		this._required = {};
		this._type = options._type;

		// analyze the input
		return analyze(this, mapping);
	}

	Mapper.prototype.create = function (_id, doc, callback) {
		if (typeof callback === 'undefined' && typeof doc === 'function') {
			callback = doc;
			doc = _id;
			_id = undefined;
		}

		var
			_this = this,
			options;

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

		// first, validate the incoming document to ensure fitness
		return _this.validate(doc, function (err, model, modelId) {
			if (err) {
				return callback(err);
			}

			// assign modelId if appropriate as _id value
			options._id = options._id || modelId;

			// next, perform index operation with _create to error if doc already exists
			return _this._client.index(
				options,
				model,
				function (err, result) {
					if (err) {
						return callback(err);
					}

					// ensure type values are as expected
					coerceProperties(_this, model);

					// return
					return callback(null, model);
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
			}
		}

		return _this._client.delete(options, function (err, result) {
			if (err) {
				return callback(err);
			}

			return callback(null);
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
			}
		}

		// perform lookup, specifying _source in order to get doc directly
		return _this._client.get(options, function (err, result) {
			// if there is an error, only return it if it's not expected (i.e. 404)
			if (err && err.statusCode !== 404) {
				return callback(err);
			}

			// coerce any result to ensure type values are as expected
			if (result) {
				coerceProperties(_this, result);
			}

			// return
			return callback(null, result || null);
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

	return Mapper;
}());
