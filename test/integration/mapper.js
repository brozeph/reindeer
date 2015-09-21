var
	chai = require('chai'),
	should = chai.should(),
	uuid = require('uuid'),

	Mapper = require('../../lib/mapper.js'),
	catsMapping = require('../cats-mapping.json');


describe('mapper', function () {
	'use strict';

	var catsMapper;

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

	describe('#constructor', function () {
		var hamish = {
			animalId : uuid.v4().replace(/\-/g, ''),
			breed : 'Manx',
			name : 'Hamish'
		};

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
	});
});
