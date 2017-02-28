/*eslint no-undefined:0*/
var validators = require('./validators');

module.exports = function (matchFields, diagnosticsFilterKey, self) {
	'use strict';

	self = self || {};

	function buildFilters (filterSet) {
		var
			filters = [],
			getMatch = function (field, value, isPhrase) {
				var filter = {
					match : {}
				};

				isPhrase = isPhrase || false;

				filter.match[field] = {
					query : value
				};

				if (isPhrase) {
					filter.match[field].type = 'phrase';
				} else {
					filter.match[field].operator = 'and';
				}

				return filter;
			},
			getMatches = function (field, value) {
				if (typeof value === 'string' && /\,/g.test(value)) {
					value = value.split(/\,/g);
				}

				if (Array.isArray(value)) {
					return value.map((item) => {
						return getMatch(field, item);
					});
				}

				return [getMatch(field, value)];
			},
			getRange = function (field, value) {
				var filter = {
					range : {}
				};

				filter.range[field] = value;

				return filter;
			},
			getTerm = function (field, value) {
				var filter = {
					term : {}
				};

				filter.term[field] = value;

				return filter;
			},
			getTerms = function (field, value) {
				if (typeof value === 'string' && /\,/g.test(value)) {
					value = value.split(/\,/g);
				}

				if (Array.isArray(value)) {
					return value.map((item) => {
						return getTerm(field, item);
					});
				}

				return [getTerm(field, value)];
			},
			gt,
			gte,
			lt,
			lte,
			missingFilter;

		if (filterSet.beginsWith) {
			Object.keys(filterSet.beginsWith).forEach((field) => {
				if (matchFields.indexOf(field) >= 0) {
					filters.push(
						getMatch(
							field,
							[filterSet.beginsWith[field]].join('')));

					return;
				}

				filters.push(
					getTerm(
						field,
						[filterSet.beginsWith[field], '*'].join('')));
			});
		}

		if (filterSet.contains) {
			Object.keys(filterSet.contains).forEach((field) => {
				if (matchFields.indexOf(field) >= 0) {
					filters.push(
						getMatch(
							field,
							[filterSet.contains[field]].join('')));

					return;
				}

				filters.push(
					getTerm(
						field,
						['*', filterSet.contains[field], '*'].join('')));
			});
		}

		if (filterSet.endsWith) {
			Object.keys(filterSet.endsWith).forEach((field) => {
				if (matchFields.indexOf(field) >= 0) {
					filters.push(
						getMatch(
							field,
							[filterSet.endsWith[field]].join('')));

					return;
				}

				filters.push(
					getTerm(
						field,
						['*', filterSet.endsWith[field]].join('')));
			});
		}

		if (filterSet.exact) {
			Object.keys(filterSet.exact).forEach((field) => {
				if (matchFields.indexOf(field) >= 0) {
					filters = filters.concat(
						getMatches(
							field,
							[filterSet.exact[field]].join(''),
							true));

					return;
				}

				filters = filters.concat(
					getTerms(
						field,
						filterSet.exact[field]));
			});
		}

		// handle checks for the existence of a field
		if (filterSet.exists) {
			if (typeof filterSet.exists === 'string' && /\,/g.test(filterSet.exists)) {
				filterSet.exists = filterSet.exists.split(/\,/g);
			}

			if (!Array.isArray(filterSet.exists)) {
				filterSet.exists = [filterSet.exists];
			}

			filterSet.exists.forEach((field) => {
				var existsFilter = {
					exists : {
						field : field
					}
				};

				filters.push(existsFilter);
			});
		}

		if (filterSet.greaterThan || filterSet.gt) {
			gt = filterSet.greaterThan || filterSet.gt;

			Object.keys(gt).forEach((field) => {
				filters.push(getRange(field, {
					gt : gt[field]
				}));
			});
		}

		if (filterSet.greaterThanEqual || filterSet.gte) {
			gte = filterSet.greaterThanEqual || filterSet.gte;

			Object.keys(gte).forEach((field) => {
				filters.push(getRange(field, {
					gte : gte[field]
				}));
			});
		}

		if (filterSet.lessThan || filterSet.lt) {
			lt = filterSet.lessThan || filterSet.lt;

			Object.keys(lt).forEach((field) => {
				filters.push(getRange(field, {
					lt : lt[field]
				}));
			});
		}

		if (filterSet.lessThanEqual || filterSet.lte) {
			lte = filterSet.lessThanEqual || filterSet.lte;

			Object.keys(lte).forEach((field) => {
				filters.push(getRange(field, {
					lte : lte[field]
				}));
			});
		}

		// handle checks for the non-existence of a field
		if (filterSet.missing) {
			if (typeof filterSet.missing === 'string' && /\,/g.test(filterSet.missing)) {
				filterSet.missing = filterSet.missing.split(/\,/g);
			}

			if (!Array.isArray(filterSet.missing)) {
				filterSet.missing = [filterSet.missing];
			}

			filterSet.missing.forEach((field) => {
				missingFilter = {
					missing : {
						existence : true,
						field : field,
						'null_value' : true
					}
				};

				filters.push(missingFilter);
			});
		}

		if (filterSet.ne) {
			Object.keys(filterSet.ne).forEach((field) => {
				filters.push(getMatch(
					field,
					[filterSet.ne[field]].join('')));
			});
		}

		// return the array of filters to the caller
		return filters;
	}

	// takes queryOptions typically used directly by Mongoose Middleware
	// and converts them to a formatted ElasticSearch query
	self.buildQuery = function (queryOptions) {
		var
			defaultQuery = {
				'match_all' : {}
			},
			filter,
			filterBool,
			filters = queryOptions.filters,
			hasFilterFilters = false,
			hasQueryFilters = false,
			mustNot,
			query = {
				query : {
					filtered : {
						query : {
							bool : {}
						},
						filter : {
							bool : {}
						}
					}
				}
			},
			queryBool,
			sortFields,
			sortOptions = [];

		// reference bool for simplicity
		filterBool = query.query.filtered.filter.bool;
		queryBool = query.query.filtered.query.bool;

		// keyword search
		if (filters && filters.keyword) {
			filter = {
				'query_string' : {
					query : filters.keyword
				}
			};

			queryBool.must = (queryBool.must || []).concat([filter]);
		}

		// add analytics filters to the query
		if (filters && filters.diagnostics && diagnosticsFilterKey) {
			if (!Array.isArray(filters.diagnostics)) {
				if (/\,/g.test(filters.diagnostics)) {
					filters.diagnostics = filters.diagnostics.split(/\,/);
				} else {
					filters.diagnostics = [filters.diagnostics];
				}
			}

			filters.diagnostics.forEach((stat) => {
				if (typeof diagnosticsFilterKey[stat] !== 'undefined') {
					filterBool.must = (filterBool.must || []).concat(
						diagnosticsFilterKey[stat]());
				}
			});
		}

		// add mandatory filters to the query
		if (filters && filters.mandatory) {
			// notEqual queries need to be processed differently than normal
			// match queries
			if (filters.mandatory.ne || filters.mandatory.notEqual || filters.mandatory.notEqualTo) {
				mustNot = {
					'ne': filters.mandatory.ne || filters.mandatory.notEqual || filters.mandatory.notEqualTo
				}

				// remove notEqual parameters so they aren't processed again
				filters.mandatory.ne = undefined;
				filters.mandatory.notEqual = undefined;
				filters.mandatory.notEqualTo = undefined;

				buildFilters(mustNot).forEach((filter) => {
					// right now, only exact match is support
					if (filter.match) {
						queryBool['must_not'] = (queryBool['must_not'] || []).concat(filter);
						return;
					}
				});
			}


			buildFilters(filters.mandatory).forEach((filter) => {
				if (filter.match) {
					queryBool.must = (queryBool.must || []).concat(filter);

					return;
				}

				filterBool.must = (filterBool.must || []).concat(filter);
			});
		}

		// add optional filters to the query
		if (filters && filters.optional) {
			buildFilters(filters.optional).forEach((filter) => {
				if (filter.match) {
					queryBool.should = (Array.isArray(queryBool.should) ? queryBool.should : [])
						.concat(filter);

					return;
				}

				filterBool.should = (Array.isArray(filterBool.should) ? filterBool.should : [])
					.concat(filter);
			});
		}

		// add projection
		if (filters && filters.field) {
			// ensure array
			if (!Array.isArray(filters.field)) {
				if (/\,/g.test(filters.field)) {
					filters.field = filters.field.split(/\,/);
				} else {
					filters.field = [filters.field];
				}
			}

			query._source = (query._source || []).concat(filters.field);
		}

		if (queryOptions.sort) {

			if (typeof queryOptions.sort === 'string') {
				sortOptions = queryOptions.sort.split(/\,/g).map((field) => {
					return field.trim();
				});
			}

			if (Array.isArray(queryOptions.sort) && queryOptions.sort.length) {
				sortOptions = queryOptions.sort;
			}

			if (validators.isPOJO(queryOptions.sort)) {
				Object.keys(queryOptions.sort).forEach((property) => {
					// support for more traditional way of supplying asc params
					if (property === 'asc') {
						sortFields = Array.isArray(queryOptions.sort.asc) ?
							queryOptions.sort.asc :
							[queryOptions.sort.asc];

						sortOptions = sortOptions.concat(sortFields);
						return;
					}

					// support for more traditional way of supplying desc params
					if (property === 'desc') {
						sortFields = Array.isArray(queryOptions.sort.desc) ?
							queryOptions.sort.desc :
							[queryOptions.sort.desc];

						sortFields = sortFields.map((field) => {
							return '-' + field;
						});

						sortOptions = sortOptions.concat(sortFields);
						return;
					}

					if (queryOptions.sort[property] === 'desc' ||
						parseInt(queryOptions.sort[property], 10) < 0) {
						sortOptions.push('-' + property);
						return;
					}

					sortOptions.push(property);
				});
			}

			query.sort = query.sort || [];

			sortOptions.forEach((field) => {
				var sortValue = {};

				if (field.startsWith('-')) {
					sortValue[field.substring(1)] = 'desc';
				} else {
					sortValue[field] = 'asc';
				}

				query.sort.push(sortValue);

			});
		}

		// add pagination details
		if (typeof queryOptions.start !== 'undefined' && !isNaN(queryOptions.start)) {
			query.from = parseInt(queryOptions.start, 10);
		}

		if (typeof queryOptions.count !== 'undefined' && !isNaN(queryOptions.count)) {
			query.size = parseInt(queryOptions.count, 10);
		}

		// if no query booleans were applied, remove query
		hasQueryFilters =
			(queryBool.should && queryBool.should.length > 0) ||
			(queryBool.must && queryBool.must.length > 0) ||
			(queryBool.must_not && queryBool.must_not.length > 0);

		if (!hasQueryFilters) {
			query.query.filtered.query = undefined;
		}

		// if no filter booleans were applied, remove filter
		hasFilterFilters =
			(filterBool.should && filterBool.should.length > 0) ||
			(filterBool.must && filterBool.must.length > 0) ||
			(filterBool.must_not && filterBool.must_not.length > 0);

		if (!hasFilterFilters) {
			query.query.filtered.filter = undefined;
		}

		if (!hasFilterFilters && !hasQueryFilters) {
			query.query = defaultQuery;
		}

		// return to caller
		return query;
	};

	return self;
};
