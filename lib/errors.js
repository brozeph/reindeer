var util = require('util');


module.exports = (function (self) {
	'use strict';

	self.InvalidMappingError = function (message) {
		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidMappingError';
	};

	self.InvalidModelError = function (source, message) {
		if (typeof message === 'undefined') {
			message = source;
			source = undefined;
		}

		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidModelError';
		this.source = source;
	};

	self.InvalidParameterError = function (parameterName, message) {
		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidParameterError';
		this.parameterName = parameterName;
	};

	util.inherits(self.InvalidMappingError, Error);
	util.inherits(self.InvalidModelError, TypeError);
	util.inherits(self.InvalidParameterError, Error);

	return self;
}({}));
