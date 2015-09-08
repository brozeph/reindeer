var util = require('util');


module.exports = (function (self) {
	'use strict';

	self.InvalidMappingError = function (message) {
		this.name = 'InvalidMappingError';
		this.message = message;
	};

	self.InvalidModelError = function (source, message) {
		if (typeof message === 'undefined') {
			message = source;
			source = undefined;
		}

		this.name = 'InvalidModelError';
		this.message = message;
		this.source = source;
	};

	util.inherits(self.InvalidMappingError, Error);
	util.inherits(self.InvalidModelError, TypeError);

	return self;
}({}));
