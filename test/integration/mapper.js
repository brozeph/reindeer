var
	chai = require('chai'),
	should = chai.should(),
	uuid = require('uuid'),

	Mapper = require('../../lib/mapper.js'),
	catsMapping = require('../cats-mapping.json');


describe('mapper', function () {
	'use strict';

	var
		catsMapper,
		dugald = {
			breed : 'Siamese',
			name : 'Dugald',
			attributes : {
				height: 8.7,
				weight : 21.2
			}
		},
		hamish = {
			animalId : uuid.v4().replace(/\-/g, ''),
			breed : 'Manx',
			name : 'Hamish'
		},
		keelin = {
			animalId : uuid.v4().replace(/\-/g, ''),
			breed : 'Unknown - longhair',
			name : 'Keelin',
			randomField : 'random data'
		};

	after(function (done) {
		catsMapper._client.indices.deleteIndex(function (err) {
			if (err) {
				console.error(err);
			}

			return done(err);
		});
	});

	before(function () {
		catsMapper = new Mapper({
			_index : 'test-index',
			_type : 'test-type'
		}, catsMapping);
	});

	describe('#create', function () {
		it('should properly create', function (done) {
			catsMapper.create(hamish.animalId, hamish, function (err, insertedDoc) {
				should.not.exist(err);
				should.exist(insertedDoc);

				insertedDoc.animalId.should.equal(hamish.animalId);
				insertedDoc.breed.should.equal(hamish.breed);
				insertedDoc.name.should.equal(hamish.name);

				return done();
			});
		});

		it('should properly create without _id', function (done) {
			catsMapper.create(dugald, function (err, createdDoc, animalId) {
				should.not.exist(err);
				should.exist(createdDoc);
				should.exist(animalId);

				should.not.exist(dugald.animalId);
				createdDoc.breed.should.equal(dugald.breed);
				createdDoc.name.should.equal(dugald.name);

				// assign _id for later
				dugald.animalId = animalId;

				return done();
			});
		});

		it('should properly create and obey dynamic=false mapping', function (done) {
			catsMapper.create(keelin.animalId, keelin, function (err, insertedDoc) {
				should.not.exist(err);
				should.exist(insertedDoc);

				insertedDoc.animalId.should.equal(keelin.animalId);
				insertedDoc.breed.should.equal(keelin.breed);
				insertedDoc.name.should.equal(keelin.name);
				should.not.exist(insertedDoc.randomField);

				return done();
			});
		});

		it('should properly require fields', function (done) {
			catsMapper.create({ breed : 'domestic shorthair' }, function (err, insertedDoc, animalId) {
				should.exist(err);
				should.not.exist(insertedDoc);
				should.not.exist(animalId);

				return done();
			});
		});

		it('should return error if document already exists', function (done) {
			catsMapper.create(hamish.animalId, hamish, function (err, insertedDoc) {
				should.exist(err);
				should.not.exist(insertedDoc);

				return done();
			});
		});
	});

	describe('#delete', function () {
		it('should properly delete a newly created doc', function (done) {
			catsMapper.delete(dugald.animalId, function (err) {
				should.not.exist(err);

				catsMapper.get(dugald.animalId, function (err, retrievedDoc) {
					should.not.exist(err);
					should.not.exist(retrievedDoc);

					return done();
				});
			});
		});
	});

	describe('#get', function () {
		it('should properly retrieve', function (done) {
			catsMapper.get(hamish.animalId, function (err, retrievedDoc) {
				should.not.exist(err);
				should.exist(retrievedDoc);

				retrievedDoc.animalId.should.equal(hamish.animalId);
				retrievedDoc.breed.should.equal(hamish.breed);
				retrievedDoc.name.should.equal(hamish.name);

				return done();
			});
		});

		it('should properly return nothing when not found', function (done) {
			catsMapper.get('doc-not-exists', function (err, retrievedDoc) {
				should.not.exist(err);
				should.not.exist(retrievedDoc);

				return done();
			});
		});
	});

	describe('#update', function () {
		it('should properly update a doc', function (done) {
			keelin.breed = 'Russian Blue';
			catsMapper.update(keelin.animalId, keelin, function (err, updatedDoc) {
				should.not.exist(err);
				should.exist(updatedDoc);

				updatedDoc.animalId.should.equal(keelin.animalId);
				updatedDoc.breed.should.equal(keelin.breed);
				updatedDoc.name.should.equal(keelin.name);

				return done();
			});
		});

		it('should return an error when attempting to update a non-existent doc', function (done) {
			dugald.name = 'Dugald the big cat';

			catsMapper.update('no-matching-id', dugald, function (err, updatedDoc) {
				should.exist(err);
				should.not.exist(updatedDoc);

				return done();
			});
		});
	});

	describe('#upsert', function () {
		it('should properly error when Id is not supplied and the document does not exist', function (done) {
			catsMapper.upsert(dugald, function (err, upsertedDoc) {
				should.exist(err);
				should.not.exist(upsertedDoc);

				return done();
			});
		});

		it('should properly create if the document does not exist', function (done) {
			dugald.animalId = uuid.v4().replace(/\-/g, '');

			catsMapper.upsert(dugald.animalId, dugald, function (err, upsertedDoc) {
				should.not.exist(err);
				should.exist(upsertedDoc);

				return done();
			});
		});
	});
});
