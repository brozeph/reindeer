/* eslint no-magic-numbers : 0 */
/* eslint no-undefined : 0 */
/* eslint no-unused-expressions : 0 */
/* eslint no-unused-vars : 0 */
/* eslint sort-keys : 0 */
import chai from 'chai';
import { Mapper } from '../../src/mapper.js';
import nock from 'nock';

const
	should = chai.should(),
	testMapping = require('../test-mapping.json');

describe('mapper', () => {
	let
		isNewIndex = false,
		isUpdatedMapping = false,
		mapper,
		mockModel,
		requestBody,
		requestUri;

	after(() => {
		nock.cleanAll();
		nock.restore();
		nock.enableNetConnect();
	});

	beforeEach(() => {
		nock.cleanAll();

		mapper = new Mapper({
			_index : 'test-index'
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

	describe('constructor', () => {
		it('should require _index name on constructor', () => {
			let err;

			try {
				mapper = new Mapper({}, testMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('_index must be provided');
		});

		it('should require mapping on constructor', () => {
			let err;

			try {
				mapper = new Mapper({
					_index : 'test-index'
				});
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('mapping is not an object or is missing properties');
		});

		it('should require each field in mapping to contain a type', () => {
			let
				err,
				invalidMapping = JSON.parse(JSON.stringify(testMapping));

			invalidMapping.properties.rootFloat.type = undefined;

			try {
				mapper = new Mapper({
					_index : 'test-index'
				}, invalidMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('field rootFloat missing type');
		});

		it('should properly recognize invalid types', () => {
			let
				err,
				invalidMapping = JSON.parse(JSON.stringify(testMapping));

			invalidMapping.properties.rootFloat.type = 'invalid';

			try {
				mapper = new Mapper({
					_index : 'test-index'
				}, invalidMapping);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			should.exist(err.message);
			err.message.should.equal('field rootFloat type is invalid: invalid');
		});
	});

	describe('initialization', () => {
		after(() => {
			nock.cleanAll();
		});

		it('should properly bubble error if encountered checking if index exists', (done) => {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(499, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return {
						message : 'server unavailable',
						statusCode : 499
					};
				});

			mapper._isInitialized = false;

			mapper.get('test-id', (err, result) => {
				should.exist(err);
				should.not.exist(result);

				return done();
			});
		});

		it('should properly bubble error if encountered creating index', (done) => {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.put('/test-index')
				.reply(499, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return {
						message : 'server unavailable',
						statusCode : 499
					};
				});

			mapper._isInitialized = false;

			mapper.get('test-id', (err, result) => {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.desc);
				should.exist(err._index);
				err.desc.should.contain('#initialize');

				return done();
			});
		});

		it('should create index in the event it does not exist', (done) => {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.put('/test-index')
				.reply(201, (uri, body) => {
					requestBody = body;
					requestUri = uri;
					isNewIndex = true;

					return { acknowledged : true };
				})
				.get('/test-index/_source/test-id')
				.reply(200, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return mockModel; // JSON.parse(JSON.stringify(mockModel));
				});

			mapper._isInitialized = false;

			mapper.get('test-id')
				.then((result) => {
					should.exist(result);
					isNewIndex.should.be.true;

					return done();
				})
				.catch(done);
		});

		it('should prepare the mapping before creating index in Elasticsearch', (done) => {
			nock('http://localhost:9200')
				.head('/test-index')
				.reply(404, (uri, body) => {
					requestBody = body;
					requestUri = uri;

					return { statusCode : 404 };
				})
				.put('/test-index')
				.reply(201, (uri, body) => {
					requestBody = body;
					isNewIndex = true;

					return { acknowledged : true };
				})
				.get('/test-index/_source/test-id')
				.reply(200, (uri) => {
					requestUri = uri;

					return JSON.parse(JSON.stringify(mockModel));
				});

			mapper._isInitialized = false;

			mapper.get('test-id')
				.then((result) => {
					should.exist(result);

					let mapping = requestBody.mappings;
					should.not.exist(
						mapping.properties.strictDynamicSubDocument.properties.someRequiredInteger.required);

					return done();
				})
				.catch(done);
		});
	});

	describe('search', () => {
		describe('#search', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should bubble errors from search properly', (done) => {
				let summary;

				nock('http://localhost:9200')
					.post('/test-index/_search')
					.reply(409, (uri, body) => {
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
						requestUri.should.equal('/test-index/_search');

						return done();
					});
			});

			it('should search properly', (done) => {
				let summary;

				nock('http://localhost:9200')
					.post('/test-index/_search')
					.reply(200, (uri, body) => {
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
						if (err) {
							return done(err);
						}

						should.exist(result);
						result.should.have.length(1);
						should.exist(summary);
						should.exist(summary.total);
						summary.total.should.equal(1);
						should.exist(requestUri);
						requestUri.should.equal('/test-index/_search');

						return done();
					});
			});
		});
	});

	describe('basic CRUD operations', () => {
		describe('#create', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when doc is null', (done) => {
				mapper.create(null, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly bubble errors', (done) => {
				nock('http://localhost:9200')
					.put('/test-index/_doc/bad-id?op_type=index')
					.reply(499, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 499
						};
					});

				mapper.create('bad-id', mockModel)
					.then(() => done(new Error('should properly return error when attempting to create a doc')))
					.catch((err) => {
						should.exist(err);
						should.exist(err.statusCode);
						err.statusCode.should.equal(499);
						requestUri.should.equal('/test-index/_doc/bad-id?op_type=index');

						return done();
					});
			});

			it('should properly PUT when _id is supplied', (done) => {
				nock('http://localhost:9200')
					.put('/test-index/_doc/test-id?op_type=index')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							created : true
						};
					});

				mapper.create('test-id', mockModel)
					.then((result) => {
						should.exist(result);
						should.exist(result.strictDynamicSubDocument);
						should.exist(result.strictDynamicSubDocument.someDate);
						(result.strictDynamicSubDocument.someDate instanceof Date)
							.should.be.true;
						requestUri.should.equal('/test-index/_doc/test-id?op_type=index');

						return done();
					})
					.catch(done);
			});

			it('should properly PUT when _id is not supplied', (done) => {
				let _id;

				nock('http://localhost:9200')
					.post('/test-index/_doc?op_type=index')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
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
						requestUri.should.equal('/test-index/_doc?op_type=index');
						should.exist(_id);
						_id.should.equal('random');

						return done();
					})
					.catch(done);
			});

			it('should properly PUT when _id.path is supplied', (done) => {
				nock('http://localhost:9200')
					.put('/test-index/_doc/test-id?op_type=index')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							created : true
						};
					});

				mapper.create(mockModel)
					.then((result) => {
						should.exist(result);

						requestUri.should.equal('/test-index/_doc/test-id?op_type=index');

						return done();
					})
					.catch(done);
			});

			it('should properly support _id overloaded as options', (done) => {
				nock('http://localhost:9200')
					.put('/test-index/_doc/test-id?ttl=1d&op_type=index')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
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
				mockModel)
					.then((result) => {
						should.exist(result);
						should.exist(result.strictDynamicSubDocument);
						should.exist(result.strictDynamicSubDocument.someDate);
						(result.strictDynamicSubDocument.someDate instanceof Date)
							.should.be.true;
						requestUri.should.equal('/test-index/_doc/test-id?ttl=1d&op_type=index');

						return done();
					})
					.catch(done);
			});
		});

		describe('#delete', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when _id is null', (done) => {
				mapper.delete(null, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					should.exist(err.name);
					err.name.should.equal('InvalidParameterError');
					should.exist(err.parameterName);
					err.parameterName.should.equal('_id');

					return done();
				});
			});

			it('should return error when _id is undefined', (done) => {
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

			it('should properly bubble errors', (done) => {
				nock('http://localhost:9200')
					.delete('/test-index/_doc/bad-id')
					.reply(404, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'not found',
							statusCode : 404
						};
					});

				mapper.delete('bad-id', (err, result) => {
					should.exist(err);
					should.not.exist(result);
					requestUri.should.equal('/test-index/_doc/bad-id');

					return done();
				});
			});

			it('should properly delete', (done) => {
				nock('http://localhost:9200')
					.delete('/test-index/_doc/test-id')
					.reply(202, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {};
					});

				mapper.delete('test-id', (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					requestUri.should.equal('/test-index/_doc/test-id');

					return done();
				});
			});

			it('should support overload of _id as options', (done) => {
				let options = {
					_id : 'test-id',
					timeout : 1
				};

				nock('http://localhost:9200')
					.delete('/test-index/_doc/test-id?timeout=1')
					.reply(202, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {};
					});

				mapper.delete(options, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					requestUri.should.equal('/test-index/_doc/test-id?timeout=1');

					return done();
				});
			});

			it('should return error when _id and query are not supplied', (done) => {
				let options = {};

				mapper.delete(options, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					err.name.should.equal('InvalidParameterError');
					should.exist(err.parameterName);
					err.parameterName.should.equal('_id');

					return done();
				});
			});

			it('should delete by query when supplied', (done) => {
				let options = {
					query : {
						term : {
							'subDocument.someBoolean' : true
						}
					}
				};

				nock('http://localhost:9200')
					.post('/test-index/_search?scroll=30s')
					.reply(200, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							hits : {
								total : 0
							}
						};
					});

				mapper.delete(options)
					.then((result) => {
						should.exist(result);
						requestUri.should.contain('/test-index/_search?scroll');

						return done();
					})
					.catch(done);
			});

			it('should delete by query and scan multiple pages as needed', (done) => {
				let
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
					.post('/test-index/_search?scroll=30s')
					.reply(function (uri, requestBody) {
						sentQuery = requestBody;

						mapper._client.request.once('request', (state) => {
							requestBody = state.data;
							requestUri = state.options.path;
						});

						return [200, {
							'_scroll_id' : 'test_scroll',
							hits : {
								total : 25
							}
						}];
					});

				nock('http://localhost:9200')
					.post('/_bulk')
					.times(5)
					.reply(200, { acknowledged : true });

				nock('http://localhost:9200')
					.post('/_search/scroll?scroll=30s')
					.times(5)
					.reply(200, {
						hits : {
							hits : testMatches.splice(0, 5),
							total : 25
						}
					});

				mapper
					.delete(options)
					.then((result) => {
						should.exist(result);
						should.exist(sentQuery);
						should.exist(sentQuery._source);
						sentQuery.from.should.equal(0);
						sentQuery.size.should.equal(5);
						requestUri.should.contain('/_search/scroll');

						return done();
					})
					.catch(done);
			});
		});

		describe('#get', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when _id is null', (done) => {
				mapper.get(null, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					should.exist(err.name);
					err.name.should.equal('InvalidParameterError');
					should.exist(err.parameterName);
					err.parameterName.should.equal('_id');

					return done();
				});
			});

			it('should return error when _id is undefined', (done) => {
				mapper.get(undefined, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					should.exist(err.name);
					err.name.should.equal('InvalidParameterError');
					should.exist(err.parameterName);
					err.parameterName.should.equal('_id');

					return done();
				});
			});

			it('should properly not return an error when get finds no document', (done) => {
				nock('http://localhost:9200')
					.get('/test-index/_source/bad-id')
					.reply(404, (uri, body) => {
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
						requestUri.should.equal('/test-index/_source/bad-id');

						return done();
					})
					.catch(done);
			});

			it('should properly return non 404 errors', (done) => {
				nock('http://localhost:9200')
					.get('/test-index/_source/really-bad-id')
					.reply(499, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 499
						};
					});

				mapper.get('really-bad-id', (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.statusCode);
					err.statusCode.should.equal(499);
					requestUri.should.equal('/test-index/_source/really-bad-id');

					return done();
				});
			});

			it('should properly return document with correctly typed values', (done) => {
				nock('http://localhost:9200')
					.get('/test-index/_source/test-id')
					.reply(200, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return JSON.parse(JSON.stringify(mockModel));
					});

				mapper.get('test-id', (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					should.exist(result.strictDynamicSubDocument.someDate);
					(result.strictDynamicSubDocument.someDate instanceof Date)
						.should.be.true;
					requestUri.should.equal('/test-index/_source/test-id');

					return done();
				});
			});

			it('should support overload of _id as options', (done) => {
				let options = {
					_id : 'test-id',
					fields : 'identity'
				};

				nock('http://localhost:9200')
					.get('/test-index/_source/test-id?fields=identity')
					.reply(200, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return JSON.parse(JSON.stringify({ identity : mockModel.identity }));
					});

				mapper.get(options)
					.then((result) => {
						should.exist(result);
						requestUri.should.equal('/test-index/_source/test-id?fields=identity');

						return done();
					})
					.catch(done);
			});
		});

		describe('#update', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when doc is null', (done) => {
				mapper.update(null, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly bubble errors', (done) => {
				let version;

				nock('http://localhost:9200')
					.post('/test-index/_update/bad-id')
					.reply(499, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 499
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.update('bad-id', mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.not.exist(version);
					should.exist(err.statusCode);
					err.statusCode.should.equal(499);
					requestUri.should.equal('/test-index/_update/bad-id');
					should.exist(requestBody);

					return done();
				});
			});

			it('should allow partial document update without required fields', (done) => {
				nock('http://localhost:9200')
					.post('/test-index/_update/test-id')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				delete mockModel.strictDynamicSubDocument.someRequiredInteger;
				mapper.update('test-id', mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);

					return done();
				});
			});

			it('should allow partial document update when required fields are undefined', (done) => {
				nock('http://localhost:9200')
					.post('/test-index/_update/test-id')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				mockModel.strictDynamicSubDocument.someRequiredInteger = undefined;
				mapper.update('test-id', mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);

					return done();
				});
			});

			it('should properly update and coerce types supplied', (done) => {
				nock('http://localhost:9200')
					.post('/test-index/_update/test-id')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				mapper.update('test-id', mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					should.exist(result.strictDynamicSubDocument.someDate);
					(result.strictDynamicSubDocument.someDate instanceof Date)
						.should.be.true;
					requestUri.should.equal('/test-index/_update/test-id');
					should.exist(requestBody);

					return done();
				});
			});

			it('should properly support _id overloaded as options', (done) => {
				let
					options = {
						_id : 'test-id',
						'retry_on_conflict' : 3
					},
					version;

				nock('http://localhost:9200')
					.post('/test-index/_update/test-id?retry_on_conflict=3')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.update(options, mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(version);
					requestUri.should.equal('/test-index/_update/test-id?retry_on_conflict=3');
					should.exist(requestBody);

					return done();
				});
			});
		});

		describe('#upsert', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when doc is null', (done) => {
				mapper.upsert(null, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly bubble errors', (done) => {
				let version;

				nock('http://localhost:9200')
					.post('/test-index/_update/bad-id')
					.reply(499, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							message : 'server unavailable',
							statusCode : 499
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.upsert('bad-id', mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.not.exist(version);
					should.exist(err.statusCode);
					err.statusCode.should.equal(499);
					requestUri.should.equal('/test-index/_update/bad-id');
					should.exist(requestBody);

					return done();
				});
			});

			it('should properly upsert and coerce types supplied', (done) => {
				nock('http://localhost:9200')
					.post('/test-index/_update/test-id')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				mapper.upsert('test-id', mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					should.exist(result.strictDynamicSubDocument.someDate);
					(result.strictDynamicSubDocument.someDate instanceof Date)
						.should.be.true;
					requestUri.should.equal('/test-index/_update/test-id');
					should.exist(requestBody);

					return done();
				});
			});

			it('should properly support _id overloaded as options', (done) => {
				let
					options = {
						_id : 'test-id',
						'retry_on_conflict' : 3
					},
					version;

				nock('http://localhost:9200')
					.post('/test-index/_update/test-id?retry_on_conflict=3')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return {
							_index : 'test-index',
							_id : 'test-id',
							_version : 1,
							updated : true
						};
					});

				mapper.on('version', (versionInfo) => (version = versionInfo));

				mapper.upsert(options, mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(version);
					requestUri.should.equal('/test-index/_update/test-id?retry_on_conflict=3');
					should.exist(requestBody);

					return done();
				});
			});
		});
	});

	describe('bulk CRUD operations', () => {
		describe('#bulkCreate', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when idList is not an array', (done) => {
				mapper.bulkCreate('invalid', [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', (done) => {
				mapper.bulkCreate([], [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', (done) => {
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

			it('should validate each document in docList', (done) => {
				let docs = [
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

			it('should properly POST bulk payload', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper._client.request.once('request', (context) => {
					requestBody = context.state.data;
					requestUri = context.options.path;
				});

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, {
						took : 0,
						items : [
							{ create : { _index : 'test-index' } },
							{ create : { _index : 'test-index' } },
							{ create : { _index : 'test-index' } }
						]
					});

				mapper.bulkCreate(docs, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');

					return done();
				});
			});
		});

		describe('#bulkDelete', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when idList is not an array', (done) => {
				mapper.bulkDelete('invalid', (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when an id within the idList array is empty', (done) => {
				mapper.bulkDelete([1, null, 3], (err, result) => {
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

			it('should properly POST bulk payload', (done) => {
				mapper._client.request.once('request', (context) => {
					requestBody = context.state.data;
					requestUri = context.options.path;
				});

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, {
							took : 0,
							items : [
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } }
							]
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

		describe('#bulkGet', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when idList is not an array', (done) => {
				mapper.bulkGet('invalid', (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when an id within the idList array is empty', (done) => {
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

			it('should properly POST bulk payload', (done) => {
				nock('http://localhost:9200')
					.post('/_mget')
					.reply(200, (uri, body) => {
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

				mapper.bulkGet([1, 2, 3], (err) => {
					if (err) {
						return done(err);
					}

					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_mget');

					return done();
				});
			});
		});

		describe('#bulkUpdate', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when idList is not an array', (done) => {
				mapper.bulkUpdate('invalid', [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', (done) => {
				mapper.bulkUpdate([], [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', (done) => {
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

			it('should validate an _id exists for each document in docList', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				delete docs[1].identity;

				mapper.bulkUpdate(docs, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					err.message.should.equal('no _id exists for document at index 1');

					return done();
				});
			});

			it('should validate each document in docList', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = 'not an integer';

				mapper.bulkUpdate(docs, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly skip required field check for each document in docList', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper._client.request.once('request', (context) => {
					requestBody = context.state.data;
					requestUri = context.options.path;
				});

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, {
							took : 0,
							items : [
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } }
							]
						});

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkUpdate(docs, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);

					return done();
				});
			});

			it('should properly POST bulk payload', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper._client.request.once('request', (context) => {
					requestBody = context.state.data;
					requestUri = context.options.path;
				});

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, {
							took : 0,
							items : [
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } }
							]
						});

				mapper.bulkUpdate(docs, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');

					return done();
				});
			});
		});

		describe('#bulkUpsert', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should return error when idList is not an array', (done) => {
				mapper.bulkUpsert('invalid', [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('idList');

					return done();
				});
			});

			it('should return error when docList is empty', (done) => {
				mapper.bulkUpsert([], [], (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					should.exist(err.parameterName);
					err.name.should.equal('InvalidParameterError');
					err.parameterName.should.equal('docList');

					return done();
				});
			});

			it('should return error when idList and docList do not match', (done) => {
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

			it('should validate an _id exists for each document in docList', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				delete docs[1].identity;

				mapper.bulkUpsert(docs, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.message);
					err.message.should.equal('no _id exists for document at index 1');

					return done();
				});
			});

			it('should validate each document in docList', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				// remove a required field
				docs[1].strictDynamicSubDocument.someRequiredInteger = undefined;

				mapper.bulkUpsert(docs, (err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.name);
					err.name.should.equal('InvalidModelError');

					return done();
				});
			});

			it('should properly POST bulk payload', (done) => {
				let docs = [
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel)),
					JSON.parse(JSON.stringify(mockModel))
				];

				mapper._client.request.once('request', (context) => {
					requestBody = context.state.data;
					requestUri = context.options.path;
				});

				nock('http://localhost:9200')
					.post('/_bulk')
					.reply(201, {
							took : 0,
							items : [
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } },
								{ create : { _index : 'test-index' } }
							]
						});

				mapper.bulkUpsert(docs, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(requestBody);
					should.exist(requestUri);
					requestUri.should.equal('/_bulk');

					return done();
				});
			});
		});
	});

	describe('model parsing and validation', () => {
		describe('#analyzedFields', () => {
			it('should properly return analyzedFields', () => {
				let analyzedFields = mapper.analyzedFields();
				analyzedFields.should.have.length(1);
			});
		});

		describe('#fieldExists', () => {
			it('should properly find existing fields', () => {
				mapper.fieldExists('strictDynamicSubDocument.someDate').should.be.true;
			});

			it('should properly return false for non existing fields', () => {
				mapper.fieldExists('a.non.existing.field').should.be.false;
			});
		});

		describe('#parse', () => {
			it('should properly fail with invalid JSON', (done) => {
				mapper.parse('{ invalid json }', (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal('unable to parse JSON');

					return done();
				});
			});

			it('should properly fail when supplied model is null', (done) => {
				mapper.parse(null)
					.then(() => done(new Error('should properly fail when supplied model is null')))
					.catch((err) => {
						should.exist(err);
						should.exist(err.message);
						err.message.should.equal('supplied model is not an object');

						return done();
					});
			});

			it('should properly fail when supplied model is an empty object', (done) => {
				mapper.parse({}, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal('supplied model is not an object');

					return done();
				});
			});

			it('should properly coerce mapping type values', (done) => {
				mockModel.falseDynamicSubDocument.anotherString = 1;
				mockModel.subDocument.someBoolean = false;

				let json = JSON.stringify(mockModel);

				mapper.parse(json, (err, result) => {
					if (err) {
						return done(err);
					}

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

			it('should properly coerce array of mapping type values', (done) => {
				let json = JSON.stringify([
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

			it('should properly coerce array of non sub-document type values', (done) => {
				mockModel.subDocument.arrayOfStrings = ['test 1', 'test 2'];

				mapper.parse(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.subDocument);
					should.exist(result.subDocument.arrayOfStrings);
					result.subDocument.arrayOfStrings.should.be.an('array');
					result.subDocument.arrayOfStrings.should.have.length(2);

					return done();
				});
			});
		});

		describe('#validate', () => {
			it('should properly require fields', (done) => {
				mapper.validate({}, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal('model is not an object or is empty');

					return done();
				});
			});

			it('should error when non-specified fields exist in strict mapping', (done) => {
				mockModel.strictDynamicSubDocument.badField = 'bad';

				mapper.validate(mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal(
						'strictDynamicSubDocument.badField is not a valid field in the strict type mapping');

					return done();
				});
			});

			it('should error when non-specified fields exist in strict dynamic mapping', (done) => {
				mockModel.strictDynamicSubDocument.badField = 'bad';

				mapper.validate(mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal(
						'strictDynamicSubDocument.badField is not a valid field in the strict type mapping');

					return done();
				});
			});

			it('should omit non-specified fields in false dynamic mapping', (done) => {
				mockModel.falseDynamicSubDocument.badField = 'bad';

				mapper.validate(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.falseDynamicSubDocument);
					should.not.exist(result.falseDynamicSubDocument.badField);

					return done();
				});
			});

			it('should not omit non-specified fields in true dynamic mapping', (done) => {
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

			it('should return an error when field validation fails', (done) => {
				mockModel.strictDynamicSubDocument.someDate = 'not a date';

				mapper.validate(mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal(
						'strictDynamicSubDocument.someDate contains an invalid value (not a date) for type date');

					return done();
				});
			});

			it('should require fields marked as required in the mapping', (done) => {
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

			it('should properly detect _id.path and extract from the model', (done) => {
				let _id;

				mockModel.identity = {
					docId : 'test-id'
				};

				mapper.on('identity', (id) => (_id = id));

				mapper.validate(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(_id);
					_id.should.equal('test-id');

					return done();
				});
			});

			it('should not raise identity event when _id is not found', (done) => {
				let _id;

				mapper.on('identity', (id) => (_id = id));

				delete mockModel.identity;

				mapper.validate(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.not.exist(_id);

					return done();
				});
			});
		});

		describe('#validate - sub-document arrays', () => {
			it('should handle arrays and sub-documents elegantly', (done) => {
				mockModel.strictDynamicSubDocument = [
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

				mapper.validate(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);
					should.exist(result.strictDynamicSubDocument);
					result.strictDynamicSubDocument.should.have.length(2);

					return done();
				});
			});

			it('should handle validation of sub-document arrays required fields correctly', (done) => {
				mockModel.strictDynamicSubDocument = [
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

				delete mockModel.strictDynamicSubDocument[1].someRequiredInteger;

				mapper.validate(mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal(
						'field strictDynamicSubDocument[1].someRequiredInteger is required');

					return done();
				});
			});

			it('should handle validation of sub-document arrays invalid values correctly', (done) => {
				mockModel.strictDynamicSubDocument = [
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument)),
					JSON.parse(JSON.stringify(mockModel.strictDynamicSubDocument))];

				mockModel.strictDynamicSubDocument[1].someRequiredInteger = 'not an integer';

				mapper.validate(mockModel, (err, result) => {
					should.exist(err);
					should.not.exist(result);

					err.message.should.equal(
						'strictDynamicSubDocument[1].someRequiredInteger contains an invalid value (not an integer) for type integer');

					return done();
				});
			});

			it('should handle validation of string type arrays correctly', (done) => {
				mockModel.subDocument.arrayOfStrings = ['string 1', 'string 2'];

				mapper.validate(mockModel, (err, result) => {
					if (err) {
						return done(err);
					}

					should.exist(result);

					return done();
				});
			});
		});

		describe('#verifyConnection', () => {
			after(() => {
				nock.cleanAll();
			});

			it('should properly initialize and verify connection to elasticsearch', (done) => {
				nock('http://localhost:9200')
					.head('/test-index')
					.reply(200, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return { statusCode : 200 };
					})
					.put('/test-index/_mapping')
					.reply(201, (uri, body) => {
						requestBody = body;
						requestUri = uri;
						isUpdatedMapping = true;

						return { acknowledged : true };
					});

				mapper._isInitialized = false;

				mapper.verifyConnection((err) => {
					if (err) {
						return done(err);
					}

					mapper._isInitialized.should.be.true;

					return done();
				});
			});

			it('should properly initialize and verify connection to elasticsearch (Promise)', (done) => {
				nock('http://localhost:9200')
					.head('/test-index')
					.reply(200, (uri, body) => {
						requestBody = body;
						requestUri = uri;

						return { statusCode : 200 };
					})
					.put('/test-index/_mapping')
					.reply(201, (uri, body) => {
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
