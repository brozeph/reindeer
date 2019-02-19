/* eslint no-magic-numbers : 0 */
/* eslint no-unused-expressions : 0 */
import chai from 'chai';
import validators from '../../src/validators.js';

const should = chai.should();

describe('validators', () => {
	describe('#attachment', () => {
		var isValid = validators.attachment();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			should.exist(result);
			result.should.be.true;

			validators.attachment({ required : true })(null).should.be.false;

			// additional checks for empty strings and objects
			validators.attachment({ required : true })('').should.be.false;
			validators.attachment({ required : true })({}).should.be.false;
		});

		it('should be false when value is not a string', () => {
			var result = isValid(true);
			result.should.be.false;
		});

		it('should be false when value is not base64', () => {
			var result = isValid('not_-_a_-_base_-_64_-_value');
			result.should.be.false;
		});

		it('should be false when base64 value is wrong length', () => {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ');
			result.should.be.false;
		});

		it('should be true value is base64', () => {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ==');
			result.should.be.true;
		});
	});

	describe('#binary', () => {
		var isValid = validators.binary();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.binary({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', () => {
			var result = isValid(true);
			result.should.be.false;
		});

		it('should be false when value is not base64', () => {
			var result = isValid('not_-_a_-_base_-_64_-_value');
			result.should.be.false;
		});

		it('should be false when base64 value is wrong length', () => {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ');
			result.should.be.false;
		});

		it('should be true value is base64', () => {
			var result = isValid('dGVzdGluZyBlbGFzdGljLXNjaGVtYQ==');
			result.should.be.true;
		});
	});

	describe('#boolean', () => {
		var isValid = validators.boolean();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.boolean({ required : true })(null).should.be.false;
		});

		it('should be false when value is not valid boolean string', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a number', () => {
			var result = isValid(1);
			result.should.be.true;
		});

		it('should be true when value is a valid boolean string', () => {
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

	describe('#byte', () => {
		var isValid = validators.byte();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.byte({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of byte range', () => {
			var result = isValid(128);
			result.should.be.false;
		});

		it('should be true when value is a valid byte number', () => {
			var result = isValid(127);
			result.should.be.true;

			result = isValid(-128);
			result.should.be.true;
		});

		it('should be true when value is a valid byte number formatted as a string', () => {
			var result = isValid('127');
			result.should.be.true;
		});
	});

	describe('#date', () => {
		var isValid = validators.date();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.date({ required : true })(null).should.be.false;
		});

		it('should be true when value is valid string format', () => {
			var result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15');
			result.should.be.true;

			result = isValid('2015-07-15T08:45.33-07:00');
			result.should.be.true;

			result = isValid(new Date().toString());
			result.should.be.true;
		});

		it('should be true when value is valid date', () => {
			var result = isValid(new Date());
			result.should.be.true;
		});

		it('should be true when value is a number', () => {
			var result = isValid(Number(new Date()));
			result.should.be.true;
		});
	});

	describe('#double', () => {
		var isValid = validators.double();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.double({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a valid double number', () => {
			var result = isValid(1.7976931348623157E308);
			result.should.be.true;

			result = isValid(4.9E-324);
			result.should.be.true;

			result = isValid(99.99);
			result.should.be.true;
		});

		it('should be true when value is a valid double number formatted as a string', () => {
			var result = isValid('99.99');
			result.should.be.true;
		});
	});

	describe('#float', () => {
		var isValid = validators.float();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.float({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a valid double number', () => {
			var result = isValid(1.4E-45);
			result.should.be.true;

			result = isValid(3.4028235E38);
			result.should.be.true;

			result = isValid(99.99);
			result.should.be.true;
		});

		it('should be true when value is a valid double number formatted as a string', () => {
			var result = isValid('99.99');
			result.should.be.true;
		});
	});

	describe('#geo_point', () => {
		// jshint camelcase : false
		var isValid = validators.geo_point();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.geo_point({ required : true })(null).should.be.false;
		});

		it('should be false when value is invalid array', () => {
			var result = isValid([-14.00, 143.12, 44.2]);
			result.should.be.false;
		});

		it('should be true when value is valid array', () => {
			var result = isValid([-14.00, 143.12]);
			result.should.be.true;

			result = isValid(['-14.00', '143.12']);
			result.should.be.true;
		});

		it('should be false when value is invalid object', () => {
			var result = isValid({ lat : 0, long : 0 });
			result.should.be.false;
		});

		it('should be true when value is valid object', () => {
			var result = isValid({ lat : 0, lon : 0 });
			result.should.be.true;
		});

		it('should be false when value is invalid coordinate string', () => {
			var result = isValid('-144.0');
			result.should.be.false;

			result = isValid('-144.0,78,-122.22');
			result.should.be.false;
		});

		it('should be true when value is valid coordinate string', () => {
			var result = isValid('-144.0,78');
			result.should.be.true;
		});
	});

	describe('#geo_shape', () => {
		// jshint camelcase : false
		var isValid = validators.geo_shape();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.geo_shape({ required : true })(null).should.be.false;
		});

		it('should be false when type field is missing', () => {
			var result = isValid({ coordinates : [1, 2] });
			result.should.be.false;
		});

		it('should be false when coordinates field is missing', () => {
			var result = isValid({ type : 'circle' });
			result.should.be.false;
		});

		it('should be false when type field is invalid', () => {
			var result = isValid({ coordinates : [1, 2], type : 'rectangle' });
			result.should.be.false;
		});

		it('should be false when type field is invalid', () => {
			var result = isValid({ coordinates : [1, 2], type : 'rectangle' });
			result.should.be.false;
		});

		it('should be true when type is not geometrycollection and coordinates are valid', () => {
			var result = isValid({ coordinates : [1, 2], type : 'point' });
			result.should.be.true;
		});

		it('should be false when type is geometrycollection and geometries are missing', () => {
			var result = isValid({
				coordinates : [
					{ coordinates : [1, 2], type : 'point' },
					{ coordinates : [2, 1], type : 'point' }
				],
				type : 'geometrycollection'
			});

			result.should.be.false;
		});

		it('should be false when type is geometrycollection and an invalid geometry is provided', () => {
			var result = isValid({
				geometries : [
					{ coordinates : [1, 2], type : 'rectangle' },
					{ coordinates : [2, 1], type : 'point' }
				],
				type : 'geometrycollection'
			});

			result.should.be.false;
		});

		it('should be true when type is geometrycollection and geometries are provided', () => {
			var result = isValid({
				geometries : [
					{ coordinates : [1, 2], type : 'point' },
					{ coordinates : [2, 1], type : 'point' }
				],
				type : 'geometrycollection'
			});

			result.should.be.true;
		});
	});

	describe('#integer', () => {
		var isValid = validators.integer();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.integer({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of integer range', () => {
			var result = isValid(2147483648);
			result.should.be.false;

			result = isValid(-2147483649);
			result.should.be.false;
		});

		it('should be true when value is a valid integer number', () => {
			var result = isValid(2147483647);
			result.should.be.true;

			result = isValid(-2147483648);
			result.should.be.true;
		});

		it('should be true when value is a valid integer number formatted as a string', () => {
			var result = isValid('2147483647');
			result.should.be.true;
		});
	});

	describe('#ip', () => {
		var isValid = validators.ip();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.ip({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a string', () => {
			var result = isValid(123456);
			result.should.be.false;
		});

		it('should be false when value is not a valid IP', () => {
			var result = isValid('256.256.256.256');
			result.should.be.false;
		});

		it('should be true when value is a valid IP', () => {
			var result = isValid('10.0.0.1');
			result.should.be.true;
		});
	});

	describe('#isPOJO', () => {
		it('should properly return false when value is null', () => {
			validators.isPOJO(null).should.be.false;
		});

		it('should properly return false when value is undefined', () => {
			validators.isPOJO().should.be.false;
		});

		it('should properly return false when value is an Array', () => {
			validators.isPOJO([]).should.be.false;
			validators.isPOJO([1, 2, 3]).should.be.false;
		});

		it('should properly return false when value is a function', () => {
			validators.isPOJO(() => {}).should.be.false;
		});

		it('should properly return false when value is a string', () => {
			validators.isPOJO('test').should.be.false;
		});

		it('should properly return false when value is a number', () => {
			validators.isPOJO(1).should.be.false;
		});

		it('should properly return false when value is a date', () => {
			validators.isPOJO(new Date()).should.be.false;
		});

		it('should properly return true when value is an actual POJO', () => {
			validators.isPOJO({ test : true }).should.be.true;
		});
	});

	describe('#long', () => {
		var isValid = validators.long();

		it('should properly detect field required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.long({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a valid number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is a proper number', () => {
			var result = isValid(7399696);
			result.should.be.true;
		});

		it('should be true when value is a proper number formatted as a string', () => {
			var result = isValid('7399696');
			result.should.be.true;
		});
	});

	describe('#object', () => {
		var isValid = validators.object();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.ip({ required : true })(null).should.be.false;
		});

		it('should be false when value is not an object', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be true when value is valid object', () => {
			var result = isValid({ test : true });
			result.should.be.true;
		});
	});

	describe('#short', () => {
		var isValid = validators.short();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.short({ required : true })(null).should.be.false;
		});

		it('should be false when value is not a number', () => {
			var result = isValid('dafuq');
			result.should.be.false;
		});

		it('should be false when value outside of short range', () => {
			var result = isValid(32768);
			result.should.be.false;

			result = isValid(-32769);
			result.should.be.false;
		});

		it('should be true when value is a valid short number', () => {
			var result = isValid(32767);
			result.should.be.true;

			result = isValid(-32768);
			result.should.be.true;
		});

		it('should be true when value is a valid short number formatted as a string', () => {
			var result = isValid('32767');
			result.should.be.true;
		});
	});

	describe('#string', () => {
		var isValid = validators.string();

		it('should properly detect field.required setting', () => {
			var result = isValid(null);
			result.should.be.true;

			validators.string({ required : true })(null).should.be.false;
		});

		it('should be true when value is a valid string', () => {
			var result = isValid('dafuq');
			result.should.be.true;
		});

		it('should be true when value can be safely cast to a string', () => {
			var result = isValid(1234);
			result.should.be.true;
		});

		it('should be false when value is not safe to cast as a string', () => {
			var result = isValid({ test : true });
			result.should.be.false;

			result = isValid(['test', 'test']);
			result.should.be.false;
		});
	});
});
