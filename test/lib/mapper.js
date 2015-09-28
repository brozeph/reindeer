var
	chai = require('chai'),
	nock = require('nock'),
	should = chai.should(),

	Mapper = require('../../lib/mapper.js'),
	testMapping = require('../test-mapping.json');


// jshint -W030
describe('mapper', function () {
	'use strict';

	var
		isNewIndex = false,
		isUpdatedMapping = false,
		mapper,
		mockModel,
		requestBody,
		requestUri;

	// configure nock
	nock('http://localhost:9200')
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
		.reply(503, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return {
				message : 'server unavailable',
				statusCode : 503
			};
		})
		.head('/test-index')
		.times(2) // to support error and success tests below
		.reply(404, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return { statusCode : 404 };
		})
		.head('/test-index')
		.times(2) // to support error and success tests below
		.reply(200, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return { statusCode : 200 };
		})
		.post('/_bulk')
		.times(4) // replicated for bulk create, delete, update and upsert
		.reply(201, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return { took : 0, items : [
				{ create : { _index : 'test-index', _type : 'test-type' } },
				{ create : { _index : 'test-index', _type : 'test-type' } },
				{ create : { _index : 'test-index', _type : 'test-type' } }
			]};
		})
		.post('/_mget')
		.reply(200, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return {
				items : [
					{ animalId : 1 },
					{ animalId : 2 },
					{ animalId : 3 }
				]
			};
		})
		.post('/test-index')
		.reply(503, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return {
				message : 'server unavailable',
				statusCode : 503
			};
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
		.reply(503, function (uri, body) {
			requestBody = body;
			requestUri = uri;

			return {
				message : 'server unavailable',
				statusCode : 503
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
		});

	after(function () {
		nock.cleanAll();
		nock.restore();
		nock.enableNetConnect();
	});

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
		it('should properly bubble error if encountered checking if index exists', function (done) {
			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);

				return done();
			});
		});

		it('should properly bubble error if encountered creating index', function (done) {
			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.desc);
				should.exist(err._index);
				err.desc.should.contain('#initialize');

				return done();
			});
		});

		it('should create index in the event it does not exist', function (done) {
			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				isNewIndex.should.be.true;

				return done();
			});
		});

		it('should properly bubble error if encountered putting mapping', function (done) {
			mapper._isInitialized = false;

			mapper.delete('test-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.desc);
				should.exist(err._index);
				should.exist(err._type);
				err.desc.should.contain('#initialize');

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

	describe('basic CRUD operations', function () {
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

				mapper.create(mockModel, function (err, result, resultId) {
					should.not.exist(err);
					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					should.exist(result.strictDynamicSubDocument.someDate);
					(result.strictDynamicSubDocument.someDate instanceof Date)
						.should.be.true;
					requestUri.should.equal('/test-index/test-type?op_type=create');
					should.exist(resultId);
					resultId.should.equal('random');

					return done();
				});
			});

			it('should properly PUT when _id.path is supplied', function (done) {
				mapper.create(mockModel, function (err, result, resultId) {
					should.not.exist(err);
					should.exist(result);
					should.exist(resultId);

					requestUri.should.equal('/test-index/test-type/test-id?op_type=create');

					return done();
				});
			});

			it('should properly support _id overloaded as options', function (done) {
				// remove identity column to ensure _id.path is not mapped
				delete mockModel.identity;

				mapper.create({
						_id : 'test-id',
						ttl : '1d'
					},
					mockModel,
					function (err, result, resultId) {
						should.not.exist(err);
						should.exist(result);
						should.not.exist(resultId);
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
					should.exist(requestBody);
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
					should.exist(requestBody);
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
					should.exist(requestBody);
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
					should.exist(requestBody);
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
					should.exist(requestBody);
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
					should.exist(requestBody);
					requestBody.should.contain('doc_as_upsert');

					return done();
				});
			});
		});
	});

	describe('bulk CRUD operations', function () {
		describe('#bulkCreate', function () {
			it('should return error when idList is not an array', function (done) {
				mapper.bulkCreate('invalid', [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', function (done) {
				mapper.bulkCreate([], [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', function (done) {
				mapper.bulkCreate(
					[1, 2, 3],
					[{ test : true }],
					function (err, result) {
						should.exist(err);
						should.not.exist(result);
						should.exist(err.name);
						should.exist(err.parameterName);
						err.name.should.equal('InvalidParameterError');
						err.parameterName.should.equal('idList');

						return done();
					});
			});

			it('should validate each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkCreate(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper.bulkCreate(docs, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');

					return done();
				});
			});
		});

		describe('#bulkDelete', function () {
			it('should return error when idList is not an array', function (done) {
				mapper.bulkDelete('invalid', function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when an id within the idList array is empty', function (done) {
				mapper.bulkDelete([1, null, 3], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.message.should.equal('_id at index 1 is null or undefined');
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				mapper.bulkDelete([1, 2, 3], function (err) {
					should.not.exist(err);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');

					return done();
				});
			});
		});

		describe('#bulkGet', function () {
			it('should return error when idList is not an array', function (done) {
				mapper.bulkGet('invalid', function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when an id within the idList array is empty', function (done) {
				mapper.bulkGet([1, null, 3], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.message.should.equal('_id at index 1 is null or undefined');
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				mapper.bulkGet([1, 2, 3], function (err) {
					should.not.exist(err);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_mget');

					return done();
				});
			});
		});

		describe('#bulkUpdate', function () {
			it('should return error when idList is not an array', function (done) {
				mapper.bulkUpdate('invalid', [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', function (done) {
				mapper.bulkUpdate([], [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', function (done) {
				mapper.bulkUpdate(
					[1, 2, 3],
					[{ test : true }],
					function (err, result) {
						should.exist(err);
						should.not.exist(result);
						should.exist(err.name);
						should.exist(err.parameterName);
						err.name.should.equal('InvalidParameterError');
						err.parameterName.should.equal('idList');

						return done();
					});
			});

			it('should validate an _id exists for each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				delete docs[1].identity;

				mapper.bulkUpdate(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					err.message.should.equal('no _id exists for document at index 1');

					return done();
				});
			});

			it('should validate each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkUpdate(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper.bulkUpdate(docs, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');
					requestBody.should.not.contain('doc_as_upsert');

					return done();
				});
			});
		});

		describe('#bulkUpsert', function () {
			it('should return error when idList is not an array', function (done) {
				mapper.bulkUpsert('invalid', [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', function (done) {
				mapper.bulkUpsert([], [], function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', function (done) {
				mapper.bulkUpsert(
					[1, 2, 3],
					[{ test : true }],
					function (err, result) {
						should.exist(err);
						should.not.exist(result);
						should.exist(err.name);
						should.exist(err.parameterName);
						err.name.should.equal('InvalidParameterError');
						err.parameterName.should.equal('idList');

						return done();
					});
			});

			it('should validate an _id exists for each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				delete docs[1].identity;

				mapper.bulkUpsert(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					err.message.should.equal('no _id exists for document at index 1');

					return done();
				});
			});

			it('should validate each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkUpsert(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper.bulkUpsert(docs, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');
					requestBody.should.contain('doc_as_upsert');

					return done();
				});
			});
		});
	});

	describe('model parsing and validation', function () {
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
});
