var
	util = require('util'),

	validators = require('./validators');


module.exports = (function () {
	'use strict';

	var validTypes = Object.keys(validators);

	function analyze (self, mapping) {
		var isValid =
			typeof mapping !== 'object' ||
			!mapping.properties ||
			typeof mapping.properties !== 'object';

		if (!isValid) {
			throw new TypeError('mapping is not an object or is missing properties');
		}

		identifyDynamicMapping(self, mapping.dynamic);
		identifyProperties(self, mapping.properties);

		return;
	}

	function identifyDynamicMapping(self, dynamicMappingType, parentPath) {
		parentPath = parentPath || '.';

		if (typeof self._dynamic[parentPath] === 'undefined') {
			self._dynamic[parentPath] = dynamicMappingType || true;
		}

		return;
	}

	function identifyProperties(self, documentProperties, parentPath) {
		var fields = Object.keys(documentProperties);

		// iterate each field in the mapping
		fields.forEach(function (field) {
			var
				fieldPath = parentPath ?
					[parentPath, field].join('.') :
					field,
				isSubDocument =
					field.properties &&
					typeof field.properties === 'object' &&
					!(Array.isArray(field.properties)) &&
					!(field instanceof Date);

			// check if field represents a sub document
			if (isSubDocument) {
				identifyDynamicMapping(self, field.dynamic, fieldPath);
				identifyProperties(self, field.properties, fieldPath);

				return;
			}

			// ensure we have a type defined
			if (!field.type) {
				throw new TypeError(
					util.format('field %s missing type', fieldPath));
			}

			// ensure the type is valid and supported
			if (validTypes.indexOf(field.type) < 0) {
				throw new TypeError(
					util.format(
						'field %s type is invalid: %s',
						fieldPath,
						field.type));
			}

			// keep track of the fully qualified field name and build a validator
			self._fields[fieldPath] = field;
			self._fieldValidators[fieldPath] = validators[field.type](field);

			return;
		});
	}

	function validateModel (self, model, parentPath) {
		var result = {
			clone : JSON.stringify(JSON.parse(model)),
			errors : []
		};

		// validate model
		if (!model || typeof model !== 'object' || !Object.keys(model).length) {
			result.errors.push('model is not an object or is empty');

			return result;
		}

		Object.keys(model).forEach(function (field) {
			var
				dynamic,
				fieldPath = parentPath ? [parentPath, field].join('.') : field;

			// check for sub-documents
			if (model[field] && typeof self._dynamic[field] !== 'undefined') {
				var fieldResult = validateModel(self, model[field], fieldPath);
				result.errors = result.errors.concat(fieldResult.errors);
				result.clone[field] = fieldResult.clone;

				return;
			}

			// determine if the field is defined in the mapping
			if (typeof self._fields[fieldPath] === 'undefined') {
				dynamic = self._dynamic[parentPath || '.'];

				// track as error if the dynamic mapping is strict
				if (dynamic === 'strict') {
					result.errors.push(util.format(
						'%s is not a valid field in the strict type mapping',
						fieldPath));

					return;
				}

				// remove the field if the dynamic mapping is false
				if (!dynamic) {
					result.clone[field] = undefined;

					return;
				}

				// keep the value if the dynamic mapping is true (default)
				return;
			}

			// validate the field value
			if (!self._fieldValidators(model[field])) {
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

		return result;
	}

	function Mapper (indexName, typeName, mapping) {
		// initialize Mapper properties
		this._dynamic = {};
		this._fields = {};
		this._fieldValidators = {};
		this._index = indexName;
		this._type = typeName;

		// analyze the input
		return analyze(this, mapping);
	}

	Mapper.prototype.delete = function (_id, callback) {

	};

	Mapper.prototype.get = function (_id, callback) {

	};

	Mapper.prototype.index = function (_id, model, callback) {
		if (typeof callback === 'undefined' && typeof model === 'function') {
			callback = model;
			model = _id;
			_id = undefined;
		}


	};

	Mapper.prototype.update = function (_id, model, callback) {

	};

	Mapper.prototype.upsert = function (_id, model, callback) {

	};

	return Mapper;
}());
