/*eslint no-magic-numbers:0*/
/*eslint no-undefined:0*/
/*eslint no-unused-expressions:0*/
var
	chai = require('chai'),
	nock = require('nock'),
	should = chai.should(),

	Mapper = require('../../lib/mapper.js'),
	testMapping = require('../test-mapping.json');


describe('mapper', function () {
	'use strict';

	var
		isNewIndex = false,
		isUpdatedMapping = false,
		mapper,
		mockModel,
		requestBody,
		requestUri;

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
		after(function () {
			nock.cleanAll();
		});

		it('should properly bubble error if encountered checking if index exists', function (done) {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(503, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return {
						message : 'server unavailable',
						statusCode : 503
					};
				});

			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.exist(err);
				should.not.exist(result);

				return done();
			});
		});

		it('should properly bubble error if encountered creating index', function (done) {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.post('/test-index')
				.reply(503, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return {
						message : 'server unavailable',
						statusCode : 503
					};
				});

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
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.post('/test-index')
				.reply(201, function (uri, body) {
					requestBody = body;
					requestUri = uri;
					isNewIndex = true;

					return { acknowledged : true };
				})
				.get('/test-index/test-type/test-id/_source')
				.reply(200, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return JSON.stringify(mockModel);
				});

			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				isNewIndex.should.be.true;

				return done();
			});
		});

		it('should properly bubble error if encountered putting mapping', function (done) {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(200, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 200 };
				})
				.put('/test-index/test-type/bad-id?op_type=create')
				.reply(503, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return {
						message : 'server unavailable',
						statusCode : 503
					};
				});

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
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(200, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 200 };
				})
				.put('/test-index/_mapping/test-type')
				.reply(201, function (uri, body) {
					requestBody = body;
					requestUri = uri;
					isUpdatedMapping = true;

					return { acknowledged : true };
				})
				.get('/test-index/test-type/test-id/_source')
				.reply(200, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return JSON.stringify(mockModel);
				});

			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);
				isUpdatedMapping.should.be.true;

				return done();
			});
		});

		it('should prepare the mapping before creating index in Elasticsearch', function (done) {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.post('/test-index')
				.reply(201, function (uri, body) {
					requestBody = body;
					isNewIndex = true;

					return { acknowledged : true };
				})
				.get('/test-index/test-type/test-id/_source')
				.reply(200, function (uri) {
					requestUri = uri;

					return JSON.stringify(mockModel);
				});

			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);

				let mapping = JSON.parse(requestBody).mappings['test-type'];
				should.not.exist(
					mapping.properties.strictDynamicSubDocument.properties.someRequiredInteger.required);

				return done();
			});
		});

		it('should prepare the mapping before updating index in Elasticsearch', function (done) {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(200, function (uri, body) {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 200 };
				})
				.put('/test-index/_mapping/test-type')
				.reply(201, function (uri, body) {
					requestBody = body;
					isUpdatedMapping = true;

					return { acknowledged : true };
				})
				.get('/test-index/test-type/test-id/_source')
				.reply(200, function (uri) {
					requestUri = uri;

					return JSON.stringify(mockModel);
				});

			mapper._isInitialized = false;

			mapper.get('test-id', function (err, result) {
				should.not.exist(err);
				should.exist(result);

				let mapping = JSON.parse(requestBody)['test-type'];
				should.not.exist(
					mapping.properties.strictDynamicSubDocument.properties.someRequiredInteger.required);

				return done();
			});
		});
	});

	describe('search', function () {
		describe('#search', function () {
			after(function () {
				nock.cleanAll();
			});

			it('should bubble errors from search properly', function (done) {
				var summary;

				nock('http://localhost:9200')
					.post('/test-index/test-type/_search')
					.reply(409, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'test error',
							statusCode : 409
						};
					});

				mapper.on('summary', (searchSummary) => (summary = searchSummary));

				mapper.search(
					{
						query : { fail : true }
					},
					function (err, result) {
						should.exist(err);
						should.not.exist(result);
						should.not.exist(summary);
						should.exist(requestUri);
						requestUri.should.equal('/test-index/test-type/_search');

						return done();
					});
			});

			it('should search properly', function (done) {
				var summary;

				nock('http://localhost:9200')
					.post('/test-index/test-type/_search')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							took : 4,
							'timed_out' : false,
							_shards : {
								total : 5,
								successful : 5,
								failed : 0
							},
							hits : {
								total : 1,
								'max_score' : 1.0,
								hits : [
									{
										_index : 'test-index',
										_type : 'test-type',
										_id : mockModel.animalId,
										_score : 1.0,
										_source : mockModel
									}
								]
							}
						};
					});

				mapper.on('summary', (searchSummary) => (summary = searchSummary));

				mapper.search(
					{
						query : { 'match_all' : {} }
					},
					function (err, result) {
						should.not.exist(err);
						should.exist(result);
						result.should.have.length(1);
						should.exist(summary);
						should.exist(summary.total);
						summary.total.should.equal(1);
						should.exist(requestUri);
						requestUri.should.equal('/test-index/test-type/_search');

						return done();
					});
			});
		});
	});

	describe('basic CRUD operations', function () {
		describe('#create', function () {
			after(function () {
				nock.cleanAll();
			});

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
				nock('http://localhost:9200')
					.put('/test-index/test-type/bad-id?op_type=create')
					.reply(503, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 503
						};
					});

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
				nock('http://localhost:9200')
					.put('/test-index/test-type/test-id?op_type=create')
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
				var _id;

				nock('http://localhost:9200')
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
					});

				delete mockModel.identity;

				mapper.on('identity', (id) => (_id = id));

				mapper.create(mockModel)
					.then((result) => {
						should.exist(result);
						should.exist(result.strictDynamicSubDocument);
						should.exist(result.strictDynamicSubDocument.someDate);
						(result.strictDynamicSubDocument.someDate instanceof Date)
							.should.be.true;
						requestUri.should.equal('/test-index/test-type?op_type=create');
						should.exist(_id);
						_id.should.equal('random');

						return done();
					})
					.catch(done);
			});

			it('should properly PUT when _id.path is supplied', function (done) {
				nock('http://localhost:9200')
					.put('/test-index/test-type/test-id?op_type=create')
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

				mapper.create(mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);

					requestUri.should.equal('/test-index/test-type/test-id?op_type=create');

					return done();
				});
			});

			it('should properly support _id overloaded as options', function (done) {
				nock('http://localhost:9200')
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
			after(function () {
				nock.cleanAll();
			});

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
				mapper.delete(undefined)
					.then(() => done(new Error('should return error when _id is undefined')))
					.catch((err) => {
						should.exist(err);

						should.exist(err.name);
						err.name.should.equal('InvalidParameterError');
						should.exist(err.parameterName);
						err.parameterName.should.equal('_id');

						return done();
					});
			});

			it('should properly bubble errors', function (done) {
				nock('http://localhost:9200')
					.delete('/test-index/test-type/bad-id')
					.reply(404, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'not found',
							statusCode : 404
						};
					});

				mapper.delete('bad-id', function (err, result) {
					should.exist(err);
					should.not.exist(result);
					requestUri.should.equal('/test-index/test-type/bad-id');

					return done();
				});
			});

			it('should properly delete', function (done) {
				nock('http://localhost:9200')
					.delete('/test-index/test-type/test-id')
					.reply(202, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {};
					});

				mapper.delete('test-id', function (err, result) {
					should.not.exist(err);
					should.exist(result);
					requestUri.should.equal('/test-index/test-type/test-id');

					return done();
				});
			});

			it('should support overload of _id as options', function (done) {
				var options = {
					_id : 'test-id',
					timeout : '1m'
				};

				nock('http://localhost:9200')
					.delete('/test-index/test-type/test-id?timeout=1m')
					.reply(202, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {};
					});

				mapper.delete(options, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					requestUri.should.equal('/test-index/test-type/test-id?timeout=1m');

					return done();
				});
			});

			it('should return error when _id and query are not supplied', function (done) {
				var options = {};

				mapper.delete(options, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					err.name.should.equal('InvalidParameterError');
					should.exist(err.parameterName);
					err.parameterName.should.equal('_id');

					return done();
				});
			});

			it('should delete by query when supplied', function (done) {
				var options = {
					query : {
						term : {
							'subDocument.someBoolean' : true
						}
					}
				};

				nock('http://localhost:9200')
					.post('/test-index/test-type/_search?scroll=30s&search_type=scan')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							hits : {
								total : 0
							}
						};
					});

				mapper.delete(options, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					requestUri.should.contain('/test-index/test-type/_search?scroll');

					return done();
				});
			});

			it('should delete by query and scan multiple pages as needed', function (done) {
				var
					bulkDeleteCount = 0,
					i = 0,
					options = {
						from : 0,
						query : {
							term : {
								'subDocument.someBoolean' : true
							}
						},
						size : 5
					},
					sentQuery,
					testMatches = [];

				// populate test matches
				for (; i < 25; i++) {
					testMatches.push({
						_id : ['id', i].join(':')
					});
				}

				nock('http://localhost:9200')
					.post('/test-index/test-type/_search?scroll=30s&search_type=scan')
					.reply(200, function (uri, body) {
						sentQuery = JSON.parse(body);

						return {
							hits : {
								total : 25
							}
						};
					});

				nock('http://localhost:9200')
					.post('/_bulk')
					.times(5)
					.reply(200, function () {
						bulkDeleteCount ++;

						return { acknowledged : true };
					});

				nock('http://localhost:9200')
					.post('/_search/scroll?scroll=30s')
					.times(5)
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							hits : {
								hits : testMatches.splice(0, 5),
								total : 25
							}
						};
					});

				mapper.delete(options, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(sentQuery);
					should.exist(sentQuery._source);
					sentQuery.from.should.equal(0);
					sentQuery.size.should.equal(5);
					requestUri.should.contain('/_search/scroll');
					bulkDeleteCount.should.equal(5);

					return done();
				});
			});
		});

		describe('#get', function () {
			after(function () {
				nock.cleanAll();
			});

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
				nock('http://localhost:9200')
					.get('/test-index/test-type/bad-id/_source')
					.reply(404, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'not found',
							statusCode : 404
						};
					});

				mapper.get('bad-id')
					.then((result) => {
						should.not.exist(result);
						requestUri.should.equal('/test-index/test-type/bad-id/_source');

						return done();
					})
					.catch(done);
			});

			it('should properly return non 404 errors', function (done) {
				nock('http://localhost:9200')
					.get('/test-index/test-type/really-bad-id/_source')
					.reply(503, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 503
						};
					});

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
				nock('http://localhost:9200')
					.get('/test-index/test-type/test-id/_source')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return JSON.stringify(mockModel);
					});

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

				nock('http://localhost:9200')
					.get('/test-index/test-type/test-id/_source?fields=identity')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return JSON.stringify({ identity : mockModel.identity });
					});

				mapper.get(options)
					.then((result) => {
						should.exist(result);
						requestUri.should.equal('/test-index/test-type/test-id/_source?fields=identity');

						return done();
					})
					.catch(done);
			});
		});

		describe('#update', function () {
			after(function () {
				nock.cleanAll();
			});

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
				var version;

				nock('http://localhost:9200')
					.post('/test-index/test-type/bad-id/_update')
					.reply(503, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 503
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.update('bad-id', mockModel, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.not.exist(version);
					should.exist(err.statusCode);
					err.statusCode.should.equal(503);
					requestUri.should.equal('/test-index/test-type/bad-id/_update');
					should.exist(requestBody);
					requestBody.should.not.contain('doc_as_upsert');

					return done();
				});
			});

			it('should allow partial document update without required fields', function (done) {
				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update')
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
					});

				delete mockModel.strictDynamicSubDocument.someRequiredInteger;
				mapper.update('test-id', mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);

					return done();
				});
			});

			it('should allow partial document update when required fields are undefined', function (done) {
				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update')
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
					});

				mockModel.strictDynamicSubDocument.someRequiredInteger = undefined;
				mapper.update('test-id', mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);

					return done();
				});
			});

			it('should properly update and coerce types supplied', function (done) {
				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update')
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
					});

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
				var
					options = {
						_id : 'test-id',
						'retry_on_conflict' : 3
					},
					version;

				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update?retry_on_conflict=3')
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
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.update(options, mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(version);
					requestUri.should.equal('/test-index/test-type/test-id/_update?retry_on_conflict=3');
					should.exist(requestBody);
					requestBody.should.not.contain('doc_as_upsert');

					return done();
				});
			});
		});

		describe('#upsert', function () {
			after(function () {
				nock.cleanAll();
			});

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
				var version;

				nock('http://localhost:9200')
					.post('/test-index/test-type/bad-id/_update')
					.reply(503, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 503
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.upsert('bad-id', mockModel, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.not.exist(version);
					should.exist(err.statusCode);
					err.statusCode.should.equal(503);
					requestUri.should.equal('/test-index/test-type/bad-id/_update');
					should.exist(requestBody);
					requestBody.should.contain('doc_as_upsert');

					return done();
				});
			});

			it('should properly upsert and coerce types supplied', function (done) {
				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update')
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
					});

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
				var
					options = {
						_id : 'test-id',
						'retry_on_conflict' : 3
					},
					version;

				nock('http://localhost:9200')
					.post('/test-index/test-type/test-id/_update?retry_on_conflict=3')
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
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.upsert(options, mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(version);
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
			after(function () {
				nock.cleanAll();
			});

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

				mapper.bulkCreate(docs)
					.then(() => done(new Error('should validate each document in docList')))
					.catch((err) => {
						should.exist(err);
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

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { took : 0, items : [
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } }
						]};
					});

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
			after(function () {
				nock.cleanAll();
			});

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
				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { took : 0, items : [
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } }
						]};
					});

				mapper.bulkDelete([1, 2, 3])
					.then(() => {
						should.exist(requestBody);
						should.exist(requestUri);
						requestUri.should.equal('/_bulk');

						return done();
					})
					.catch(done);
			});
		});

		describe('#bulkGet', function () {
			after(function () {
				nock.cleanAll();
			});

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
				mapper.bulkGet([1, null, 3])
					.then(() => done(
						new Error('should return error when an id within the idList array is empty')))
					.catch((err) => {
						should.exist(err);
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
				nock('http://localhost:9200')
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
					});

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
			after(function () {
				nock.cleanAll();
			});

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
				docs[1].strictDynamicSubDocument.someRequiredInteger = 'not an integer';

				mapper.bulkUpdate(docs, function (err, result) {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly skip required field check for each document in docList', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { took : 0, items : [
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } }
						]};
					});

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkUpdate(docs, function (err, result) {
					should.not.exist(err);
					should.exist(result);

					return done();
				});
			});

			it('should properly POST bulk payload', function (done) {
				var docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { took : 0, items : [
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } }
						]};
					});

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
			after(function () {
				nock.cleanAll();
			});

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

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { took : 0, items : [
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } },
							{ create : { _index : 'test-index', _type : 'test-type' } }
						]};
					});

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
		describe('#analyzedFields', function () {
			it('should properly return analyzedFields', function () {
				var analyzedFields = mapper.analyzedFields();
				analyzedFields.should.have.length(2);
			});
		});

		describe('#fieldExists', function () {
			it('should properly find existing fields', function () {
				mapper.fieldExists('strictDynamicSubDocument.someDate').should.be.true;
			});

			it('should properly return false for non existing fields', function () {
				mapper.fieldExists('a.non.existing.field').should.be.false;
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
				mapper.parse(null)
					.then(() => done(new Error('should properly fail when supplied model is null')))
					.catch((err) => {
						should.exist(err);
						should.exist(err.message);
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
				mockModel.subDocument.someBoolean = false;

				let json = JSON.stringify(mockModel);

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
					result.falseDynamicSubDocument.anotherString
						.should.equal('1');

					should.exist(result.subDocument);
					should.exist(result.subDocument.someBoolean);
					result.subDocument.someBoolean.should.be.false;

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

				mapper.parse(json)
					.then((result) => {
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
					})
					.catch(done);
			});

			it('should properly coerce array of non sub-document type values', function (done) {
				mockModel.subDocument.arrayOfStrings = ['test 1', 'test 2'];

				mapper.parse(mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(result.subDocument);
					should.exist(result.subDocument.arrayOfStrings);
					result.subDocument.arrayOfStrings.should.be.an('array');
					result.subDocument.arrayOfStrings.should.have.length(2);

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

				mapper.validate(mockModel)
					.then((result) => {
						should.exist(result);
						should.exist(result.subDocument);
						should.exist(result.subDocument.badField);

						return done();
					})
					.catch(done);
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

				mapper.validate(mockModel)
					.then(() => done(new Error('shoudl require fields marked as required')))
					.catch((err) => {
						should.exist(err);
						should.exist(err.message);

						err.message.should.equal(
							'field strictDynamicSubDocument.someRequiredInteger is required');

						return done();
					});
			});

			it('should properly detect _id.path and extract from the model', function (done) {
				var _id;

				mockModel.identity = {
					docId : 'test-id'
				};

				mapper.on('identity', (id) => (_id = id));

				mapper.validate(mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.exist(_id);
					_id.should.equal('test-id');

					return done();
				});
			});

			it('should not raise identity event when _id is not found', function (done) {
				var _id;

				mapper.on('identity', (id) => (_id = id));

				delete mockModel.identity;

				mapper.validate(mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);
					should.not.exist(_id);

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

			it('should handle validation of string type arrays correctly', function (done) {
				mockModel.subDocument.arrayOfStrings = ['string 1', 'string 2'];

				mapper.validate(mockModel, function (err, result) {
					should.not.exist(err);
					should.exist(result);

					return done();
				});
			});
		});

		describe('#verifyConnection', function () {
			after(function () {
				nock.cleanAll();
			});

			it('should properly initialize and verify connection to elasticsearch', function (done) {
				nock('http://localhost:9200')
					.head('/test-index')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { statusCode : 200 };
					})
					.put('/test-index/_mapping/test-type')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;
						isUpdatedMapping = true;

						return { acknowledged : true };
					});

				mapper._isInitialized = false;

				mapper.verifyConnection(function (err) {
					should.not.exist(err);
					mapper._isInitialized.should.be.true;

					return done();
				});
			});

			it('should properly initialize and verify connection to elasticsearch (Promise)', function (done) {
				nock('http://localhost:9200')
					.head('/test-index')
					.reply(200, function (uri, body) {
						requestBody = body;
						requestUri = uri;

						return { statusCode : 200 };
					})
					.put('/test-index/_mapping/test-type')
					.reply(201, function (uri, body) {
						requestBody = body;
						requestUri = uri;
						isUpdatedMapping = true;

						return { acknowledged : true };
					});

				mapper._isInitialized = false;

				mapper
					.verifyConnection()
					.then(() => {
						mapper._isInitialized.should.be.true;
						return done();
					})
					.catch(done);
			});
		});
	});
});
