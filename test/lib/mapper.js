var
	chai = require('chai'),
	nock = require('nock'),
	should = chai.should(),

	Mapper = require('../../lib/mapper.js'),
	testMapping = require('../test-mapping.json');


describe('mapper', function () {
	'use strict';

	var
		elasticsearch = nock('http://localhost:9200')
			.delete('/test-index/test-type/test-id')
			.reply(202, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {};
			})
			.delete('/test-index/test-type/bad-id')
			.reply(404, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					message : 'not found',
					statusCode : 404
				};
			})
			.delete('/test-index/test-type/test-id?timeout=1m')
			.reply(202, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {};
			})
			.get('/test-index/test-type/bad-id/_source')
			.reply(404, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					message : 'not found',
					statusCode : 404
				};
			})
			.get('/test-index/test-type/really-bad-id/_source')
			.reply(503, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					message : 'server unavailable',
					statusCode : 503
				};
			})
			.get('/test-index/test-type/test-id/_source')
			.times(3)
			.reply(200, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return JSON.stringify(mockModel);
			})
			.get('/test-index/test-type/test-id/_source?fields=identity')
			.reply(200, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return JSON.stringify({ identity : mockModel.identity });
			})
			.head('/test-index')
			.reply(404, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return { statusCode : 404 };
			})
			.head('/test-index')
			.reply(200, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return { statusCode : 200 };
			})
			.post('/test-index')
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;
				isNewIndex = true;

				return { acknowledged : true };
			})
			.post('/test-index/test-type?op_type=create')
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					_index : 'test-index',
					_type : 'test-type',
					_id : 'random',
					_version : 1,
					created : true
				};
			})
			.post('/test-index/test-type/bad-id/_update')
			.times(2) // replicated for upsert and update
			.reply(503, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					message : 'server unavailable',
					statusCode : 503
				};
			})
			.post('/test-index/test-type/test-id/_update')
			.times(2) // replicated for upsert and update
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					_index : 'test-index',
					_type : 'test-type',
					_id : 'test-id',
					_version : 1,
					updated : true
				};
			})
			.post('/test-index/test-type/test-id/_update?retry_on_conflict=3')
			.times(2) // replicated for upsert and update
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					_index : 'test-index',
					_type : 'test-type',
					_id : 'test-id',
					_version : 1,
					updated : true
				};
			})
			.put('/test-index/_mapping/test-type')
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;
				isUpdatedMapping = true;

				return { acknowledged : true };
			})
			.put('/test-index/test-type/bad-id?op_type=create')
			.reply(503, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					message : 'server unavailable',
					statusCode : 503
				};
			})
			.put('/test-index/test-type/test-id?op_type=create')
			.times(2) // two tests use this
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					_index : 'test-index',
					_type : 'test-type',
					_id : 'test-id',
					_version : 1,
					created : true
				};
			})
			.put('/test-index/test-type/test-id?ttl=1d&op_type=create')
			.reply(201, function (uri, body) {
				requestBody = body;
				requestUri = uri;

				return {
					_index : 'test-index',
					_type : 'test-type',
					_id : 'test-id',
					_version : 1,
					created : true
				};
			}),
		isNewIndex = false,
		isUpdatedMapping = false,
		mapper,
		mockModel,
		requestBody,
		requestUri;

	beforeEach(function () {
		mapper = new Mapper({
			_index : 'test-index',
			_type : 'test-type'
		}, testMapping);

		// monkey patch initialize
		mapper._isInitialized = true;

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
				anotherInteger : 2,
				someBoolean : true
			},
			rootFloat : 99.99,
			rootGeoPoint : [-122, 35],
			identity : {
				docId : 'test-id'
			}
		};

		isNewIndex = false;
		isUpdatedMapping = false;
		requestBody = null;
		requestUri = null;
	});

	describe('constructor', function () {
		it('should require type name on constructor', function () {
			var err;

			try {
				mapper = new Mapper({
					_type : 'test-type'
				}, testMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('_index must be provided');
		});

		it('should require type name on constructor', function () {
			var err;

			try {
				mapper = new Mapper({
					_index : 'test-index'
				}, testMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('_type must be provided');
		});

		it('should require mapping on constructor', function () {
			var err;

			try {
				mapper = new Mapper({
					_index : 'test-index',
					_type : 'test-type'
				});
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
				mapper = new Mapper({
					_index : 'test-index',
					_type : 'test-type'
				}, invalidMapping);
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
				mapper = new Mapper({
					_index : 'test-index',
					_type : 'test-type'
				}, invalidMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('field rootFloat type is invalid: invalid');
		});
	});

	describe('initialization', function () {
		it('should create index in the event it does not exist', function (done) {
			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				isNewIndex.should.be.true;

				return done();
			});
		});

		it('should put the mapping in the event the index exists', function (done) {
			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				isUpdatedMapping.should.be.true;

				return done();
			});
		});
	});

	describe('#create', function () {
		it('should return error when doc is null', function (done) {
			mapper.create(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.name);
				err.name.should.equal('InvalidModelError');

				return done();
			});
		});

		it('should properly bubble errors', function (done) {
			mapper.create('bad-id', mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.statusCode);
				err.statusCode.should.equal(503);
				requestUri.should.equal('/test-index/test-type/bad-id?op_type=create');

				return done();
			});
		});

		it('should properly PUT when _id is supplied', function (done) {
			mapper.create('test-id', mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;
				requestUri.should.equal('/test-index/test-type/test-id?op_type=create');

				return done();
			});
		});

		it('should properly POST when _id is not supplied', function (done) {
			delete mockModel.identity;

			mapper.create(mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;
				requestUri.should.equal('/test-index/test-type?op_type=create');

				return done();
			});
		});

		it('should properly PUT when _id.path is supplied', function (done) {
			mapper.create(mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);

				requestUri.should.equal('/test-index/test-type/test-id?op_type=create');

				return done();
			});
		});

		it('should properly support _id overloaded as options', function (done) {
			mapper.create({
					_id : 'test-id',
					ttl : '1d'
				},
				mockModel,
				function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					should.exist(result.strictDynamicSubDocument.someDate);
					(result.strictDynamicSubDocument.someDate instanceof Date)
						.should.be.true;
					requestUri.should.equal('/test-index/test-type/test-id?ttl=1d&op_type=create');

					return done();
				});
		});
	});

	describe('#delete', function () {
		it('should return error when _id is null', function (done) {
			mapper.delete(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				should.exist(err.name);
				err.name.should.equal('InvalidParameterError');
				should.exist(err.parameterName);
				err.parameterName.should.equal('_id');

				return done();
			});
		});

		it('should return error when _id is undefined', function (done) {
			mapper.delete(undefined, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				should.exist(err.name);
				err.name.should.equal('InvalidParameterError');
				should.exist(err.parameterName);
				err.parameterName.should.equal('_id');

				return done();
			});
		});

		it('should properly bubble errors', function (done) {
			mapper.delete('bad-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);
				requestUri.should.equal('/test-index/test-type/bad-id');

				return done();
			});
		});

		it('should properly delete', function (done) {
			mapper.delete('test-id', function (err, result) {
				should.not.exist(err);
				should.not.exist(result);
				requestUri.should.equal('/test-index/test-type/test-id');

				return done();
			});
		});

		it('should support overload of _id as options', function (done) {
			var options = {
				_id : 'test-id',
				timeout : '1m'
			};

			mapper.delete(options, function (err, result) {
				should.not.exist(err);
				should.not.exist(result);
				requestUri.should.equal('/test-index/test-type/test-id?timeout=1m');

				return done();
			});
		});
	});

	describe('#get', function () {
		it('should return error when _id is null', function (done) {
			mapper.get(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				should.exist(err.name);
				err.name.should.equal('InvalidParameterError');
				should.exist(err.parameterName);
				err.parameterName.should.equal('_id');

				return done();
			});
		});

		it('should return error when _id is undefined', function (done) {
			mapper.get(undefined, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				should.exist(err.name);
				err.name.should.equal('InvalidParameterError');
				should.exist(err.parameterName);
				err.parameterName.should.equal('_id');

				return done();
			});
		});

		it('should properly not return an error when get finds no document', function (done) {
			mapper.get('bad-id', function (err, result) {
				should.not.exist(err);
				should.not.exist(result);
				requestUri.should.equal('/test-index/test-type/bad-id/_source');

				return done();
			});
		});

		it('should properly return non 404 errors', function (done) {
			mapper.get('really-bad-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.statusCode);
				err.statusCode.should.equal(503);
				requestUri.should.equal('/test-index/test-type/really-bad-id/_source');

				return done();
			});
		});

		it('should properly return document with correctly typed values', function (done) {
			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;
				requestUri.should.equal('/test-index/test-type/test-id/_source');

				return done();
			});
		});

		it('should support overload of _id as options', function (done) {
			var options = {
				_id : 'test-id',
				fields : 'identity'
			};

			mapper.get(options, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				requestUri.should.equal('/test-index/test-type/test-id/_source?fields=identity');

				return done();
			});
		});
	});

	describe('#parse', function () {
		it('should properly fail with invalid JSON', function (done) {
			mapper.parse('{ invalid json }', function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal('unable to parse JSON');

				return done();
			});
		});

		it('should properly fail when supplied model is null', function (done) {
			mapper.parse(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal('supplied model is not an object');

				return done();
			});
		});

		it('should properly fail when supplied model is an empty object', function (done) {
			mapper.parse({}, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal('supplied model is not an object');

				return done();
			});
		});


		it('should properly coerce mapping type values', function (done) {
			mockModel.falseDynamicSubDocument.anotherString = 1;

			var json = JSON.stringify(mockModel);

			mapper.parse(json, function (err, result) {
				should.not.exist(err);
				should.exist(result);

				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;

				should.exist(result.strictDynamicSubDocument.someString);
				(typeof result.strictDynamicSubDocument.someString === 'string')
					.should.be.true;

				should.exist(result.strictDynamicSubDocument.someRequiredInteger);
				(typeof result.strictDynamicSubDocument.someRequiredInteger === 'number')
					.should.be.true;

				should.exist(result.falseDynamicSubDocument.anotherString);
				(typeof result.falseDynamicSubDocument.anotherString === 'string')
					.should.be.true;
				result.falseDynamicSubDocument.anotherString.should.equal('1');

				should.exist(result.rootFloat);
				(typeof result.rootFloat === 'number')
					.should.be.true;

				should.exist(result.rootGeoPoint);
				(Array.isArray(result.rootGeoPoint))
					.should.be.true;

				return done();
			});
		});

		it('should properly coerce array of mapping type values', function (done) {
			var json = JSON.stringify([
				mockModel,
				mockModel]);

			mapper.parse(json, function (err, result) {
				should.not.exist(err);
				should.exist(result);

				should.exist(result[0].strictDynamicSubDocument.someDate);
				(result[0].strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;

				should.exist(result[0].strictDynamicSubDocument.someString);
				(typeof result[0].strictDynamicSubDocument.someString === 'string')
					.should.be.true;

				should.exist(result[0].strictDynamicSubDocument.someRequiredInteger);
				(typeof result[0].strictDynamicSubDocument.someRequiredInteger === 'number')
					.should.be.true;

				should.exist(result[0].rootFloat);
				(typeof result[0].rootFloat === 'number')
					.should.be.true;

				should.exist(result[0].rootGeoPoint);
				(Array.isArray(result[0].rootGeoPoint))
					.should.be.true;

				return done();
			});
		});
	});

	describe('#update', function () {
		it('should return error when doc is null', function (done) {
			mapper.update(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.name);
				err.name.should.equal('InvalidModelError');

				return done();
			});
		});

		it('should properly bubble errors', function (done) {
			mapper.update('bad-id', mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.statusCode);
				err.statusCode.should.equal(503);
				requestUri.should.equal('/test-index/test-type/bad-id/_update');
				should.exist(requestBody)
				requestBody.should.not.contain('doc_as_upsert');

				return done();
			});
		});

		it('should properly update and coerce types supplied', function (done) {
			mapper.update('test-id', mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;
				requestUri.should.equal('/test-index/test-type/test-id/_update');
				should.exist(requestBody)
				requestBody.should.not.contain('doc_as_upsert');

				return done();
			});
		});

		it('should properly support _id overloaded as options', function (done) {
			var options = {
				_id : 'test-id',
				'retry_on_conflict' : 3
			};

			mapper.update(options, mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				requestUri.should.equal('/test-index/test-type/test-id/_update?retry_on_conflict=3');
				should.exist(requestBody)
				requestBody.should.not.contain('doc_as_upsert');

				return done();
			});
		});
	});

	describe('#upsert', function () {
		it('should return error when doc is null', function (done) {
			mapper.upsert(null, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.name);
				err.name.should.equal('InvalidModelError');

				return done();
			});
		});

		it('should properly bubble errors', function (done) {
			mapper.upsert('bad-id', mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.statusCode);
				err.statusCode.should.equal(503);
				requestUri.should.equal('/test-index/test-type/bad-id/_update');
				should.exist(requestBody)
				requestBody.should.contain('doc_as_upsert');

				return done();
			});
		});

		it('should properly upsert and coerce types supplied', function (done) {
			mapper.upsert('test-id', mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				should.exist(result.strictDynamicSubDocument.someDate);
				(result.strictDynamicSubDocument.someDate instanceof Date)
					.should.be.true;
				requestUri.should.equal('/test-index/test-type/test-id/_update');
				should.exist(requestBody)
				requestBody.should.contain('doc_as_upsert');

				return done();
			});
		});

		it('should properly support _id overloaded as options', function (done) {
			var options = {
				_id : 'test-id',
				'retry_on_conflict' : 3
			};

			mapper.upsert(options, mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				requestUri.should.equal('/test-index/test-type/test-id/_update?retry_on_conflict=3');
				should.exist(requestBody)
				requestBody.should.contain('doc_as_upsert');

				return done();
			});
		});
	});

	describe('#validate', function () {
		it('should properly require fields', function (done) {
			mapper.validate({}, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal('model is not an object or is empty');

				return done();
			});
		});

		it('should error when non-specified fields exist in strict mapping', function (done) {
			mockModel.strictDynamicSubDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal(
					'strictDynamicSubDocument.badField is not a valid field in the strict type mapping');

				return done();
			});
		});

		it('should error when non-specified fields exist in strict dynamic mapping', function (done) {
			mockModel.strictDynamicSubDocument.badField = 'bad';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal(
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

				err.message.should.equal(
					'strictDynamicSubDocument.someDate contains an invalid value (not a date) for type date');

				return done();
			});
		});

		it('should require fields marked as required in the mapping', function (done) {
			delete mockModel.strictDynamicSubDocument.someRequiredInteger;

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal(
					'field strictDynamicSubDocument.someRequiredInteger is required');

				return done();
			});
		});

		it('should properly detect _id.path and extract from the model', function (done) {
			mockModel.identity = {
				docId : 'test-id'
			};

			mapper.validate(mockModel, function (err, result, resultId) {
				should.not.exist(err);
				should.exist(result);
				should.exist(resultId);
				resultId.should.equal('test-id');

				return done();
			});
		});
	});

	describe('#validate - sub-document arrays', function () {
		it('should handle arrays and sub-documents elegantly', function (done) {
			mockModel.strictDynamicSubDocument = [
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

			mapper.validate(mockModel, function (err, result) {
				should.not.exist(err);
				should.exist(result);
				should.exist(result.strictDynamicSubDocument);
				result.strictDynamicSubDocument.should.have.length(2);

				return done();
			});
		});

		it('should handle validation of sub-document arrays required fields correctly', function (done) {
			mockModel.strictDynamicSubDocument = [
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

			delete mockModel.strictDynamicSubDocument[1].someRequiredInteger;

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal(
					'field strictDynamicSubDocument[1].someRequiredInteger is required');

				return done();
			});
		});

		it('should handle validation of sub-document arrays invalid values correctly', function (done) {
			mockModel.strictDynamicSubDocument = [
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
				JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

			mockModel.strictDynamicSubDocument[1].someRequiredInteger = 'not an integer';

			mapper.validate(mockModel, function (err, result) {
				should.exist(err);
				should.not.exist(result);

				err.message.should.equal(
					'strictDynamicSubDocument[1].someRequiredInteger contains an invalid value (not an integer) for type integer');

				return done();
			});
		});
	});
});
