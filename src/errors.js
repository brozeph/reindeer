class InvalidMappingError extends Error {
	constructor (message) {
		super();

		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidMappingError';
	}
}

class InvalidModelError extends Error {
	constructor (source, message) {
		super();

		/* eslint no-undefined : 0 */
		if (typeof message === 'undefined') {
			message = source;
			source = undefined;
		}

		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidModelError';
		this.source = source;
	}
}

class InvalidParameterError extends Error {
	constructor (parameterName, message) {
		super();

		Error.captureStackTrace(this, this);
		this.message = message;
		this.name = 'InvalidParameterError';
		this.parameterName = parameterName;
	}
}

module.exports = {
	InvalidMappingError,
	InvalidModelError,
	InvalidParameterError
};
