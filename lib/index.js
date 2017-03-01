var
	Mapper = require('./mapper'),
	QueryBuilder = require('./builder');


module.exports = (function (self) {
	'use strict';

	self.QueryBuilder = QueryBuilder;
	self.Mapper = Mapper;

	return self;
}({}));
