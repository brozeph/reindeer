var
	util = require('util'),

	validators = require('./validators');


module.exports = (function () {
	'use strict';

	var validTypes = Object.keys(validators);

	function analyze (mapping) {
		var isValid =
			typeof mapping !== 'object' ||
			!mapping.properties ||
			typeof mapping.properties !== 'object';

		if (!isValid) {
			throw new TypeError('mapping is not an object or is missing properties');
		}

		analyzeProperties(mapping.properties);

		return;
	}

	function analyzeProperties(documentProperties, parentPath) {
		var fields = Object.keys(documentProperties);

		// iterate each field in the mapping
		fields.forEach(function (field) {
			var
				fieldPath = parentPath ?
					[parentPath, field].join('.') :
					field,
				isSubDocument =
					field.properties &&
					typeof field.properties === 'object';

			// check if field represents a sub document
			if (isSubDocument) {
				analyzeProperties(field.properties, fieldPath);

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
			this._fieldPaths.push(fieldPath);
			this._fieldValidators[fieldPath] = function () {

			};

			return;
		});
	}

	function Schema (mapping) {
		// initialize schema properties
		this._fieldPaths = [];
		this._fieldValidators = {};

		// analyze the input
		analyze(mapping);

		return;
	}

	Schema.prototype.analyze = function () {

	};

	return Schema;
}());
