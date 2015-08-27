var
	util = require('util'),

	validators = require('./validators');


module.exports = (function () {
	'use strict';

	var validTypes = Object.keys(validators);

	function analyze (self, mapping) {
		var isValid =
			validators.isPOJO(mapping) &&
			validators.isPOJO(mapping.properties);

		if (!isValid) {
			throw new TypeError('mapping is not an object or is missing properties');
		}

		identifyDynamicMapping(self, mapping.dynamic);
		identifyProperties(self, mapping.properties);

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
					throw new TypeError(
						util.format('field %s missing type', fieldPath));
				}

				// ensure the type is valid and supported
				if (validTypes.indexOf(fieldValue.type) < 0) {
					throw new TypeError(
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
				clone : null,
				errors : []
			};

		// ensure we have a root model
		if (!validators.isPOJO(model) || !Object.keys(model).length) {
			if (!parentPath) {
				result.errors.push('model is not an object or is empty');
			}

			return result;
		}

		// clone the input model
		result.clone = JSON.parse(JSON.stringify(model));

		Object.keys(model).forEach(function (field) {
			var
				dynamic,
				fieldPath = parentPath ? [parentPath, field].join('.') : field,
				fieldValue = model[field];

			// clear required field when discovered
			if (missingRequiredFields && missingRequiredFields.indexOf(field) >= 0) {
				missingRequiredFields.splice(missingRequiredFields.indexOf(field), 1);
			}

			// check for sub-documents
			if (validators.isPOJO(model[field])) {
				var fieldResult = validateModel(self, fieldValue, fieldPath);
				result.errors = result.errors.concat(fieldResult.errors);
				result.clone[field] = fieldResult.clone;

				return;
			}

			// determine if the field is defined in the mapping
			if (typeof self._fields[fieldPath] === 'undefined') {
				dynamic = self._dynamic[parentPath || '.'];

				// keep the value if the dynamic mapping is true (the default setting)
				if (typeof dynamic === 'undefined' || dynamic === true) {
					return;
				}

				// track as error if the dynamic mapping is strict
				if (dynamic === 'strict') {
					result.errors.push(util.format(
						'%s is not a valid field in the strict type mapping',
						fieldPath));

					return;
				}

				// remove the field if the dynamic mapping is false
				result.clone[field] = undefined;
				return;
			}

			// validate the field value
			if (!self._fieldValidators[fieldPath](fieldValue)) {
				result.errors.push(
					util.format(
						'%s contains an invalid value (%s) for type %s',
						fieldPath,
						model[field],
						self._fields[fieldPath].type));

				return;
			}

			return;
		});

		// note all missing required fields as errors
		if (Array.isArray(missingRequiredFields) && missingRequiredFields.length) {
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

	function Mapper (name, mapping) {
		if (!name || typeof name !== 'string') {
			throw new Error('type name must be provided');
		}

		// initialize Mapper properties
		this._dynamic = {};
		this._fields = {};
		this._fieldValidators = {};
		this._required = {};
		this._type = name;

		// analyze the input
		return analyze(this, mapping);
	}

	Mapper.prototype.validate = function (model, callback) {
		var result = validateModel(this, model);

		if (Array.isArray(result.errors) && result.errors.length) {
			var err = new Error('model is invalid');
			err.errors = result.errors;

			return setImmediate(callback, err);
		}

		return setImmediate(function () {
			return callback(null, result.clone);
		});
	};

	return Mapper;
}());
