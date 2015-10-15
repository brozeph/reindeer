var
	chai = require('chai'),
	should = chai.should(),

	validators = require('../../lib/validators.js');

// jshint expr : true
// jshint unused : false
describe('validators', function () {
	'use strict';

	describe('#attachment', function () {
		var isValid = validators.attachment();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.attachment({ required : true })(null).should.be.false;

			// additional checks for empty strings and objects
			validators.attachment({ required : true })('').should.be.false;
			validators.attachment({ required : true })({}).should.be.false;
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

	describe('#binary', function () {
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

	describe('#boolean', function () {
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

	describe('#byte', function () {
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

		it('should be true when value is a valid byte number formatted as a string', function () {
			var result = isValid('127');
			result.should.be.true;
		});
	});

	describe('#date', function () {
		var isValid = validators.date();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.date({ required : true })(null).should.be.false;
		});

		it('should be true when value is valid string format', function () {
			var result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15T08:45.33-07:00');
			result.should.be.true;

			result = isValid(new Date().toString());
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

	describe('#double', function () {
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

			result = isValid(99.99);
			result.should.be.true;
		});

		it('should be true when value is a valid double number formatted as a string', function () {
			var result = isValid('99.99');
			result.should.be.true;
		});
	});

	describe('#float', function () {
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

			result = isValid(99.99);
			result.should.be.true;
		});

		it('should be true when value is a valid double number formatted as a string', function () {
			var result = isValid('99.99');
			result.should.be.true;
		});
	});

	describe('#geo_point', function () {
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

	describe('#geo_shape', function () {
		// jshint camelcase : false
		var isValid = validators.geo_shape();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.geo_shape({ required : true })(null).should.be.false;
		});

		it('should be false when type field is missing', function () {
			var result = isValid({ coordinates : [1, 2] });
			result.should.be.false;
		});

		it('should be false when coordinates field is missing', function () {
			var result = isValid({ type : 'circle' });
			result.should.be.false;
		});

		it('should be false when type field is invalid', function () {
			var result = isValid({ type : 'rectangle', coordinates : [1, 2] });
			result.should.be.false;
		});

		it('should be false when type field is invalid', function () {
			var result = isValid({ type : 'rectangle', coordinates : [1, 2] });
			result.should.be.false;
		});

		it('should be true when type is not geometrycollection and coordinates are valid', function () {
			var result = isValid({ type : 'point', coordinates : [1, 2] });
			result.should.be.true;
		});

		it('should be false when type is geometrycollection and geometries are missing', function () {
			var result = isValid({
				type : 'geometrycollection',
				coordinates : [
					{ type : 'point', coordinates : [1, 2] },
					{ type : 'point', coordinates : [2, 1] }
				]
			});

			result.should.be.false;
		});

		it('should be false when type is geometrycollection and an invalid geometry is provided', function () {
			var result = isValid({
				type : 'geometrycollection',
				geometries : [
					{ type : 'rectangle', coordinates : [1, 2] },
					{ type : 'point', coordinates : [2, 1] }
				]
			});

			result.should.be.false;
		});

		it('should be true when type is geometrycollection and geometries are provided', function () {
			var result = isValid({
				type : 'geometrycollection',
				geometries : [
					{ type : 'point', coordinates : [1, 2] },
					{ type : 'point', coordinates : [2, 1] }
				]
			});

			result.should.be.true;
		});
	});

	describe('#integer', function () {
		var isValid = validators.integer();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.integer({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of integer range', function () {
			var result = isValid(2147483648);
			result.should.be.false;

			result = isValid(-2147483649);
			result.should.be.false;
		});

		it('should be true when value is a valid integer number', function () {
			var result = isValid(2147483647);
			result.should.be.true;

			result = isValid(-2147483648);
			result.should.be.true;
		});

		it('should be true when value is a valid integer number formatted as a string', function () {
			var result = isValid('2147483647');
			result.should.be.true;
		});
	});

	describe('#ip', function () {
		var isValid = validators.ip();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.ip({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', function () {
			var result = isValid(123456);
			result.should.be.false;
		});

		it('should be false when value is not a valid IP', function () {
			var result = isValid('256.256.256.256');
			result.should.be.false;
		});

		it('should be true when value is a valid IP', function () {
			var result = isValid('10.0.0.1');
			result.should.be.true;
		});
	});

	describe('#isPOJO', function () {
		it('should properly return false when value is null', function () {
			validators.isPOJO(null).should.be.false;
		});

		it('should properly return false when value is undefined', function () {
			validators.isPOJO().should.be.false;
		});

		it('should properly return false when value is an Array', function () {
			validators.isPOJO([]).should.be.false;
			validators.isPOJO([1, 2, 3]).should.be.false;
		});

		it('should properly return false when value is a function', function () {
			validators.isPOJO(function () {}).should.be.false;
		});

		it('should properly return false when value is a string', function () {
			validators.isPOJO('test').should.be.false;
		});

		it('should properly return false when value is a number', function () {
			validators.isPOJO(1).should.be.false;
		});

		it('should properly return false when value is a date', function () {
			validators.isPOJO(new Date()).should.be.false;
		});

		it('should properly return true when value is an actual POJO', function () {
			validators.isPOJO({ test : true }).should.be.true;
		});
	});

	describe('#long', function () {
		var isValid = validators.long();

		it('should properly detect field required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.long({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a valid number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a proper number', function () {
			var result = isValid(7399696);
			result.should.be.true;
		});

		it('should be true when value is a proper number formatted as a string', function () {
			var result = isValid('7399696');
			result.should.be.true;
		});
	});

	describe('#object', function () {
		var isValid = validators.object();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.ip({ required : true })(null).should.be.false;
		});

		it('should be false when value is not an object', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is valid object', function () {
			var result = isValid({ test : true });
			result.should.be.true;
		});
	});

	describe('#short', function () {
		var isValid = validators.short();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.short({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', function () {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of short range', function () {
			var result = isValid(32768);
			result.should.be.false;

			result = isValid(-32769);
			result.should.be.false;
		});

		it('should be true when value is a valid short number', function () {
			var result = isValid(32767);
			result.should.be.true;

			result = isValid(-32768);
			result.should.be.true;
		});

		it('should be true when value is a valid short number formatted as a string', function () {
			var result = isValid('32767');
			result.should.be.true;
		});
	});

	describe('#string', function () {
		var isValid = validators.string();

		it('should properly detect field.required setting', function () {
			var result = isValid(null);
			result.should.be.true;

			validators.string({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', function () {
			var result = isValid(1234);
			result.should.be.false;
		});

		it('should be true when value is a valid string', function () {
			var result = isValid('dafuq');
			result.should.be.true;
		});
	});
});
