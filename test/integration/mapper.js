/* eslint no-magic-numbers : 0 */
/* eslint no-unused-expressions : 0 */
import chai from 'chai';
import { Mapper } from '../../src/mapper.js';
import { v4 as uuid } from 'uuid';

const
	catsMapping = require('../cats-mapping.json'),
	should = chai.should();

describe('mapper', () => {
	let
		blue = {
			animalId : uuid().replace(/\-/g, ''),
			breed : 'Domestic Shorthair',
			name : 'Blue'
		},
		catsMapper = new Mapper({
				_index : 'test-index',
				_type : 'test-type'
			},
			catsMapping),
		cooper = {
			animalId : uuid().replace(/\-/g, ''),
			breed : 'Domestic Shorthair',
			name : 'Cooper'
		},
		dugald = {
			attributes : {
				height: 8.7,
				weight : 21.2
			},
			breed : 'Siamese',
			name : 'Dugald'
		},
		hamish = {
			animalId : uuid().replace(/\-/g, ''),
			breed : 'Manx',
			name : 'Hamish'
		},
		keelin = {
			animalId : uuid().replace(/\-/g, ''),
			breed : 'Unknown - longhair',
			name : 'Keelin',
			randomField : 'random data',
			randomNestedField : {
				randomData: 'random data'
			}
		};

	after((done) => {
		return catsMapper._client.indices.deleteIndex(done);
	});

	describe('#bulkCreate', () => {
		it('should properly create in bulk', (done) => {
			let
				docList = [blue, cooper, hamish, keelin],
				esIdList,
				idList = docList.map((cat) => {
					return cat.animalId;
				});

			catsMapper.on('identity', (ids) => (esIdList = ids));

			catsMapper.bulkCreate(idList, docList, (err, result) => {
				if (err) {
					return done(err);
				}

				should.exist(result);
				should.not.exist(esIdList);
				result.should.have.length(4);
				should.exist(result[0]);
				should.exist(result[1]);
				should.exist(result[2]);
				should.exist(result[3]);

				catsMapper.get(keelin.animalId, (err, catModel) => {
					if (err) {
						return done(err);
					}

					should.exist(catModel);
					should.exist(catModel.name);
					catModel.name.should.equal('Keelin');

					return done();
				});
			});
		});

		it('should properly error when bulk creating documents that already exist', (done) => {
			let
				docList = [hamish, keelin],
				idList = docList.map((cat) => {
					return cat.animalId;
				});

			catsMapper.bulkCreate(idList, docList)
				.then((err, result) => {
					should.exist(err);
					should.not.exist(result);
					should.exist(err.statusCode);
					err.statusCode.should.equal(409);

					return done();
				})
				.catch((err) => {
					should.exist(err);
					return done();
				});
		});

		it('should properly create in bulk without ids', (done) => {
			let
				docList = [
					JSON.parse(JSON.stringify(hamish)),
					JSON.parse(JSON.stringify(keelin)),
					JSON.parse(JSON.stringify(dugald))
				],
				esIdList;

			delete docList[0].animalId;
			delete docList[1].animalId;

			catsMapper.on('identity', (ids) => (esIdList = ids));

			catsMapper.bulkCreate(docList)
				.then((result) => {
					should.exist(result);
					should.exist(esIdList);
					should.exist(result[0]);
					should.exist(result[1]);
					esIdList.should.have.length(3);

					return done();
				})
				.catch(done);
		});
	});

	describe('#bulkGet', () => {
		it('should properly get in bulk', (done) => {
			let idList = [hamish, keelin].map((cat) => {
				return cat.animalId;
			});

			catsMapper.bulkGet(idList)
				.then((catModels) => {
					should.exist(catModels);
					catModels.should.have.length(2);
					catModels[0].name.should.equal(hamish.name);

					return done();
				})
				.catch(done);
		});

		it('should properly get in bulk with _source parameter', (done) => {
			let idList = [hamish, keelin].map((cat) => {
				return cat.animalId;
			});

			catsMapper.bulkGet(idList, ['name'], (err, catModels) => {
				if (err) {
					return done(err);
				}

				should.exist(catModels);
				catModels.should.have.length(2);
				Object.keys(catModels[0]).should.have.length(1);
				Object.keys(catModels[1]).should.have.length(1);

				return done();
			});
		});

		it('should properly return empty array when no results are found', (done) => {
			catsMapper.bulkGet(['not-valid-id-1', 'not-valid-id-2'], (err, catModels) => {
				if (err) {
					return done(err);
				}

				should.exist(catModels);
				catModels.should.have.length(0);

				return done();
			});
		});
	});

	describe('#bulkUpdate', () => {
		it('should not update documents that do not exist, in bulk', (done) => {
			let
				docList = [
					JSON.parse(JSON.stringify(hamish)),
					JSON.parse(JSON.stringify(keelin))
				],
				idList = docList.map((cat, i) => {
					return ['not-valid-id', i].join('-');
				});

			docList[0].attributes = {
				height: 8.6,
				weight : 16.1
			};

			docList[1].attributes = {
				height: 6.2,
				weight : 14.7
			};

			catsMapper.bulkUpdate(idList, docList, (err, result) => {
				should.exist(err);
				should.not.exist(result);
				should.exist(err.statusCode);
				err.statusCode.should.equal(404);

				return done();
			});
		});

		it('should update documents in bulk', (done) => {
			let
				docList = [
					JSON.parse(JSON.stringify(hamish)),
					JSON.parse(JSON.stringify(keelin))
				],
				idList = docList.map((cat) => {
					return cat.animalId;
				});

			docList[0].attributes = {
				height: 8.6,
				weight : 16.1
			};

			docList[1].attributes = {
				height: 6.2,
				weight : 14.7
			};

			catsMapper.bulkUpdate(idList, docList, (err, result) => {
				if (err) {
					return done(err);
				}

				should.exist(result);

				result.should.have.length(2);
				should.exist(result[0]);
				should.exist(result[1]);

				catsMapper.get(keelin.animalId, (err, catModel) => {
					if (err) {
						return done(err);
					}

					should.exist(catModel);
					should.exist(catModel.name);
					should.exist(catModel.attributes);
					should.exist(catModel.attributes.height);
					catModel.name.should.equal('Keelin');
					catModel.attributes.height.should.equal(6.2);

					return done();
				});
			});
		});
	});

	describe('#bulkUpsert', () => {
		it('should upsert documents in bulk', (done) => {
			let
				docList = [
					JSON.parse(JSON.stringify(hamish)),
					JSON.parse(JSON.stringify(keelin))
				],
				idList = docList.map((cat) => {
					return cat.name;
				});

			catsMapper.bulkUpsert(idList, docList)
				.then((result) => {
					should.exist(result);

					result.should.have.length(2);
					should.exist(result[0]);
					should.exist(result[1]);

					catsMapper.get(keelin.name, (err, catModel) => {
						if (err) {
							return done(err);
						}

						should.exist(catModel);
						should.exist(catModel.name);

						return done();
					});
				})
				.catch(done);
		});
	});

	describe('#search', () => {
		it('should properly search', (done) => {
			let
				query = {
					from : 0,
					query : {
						'match_all' : {}
					},
					size : 500
				},
				summary;

			catsMapper.on('summary', (searchSummary) => (summary = searchSummary));

			catsMapper.search(query, (err, catModels) => {
				if (err) {
					return done(err);
				}

				should.exist(catModels);
				should.exist(summary);
				should.exist(summary.total);
				catModels.should.have.length(summary.total);

				return done();
			});
		});
	});

	describe('#bulkDelete', () => {
		it('should properly delete in bulk', (done) => {
			catsMapper.bulkDelete([hamish.animalId, keelin.animalId], (err) => {
				if (err) {
					return done(err);
				}

				catsMapper.get(hamish.animalId)
					.then((retrievedDoc) => {
						should.not.exist(retrievedDoc);

						catsMapper.get(blue.animalId, (err, retrievedDoc) => {
							if (err) {
								return done(err);
							}

							should.exist(retrievedDoc);

							return done();
						});
					})
					.catch(done);
			});
		});
	});

	describe('#create', () => {
		it('should properly create', (done) => {
			let _id;

			catsMapper.on('identity', (id) => (_id = id));

			catsMapper.create(hamish.animalId, hamish, (err, insertedDoc) => {
				if (err) {
					return done(err);
				}

				should.exist(insertedDoc);
				should.not.exist(_id);

				insertedDoc.animalId.should.equal(hamish.animalId);
				insertedDoc.breed.should.equal(hamish.breed);
				insertedDoc.name.should.equal(hamish.name);

				return done();
			});
		});

		it('should properly create without _id', (done) => {
			let _id;

			catsMapper.on('identity', (id) => (_id = id));

			catsMapper.create(dugald)
				.then((createdDoc) => {
					should.exist(createdDoc);
					should.exist(_id);

					should.not.exist(dugald.animalId);
					createdDoc.breed.should.equal(dugald.breed);
					createdDoc.name.should.equal(dugald.name);

					// assign _id for later
					dugald.animalId = _id;

					return done();
				})
				.catch(done);
		});

		it('should properly create and obey dynamic=false mapping', (done) => {
			catsMapper.create(keelin.animalId, keelin, (err, insertedDoc) => {
				if (err) {
					return done(err);
				}

				should.exist(insertedDoc);

				insertedDoc.animalId.should.equal(keelin.animalId);
				insertedDoc.breed.should.equal(keelin.breed);
				insertedDoc.name.should.equal(keelin.name);
				should.not.exist(insertedDoc.randomField);
				should.not.exist(insertedDoc.randomNestedField.randomData);

				return done();
			});
		});

		it('should properly require fields', (done) => {
			catsMapper.create({ breed : 'domestic shorthair' }, (err, insertedDoc, animalId) => {
				should.exist(err);
				should.not.exist(insertedDoc);
				should.not.exist(animalId);

				return done();
			});
		});

		it('should return error if document already exists', (done) => {
			catsMapper.create(hamish.animalId, hamish, (err, insertedDoc) => {
				should.exist(err);
				should.not.exist(insertedDoc);

				return done();
			});
		});
	});

	describe('#delete', () => {
		it('should properly delete a newly created doc', (done) => {
			catsMapper.delete(dugald.animalId)
				.then(() => {
					catsMapper.get(dugald.animalId, (err, retrievedDoc) => {
						if (err) {
							return done(err);
						}

						should.not.exist(retrievedDoc);

						return done();
					});
				})
				.catch(done);
		});

		/* Elasticsearch has removed deleteByQuery functionality in the core and moved capability to a plugin */
		/* https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-delete-by-query.html */
	});

	describe('#get', () => {
		it('should properly retrieve', (done) => {
			catsMapper.get(hamish.animalId, (err, retrievedDoc) => {
				if (err) {
					return done(err);
				}

				should.exist(retrievedDoc);

				retrievedDoc.animalId.should.equal(hamish.animalId);
				retrievedDoc.breed.should.equal(hamish.breed);
				retrievedDoc.name.should.equal(hamish.name);

				return done();
			});
		});

		it('should properly return nothing when not found', (done) => {
			catsMapper.get('doc-not-exists', (err, retrievedDoc) => {
				if (err) {
					return done(err);
				}

				should.not.exist(retrievedDoc);

				return done();
			});
		});

		it('should properly handle _source parameter', (done) => {
			catsMapper.update(
				keelin.animalId,
				{
					attributes : {
						height: 8.7,
						weight : 21.2
					}
				},
				function (err) {
					if (err) {
						return done(err);
					}


					catsMapper.get(
						keelin.animalId,
						['animalId', 'breed', 'name'],
						function (err, partialDoc) {
							if (err) {
								return done(err);
							}

							should.exist(partialDoc);
							Object.keys(partialDoc).should.have.length(3);

							return done();
						});
				});
		});
	});

	describe('#update', () => {
		it('should properly update a doc', (done) => {
			keelin.breed = 'Russian Blue';
			catsMapper.update(keelin.animalId, keelin, (err, updatedDoc) => {
				if (err) {
					return done(err);
				}

				should.exist(updatedDoc);

				updatedDoc.animalId.should.equal(keelin.animalId);
				updatedDoc.breed.should.equal(keelin.breed);
				updatedDoc.name.should.equal(keelin.name);

				return done();
			});
		});

		it('should return an error when attempting to update a non-existent doc', (done) => {
			dugald.name = 'Dugald the big cat';

			catsMapper.update('no-matching-id', dugald)
				.then(() => done(new Error('should return error when attempting to update a non-existent doc')))
				.catch((err) => {
					should.exist(err);

					return done();
				});
		});
	});

	describe('#upsert', () => {
		it('should properly error when Id is not supplied and the document does not exist', (done) => {
			catsMapper.upsert(dugald, (err, upsertedDoc) => {
				should.exist(err);
				should.not.exist(upsertedDoc);

				return done();
			});
		});

		it('should properly create if the document does not exist', (done) => {
			dugald.animalId = uuid().replace(/\-/g, '');

			catsMapper.upsert(dugald.animalId, dugald)
				.then((upsertedDoc) => {
					should.exist(upsertedDoc);

					return done();
				})
				.catch(done);
		});

		it('should properly create if the document contains fields not contained in mapping', (done) => {
			keelin.animalId = uuid().replace(/\-/g, '');

			catsMapper.upsert(keelin.animalId, keelin, (err, upsertedDoc) => {
				if (err) {
					return done(err);
				}

				should.exist(upsertedDoc);
				should.not.exist(upsertedDoc.randomField);
				should.not.exist(upsertedDoc.randomNestedField.randomData);

				return done();
			});
		});
	});
});
