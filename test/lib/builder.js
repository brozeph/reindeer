/*eslint no-magic-numbers:0*/
/*eslint no-unused-expressions:0*/
var
	builder,
	chai = require('chai'),
	should = chai.should(),

	QueryBuilder = require('../../lib/builder.js');

describe('builder', function () {
	'use strict';

	beforeEach(function () {
		builder = new QueryBuilder(['field']);
	});

	describe('#buildQuery', function () {

		it('should return a match_all query if query is empty', function () {
			var query = builder.buildQuery({});

			should.exist(query.query['match_all']);
		});

		it('should translate keyword filters', function () {
			var query = builder.buildQuery({
				'filters' : {
					'keyword' : 'test search'
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must);
			query.query.filtered.query.bool.must.should.be.a('array');
		});

		it('should build notEqual queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'notEqual' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must_not);
			query.query.filtered.query.bool.must_not.should.be.a('array');
		});

		it('should build mandatory exact queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'exact' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must);
			query.query.filtered.query.bool.must.should.be.a('array');
		});

		it('should build mandatory startsWith queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'beginsWith' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must);
			query.query.filtered.query.bool.must.should.be.a('array');
		});

		it('should build mandatory endsWith queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'endsWith' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must);
			query.query.filtered.query.bool.must.should.be.a('array');
		});

		it('should build mandatory contains queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'contains' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			should.exist(query.query.filtered.query.bool.must);
			query.query.filtered.query.bool.must.should.be.a('array');
		});

		it('should build mandatory exists queries for fields it is not expecting', function () {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'exists' : 'test'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
		});

		it('should build optional contains queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'contains' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional exact queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'exact' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional beginsWith queries for fields it is not expecting', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'beginsWith' : {
							'fields' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional endsWith queries for fields it is not expecting', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'endsWith' : {
							'fields' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional exact queries for fields it is not expecting', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'exact' : {
							'fields' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional contains queries for fields it is not expecting', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'contains' : {
							'fields' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional greaterThan queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'gt' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional greaterThanEqual queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'greaterThanEqual' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional lessThan queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'lt' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional lessThanEqual queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'lessThanEqual' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional missing queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'missing' : 'field'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.filter);
			should.exist(query.query.filtered.filter.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build optional notEqual queries', function () {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'ne' : {
							'field' : '10'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.filtered);
			should.exist(query.query.filtered.query);
			should.exist(query.query.filtered.query.bool);
			// This is as far as we can test. chai stumbles over the fact that
			// the query has a should property, which is a "reserved word" in
			// this area
		});

		it('should build asc sort parameters', function () {
			var query = builder.buildQuery({
				'sort' : {
					'asc' : 'field'
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
		});

		it('should build desc sort parameters', function () {
			var query = builder.buildQuery({
				'sort' : {
					'desc' : 'field'
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
		});

		it('should build pagination parameters', function () {
			var query = builder.buildQuery({
				'start' : 10,
				'count' : 10
			});

			should.exist(query.query);
			should.exist(query.from);
			should.exist(query.size);
		});
	});
});
