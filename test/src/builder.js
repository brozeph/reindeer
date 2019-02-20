/* eslint no-magic-numbers : 0 */
/* eslint no-unused-expressions : 0 */
import chai from 'chai';
import { QueryBuilder } from '../../src/builder.js';

const should = chai.should();

describe('builder', () => {
	let builder;

	beforeEach(() => {
		builder = new QueryBuilder(
			['field', 'testField'],
			{
				'missingTestField' : () => [{
					missing : {
						field : 'test'
					}
				}]
			}
		);
	});

	describe('#buildQuery', () => {
		it('should return a match_all query if query is empty', () => {
			var query = builder.buildQuery({});

			should.exist(query.query['match_all']);
		});

		it('should translate keyword filters', () => {
			var query = builder.buildQuery({
				'filters' : {
					'keyword' : 'test search'
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build notEqual queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.must_not);
			query.query.bool.must_not.should.be.a('array');
		});

		it('should build notEqual queries using ne syntax', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'ne' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must_not);
			query.query.bool.must_not.should.be.a('array');
		});

		it('should build notEqual queries using notEqualTo syntax', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'notEqualTo' : {
							'field' : 'string'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must_not);
			query.query.bool.must_not.should.be.a('array');
		});

		it('should build mandatory exact queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory startsWith queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory endsWith queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory contains queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory exists queries for fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'exists' : 'test'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory exists queries for many fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'exists' : 'test,test1,test2'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build mandatory missing queries for fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'missing' : 'test'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must_not);
			query.query.bool.must_not.should.be.a('array');
		});

		it('should build mandatory missing queries for fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'missing' : 'test,test1,test2'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must_not);
			query.query.bool.must_not.should.be.a('array');
		});

		it('should build optional contains queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional exact queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional beginsWith queries for fields it is not expecting', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional endsWith queries for fields it is not expecting', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional exact queries for fields it is not expecting', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional contains queries for fields it is not expecting', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional greaterThan queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional greaterThanEqual queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional greaterThanEqual queries using gte syntax', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'gte' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional lessThan queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional lessThanEqual queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional lessThanEqual queries using lte syntax', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'lte' : {
							'field' : 10
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional missing queries', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'missing' : 'field'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional missing queries for many fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'missing' : 'field,field1,field2'
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional notEqual queries', () => {
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
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build asc sort parameters', () => {
			var query = builder.buildQuery({
				'sort' : {
					'asc' : 'field'
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(1);
			query.sort[0].field.should.equal('asc');
		});

		it('should build asc sort with many parameters', () => {
			var query = builder.buildQuery({
				'sort' : {
					'asc' : ['field', 'field1', 'field2']
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('asc');
			query.sort[1].field1.should.equal('asc');
			query.sort[2].field2.should.equal('asc');
		});

		it('should build sort as array syntax, both asc and desc', () => {
			var query = builder.buildQuery({
				'sort' : ['field', '-field1', 'field2']
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('asc');
			query.sort[1].field1.should.equal('desc');
			query.sort[2].field2.should.equal('asc');
		});

		it('should build sort as string syntax, both asc and desc', () => {
			var query = builder.buildQuery({
				'sort' : 'field, -field1, field2'
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('asc');
			query.sort[1].field1.should.equal('desc');
			query.sort[2].field2.should.equal('asc');
		});

		it('should build sort with object syntax, both asc and desc', () => {
			var query = builder.buildQuery({
				'sort' : {
					'field' : 1,
					'field1' : -1,
					'field2' : 1
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('asc');
			query.sort[1].field1.should.equal('desc');
			query.sort[2].field2.should.equal('asc');
		});

		it('should build sort with object syntax, using asc and desc', () => {
			var query = builder.buildQuery({
				'sort' : {
					'field' : 'asc',
					'field1' : 'desc',
					'field2' : 'asc'
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('asc');
			query.sort[1].field1.should.equal('desc');
			query.sort[2].field2.should.equal('asc');
		});

		it('should build desc sort parameters', () => {
			var query = builder.buildQuery({
				'sort' : {
					'desc' : 'field'
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(1);
			query.sort[0].field.should.equal('desc');
		});

		it('should build desc sort with many parameters', () => {
			var query = builder.buildQuery({
				'sort' : {
					'desc' : ['field', 'field1', 'field2']
				}
			});

			should.exist(query.query);
			should.exist(query.sort);
			query.sort.should.be.a('array');
			query.sort.length.should.equal(3);
			query.sort[0].field.should.equal('desc');
			query.sort[1].field1.should.equal('desc');
			query.sort[2].field2.should.equal('desc');
		});

		it('should build pagination parameters', () => {
			var query = builder.buildQuery({
				'count' : 10,
				'start' : 10
			});

			should.exist(query.query);
			should.exist(query.from);
			should.exist(query.size);
		});

		it('should build query with many exact criteria', () => {
			var query = builder.buildQuery({
				'filters' : {
					'mandatory' : {
						'exact' : {
							'field' : ['string', 'test']
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.must);
			query.query.bool.must.should.be.a('array');
		});

		it('should build optional exact query with many criteria', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'exact' : {
							'fieldsss' : ['test', 'one', 'two']
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build optional exact query with many criteria input as a string', () => {
			var query = builder.buildQuery({
				'filters' : {
					'optional' : {
						'exact' : {
							'fieldsss' : 'test, one, two'
						}
					}
				}
			});

			should.exist(query.query);
			should.exist(query.query.bool);
			should.exist(query.query.bool.should);
			query.query.bool.should.should.be.a('array');
		});

		it('should build query for limiting returned fields', () => {
			var query = builder.buildQuery({
				'filters' : {
					'field' : 'one,two,three'
				}
			});

			should.exist(query.query);
			should.exist(query['_source']);
			query['_source'].should.be.a('array');
		});

		it('should build query for limiting returned fields when passed in as an array', () => {
			var query = builder.buildQuery({
				'filters' : {
					'field' : ['one', 'two', 'three']
				}
			});

			should.exist(query.query);
			should.exist(query['_source']);
			query['_source'].should.be.a('array');
		});

		it('should build query for limiting returned fields when only one is passed in', () => {
			var query = builder.buildQuery({
				'filters' : {
					'field' : 'three'
				}
			});

			should.exist(query.query);
			should.exist(query['_source']);
			query['_source'].should.be.a('array');
		});

		it('should build query for diagnostics', () => {
			var query = builder.buildQuery({
				'filters' : {
					'diagnostics' : 'missingTestField',
					'optional' : {
						'missing' : 'field'
					}
				}
			});

			should.exist(query);
		});

		it('should build query for many diagnostics', () => {
			var query = builder.buildQuery({
				'filters' : {
					'diagnostics' : 'missingTestField,test',
					'optional' : {
						'missing' : 'field'
					}
				}
			});

			should.exist(query);
		});
	});
});
