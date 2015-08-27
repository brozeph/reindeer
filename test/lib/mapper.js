var
	chai = require('chai'),
	should = chai.should(),

	Mapper = require('../../lib/mapper.js'),
	testMapping = require('../test-mapping.json');


describe('mapper', function () {
	'use strict';

	var
		mapper,
		mockModel;

	beforeEach(function () {
		mapper = new Mapper('testType', testMapping);

		mockModel = {
			strictDynamicSubDocument : {
				someDate : new Date(),
				someString : 'test string',
				someRequiredInteger : 1
			},
			falseDynamicSubDocument : {
				anotherString : 'another test string'
			},
			subDocument : {
				anotherInteger : 2
			},
			rootFloat : 99.99,
			rootGeoPoint : [-122, 35]
		};
	});

	describe('constructor', function () {
		it('should require type name on constructor', function () {
			var err;

			try {
				mapper = new Mapper('', testMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('type name must be provided');
		});

		it('should require mapping on constructor', function () {
			var err;

			try {
				mapper = new Mapper('testType');
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('mapping is not an object or is missing properties');
		});

		it('should require each field in mapping to contain a type', function () {
			var
				err,
				invalidMapping = JSON.parse(JSON.stringify(testMapping));

			invalidMapping.properties.rootFloat.type = undefined;

			try {
				mapper = new Mapper('testType', invalidMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('field rootFloat missing type');
		});

		it('should properly recognize invalid types', function () {
			var
				err,
				invalidMapping = JSON.parse(JSON.stringify(testMapping));

			invalidMapping.properties.rootFloat.type = 'invalid';

			try {
				mapper = new Mapper('testType', invalidMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('field rootFloat type is invalid: invalid');
		});
	});

	describe('#validate', function () {
		it('should properly require fields', function (done) {
			mapper.validate({}, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.errors);
				err.errors.should.have.length(1);
				err.errors[0].should.equal('model is not an object or is empty');

				return done();
			});
		});

		it('should error when non-specified fields exist in strict mapping', function (done) {
			mockModel.strictDynamicSubDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.errors);
				err.errors.should.have.length(1);
				err.errors[0].should.equal(
					'strictDynamicSubDocument.badField is not a valid field in the strict type mapping');

				return done();
			});
		});

		it('should error when non-specified fields exist in strict dynamic mapping', function (done) {
			mockModel.strictDynamicSubDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.errors);
				err.errors.should.have.length(1);
				err.errors[0].should.equal(
					'strictDynamicSubDocument.badField is not a valid field in the strict type mapping');

				return done();
			});
		});

		it('should omit non-specified fields in false dynamic mapping', function (done) {
			mockModel.falseDynamicSubDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.falseDynamicSubDocument);
				should.not.exist(result.falseDynamicSubDocument.badField);

				return done();
			});
		});

		it('should not omit non-specified fields in true dynamic mapping', function (done) {
			mockModel.subDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.subDocument);
				should.exist(result.subDocument.badField);

				return done();
			});
		});

		it('should return an error when field validation fails', function (done) {
			mockModel.strictDynamicSubDocument.someDate = 'not a date';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.errors);
				err.errors.should.have.length(1);
				err.errors[0].should.equal(
					'strictDynamicSubDocument.someDate contains an invalid value (not a date) for type date');

				return done();
			});
		});
	});
});
