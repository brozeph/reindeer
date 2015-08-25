var
	chai = require('chai'),
	should = chai.should(),

	validators = require('../../lib/validators.js');

// jshint expr : true
// jshint unused : false
describe('validators', function () {
	'use strict';

	describe('attachment', function () {
		var isValid = validators.attachment();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.attachment({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', function () {
			var result = isValid(true);
			result.should.be.false;
		});

		it('should be false when value is not base64', function () {
			var result = isValid('not_-_a_-_base_-_64_-_value');
			result.should.be.false;
		});

		it('should be false when base64 value is wrong length', function () {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ');
			result.should.be.false;
		});

		it('should be true value is base64', function () {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ==');
			result.should.be.true;
		});
	});

	describe('binary', function () {
		var isValid = validators.binary();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.binary({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', function () {
			var result = isValid(true);
			result.should.be.false;
		});

		it('should be false when value is not base64', function () {
			var result = isValid('not_-_a_-_base_-_64_-_value');
			result.should.be.false;
		});

		it('should be false when base64 value is wrong length', function () {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ');
			result.should.be.false;
		});

		it('should be true value is base64', function () {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ==');
			result.should.be.true;
		});
	});

	describe('boolean', function () {
		var isValid = validators.boolean();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.boolean({ required : true })(null).should.be.false;
		});

		it('should be false when value is not valid boolean string', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a number', function () {
			var result = isValid(1);
			result.should.be.true;
		});

		it('should be true when value is a valid boolean string', function () {
			var result = isValid('true');
			result.should.be.true;

			result = isValid('on');
			result.should.be.true;

			result = isValid('yes');
			result.should.be.true;

			result = isValid('1');
			result.should.be.true;

			result = isValid('false');
			result.should.be.true;

			result = isValid('off');
			result.should.be.true;

			result = isValid('no');
			result.should.be.true;

			result = isValid('0');
			result.should.be.true;
		});
	});

	describe('byte', function () {
		var isValid = validators.byte();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.byte({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of byte range', function () {
			var result = isValid(128);
			result.should.be.false;
		});

		it('should be true when value is a valid byte number', function () {
			var result = isValid(127);
			result.should.be.true;

			result = isValid(-128);
			result.should.be.true;
		});
	});

	describe('date', function () {
		var isValid = validators.date();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.date({ required : true })(null).should.be.false;
		});

		it('should be false when value is invalid string format', function () {
			var result = isValid('2015/07/15');
			result.should.be.false;
		});

		it('should be true when value is valid string format', function () {
			var result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15T08:45.33-07:00');
			result.should.be.true;
		});

		it('should be true when value is valid date', function () {
			var result = isValid(new Date());
			result.should.be.true;
		});

		it('should be true when value is a number', function () {
			var result = isValid(Number(new Date()));
			result.should.be.true;
		});
	});

	describe('double', function () {
		var isValid = validators.double();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.double({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a valid double number', function () {
			var result = isValid(1.7976931348623157E308);
			result.should.be.true;

			result = isValid(4.9E-324);
			result.should.be.true;
		});
	});

	describe('float', function () {
		var isValid = validators.float();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.float({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a valid double number', function () {
			var result = isValid(1.4E-45);
			result.should.be.true;

			result = isValid(3.4028235E38);
			result.should.be.true;
		});
	});

	describe('geo_point', function () {
		// jshint camelcase : false
		var isValid = validators.geo_point();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.geo_point({ required : true })(null).should.be.false;
		});

		it('should be false when value is invalid array', function () {
			var result = isValid([-14.00,143.12,44.2]);
			result.should.be.false;
		});

		it('should be true when value is valid array', function () {
			var result = isValid([-14.00,143.12]);
			result.should.be.true;

			result = isValid(['-14.00','143.12']);
			result.should.be.true;
		});

		it('should be false when value is invalid object', function () {
			var result = isValid({ lat : 0, long : 0 });
			result.should.be.false;
		});

		it('should be true when value is valid object', function () {
			var result = isValid({ lat : 0, lon : 0 });
			result.should.be.true;
		});

		it('should be false when value is invalid coordinate string', function () {
			var result = isValid('-144.0');
			result.should.be.false;

			result = isValid('-144.0,78,-122.22');
			result.should.be.false;
		});

		it('should be true when value is valid coordinate string', function () {
			var result = isValid('-144.0,78');
			result.should.be.true;
		});
	});
});
