var util = require('util');


module.exports = (function (self) {
	'use strict';

	self.InvalidModelError = function (message) {
		this.name = 'InvalidModelError';
		this.message = message;
	};

	util.inherits(self.InvalidModelError, Error);

	return self;
}({}));
